import json
import re
from pathlib import Path
from datetime import datetime

from services.usage_tracker import UsageTracker
from llm.groq_client import generate_response
from llm.prompt_templates import TESTER_PROMPT
from memory.project_memory import save_memory
from services.execution_stream import append_execution_step
from services.workspace_manager import workspace_manager


# ============================================================
# Helpers
# ============================================================

def _safe_read(path, max_chars=20000):
    try:
        return path.read_text(
            encoding="utf-8",
            errors="replace"
        )[:max_chars]
    except Exception:
        return ""


def _detect_project_stack(workspace_path):
    """
    Detect the generated project's technology stack.
    """

    workspace = Path(workspace_path)

    files = {
        p.name.lower()
        for p in workspace.rglob("*")
        if p.is_file()
    }

    stack = []

    if "package.json" in files:
        stack.append("node")

    if "requirements.txt" in files:
        stack.append("python")

    if "pyproject.toml" in files:
        stack.append("python")

    if "main.py" in files:
        stack.append("python")

    if "index.html" in files:
        stack.append("html")

    if "dockerfile" in files:
        stack.append("docker")

    if "docker-compose.yml" in files:
        stack.append("docker-compose")

    if "docker-compose.yaml" in files:
        stack.append("docker-compose")

    return stack


def _get_project_files(workspace_path):
    """
    Return relative project file paths.
    """

    try:
        return workspace_manager.list_files(
            workspace_path
        )
    except Exception:
        return []


def _run_command(
    workspace_path,
    command,
    timeout=120
):
    """
    Execute generated-project commands through the isolated sandbox.

    The tester must never execute generated code directly on the Aethera
    host. WorkspaceManager owns the Docker isolation policy.
    """

    print(
        f"[Tester] Running in sandbox: {command}"
    )

    result = workspace_manager.run_command(
        workspace_path=workspace_path,
        command=command,
        timeout=timeout,
        sandbox=True,
    )

    return result


def _coverage_unavailable():
    return {
        "line": None, "branch": None, "statement": None,
        "function": None, "status": "not_available",
    }


def _percent(covered, total):
    if isinstance(covered, (int, float)) and isinstance(total, (int, float)) and total:
        return round((covered / total) * 100, 2)
    return None


def _parse_coverage_summary(payload):
    """Normalize coverage.py/Jest/Vitest JSON summaries without inventing data."""
    if not isinstance(payload, dict):
        return _coverage_unavailable()
    totals = payload.get("totals") if isinstance(payload.get("totals"), dict) else payload.get("total")
    if not isinstance(totals, dict):
        return _coverage_unavailable()

    def metric(name, covered_key, total_key):
        value = totals.get(name)
        if isinstance(value, dict):
            return value.get("pct", value.get("percent", _percent(value.get("covered"), value.get("total"))))
        return _percent(totals.get(covered_key), totals.get(total_key))

    coverage = {
        "line": metric("lines", "covered_lines", "num_statements"),
        "branch": metric("branches", "covered_branches", "num_branches"),
        "statement": metric("statements", "covered_statements", "num_statements"),
        "function": metric("functions", "covered_functions", "num_functions"),
    }
    if all(value is None for value in coverage.values()):
        return _coverage_unavailable()
    coverage["status"] = "available"
    # Compatibility with the Quality Gate's existing line_pct lookup.
    coverage["line_pct"] = coverage["line"]
    return coverage


def _read_coverage(workspace_path, relative_path):
    if not relative_path:
        return _coverage_unavailable()
    try:
        raw = _safe_read(Path(workspace_path) / relative_path, max_chars=2_000_000)
        return _parse_coverage_summary(json.loads(raw))
    except (OSError, TypeError, ValueError, json.JSONDecodeError):
        return _coverage_unavailable()


def _is_coverage_tool_unavailable(result):
    output = f"{result.get('stdout', '')}\n{result.get('stderr', '')}".lower()
    return any(marker in output for marker in (
        "unrecognized arguments: --cov", "no module named 'pytest_cov'",
        "no module named pytest_cov", "unknown option '--coverage'",
    ))


def _validate_expected_stack(
    idea,
    project_files,
    stack
):
    """
    Validate that the generated workspace actually resembles
    the technology requested by the user.

    Returns:
        (is_valid, issues)
    """

    idea_lower = (
        idea or ""
    ).lower()

    file_paths = [
        str(path)
        .replace("\\", "/")
        .lower()
        for path in project_files
    ]

    issues = []

    # ========================================================
    # Empty project
    # ========================================================

    if not project_files:

        issues.append(
            {
                "severity": "CRITICAL",
                "category": "PROJECT_STRUCTURE",
                "description": (
                    "Generated workspace contains no project files."
                ),
                "suggested_fix": (
                    "Coder must generate the complete project."
                ),
            }
        )

        return False, issues

    # ========================================================
    # React / Vite
    # ========================================================

    wants_react = (
        "react" in idea_lower
        or "vite" in idea_lower
    )

    if wants_react:

        has_package_json = any(
            path == "package.json"
            for path in file_paths
        )

        has_react_source = any(
            (
                path.endswith(".jsx")
                or path.endswith(".tsx")
            )
            and (
                path.startswith("src/")
                or "/src/" in f"/{path}"
            )
            for path in file_paths
        )

        has_node_stack = (
            "node" in stack
        )

        if not has_package_json:

            issues.append(
                {
                    "severity": "CRITICAL",
                    "category": "PROJECT_STRUCTURE",
                    "description": (
                        "React/Vite project is requested but "
                        "package.json is missing."
                    ),
                    "suggested_fix": (
                        "Generate a complete Node/React project "
                        "with package.json."
                    ),
                }
            )

        if not has_node_stack:

            issues.append(
                {
                    "severity": "CRITICAL",
                    "category": "PROJECT_STACK",
                    "description": (
                        "React/Vite project was requested but "
                        "Node.js stack was not detected."
                    ),
                    "suggested_fix": (
                        "Generate package.json and the required "
                        "React/Vite project structure."
                    ),
                }
            )

        if not has_react_source:

            issues.append(
                {
                    "severity": "CRITICAL",
                    "category": "PROJECT_STRUCTURE",
                    "description": (
                        "React/Vite project was requested but "
                        "no JSX/TSX source file was found under src/."
                    ),
                    "suggested_fix": (
                        "Generate the React source files under src/."
                    ),
                }
            )

    # ========================================================
    # Python
    # ========================================================

    wants_python = (
        "python" in idea_lower
        or "fastapi" in idea_lower
        or "flask" in idea_lower
    )

    if wants_python:

        if "python" not in stack:

            issues.append(
                {
                    "severity": "CRITICAL",
                    "category": "PROJECT_STACK",
                    "description": (
                        "Python project was requested but "
                        "Python stack was not detected."
                    ),
                    "suggested_fix": (
                        "Generate the required Python project "
                        "files and dependency configuration."
                    ),
                }
            )

    # ========================================================
    # Unknown stack
    # ========================================================

    if not stack and not issues:

        issues.append(
            {
                "severity": "HIGH",
                "category": "PROJECT_STACK",
                "description": (
                    "No recognizable project technology stack "
                    "was detected."
                ),
                "suggested_fix": (
                    "Generate the required dependency and "
                    "configuration files for the requested project."
                ),
            }
        )

    return (
        len(issues) == 0,
        issues,
    )


def _build_test_plan(
    workspace_path,
    stack
):
    """
    Build a deterministic test plan.

    IMPORTANT:
    Commands are predefined here.
    We do NOT allow the LLM to choose arbitrary shell commands.
    """

    workspace = Path(workspace_path)

    plan = []

    package_json = (
        workspace / "package.json"
    )

    requirements = (
        workspace / "requirements.txt"
    )

    pyproject = (
        workspace / "pyproject.toml"
    )

    # ========================================================
    # Node.js
    # ========================================================

    if "node" in stack and package_json.exists():

        package_data = {}

        try:

            package_data = json.loads(
                _safe_read(
                    package_json,
                    max_chars=50000
                )
            )

        except Exception:
            package_data = {}

        scripts = package_data.get(
            "scripts",
            {}
        )

        # Install dependencies
        plan.append(
            {
                "name": "node_dependency_install",
                "command": "npm install --ignore-scripts",
                "timeout": 180
            }
        )

        # Run build if available
        if "build" in scripts:

            plan.append(
                {
                    "name": "frontend_build",
                    "command": "npm run build",
                    "timeout": 180
                }
            )

        # Run the project's declared Jest/Vitest test command. Coverage is
        # requested only through the test runner, never fabricated by Tester.
        if "test" in scripts:
            dependencies = {}
            dependencies.update(package_data.get("dependencies") or {})
            dependencies.update(package_data.get("devDependencies") or {})
            framework = "vitest" if "vitest" in dependencies or "vitest" in str(scripts.get("test", "")).lower() else "jest"
            plan.append(
                {
                    "name": f"{framework}_tests",
                    "command": "npm run test -- --coverage" + (" --runInBand" if framework == "jest" else ""),
                    "fallback_command": "npm run test" + (" -- --runInBand" if framework == "jest" else ""),
                    "coverage_path": "coverage/coverage-summary.json",
                    "timeout": 180,
                }
            )

    # ========================================================
    # Python
    # ========================================================

    if "python" in stack:

        # Keep the virtual environment inside the host workspace so it
        # survives the disposable dependency-install container. The project
        # itself is never copied into Docker; only this existing workspace is
        # bind-mounted.
        if requirements.exists() or pyproject.exists():

            install_target = (
                "-r requirements.txt"
                if requirements.exists()
                else "-e ."
            )

            plan.append(
                {
                    "name": "python_dependency_install",
                    "command": (
                        "python -m venv .aethera-venv && "
                        ".aethera-venv/bin/python -m pip install "
                        "--disable-pip-version-check "
                        "--no-cache-dir "
                        f"{install_target}"
                    ),
                    "timeout": 300
                }
            )

            plan.append(
                {
                    "name": "pytest_tests",
                    "command": ".aethera-venv/bin/python -m pytest --cov=. --cov-report=term --cov-report=json:coverage.json",
                    "fallback_command": ".aethera-venv/bin/python -m pytest",
                    "coverage_path": "coverage.json",
                    "timeout": 180,
                }
            )

            plan.append(
                {
                    "name": "python_dependency_check",
                    "command": ".aethera-venv/bin/python -m pip check",
                    "timeout": 120
                }
            )

            plan.append(
                {
                    "name": "python_syntax_check",
                    "command": ".aethera-venv/bin/python -m compileall -q .",
                    "timeout": 120
                }
            )

        else:

            plan.append(
                {
                    "name": "python_syntax_check",
                    "command": (
                        "python -m compileall -q ."
                    ),
                    "timeout": 120
                }
            )

            plan.append(
                {
                    "name": "pytest_tests",
                    "command": "python -m pytest --cov=. --cov-report=term --cov-report=json:coverage.json",
                    "fallback_command": "python -m pytest",
                    "coverage_path": "coverage.json",
                    "timeout": 180,
                }
            )

    # ========================================================
    # Static HTML
    # ========================================================

    if "html" in stack:

        index_file = (
            workspace / "index.html"
        )

        if index_file.exists():

            plan.append(
                {
                    "name": "html_existence_check",
                    "command": (
                        "python -c "
                        "\"from pathlib import Path; "
                        "p=Path('index.html'); "
                        "assert p.exists() and "
                        "p.stat().st_size > 0\""
                    ),
                    "timeout": 30
                }
            )

    return plan


def _parse_llm_report(response):
    """
    Robustly parse tester LLM JSON.
    """

    if not response:

        raise ValueError(
            "Empty tester response"
        )

    cleaned = response.strip()

    cleaned = re.sub(
        r"```json",
        "",
        cleaned,
        flags=re.IGNORECASE
    )

    cleaned = re.sub(
        r"```",
        "",
        cleaned
    ).strip()

    # Complete JSON
    try:

        return json.loads(
            cleaned
        )

    except Exception:
        pass

    # Find JSON object
    start = cleaned.find("{")
    end = cleaned.rfind("}")

    if start == -1 or end == -1:

        raise ValueError(
            "No JSON object found in tester response"
        )

    json_text = cleaned[
        start:end + 1
    ]

    try:

        return json.loads(
            json_text
        )

    except Exception as json_error:

        import ast

        try:

            return ast.literal_eval(
                json_text
            )

        except Exception:

            raise json_error


def _normalize_report(report):
    """
    Make sure tester report always has a predictable schema.
    """

    if not isinstance(
        report,
        dict
    ):
        report = {}

    status = str(
        report.get(
            "status",
            "FAIL"
        )
    ).upper()

    if status not in (
        "PASS",
        "FAIL"
    ):
        status = "FAIL"

    summary = report.get(
        "summary",
        {}
    )

    if not isinstance(
        summary,
        dict
    ):
        summary = {}

    issues = report.get(
        "issues",
        []
    )

    if not isinstance(
        issues,
        list
    ):
        issues = []

    summary.setdefault(
        "critical_count",
        0
    )

    summary.setdefault(
        "high_count",
        0
    )

    summary.setdefault(
        "medium_count",
        0
    )

    summary.setdefault(
        "low_count",
        0
    )

    report["status"] = status
    report["summary"] = summary
    report["issues"] = issues

    return report


# ============================================================
# Main Tester Agent
# ============================================================

def tester_agent(state):
    # Bind LLM usage telemetry to this Engineer execution.
    UsageTracker.set_context(
        user_id=state.get("user_id"),
        module="engineer",
        operation="tester_agent",
        agent="tester",
        project_id=state.get("project_id"),
        execution_id=state.get("execution_id"),
    )


    generated_code = (
        state.get("fixed_code")
        or state.get("generated_code")
        or []
    )

    execution_id = state.get(
        "execution_id"
    )

    project_id = state.get(
        "project_id"
    )

    user_id = state.get(
        "user_id"
    )

    workspace_path = state.get(
        "project_path"
    )

    idea = state.get(
        "idea",
        ""
    )

    # ========================================================
    # STEP 1 — Start testing
    # ========================================================

    append_execution_step(
        state,
        {
            "agent": "tester",
            "step": "testing_started",
            "status": "in_progress",
            "message": (
                "Starting real project verification"
            ),
            "timestamp": datetime.utcnow().isoformat()
        }
    )

    print("\n" + "=" * 70)
    print("TESTER AGENT")
    print("=" * 70)

    print(
        f"Project ID : {project_id}"
    )

    print(
        f"Execution  : {execution_id}"
    )

    print(
        f"Workspace  : {workspace_path}"
    )

    # ========================================================
    # STEP 2 — Check workspace
    # ========================================================

    if not workspace_path:

        report = {
            "status": "FAIL",
            "summary": {
                "critical_count": 1,
                "high_count": 0,
                "medium_count": 0,
                "low_count": 0
            },
            "issues": [
                {
                    "severity": "CRITICAL",
                    "category": "WORKSPACE",
                    "description": (
                        "No project workspace exists."
                    ),
                    "suggested_fix": (
                        "Coder must create a workspace "
                        "before testing."
                    )
                }
            ],
            "execution": {
                "workspace": None,
                "commands": []
            }
        }

        state["test_results"] = report

        append_execution_step(
            state,
            {
                "agent": "tester",
                "step": "workspace_check",
                "status": "failed",
                "message": (
                    "No project workspace found."
                )
            }
        )

        return state

    # ========================================================
    # STEP 3 — Inspect workspace
    # ========================================================

    project_files = _get_project_files(
        workspace_path
    )

    stack = _detect_project_stack(
        workspace_path
    )

    print(
        f"[Tester] Detected stack: {stack}"
    )

    print(
        f"[Tester] Files found: "
        f"{len(project_files)}"
    )

    append_execution_step(
        state,
        {
            "agent": "tester",
            "step": "workspace_inspection",
            "status": "completed",
            "message": (
                "Project workspace inspected."
            ),
            "details": {
                "stack": stack,
                "files_count": len(
                    project_files
                ),
                "files": project_files[:100]
            }
        }
    )

    # ========================================================
    # STEP 3.5 — Validate requested project structure
    # ========================================================

    structure_valid, structure_issues = (
        _validate_expected_stack(
            idea,
            project_files,
            stack
        )
    )

    if structure_issues:

        print(
            f"[Tester] Structure validation found "
            f"{len(structure_issues)} issue(s)."
        )

        for issue in structure_issues:

            print(
                f"  [{issue['severity']}] "
                f"{issue['description']}"
            )

    # ========================================================
    # STEP 4 — Build deterministic test plan
    # ========================================================

    test_plan = _build_test_plan(
        workspace_path,
        stack
    )

    execution_results = []
    coverage = _coverage_unavailable()

    # ========================================================
    # STEP 5 — Execute real tests
    # ========================================================
    testing_started_at = datetime.utcnow()

    if not test_plan:

        if structure_valid:

            execution_results.append({
                "name": "no_runtime_test", "success": False, "exit_code": None,
                "stdout": "", "stderr": "No real test command is available for the detected stack.",
            })

        else:

            execution_results.append(
                {
                    "name": "project_structure_validation",
                    "success": False,
                    "exit_code": None,
                    "stdout": "",
                    "stderr": (
                        "Project structure validation failed."
                    )
                }
            )

    else:

        for test in test_plan:

            result = _run_command(
                workspace_path=workspace_path,
                command=test["command"],
                timeout=test.get(
                    "timeout",
                    120
                )
            )

            # pytest-cov/Jest/Vitest coverage support is optional. A missing
            # coverage plugin must not be confused with a failing test suite:
            # rerun the same real suite without coverage and report coverage
            # as unavailable.
            command_used = test["command"]
            if test.get("fallback_command") and _is_coverage_tool_unavailable(result):
                result = _run_command(
                    workspace_path=workspace_path,
                    command=test["fallback_command"],
                    timeout=test.get("timeout", 120),
                )
                command_used = test["fallback_command"]

            execution_result = {
                "name": test["name"],
                "command": command_used,
                "success": result.get("exit_code") == 0,
                "exit_code": result.get(
                    "exit_code"
                ),
                "stdout": result.get(
                    "stdout",
                    ""
                )[-10000:],
                "stderr": result.get(
                    "stderr",
                    ""
                )[-10000:],
                "sandboxed": result.get(
                    "sandboxed",
                    False
                ),
                "sandbox": result.get(
                    "sandbox",
                    {}
                ),
                "sandbox_error": result.get(
                    "sandbox_error"
                ),
                "timeout": result.get(
                    "timeout",
                    False
                ),
            }

            execution_results.append(
                execution_result
            )

            if test.get("coverage_path") and execution_result["success"]:
                coverage = _read_coverage(workspace_path, test["coverage_path"])

            if execution_result["success"]:

                append_execution_step(
                    state,
                    {
                        "agent": "tester",
                        "step": test["name"],
                        "status": "completed",
                        "message": (
                            f"{test['command']} passed."
                        )
                    }
                )

            else:

                append_execution_step(
                    state,
                    {
                        "agent": "tester",
                        "step": test["name"],
                        "status": "failed",
                        "message": (
                            f"{test['command']} failed."
                        ),
                        "details": {
                            "exit_code": (
                                execution_result[
                                    "exit_code"
                                ]
                            ),
                            "stderr": (
                                execution_result[
                                    "stderr"
                                ][-3000:]
                            ),
                            "sandboxed": execution_result.get(
                                "sandboxed",
                                False
                            ),
                            "sandbox_error": execution_result.get(
                                "sandbox_error"
                            ),
                            "timeout": execution_result.get(
                                "timeout",
                                False
                            ),
                        }
                    }
                )

    # ========================================================
    # STEP 6 — Build execution summary
    # ========================================================

    failed_commands = [
        result
        for result in execution_results
        if not result.get(
            "success",
            False
        )
    ]

    execution_passed = (
        len(failed_commands) == 0
        and structure_valid
    )

    test_commands = [r for r in execution_results if "test" in r.get("name", "").lower()]
    suites = [{
        "name": r["name"], "status": "PASS" if r.get("success") else "FAIL",
        "exit_code": r.get("exit_code"), "stdout": r.get("stdout", ""),
        "stderr": r.get("stderr", ""),
    } for r in test_commands]
    # Runner output is retained verbatim; counts are intentionally null when a
    # runner does not expose a reliable aggregate format.
    total = passed = failed = None
    for result in test_commands:
        output = f"{result.get('stdout', '')}\n{result.get('stderr', '')}"
        passed_match = re.search(r"(\d+)\s+(?:passed|passing)", output, re.I)
        failed_match = re.search(r"(\d+)\s+(?:failed|failing)", output, re.I)
        if passed_match or failed_match:
            passed = (passed or 0) + (int(passed_match.group(1)) if passed_match else 0)
            failed = (failed or 0) + (int(failed_match.group(1)) if failed_match else 0)
            total = (total or 0) + (int(passed_match.group(1)) if passed_match else 0) + (int(failed_match.group(1)) if failed_match else 0)
    testing_duration_ms = round((datetime.utcnow() - testing_started_at).total_seconds() * 1000, 2)

    # ========================================================
    # STEP 7 — Ask LLM to analyze code + execution
    # ========================================================

    prompt = TESTER_PROMPT.replace(
        "{generated_code}",
        str(generated_code)
    )

    prompt += f"""

============================================================
REAL WORKSPACE TEST RESULTS
============================================================

Workspace:
{workspace_path}

Detected Stack:
{json.dumps(stack, indent=2)}

Project Files:
{json.dumps(project_files, indent=2)}

Structure Validation:
{json.dumps(structure_issues, indent=2)}

Executed Tests:
{json.dumps(execution_results, indent=2)}

Real Execution Status:
{"PASS" if execution_passed else "FAIL"}

============================================================
IMPORTANT
============================================================

The execution results above are REAL results from the
generated project workspace.

Do not ignore them.

If a build, dependency check, syntax check or test command
failed, treat that failure as an actual issue.

If the requested project structure is invalid, treat that
as an actual issue.

Correlate runtime/build errors with the generated source code.

Return ONLY valid JSON using the required tester schema.
"""
    try:
        from services.self_learning import get_relevant_learnings
        lessons, applied = get_relevant_learnings(state.get("user_id", ""), state.get("idea", ""))
        if lessons:
            prompt = f"{lessons}\n\n{prompt}"
            state.setdefault("learnings_applied", []).extend(applied)
    except Exception:
        pass

    try:

        response = generate_response(
            prompt
        )

    except Exception as exc:

        print(
            f"[Tester] LLM analysis failed: {exc}"
        )

        response = ""

    print("\n=== TESTER RAW ===\n")

    try:

        print(
            response[:3000]
            .encode(
                "utf-8",
                errors="replace"
            )
            .decode(
                "utf-8",
                errors="replace"
            )
        )

    except Exception:
        pass

    # ========================================================
    # STEP 8 — Parse LLM report
    # ========================================================

    try:

        report = _parse_llm_report(
            response
        )

        report = _normalize_report(
            report
        )

    except Exception as exc:

        print(
            "\n=== TESTER PARSE ERROR ==="
        )

        print(
            str(exc)
        )

        report = _normalize_report({})

    # ========================================================
    # STEP 9 — Deterministic hard gates
    # ========================================================

    report["execution"] = {
        "workspace": workspace_path,
        "stack": stack,
        "project_files": project_files,
        "commands": execution_results,
        "passed": execution_passed,
        "sandboxed": all(
            result.get("sandboxed", False)
            for result in execution_results
        ) if execution_results else True,
    }
    report["suites"] = suites
    report["total"] = total
    report["passed"] = passed
    report["failed"] = failed
    report["duration"] = testing_duration_ms
    report["coverage"] = coverage
    report["stdout"] = "\n".join(r.get("stdout", "") for r in test_commands)
    report["stderr"] = "\n".join(r.get("stderr", "") for r in test_commands)

    # --------------------------------------------------------
    # Structure validation is authoritative
    # --------------------------------------------------------

    if not structure_valid:

        report["status"] = "FAIL"

        existing_issues = report.get(
            "issues",
            []
        )

        existing_issues.extend(
            structure_issues
        )

        report["issues"] = (
            existing_issues
        )

        critical_structure_count = sum(
            1
            for issue in structure_issues
            if issue.get("severity") == "CRITICAL"
        )

        report["summary"][
            "critical_count"
        ] = (
            report["summary"].get(
                "critical_count",
                0
            )
            + critical_structure_count
        )

    # --------------------------------------------------------
    # Real command execution is authoritative
    # --------------------------------------------------------

    if not execution_passed:

        report["status"] = "FAIL"

        existing_issues = report.get(
            "issues",
            []
        )

        for failed in failed_commands:

            existing_issues.append(
                {
                    "severity": "CRITICAL",
                    "category": "RUNTIME",
                    "description": (
                        f"Command failed: "
                        f"{failed.get('command', failed.get('name'))}"
                    ),
                    "suggested_fix": (
                        failed.get(
                            "stderr",
                            ""
                        )[-3000:]
                    )
                }
            )

        report["issues"] = (
            existing_issues
        )

        report["summary"][
            "critical_count"
        ] = (
            report["summary"].get(
                "critical_count",
                0
            )
            + len(failed_commands)
        )

    # The LLM may add human-readable diagnosis, but it never decides pass/fail.
    report["status"] = "PASS" if execution_passed else "FAIL"

    # ========================================================
    # STEP 10 — Store result
    # ========================================================

    state["test_results"] = report

    status = report.get(
        "status",
        "FAIL"
    )

    critical_count = report.get(
        "summary",
        {}
    ).get(
        "critical_count",
        0
    )

    # ========================================================
    # STEP 11 — Execution stream
    # ========================================================

    append_execution_step(
        state,
        {
            "agent": "tester",
            "step": "testing_completed",
            "status": (
                "completed"
                if status == "PASS"
                else "failed"
            ),
            "message": (
                f"Testing completed - "
                f"Status: {status}, "
                f"Critical issues: {critical_count}"
            ),
            "details": {
                "status": status,
                "critical_count": critical_count,
                "issues_count": len(
                    report.get(
                        "issues",
                        []
                    )
                ),
                "execution_passed": (
                    execution_passed
                ),
                "commands_executed": len(
                    execution_results
                ),
                "commands_failed": len(
                    failed_commands
                ),
                "structure_valid": (
                    structure_valid
                )
            }
        }
    )

    # ========================================================
    # STEP 12 — Agent notes
    # ========================================================

    if "agent_notes" not in state:
        state["agent_notes"] = []

    state["agent_notes"].append(
        (
            f"Tester completed real verification: "
            f"{status}; "
            f"{len(failed_commands)} command(s) failed; "
            f"structure_valid={structure_valid}; "
            f"sandboxed={all(r.get('sandboxed', False) for r in execution_results) if execution_results else True}."
        )
    )

    # ========================================================
    # STEP 13 — Save memory
    # ========================================================

    try:

        save_memory(
            {
                "project_id": project_id,
                "agent": "tester",
                "note": (
                    "Tester completed real workspace "
                    "verification."
                ),
                "status": status,
                "critical_count": critical_count,
                "execution_passed": (
                    execution_passed
                ),
                "structure_valid": (
                    structure_valid
                )
            }
        )

    except Exception as exc:

        print(
            f"[Tester] Memory save failed: {exc}"
        )

    print("=" * 70)
    print(
        f"TESTER COMPLETE → {status}"
    )
    print("=" * 70)

    return state

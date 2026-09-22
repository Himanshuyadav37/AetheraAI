# Engineer AI Subsystem Completion - Product Requirements Document

## Overview
- **Summary**: Complete the remaining 10 Engineer AI subsystems of the existing AetheraAI project: Automated Test Generator, Test+Coverage, Static Analysis, Security Analysis, Debugger Integration, Quality Gate, Engineer Evaluation persistence, Self-Learning improvements, Git/GitHub support completion, and CI/CD workflow generation. Then perform a full frontend audit and a mandatory 15-point final audit.
- **Purpose**: The current Engineer pipeline (Planner→Coder→Tester→Debugger→Deployer) provides basic code generation and sandboxed build checks but lacks real test execution, coverage metrics, static analysis, security scanning, quality gates, structured evaluation, validated self-learning, comprehensive Git integration, and CI/CD generation. The subsystem must be upgraded end-to-end while reusing the existing architecture without rewriting working systems.
- **Target Users**: Software engineers, product teams, and end-users building production applications via the Aethera Engineer AI in both Manual (direct) and Automatic (Supervisor-routed) workspace modes.

## Goals
- Generate real, meaningful project tests (Python/pytest + JS/TS/Jest/Vitest) from actual generated code and persist them in the canonical project file format.
- Execute tests inside the existing Docker sandbox with real pass/fail/error/stdout/stderr/duration capture, calculating real coverage where supported (never fabricate results).
- Run structured static analysis (Python: Ruff + type checks; JS/TS: ESLint + TypeScript checks) returning structured errors/warnings.
- Perform security analysis covering secrets, unsafe commands, dependency vulnerabilities, filesystem/network risks, with secret redaction in logs/results.
- Integrate failed tests/build/lint/type/runtime errors into targeted Debugger context with bounded iteration prevention.
- Enforce a pre-deployment Quality Gate evaluating real build, tests, coverage, lint/type, security, and unresolved errors; deployment only on real evidence.
- Persist structured Engineer Evaluation records covering success/failure, tests, coverage, security findings, iterations, latency, tokens, cost, retries, and deployment result.
- Improve Self-Learning by storing only validated lessons from successful fixes/failures and retrieving relevant lessons for Planner/Coder/Tester/Debugger.
- Complete Git/GitHub support: repository detection, init, branch, status, diff, commit, push/pull, import; never expose tokens or modify external repos without explicit authorization.
- Generate appropriate CI/CD workflows (e.g., GitHub Actions: install → lint → typecheck → test → coverage → build); no external deployment without authorization.
- Audit and fix the complete Engineer frontend for every API contract, TS type, SSE event, and UI state.
- Execute a mandatory 15-point final audit covering all Engineer agents, LangGraph transitions, FastAPI routes, Mongo persistence, Redis queue/worker, Docker sandbox, SSE, cancellation, RBAC, budgets/UsageTracker, replay/restore/diff, frontend/backend contracts, backend tests, frontend tests/build/type checks, and complete end-to-end execution.

## Non-Goals
- Rewrite working LangGraph nodes, Docker sandbox implementation, Redis queue/workers, authentication/RBAC, UsageTracker/budgets, or SSE infrastructure.
- Add external deployment/CD pushing to live cloud providers without explicit user authorization.
- Add new programming language test runners beyond Python (pytest) and JS/TS (Jest/Vitest).
- Replace MongoDB with another persistence layer.
- Introduce a new queue system separate from Redis Streams.
- Implement a new frontend framework or rewrite UI components that already work correctly.

## Background & Context
Existing verified architecture (after repository inspection):

**Backend LangGraph Pipeline** (agents/graph.py):
- Nodes: `planner → coder → tester → debugger? → deployer → END`
- State: `AgentState` TypedDict with idea, project_id, project_plan, generated_code (list[{path,code}]), initial_generated_code, fixed_code, project_path, test_results, debug_report, deployment_plan, messages, iterations, user_id, agent_notes, execution_steps, mode, parent_execution_id, execution_id.
- Observability: `_run_observed_agent` wraps each node with timings, status, retries (transient only), appends to `execution_steps`, and runs `UsageTracker.enforce_budget` before each LLM call.
- Router: `route_after_testing` routes Tester FAIL→Debugger while iterations<3 (MAX_ITERATIONS=3), else Tester PASS/Max iterations → Deployer.

**Infrastructure verified present**:
- Mongo execution persistence (db/execution_service.py: save/update/append_execution_step, get_project_history)
- Redis Streams queue + consumer-group workers (services/job_queue.py, workers/execution_worker.py with handlers: supervisor.run, engineer.generate, conversational.chat, research.run, education.run, automation.run)
- Docker sandbox (services/workspace_manager.py: run_sandboxed_command with cap-drop ALL, no-new-privileges, non-root user, CPU/memory/PID limits, offline-by-default network, bind-mounted workspace only, auto cleanup)
- SSE/realtime events (services/execution_stream.py: ExecutionStreamManager + /ai/{execution_id}/stream endpoint)
- UsageTracker with budgets (services/usage_tracker.py: record_usage, enforce_budget, get_budget_status; USD defaults: execution=$5, project=$25, user_daily=$50)
- Retries: transient-error retries (graph.py _run_observed_agent, max 2), worker job retries (MAX_ATTEMPTS=3), dead-letter queue
- Cancellation: POST /ai/executions/{id}/cancel (soft: DB status + SSE notification)
- RBAC: auth.dependencies (get_current_user), auth.optional_auth (get_optional_user)
- Execution history / replay: POST /ai/executions/{id}/replay, REPLAY_NODES in graph.py
- Restore: POST /ai/projects/{id}/versions/{v}/restore (db/project_version_service.py)
- Diff: GET /ai/executions/{id}/diff?compare=fixed|<other_exec_id>
- Versioning: project_versions collection, save_version / get_project_versions / get_version_by_number
- Self-learning skeleton: services/self_learning.py (record_lessons_from_execution, get_active_learnings), db/learning_service.py, api/routes/learnings.py
- GitHub skeleton: services/github_service.py (push_project_to_github, get_github_username), api/routes/github.py (push-to-github, verify-token)

**Gaps identified (required work)**:
1. Test Generator: No agent/code that generates test files from generated code.
2. Test + Coverage: Tester runs npm install/build and python syntax/dependency checks, but does not run actual pytest/Jest/Vitest suites with coverage.
3. Static Analysis: No Ruff, ESLint, tsc type checks.
4. Security Analysis: No secrets detection, unsafe command scan, dependency vulnerability scan, filesystem/network risk analysis, or redaction.
5. Debugger Integration: Debugger only reads test_results generically; no targeted context per failure category, no explicit infinite loop guard beyond iterations=3.
6. Quality Gate: Deployer runs unconditionally after router→end; does not evaluate real build/test/coverage/lint/type/security evidence.
7. Engineer Evaluation: No structured Mongo collection or persistence of success/failure, coverage %, security findings, iterations, latencies, tokens, cost, retries, deployment result.
8. Self-Learning: record_lessons_from_execution exists but is never called after pipeline completion; Planner/Coder/Tester don't consume lessons; no validation prevents learning from bad results.
9. Git/GitHub: Only push exists; missing detection, init, branch, status, diff, commit, pull, import, token masking in UI.
10. CI/CD: No workflow generation for GitHub Actions or similar.

## Functional Requirements

### FR-1: Automated Test Generator Agent
- After Coder writes generated_code and workspace, run a test_generator_agent that inspects generated_code files, project stack, and plan.
- Generate meaningful tests for Python projects using pytest file conventions (tests/test_*.py, top-level pytest.ini/pyproject.toml if appropriate).
- Generate meaningful tests for JS/TS projects using Jest or Vitest conventions depending on package.json scripts/dependencies.
- Store generated tests as canonical project files [{path, code}] in a new AgentState field `generated_tests` and write them to the workspace.
- Record test_generator step in execution_steps with timing/status and UsageTracker context.

### FR-2: Test Execution + Coverage Capture
- Extend tester_agent test plan to run actual pytest/Jest/Vitest test suites detected in the generated project.
- Capture real pass/fail/errors/stdout/stderr/duration per suite inside the Docker sandbox.
- Calculate real coverage when the tooling supports it (pytest-cov, jest --coverage, vitest --coverage) and never fabricate coverage numbers.
- Store detailed results in AgentState.test_results.execution.commands and in a structured `test_summary` sub-document with per-suite and aggregated counts.
- Expose coverage percentages (line/branch/statement/function when available) in test_results.coverage.
- All commands must still route through workspace_manager.run_command(sandbox=True).

### FR-3: Static Analysis Stage
- Extend the Tester node (or add a static_analyzer node between Coder and Tester in the graph) to run real static analyzers when their configuration or project conventions are detected:
  - Python: Ruff (lint + format check), mypy or pyright type checks (when configured)
  - JS/TS: ESLint (when .eslintrc* or eslintConfig exists), tsc --noEmit (when tsconfig.json exists)
- Return structured errors/warnings per file with severity, line, message, rule_id, category.
- Store in AgentState.static_analysis_results and append to execution_steps.
- Always run inside Docker sandbox.

### FR-4: Security Analysis Stage
- Run a security_analysis stage covering:
  - Secrets scan: regex-based detection of API keys, tokens, passwords, private keys in generated files and command outputs.
  - Unsafe commands: flag dangerous shell patterns (rm -rf /, curl|bash, eval of untrusted input, chmod 777, privilege escalation patterns).
  - Dependency risks: when supported by tooling (npm audit, pip-audit inside sandbox), capture advisories.
  - Filesystem/network risks: flag hardcoded absolute paths, path traversal strings, raw socket connections in generated source.
- Redact discovered secrets from all persisted execution_steps, test_results, static_analysis, and SSE events before storage/broadcast.
- Store structured findings in AgentState.security_analysis_results with severity, category, file, line, description, redacted_preview, and a redaction_log mapping ids to redacted tokens for authorized users only.
- Persist only redacted content to Mongo and SSE; never persist raw secrets.

### FR-5: Debugger Integration and Bounded Recovery
- Enhance debugger_agent prompt construction so it receives categorized failure context: test failures (with per-suite diffs), lint/type errors (with line numbers), security findings (redacted), build errors, and runtime errors.
- When test_results contains coverage data, include low-coverage files as high-priority fix targets.
- Explicitly add an iteration cap safety check at the router level (already has MAX_ITERATIONS=3, ensure it cannot be bypassed) and add a per-step progress check to prevent spinning when no code changes occurred between debugger runs.
- Route static-analysis and security-analysis failures to debugger with the same retry loop so they get fixed, not ignored.

### FR-6: Quality Gate Before Deployment
- Insert a quality_gate LangGraph node between Tester (after PASS) and Deployer.
- QualityGate evaluates real execution evidence and returns PASS or FAIL:
  - Build: required build scripts must have exit 0
  - Tests: all required suites pass (non-zero suites when any test files exist)
  - Coverage: when coverage is produced, meet configurable thresholds (default: line >= 60%, or configurable via env AETHERA_MIN_COVERAGE_PCT; thresholds only enforced when tooling actually produced coverage data)
  - Lint / type checks: zero CRITICAL severity errors; HIGH severity warnings < N (default 5)
  - Security: zero CRITICAL/HIGH severity findings that are not explicitly acknowledged or false-positives; no hardcoded secrets remaining after redaction
  - Unresolved errors: no pending unresolved runtime/build errors flagged by tester
- On QualityGate FAIL: route back to Debugger with a targeted gate_failure context.
- On QualityGate PASS: proceed to Deployer. The gate decision must be stored in execution_steps with a structured gate_report including each check's pass/fail and measured values.

### FR-7: Engineer Evaluation Persistence
- Create a dedicated Mongo collection `engineer_evaluations` and a matching service module db/engineer_evaluation_service.py with save/get/list operations.
- After pipeline completion (before returning from generate_project), persist one evaluation document containing:
  - execution_id, project_id, user_id, parent_execution_id, workspace_mode, mode
  - success/failure overall result
  - tests: pass count, fail count, total count, pass_rate, per-suite breakdown
  - coverage: line/branch/statement/function percentages when available
  - security: counts by severity, list of finding categories
  - static_analysis: counts by severity, error/warning counts
  - iterations: number of tester/debugger loops, total retries across all nodes
  - latencies: per-agent duration_ms, total pipeline duration_ms
  - tokens: input/output/total per agent, overall
  - cost: estimated_cost_usd per agent, overall (from UsageTracker aggregation)
  - deployment: quality_gate pass/fail, deployment_plan details, any deployment result fields
  - quality_gate: structured gate_report with each check result
- Add GET /ai/engineer-evaluations/{execution_id} and GET /ai/engineer-evaluations?project_id=&user_id= routes.
- Include evaluation data in the final result returned to the frontend so it can render metrics without a second fetch.

### FR-8: Self-Learning Improvements
- Call record_lessons_from_execution at the end of every successful Engineer pipeline (when QualityGate is PASS) after writing the final execution.
- Before recording a lesson, validate that:
  - The execution actually had at least one debugger iteration or a coder→tester FAIL that was corrected, AND
  - The final QualityGate is PASS (never learn from runs that never produced a passing result).
- Expand retrieval of active learnings: inject context into Planner, Coder, and Tester agents in addition to Debugger.
- Add a lightweight relevance filter: hash or keyword-match lessons against the current project idea/stack so only relevant lessons are injected.
- Store the `learnings_applied` list in AgentState and in the engineer_evaluation document so evaluation shows which lessons were used.

### FR-9: Git/GitHub Support Completion
- Extend services/github_service.py (or create services/git_service.py) to implement:
  - detect_git_repo(project_dir): checks if .git exists, returns is_repo, current_branch, has_remote
  - git_init(project_dir, default_branch="main"): init + initial user config
  - git_branch(project_dir, branch_name=None, create=False): list / create / switch
  - git_status(project_dir): structured changed/untracked/staged counts + file list
  - git_diff(project_dir, staged=False, pathspec=None): returns unified diff text per file
  - git_commit(project_dir, message): add -A + commit with message
  - git_pull(project_dir, remote="origin", branch=None): pull with ff-only safe default
  - git_import_from_github(remote_url, target_dir, token=None, user=None): shallow clone (never expose tokens in logs; strip token from URLs before logging/persisting)
- Add FastAPI endpoints under /ai/git and /ai/github exposing the above operations with RBAC: only the project owner can run mutating commands.
- Existing push_project_to_github must mask the token from all persisted execution_steps, logs, and SSE events. Existing tokens in any persisted fields must be redacted retroactively at read-time by the service layer.
- Never modify external repository contents beyond the operations listed without explicit user request (no auto PR creation, no force push unless explicitly requested).

### FR-10: CI/CD Workflow Generation
- Add a ci_cd_generator helper (service) and wire it into the Deployer agent (or QualityGate on PASS).
- Detect the project stack (Node, Python, static HTML) and generate a matching GitHub Actions workflow at `.github/workflows/ci.yml` (when not already present) with the following ordered jobs:
  - install: check out code, set up language runtime, install dependencies (with caching)
  - lint: run ESLint / Ruff as applicable
  - typecheck: run tsc --noEmit / mypy as applicable
  - test: run Jest/Vitest/pytest with coverage upload (upload artifact only; no external deploy step)
  - build: run npm run build / equivalent when configured
- Include workflow permissions: `contents: read`, strictly minimal.
- Never include a deploy job or external environment secrets in the generated workflow unless the user explicitly requests deployment.
- Write the workflow file to the workspace and add it to generated_code/fixed_code lists so it's persisted with the project.
- Record ci_cd_generated step in execution_steps.

### FR-11: LangGraph State + Graph Updates
- Extend `AgentState` TypedDict in agents/state.py to include: generated_tests, static_analysis_results, security_analysis_results, quality_gate_report, engineer_evaluation, generated_ci_files.
- Add static_analyzer and security_analyzer and quality_gate nodes to the LangGraph graph (agents/graph.py) with the following updated flow:
  `planner → coder → test_generator → static_analyzer → security_analyzer → tester → (FAIL? → debugger → tester → ...) → quality_gate → (FAIL? → debugger → ... → quality_gate) → deployer → END`
- Wrap each new node with `_run_observed_agent` and the existing traced+logged wrappers.
- Update route_after_testing and add a route_after_quality_gate conditional edge.
- Ensure replay nodes include the new nodes.

### FR-12: Backend FastAPI Route Completeness
- Ensure endpoints exist and are mounted in main.py for:
  - Engineer execution POST (already there), cancel, replay, versions/restore, diff, history, stream
  - Evaluations: list / get
  - Git/GitHub: detect, init, branch, status, diff, commit, pull, import, push, token verify
  - Learnings: list / toggle / delete
- Ensure all new endpoints use appropriate RBAC (owner-level for mutating, optional auth for reads when safe).
- Ensure all new endpoints stream step data via the existing ExecutionStreamManager and persist to Mongo executions collection via append_execution_step.

### FR-13: Frontend Engineer Audit + Fixes
- Verify and, where missing, implement the UI in EngineerPanel + EngineerChat for:
  - project creation (prompt input, starter prompts)
  - execution status display (running/passed/failed/cancelled + per-agent timeline)
  - planner/coder/tester/debugger/deployer step details (AgentLiveTimeline / AgentTimeline)
  - generated files list + FileViewer rendering
  - tests: show generated test files, per-suite pass/fail, duration, stdout/stderr collapsible
  - coverage: coverage percentage metric, per-file breakdown when available
  - lint/type results: list static analysis errors/warnings by file/severity with line numbers
  - security results: findings by severity, redacted previews, never display raw redacted content
  - execution_steps: interactive timeline, replay step action
  - errors: structured error display per agent, retry/debugger context
  - cancellation: cancel button wired to /cancel endpoint, confirmation dialog, SSE event reflection in UI state
  - workspace: file list, write access where allowed
  - preview: LiveWebPreview integration
  - history: project history list with versions
  - restore: restore from version action, confirmation dialog
  - replay: dialog/action for replayable steps
  - diff: intra-execution (fixed vs generated) and cross-execution diff rendering
  - cost/tokens: display UsageTracker budget status, per-agent token/cost cards, budget warning banner
  - deployment: deployment plan rendering, deployment file list, warning when quality gate not met
- Verify every API payload/response matches the frontend axios calls.
- Verify all SSE event types (step/thought/complete/failed) are handled by the frontend streaming logic.
- Verify Manual mode and Automatic (Supervisor) mode both function correctly.
- Ensure Engineer remains independent from Supervisor (can be called directly without going through Supervisor routing).

### FR-14: Integration with Existing Infrastructure
- All new stages MUST integrate with:
  - LangGraph AgentState (new fields added, existing fields preserved)
  - Mongo execution persistence (append_execution_step, update_execution, evaluations collection)
  - Redis queue/workers (job types for new stages if any; otherwise reuse engineer.generate path)
  - Existing Docker sandbox (all commands go through workspace_manager.run_command with sandbox=True)
  - SSE/realtime events (ExecutionStreamManager + stream endpoint)
  - UsageTracker (set_context before every LLM call, enforce_budget inside _run_observed_agent already covers)
  - Execution budgets (budget enforcement already at node boundary)
  - Retries (transient retries already handled by _run_observed_agent wrapper)
  - Cancellation (respect existing soft cancellation; optionally check status mid-loop in long-running nodes)
  - RBAC (new endpoints use existing auth dependencies)
  - Execution history/replay/diff (add new state fields to replay hydration and diff computation)
- Historical executions remain immutable; writing back to existing completed executions is forbidden; only appends via new child executions.

## Non-Functional Requirements
- **NFR-1 (Backward Compatibility)**: All existing AgentState fields, Mongo execution document shapes, and API response contracts must remain backward compatible (new fields only; no deletions or renames of existing fields).
- **NFR-2 (No Fabrication)**: Test statuses, coverage percentages, lint counts, and security severities must come only from real tool execution outputs. Default values of "unknown" or null are acceptable when tools cannot run (e.g. no Docker).
- **NFR-3 (Sandbox Enforcement)**: Zero generated-project commands (tests, lint, typecheck, security scans, build, install) execute outside the Docker sandbox path.
- **NFR-4 (Secret Safety)**: No raw secret tokens ever appear in persisted execution_steps, Mongo documents, SSE events, API responses, or stdout/stderr logs.
- **NFR-5 (Budget Safety)**: Every new agent node that makes an LLM call must call UsageTracker.set_context and the existing _run_observed_agent wrapper will call enforce_budget.
- **NFR-6 (Observability)**: Every new agent stage emits at least one execution_step with status in_progress/completed/failed, duration_ms, and agent name.
- **NFR-7 (Idempotency)**: Replays of existing nodes must not mutate the source execution; all replay writes create a new child execution.
- **NFR-8 (Performance)**: Static + security scans combined should not add more than 3 minutes of wall time to the default Engineer pipeline (timeout values inside Docker commands cap each stage).

## Constraints
- **Technical**: Must reuse LangGraph, MongoDB (pymongo), Redis Streams, existing WorkspaceManager Docker sandbox, FastAPI, UsageTracker, existing Postgres task table, and the existing React/Vite frontend. Python 3.11+ and Node 20 for generated projects but host can use existing runtimes.
- **Business**: Never deploy to external infrastructure or write to external GitHub repositories beyond pull/import/push with explicit user authorization. Never commit or expose user tokens.
- **Dependencies**: Use only tools available inside the existing Docker base images (python:3.12-slim and node:20-bookworm-slim). Do not add host-level system package dependencies; install analyzers via project devDependencies where possible or as one-shot sandbox invocations with pip/npm --user install.

## Assumptions
- MongoDB and Redis (or Redis fallback direct-execution mode) are available.
- Docker daemon is available for sandbox execution; when unavailable, tests/coverage/scans will gracefully degrade and record "docker_unavailable" status rather than failing the entire pipeline (results will show as not-run, not fabricated pass).
- The existing LLM client (llm/groq_client.generate_response) is the provider used for all new agent LLM calls.
- Frontend uses React 18+, Vite, lucide-react icons, axios-based api service, and the existing WorkspaceContext state management.

## Acceptance Criteria

### AC-1: Test Generator Produces Real Project Tests
- **Type**: `rule`
- **Given**: A generated project with at least 3 Python source files or 3 JS/TS source files.
- **When**: The engineer pipeline runs and completes the test_generator stage.
- **Then**: `AgentState.generated_tests` is a non-empty list of `{path, code}` items following pytest/Jest/Vitest conventions and files are written to the workspace `project_path`.
- **Pass Condition**: At least one test file exists per major source module, with test functions asserting real behavior (not empty stubs like `assert True` only).
- **Evidence**: generated_tests list in Mongo execution document, workspace file listing from WorkspaceManager.list_files showing test files on disk.

### AC-2: Real Test Execution + Coverage (Non-Fabricated)
- **Type**: `rule`
- **Given**: A generated project with generated tests.
- **When**: Tester runs pytest/Jest/Vitest in the Docker sandbox.
- **Then**: `test_results.execution.commands` contains entries where success is determined solely by the subprocess exit code and stdout/stderr, and coverage percentages are populated from coverage tool output when applicable.
- **Pass Condition**: No default PASS when commands return nonzero; coverage is null or "not_available" when coverage tooling is not detected, never a fabricated percentage.
- **Evidence**: Command stdout/stderr output strings stored in test_results; Docker sandbox fields present.

### AC-3: Static Analysis Structured Output
- **Type**: `rule`
- **Given**: A Python project with Ruff configured or a JS/TS project with ESLint/tsconfig.
- **When**: static_analyzer stage runs.
- **Then**: `static_analysis_results` is populated with a list of findings each having `{severity, category, rule_id, file, line, message}`.
- **Pass Condition**: Findings come from actual analyzer outputs (parsed from stdout) and counts match the raw tool output count.
- **Evidence**: Raw analyzer stdout attached to execution_steps entry for static_analyzer stage plus structured parsed findings.

### AC-4: Security Analysis Finds and Redacts Secrets
- **Type**: `rule`
- **Given**: A generated file containing a hardcoded pattern that matches known-secret regexes (e.g. `sk-...`, AWS key id pattern, `password = "..."` in code).
- **When**: security_analyzer runs and then execution_steps/API responses are later returned.
- **Then**: security_analysis_results contains a finding for the secret, and any persisted execution_steps, Mongo documents, and SSE events contain only a redacted placeholder (e.g. `***REDACTED:secret#id***`) never the raw string.
- **Pass Condition**: A grep for the raw secret across execution_steps documents and API responses returns zero matches.
- **Evidence**: Finding entry in security_analysis_results, redaction_log entry, API response body captured showing redacted form.

### AC-5: Debugger Receives Targeted Failure Context
- **Type**: `rule`
- **Given**: A pipeline where Tester fails or StaticAnalyser fails or SecurityAnalyser fails.
- **When**: Debugger agent runs.
- **Then**: The prompt context passed to generate_response includes categorized sections for test failures (with file/line), lint/type (file/rule_id), and security findings (redacted forms only).
- **Pass Condition**: The debugger prompt string contains section headers for each non-empty failure category present.
- **Evidence**: Prompt substring check saved in debugger's execution_steps "prompt_summary" details.

### AC-6: Quality Gate Evaluates Real Evidence
- **Type**: `rule`
- **Given**: A pipeline where tests run but 1 or more critical tests fail.
- **When**: quality_gate node runs before Deployer.
- **Then**: quality_gate_report shows tests=FAIL, overall status=FAIL, and graph routes back to Debugger rather than to Deployer.
- **Pass Condition**: Deployer never executes before quality_gate_report.status=="PASS" (verified by execution_steps ordering).
- **Evidence**: execution_steps list showing order: tester → quality_gate(status=fail) → debugger, with no deployer step before a passing gate.

### AC-7: Engineer Evaluation Persists Structured Metrics
- **Type**: `rule`
- **Given**: A completed Engineer execution.
- **When**: The evaluation is saved via the new evaluation service.
- **Then**: A document exists in the `engineer_evaluations` collection with all required fields populated from real evidence.
- **Pass Condition**: All top-level evaluation fields are present and numeric fields (coverage, counts, costs, latencies) are populated from execution_steps/UsageTracker data.
- **Evidence**: Mongo find_one on the collection by execution_id; aggregation of UsageTracker usage data for that execution_id matches tokens/cost fields in evaluation.

### AC-8: Self-Learning Validates and Retrieves Lessons
- **Type**: `rule`
- **Given**: Two consecutive engineer runs: Run A produces a passing quality gate after >=1 debugger fix cycles, then Run B runs with a similar project idea.
- **When**: Run A completes, then Run B executes Planner/Coder/Tester/Debugger stages.
- **Then**: A learning is saved only for Run A (never failed-only runs), and Run B state includes learnings_applied list with at least one item matching Run A's error patterns.
- **Pass Condition**: learning_service query shows one new enabled record; B's evaluation.learnings_applied has length >= 1.
- **Evidence**: Mongo agent_learnings collection after A; engineer_evaluations.learnings_applied for B.

### AC-9: Git Operations Are Complete and Token-Safe
- **Type**: `rule`
- **Given**: A project workspace with generated files.
- **When**: User calls detect_git_repo, git_init, git_branch(create), git_status, git_diff, git_commit, git_pull endpoints with an owner RBAC user.
- **Then**: Each endpoint returns a structured JSON response appropriate for the operation, and any token passed for authenticated push/pull import is not present in execution_steps or SSE events.
- **Pass Condition**: Each operation succeeds or reports a well-formed error (not a 500 stacktrace), and grep for token in execution_steps yields zero matches.
- **Evidence**: HTTP response bodies, Mongo execution_steps for the execution.

### AC-10: CI/CD Workflow Generation Correctness
- **Type**: `rule`
- **Given**: A generated Node+Jest or Python+pytest project passing the QualityGate.
- **When**: Deployer runs and CI/CD generator is invoked.
- **Then**: `.github/workflows/ci.yml` is added to the project files with jobs in order: install → lint → typecheck → test → build, jobs have `contents: read` permission, no deploy job present.
- **Pass Condition**: Workflow YAML validates structurally and step order matches specification.
- **Evidence**: generated_code/fixed_code contains the file path; YAML content inspected in FileViewer.

### AC-11: LangGraph Graph and State Include New Stages
- **Type**: `rule`
- **Given**: The compiled LangGraph graph.
- **When**: Inspecting graph.nodes and AgentState keys.
- **Then**: Nodes planner/coder/test_generator/static_analyzer/security_analyzer/tester/debugger/quality_gate/deployer all exist. AgentState includes all new fields.
- **Pass Condition**: Node set includes new nodes; edges form the expected DAG; state TypedDict keys include generated_tests, static_analysis_results, security_analysis_results, quality_gate_report, engineer_evaluation, generated_ci_files.
- **Evidence**: Static inspection of agents/state.py and agents/graph.py; runtime graph dump.

### AC-12: All New Endpoints Use RBAC and SSE
- **Type**: `rule`
- **Given**: A non-owner anonymous request to a mutating Git operation (e.g. git_commit on another user's project) and a running Engineer execution.
- **When**: The request is made, then SSE stream is read.
- **Then**: The mutation returns 403. The SSE stream produces step events for all new stages matching their emit times.
- **Pass Condition**: 403 with detail==Access denied; stream captures at least test_generator/static_analyzer/security_analyzer/quality_gate/ci_cd_generated step events.
- **Evidence**: HTTP status code + response; SSE event capture from the stream endpoint.

### AC-13: Frontend Renders All New Stage Results
- **Type**: `rule`
- **Given**: A completed Engineer execution with tests, coverage, static analysis warnings, and security findings.
- **When**: User loads EngineerPanel with the result.
- **Then**: The panel renders visible cards or sections for: tests (per-suite), coverage percentage, lint/type findings list, security findings (redacted), quality gate report, evaluation metrics (tokens, cost, latency, iterations).
- **Pass Condition**: Each section is a DOM element with non-empty content when data is present.
- **Evidence**: DOM snapshot or rendered UI screenshot + visibility checks.

### AC-14: Cancellation, Replay, Restore, Diff Work for New Stages
- **Type**: `rule`
- **Given**: A running Engineer execution with new stages partially completed, and a completed execution with generated_tests/evaluations.
- **When**: Cancel mid-run, then replay a stage from the completed execution, then restore a version, then request a diff.
- **Then**: Cancel sets status=cancelled and emits failed SSE event. Replay creates a NEW child execution (not mutating source). Restore materializes files on disk in new execution. Diff includes generated_tests and generated_ci_files in compute_code_diff comparison.
- **Pass Condition**: Cancellation reflected in DB/SSE. Source execution after replay is unchanged (compare created_at/content). Restore workspace disk state matches version files. Diff JSON includes test/CI file paths with added/modified/removed when applicable.
- **Evidence**: Before/after snapshots of source execution; workspace directory listing; diff response JSON.

### AC-15: End-to-End Engineer Paths Execute Successfully
- **Type**: `rubric`
- **Dimension**: End-to-end Engineer pipeline completeness for 4 mandatory scenarios and build/type/lint health.
- **Scale**: 1-5
- **Anchors**: 1 = pipeline crashes or returns 500; 3 = basic plan/code/deploy works but new stages often skip; 5 = all scenarios work: (a) successful project with passing gate, (b) failing test → debugger → retest → pass, (c) cancellation mid-execution, (d) replay + restore + diff; frontend build passes; backend tests pass; frontend lint/typecheck clean.
- **Pass Threshold**: >= 4
- **Evidence**: Backend test suite run (pytest) pass counts, frontend npm run build result, frontend npm run lint/typecheck result, manual scenario run logs with execution_steps.

## Open Questions
- None. All scope has been defined explicitly in the user request.

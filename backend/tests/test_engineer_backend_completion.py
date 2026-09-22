from agents import static_analyzer, security_analyzer, test_generator
from db.engineer_evaluation_service import build_engineer_evaluation
from services.secret_redactor import redact_in_place
from services.execution_stream import append_execution_step


def test_static_analysis_parses_real_ruff_findings():
    findings = []
    static_analyzer._append_findings(findings, [{"code": "F401", "filename": "main.py", "line": 2, "message": "unused"}], {"F": "HIGH"}, "LINT")
    finding = findings[0]
    assert finding["rule_id"] == "F401" and finding["severity"] == "HIGH"


def test_static_analysis_unavailable_is_not_clean():
    assert static_analyzer._tool_available({"stdout": "", "stderr": "ruff: command not found"}) is False


def test_test_generator_uses_supported_llm_signature(monkeypatch):
    state = {
        "project_path": None,
        "generated_code": [{"path": "main.py", "code": "def add(a, b): return a + b"}],
        "execution_steps": [],
        "user_id": "user-1",
        "execution_id": "execution-1",
    }
    monkeypatch.setattr(
        test_generator,
        "generate_response",
        lambda _prompt: '[{"path":"tests/test_main.py","code":"from main import add\\ndef test_add(): assert add(1, 2) == 3"}]',
    )

    test_generator.test_generator_agent(state)

    assert state["generated_tests"][0]["path"] == "tests/test_main.py"
    assert state["execution_steps"][-1]["status"] == "completed"


def test_security_redacts_raw_secret_from_output():
    raw = {"description": "token sk-abcdefghijklmnopqrstuvwxyz123456"}
    safe, _ = redact_in_place(raw)
    assert "sk-abcdefghijklmnopqrstuvwxyz123456" not in str(safe)
    assert "REDACTED_SECRET" in safe["description"]


def test_execution_step_boundary_redacts_before_sse_or_persistence():
    state = {"execution_steps": []}
    append_execution_step(state, {"agent": "security", "message": "sk-abcdefghijklmnopqrstuvwxyz123456"})
    assert "sk-abcdefghijklmnopqrstuvwxyz123456" not in str(state["execution_steps"])


def test_security_dependency_parser_uses_structured_finding():
    findings = security_analyzer._parse_npm_audit({"stdout": '{"vulnerabilities":{"pkg":{"severity":"high","via":[{"title":"issue","severity":"high"}]}}}'})
    assert findings[0]["category"] == "DEPENDENCY"
    assert findings[0]["severity"] == "HIGH"


def test_evaluation_uses_real_structured_tester_data(monkeypatch):
    from services.usage_tracker import UsageTracker
    monkeypatch.setattr(UsageTracker, "get_execution_usage", lambda _: {"total_tokens": 12, "estimated_cost_usd": 0.2})
    evaluation = build_engineer_evaluation({
        "execution_id": "exec", "project_id": "project", "user_id": "user",
        "test_results": {"suites": [{"name": "pytest_tests", "status": "PASS"}], "coverage": {"line": 80}},
        "static_analysis_results": {"findings": []}, "security_analysis_results": {"findings": []},
        "quality_gate_report": {"overall": "PASS"}, "deployment_plan": {"Dockerfile": {}},
        "execution_steps": [{"agent": "tester", "duration_ms": 5}], "learnings_applied": [],
    })
    assert evaluation["tests"]["passed_suites"] == 1
    assert evaluation["tokens_total"] == 12
    assert evaluation["deployment"]["result"] == "completed"

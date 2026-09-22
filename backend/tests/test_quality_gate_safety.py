from agents.quality_gate import quality_gate_agent
from agents.router import route_after_quality_gate, route_after_testing


def _state(**overrides):
    state = {
        "execution_steps": [], "iterations": 0, "test_results": {
            "status": "PASS", "coverage": {"line_pct": 80},
            "issues": [], "execution": {"commands": [
                {"command": "python -m compileall .", "success": True},
                {"command": "pytest", "success": True},
            ]},
        },
        "static_analysis_results": {"summary": {"total": 0}, "findings": []},
        "security_analysis_results": {"summary": {"total": 0}, "findings": []},
    }
    state.update(overrides)
    return state


def test_evidence_backed_pass_routes_to_deployer():
    state = quality_gate_agent(_state())
    assert state["quality_gate_report"]["overall"] == "PASS"
    assert route_after_quality_gate(state) == "deployer"


def test_gate_fail_routes_to_debugger_not_deployer():
    state = quality_gate_agent(_state(test_results={
        "status": "PASS", "coverage": {"line_pct": 80}, "issues": [],
        "execution": {"commands": [
            {"command": "python -m compileall .", "success": True},
            {"command": "pytest", "success": True},
        ]},
    }, static_analysis_results={"summary": {"total": 1}, "findings": [{"severity": "HIGH"}]}))
    assert state["quality_gate_report"]["overall"] == "FAIL"
    assert route_after_quality_gate(state) == "debugger"


def test_unavailable_evidence_never_passes_or_deploys():
    state = quality_gate_agent(_state(static_analysis_results={}))
    assert state["quality_gate_report"]["overall"] == "FAIL"
    assert state["quality_gate_report"]["checks"]["lint_type"]["status"] == "NOT_AVAILABLE"
    assert route_after_quality_gate(state) == "debugger"


def test_max_iterations_fails_without_deployer():
    state = _state(iterations=3, test_results={"status": "FAIL"})
    assert route_after_testing(state) == "failed"
    assert state["failure_reason"] == "max_iterations"
    gate_state = _state(iterations=3, quality_gate_report={"overall": "FAIL"})
    assert route_after_quality_gate(gate_state) == "failed"


def test_no_progress_fails_without_deployer():
    state = _state(no_progress=True, quality_gate_report={"overall": "FAIL"})
    assert route_after_quality_gate(state) == "failed"
    assert state["failure_reason"] == "no_progress"


def test_deployer_has_a_defense_in_depth_gate(monkeypatch):
    import agents.graph as graph_module

    called = False

    def should_not_run(state):
        nonlocal called
        called = True
        return state

    monkeypatch.setattr(graph_module, "deployer_agent", should_not_run)
    state = graph_module.traced_deployer_agent(_state(quality_gate_report={"overall": "FAIL"}))
    assert called is False
    assert state["execution_status"] == "FAILED"
    assert any(step["step"] == "deployment_blocked" for step in state["execution_steps"])

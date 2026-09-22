from agents import tester


def _result(exit_code=0, stdout="", stderr=""):
    return {"exit_code": exit_code, "success": exit_code == 0, "stdout": stdout, "stderr": stderr, "sandboxed": True, "sandbox": {"runtime": "docker"}}


def _state():
    return {"project_path": "sandbox-workspace", "idea": "python utility", "generated_code": [], "fixed_code": [], "execution_steps": [], "agent_notes": []}


def _run_tester(monkeypatch, pytest_result, coverage=None):
    def fake_run(workspace_path, command, timeout=120):
        if "pytest --cov" in command:
            return pytest_result
        if command.endswith(" -m pytest"):
            return _result(0, "2 passed in 0.10s")
        return _result(0)

    monkeypatch.setattr(tester, "_get_project_files", lambda _: ["main.py"])
    monkeypatch.setattr(tester, "_detect_project_stack", lambda _: ["python"])
    monkeypatch.setattr(tester, "_validate_expected_stack", lambda *_: (True, []))
    monkeypatch.setattr(tester, "_build_test_plan", lambda *_: [{"name": "pytest_tests", "command": "python -m pytest --cov=.", "fallback_command": "python -m pytest", "coverage_path": "coverage.json"}])
    monkeypatch.setattr(tester, "_read_coverage", lambda *_: coverage or tester._coverage_unavailable())
    monkeypatch.setattr(tester, "_run_command", fake_run)
    monkeypatch.setattr(tester, "generate_response", lambda _prompt: '{"status":"FAIL","summary":{},"issues":[]}')
    monkeypatch.setattr(tester, "save_memory", lambda _payload: None)
    return tester.tester_agent(_state())["test_results"]


def test_passing_pytest_uses_real_exit_code_and_structured_result(monkeypatch):
    coverage = tester._parse_coverage_summary({"totals": {"covered_lines": 8, "num_statements": 10, "covered_branches": 3, "num_branches": 4}})
    report = _run_tester(monkeypatch, _result(0, "2 passed in 0.10s"), coverage)
    assert report["status"] == "PASS"
    assert report["total"] == 2 and report["passed"] == 2 and report["failed"] == 0
    assert report["suites"][0]["name"] == "pytest_tests"
    assert report["coverage"]["line"] == 80.0
    assert report["coverage"]["branch"] == 75.0


def test_failing_pytest_and_nonzero_exit_are_failures(monkeypatch):
    report = _run_tester(monkeypatch, _result(1, "1 failed, 1 passed", "assertion failed"))
    assert report["status"] == "FAIL"
    pytest_command = next(c for c in report["execution"]["commands"] if c["name"] == "pytest_tests")
    assert pytest_command["exit_code"] == 1 and pytest_command["success"] is False


def test_coverage_unavailable_falls_back_to_real_pytest(monkeypatch):
    report = _run_tester(monkeypatch, _result(1, "", "No module named pytest_cov"))
    assert report["status"] == "PASS"
    assert report["coverage"]["status"] == "not_available"


def test_jest_and_vitest_detection_requests_coverage(monkeypatch):
    monkeypatch.setattr(tester, "_safe_read", lambda *_args, **_kwargs: '{"scripts":{"test":"vitest run"},"devDependencies":{"vitest":"1.0.0"}}')
    from unittest.mock import MagicMock, patch
    with patch("agents.tester.Path.exists", return_value=True):
        plan = tester._build_test_plan("ignored", ["node"])
    test_step = next(step for step in plan if step["name"] == "vitest_tests")
    assert "--coverage" in test_step["command"]


def test_coverage_parser_returns_not_available_without_metrics():
    assert tester._parse_coverage_summary({"totals": {}})["status"] == "not_available"

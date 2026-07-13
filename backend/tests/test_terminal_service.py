import sys
from pathlib import Path
import pytest

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parents[1]
if str(backend_dir) not in sys.path:
    sys.path.append(str(backend_dir))

from services.terminal_service import execute_workspace_command, analyze_terminal_output

def test_execute_workspace_command_invalid_project():
    # Attempting to execute in a project directory that does not exist should fail cleanly
    res = execute_workspace_command("non_existent_project_id", "echo hello")
    assert "does not exist" in res["stderr"]
    assert res["exit_code"] == 1
    assert res["fix_suggestion"] is None

def test_analyze_terminal_output_no_error():
    # If stdout/stderr represents a clean execution, analysis should return None
    res = analyze_terminal_output("echo hello", "hello", "")
    assert res is None

def test_analyze_terminal_output_mock_error(monkeypatch):
    # Mock LLM response to simulate parsing a missing package error
    mock_llm_response = """
    {
      "has_error": true,
      "error_summary": "ModuleNotFoundError: No module named 'requests'",
      "fix_type": "command",
      "fix_command": "pip install requests",
      "files_to_fix": []
    }
    """
    monkeypatch.setattr("services.terminal_service.generate_response", lambda p: mock_llm_response)

    res = analyze_terminal_output("python script.py", "", "ModuleNotFoundError: No module named 'requests'")
    assert res is not None
    assert res["has_error"] is True
    assert res["fix_command"] == "pip install requests"
    assert res["fix_type"] == "command"

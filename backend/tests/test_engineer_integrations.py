from services.ci_cd_generator import generate_ci_workflow
from services.git_service import _strip_token
from services.self_learning import get_relevant_learnings


def test_ci_python_workflow_is_read_only_and_has_no_deploy():
    workflow = generate_ci_workflow(["python"], [{"path": "requirements.txt", "code": "pytest"}, {"path": "test_app.py", "code": ""}])
    assert workflow["path"] == ".github/workflows/ci.yml"
    assert "contents: read" in workflow["code"]
    assert "deploy" not in workflow["code"].lower()


def test_ci_node_workflow_detects_typescript_and_build():
    workflow = generate_ci_workflow(["node"], [{"path": "tsconfig.json", "code": "{}"}, {"path": "package.json", "code": '{"scripts":{"build":"vite build"}}'}])
    assert "Node.js CI" in workflow["code"]
    assert "contents: read" in workflow["code"]


def test_git_token_redaction_never_returns_token():
    token = "ghp_abcdefghijklmnopqrstuvwxyz1234567890"
    assert token not in _strip_token(f"https://x-access-token:{token}@github.com/a/b.git")


def test_relevant_learning_returns_empty_without_storage_error(monkeypatch):
    monkeypatch.setattr("services.self_learning.get_learnings_by_user", lambda _: [])
    assert get_relevant_learnings("user", "build a FastAPI app") == ("", [])

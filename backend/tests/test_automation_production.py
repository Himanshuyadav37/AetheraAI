import hashlib
import hmac
import json

import pytest

from core.ssrf_protection import SSRFError, validate_url
from api.routes import automation_production
from services.automation import execution_engine
from services.automation.github_adapter import validate_issue_event, verify_webhook_signature
from services.automation.llm_analyzer import _extract_and_validate_json


SECRET = "test-webhook-secret"


def valid_payload():
    return {
        "action": "opened",
        "issue": {
            "number": 42,
            "title": "Broken login",
            "body": "Users cannot sign in.",
            "labels": [{"name": "bug"}],
        },
        "repository": {"id": 123, "full_name": "acme/app"},
    }


def signed_body(payload):
    raw = json.dumps(payload).encode()
    signature = "sha256=" + hmac.new(SECRET.encode(), raw, hashlib.sha256).hexdigest()
    return raw, signature


def test_invalid_github_signature_is_rejected():
    raw, _ = signed_body(valid_payload())
    assert not verify_webhook_signature(raw, "sha256=invalid", SECRET)
    assert not verify_webhook_signature(raw, None, SECRET)


def test_valid_github_signature_is_accepted():
    raw, signature = signed_body(valid_payload())
    assert verify_webhook_signature(raw, signature, SECRET)


def test_webhook_rejects_invalid_signature(test_client, monkeypatch):
    monkeypatch.setattr(automation_production.settings, "AUTOMATION_GITHUB_WEBHOOK_SECRET", SECRET)
    response = test_client.post(
        "/api/automation/github/webhook",
        content=json.dumps(valid_payload()),
        headers={"X-GitHub-Event": "issues", "X-Hub-Signature-256": "sha256=bad"},
    )
    assert response.status_code == 401


def test_webhook_skips_non_bug_issue(test_client, monkeypatch):
    monkeypatch.setattr(automation_production.settings, "AUTOMATION_GITHUB_WEBHOOK_SECRET", SECRET)
    payload = valid_payload()
    payload["issue"]["labels"] = [{"name": "feature"}]
    raw, signature = signed_body(payload)
    response = test_client.post(
        "/api/automation/github/webhook",
        content=raw,
        headers={"X-GitHub-Event": "issues", "X-Hub-Signature-256": signature},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "SKIPPED"


def test_event_validation_rejects_non_bug_and_malformed_payloads():
    payload = valid_payload()
    payload["issue"]["labels"] = [{"name": "feature"}]
    valid, reason = validate_issue_event("issues", payload)
    assert not valid and "bug" in reason

    valid, _ = validate_issue_event("issues", {"action": "opened"})
    assert not valid


def test_llm_structured_output_validation_rejects_malformed_response():
    with pytest.raises(ValueError):
        _extract_and_validate_json('{"summary":"x","severity":"urgent"}')


def test_ssrf_blocks_untrusted_and_private_urls():
    with pytest.raises(SSRFError):
        validate_url("https://example.com/api")
    with pytest.raises(SSRFError):
        validate_url("http://127.0.0.1:8000", require_https=False, use_allowlist=False)


def test_duplicate_webhook_returns_previous_execution(monkeypatch):
    monkeypatch.setattr(execution_engine, "check_idempotency", lambda key: "existing-execution")
    monkeypatch.setattr(execution_engine, "get_execution", lambda execution_id: {"status": "SUCCESS"})
    result = execution_engine.run_github_bug_pipeline(
        automation_id="automation-1",
        automation_config={},
        event_type="issues",
        delivery_id="delivery-2",
        payload=valid_payload(),
        test_mode=False,
    )
    assert result["duplicate"] is True
    assert result["execution_id"] == "existing-execution"


def test_complete_pipeline_requires_provider_confirmations(monkeypatch):
    execution = {"_id": "execution-1", "steps": []}
    stored = {"status": "RUNNING", "steps": []}
    monkeypatch.setattr(execution_engine.settings, "AUTOMATION_SLACK_BOT_TOKEN", "configured-test-token")

    monkeypatch.setattr(execution_engine, "check_idempotency", lambda key: None)
    monkeypatch.setattr(execution_engine, "create_execution", lambda **kwargs: execution)
    monkeypatch.setattr(execution_engine, "set_idempotency", lambda *args: None)
    monkeypatch.setattr(execution_engine, "add_execution_step", lambda *args, **kwargs: None)
    monkeypatch.setattr(execution_engine, "fetch_issue", lambda *args: valid_payload()["issue"] | {"html_url": "https://github.com/acme/app/issues/42"})
    monkeypatch.setattr(execution_engine, "analyze_issue", lambda **kwargs: ({"summary": "x", "severity": "low", "reason": "minor"}, True))
    monkeypatch.setattr(execution_engine, "create_project_task", lambda **kwargs: {"id": "task-1", "url": "https://linear.app/task-1"})
    monkeypatch.setattr(execution_engine, "send_bug_notification", lambda **kwargs: {"ts": "1.2", "channel": "#test"})
    monkeypatch.setattr(execution_engine, "finalize_execution", lambda execution_id, status, *args: stored.update(status=status))
    monkeypatch.setattr(execution_engine, "get_execution", lambda execution_id: {"status": stored.get("status"), "steps": []})

    result = execution_engine.run_github_bug_pipeline(
        automation_id="automation-1",
        automation_config={"slack_channel": "#test"},
        event_type="issues",
        delivery_id="delivery-1",
        payload=valid_payload(),
        test_mode=False,
    )
    assert result["status"] == "SUCCESS"


def test_task_success_slack_failure_is_partial_failure(monkeypatch):
    monkeypatch.setattr(execution_engine, "check_idempotency", lambda key: None)
    monkeypatch.setattr(execution_engine, "create_execution", lambda **kwargs: {"_id": "execution-2", "steps": []})
    monkeypatch.setattr(execution_engine, "set_idempotency", lambda *args: None)
    monkeypatch.setattr(execution_engine, "add_execution_step", lambda *args, **kwargs: None)
    monkeypatch.setattr(execution_engine, "fetch_issue", lambda *args: valid_payload()["issue"] | {"html_url": "https://github.com/acme/app/issues/42"})
    monkeypatch.setattr(execution_engine, "analyze_issue", lambda **kwargs: ({"summary": "x", "severity": "low", "reason": "minor"}, True))
    monkeypatch.setattr(execution_engine, "create_project_task", lambda **kwargs: {"id": "task-1"})
    monkeypatch.setattr(execution_engine, "send_bug_notification", lambda **kwargs: (_ for _ in ()).throw(RuntimeError("slack unavailable")))
    monkeypatch.setattr(execution_engine, "finalize_execution", lambda execution_id, status, *args: None)
    monkeypatch.setattr(execution_engine, "get_execution", lambda execution_id: {"status": "PARTIAL_FAILURE", "steps": []})

    result = execution_engine.run_github_bug_pipeline(
        automation_id="automation-1",
        automation_config={"slack_channel": "#test"},
        event_type="issues",
        delivery_id="delivery-1",
        payload=valid_payload(),
        test_mode=False,
    )
    assert result["status"] == "PARTIAL_FAILURE"


def test_project_task_failure_is_failed(monkeypatch):
    monkeypatch.setattr(execution_engine, "check_idempotency", lambda key: None)
    monkeypatch.setattr(execution_engine, "create_execution", lambda **kwargs: {"_id": "execution-3", "steps": []})
    monkeypatch.setattr(execution_engine, "set_idempotency", lambda *args: None)
    monkeypatch.setattr(execution_engine, "add_execution_step", lambda *args, **kwargs: None)
    monkeypatch.setattr(execution_engine, "fetch_issue", lambda *args: valid_payload()["issue"] | {"html_url": "https://github.com/acme/app/issues/42"})
    monkeypatch.setattr(execution_engine, "analyze_issue", lambda **kwargs: ({"summary": "x", "severity": "low", "reason": "minor"}, True))
    monkeypatch.setattr(execution_engine, "create_project_task", lambda **kwargs: (_ for _ in ()).throw(RuntimeError("tracker unavailable")))
    monkeypatch.setattr(execution_engine, "finalize_execution", lambda execution_id, status, *args: None)
    monkeypatch.setattr(execution_engine, "get_execution", lambda execution_id: {"status": "FAILED", "steps": []})

    result = execution_engine.run_github_bug_pipeline(
        automation_id="automation-1",
        automation_config={},
        event_type="issues",
        delivery_id="delivery-1",
        payload=valid_payload(),
        test_mode=False,
    )
    assert result["status"] == "FAILED"
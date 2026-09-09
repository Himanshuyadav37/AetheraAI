import pytest
from fastapi.testclient import TestClient
from main import app
from auth.dependencies import get_current_user

# Mock user dependency
class MockUser:
    id = "user_test_123"
    email = "test.startup@nexusai.com"
    username = "StartupTester"
    is_admin = True

def mock_get_current_user():
    return MockUser()

app.dependency_overrides[get_current_user] = mock_get_current_user
client = TestClient(app)

def test_custom_agents_crud_flow():
    # 1. Create custom agent
    payload = {
        "name": "Test Customer Support Bot",
        "description": "Handles tier 1 support inquiries",
        "avatar": "🤖",
        "category": "support",
        "model": "llama-3.3-70b-versatile",
        "system_prompt": "You are a friendly customer support AI agent.",
        "temperature": 0.7,
        "starter_prompts": ["How do I reset my password?"]
    }
    create_res = client.post("/api/custom-agents", json=payload)
    assert create_res.status_code == 200
    agent_data = create_res.json()
    assert agent_data["name"] == "Test Customer Support Bot"
    assert "id" in agent_data
    agent_id = agent_data["id"]

    # 2. Get agent details
    get_res = client.get(f"/api/custom-agents/{agent_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Test Customer Support Bot"

    # 3. Public metadata endpoint
    pub_res = client.get(f"/api/custom-agents/public/{agent_id}")
    assert pub_res.status_code == 200
    assert pub_res.json()["name"] == "Test Customer Support Bot"

    # 4. Clean up delete
    del_res = client.delete(f"/api/custom-agents/{agent_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

def test_teams_flow():
    # 1. Create team
    team_payload = {
        "name": "Test Acme Engineering",
        "description": "Core software team"
    }
    team_res = client.post("/api/teams", json=team_payload)
    assert team_res.status_code == 200
    team_data = team_res.json()
    assert team_data["name"] == "Test Acme Engineering"
    team_id = team_data["id"]

    # 2. List user teams
    my_teams_res = client.get("/api/teams/my")
    assert my_teams_res.status_code == 200
    assert any(t["id"] == team_id for t in my_teams_res.json())

    # 3. Create shared prompt in team
    prompt_payload = {
        "title": "Code Review Standard",
        "prompt_text": "Review this code for OWASP security flaws.",
        "category": "Engineering"
    }
    prompt_res = client.post(f"/api/teams/{team_id}/prompts", json=prompt_payload)
    assert prompt_res.status_code == 200
    prompt_id = prompt_res.json()["id"]

    # 4. List team prompts
    list_prompts_res = client.get(f"/api/teams/{team_id}/prompts")
    assert list_prompts_res.status_code == 200
    assert any(p["id"] == prompt_id for p in list_prompts_res.json())

    # 5. Enterprise Channels Flow
    chan_res = client.get(f"/api/teams/{team_id}/channels")
    assert chan_res.status_code == 200
    channels = chan_res.json()
    assert len(channels) >= 2
    general_chan = channels[0]["id"]

    msg_res = client.post(f"/api/teams/{team_id}/channels/{general_chan}/messages", json={"content": "Hello Team!"})
    assert msg_res.status_code == 200
    assert "user_message" in msg_res.json()

    # 6. Enterprise Kanban Tasks Flow
    task_res = client.post(f"/api/teams/{team_id}/tasks", json={
        "title": "Implement Stripe Webhook",
        "description": "Handle invoice.payment_succeeded",
        "priority": "high",
        "status": "todo"
    })
    assert task_res.status_code == 200
    task_id = task_res.json()["id"]

    update_task_res = client.put(f"/api/teams/{team_id}/tasks/{task_id}", json={"status": "in_progress"})
    assert update_task_res.status_code == 200
    assert update_task_res.json()["status"] == "in_progress"

    # 7. Enterprise Docs & Wiki Flow
    doc_res = client.post(f"/api/teams/{team_id}/docs", json={
        "title": "Database Schema Standard",
        "content": "All collections must include created_at & updated_at ISO strings.",
        "category": "Architecture"
    })
    assert doc_res.status_code == 200
    doc_id = doc_res.json()["id"]

    # 8. Departmental Analytics Quota Telemetry
    analytics_res = client.get(f"/api/teams/{team_id}/analytics")
    assert analytics_res.status_code == 200
    analytics_data = analytics_res.json()
    assert "budget" in analytics_data
    assert "metrics" in analytics_data
    assert analytics_data["metrics"]["total_tasks"] >= 1

    # 9. Delete Team Workspace & Clean up
    del_team_res = client.delete(f"/api/teams/{team_id}")
    assert del_team_res.status_code == 200
    assert del_team_res.json()["success"] is True

def test_integrations_flow():
    # List integrations
    res = client.get("/api/integrations")
    assert res.status_code == 200
    integrations = res.json()
    assert len(integrations) >= 5
    app_ids = [item["app_id"] for item in integrations]
    assert "github" in app_ids
    assert "slack" in app_ids
    assert "google_drive" in app_ids

def test_developer_api_keys_flow():
    # 1. Generate API key
    key_payload = {
        "name": "Production Test Key",
        "rate_limit_rpm": 120,
        "expires_in_days": 30
    }
    create_res = client.post("/api/developer/keys", json=key_payload)
    assert create_res.status_code == 200
    key_data = create_res.json()
    assert "raw_key" in key_data
    assert key_data["raw_key"].startswith("nx_live_")
    key_id = key_data["id"]

    # 2. List API keys
    list_res = client.get("/api/developer/keys")
    assert list_res.status_code == 200
    assert any(k["id"] == key_id for k in list_res.json())

    # 3. Revoke key
    del_res = client.delete(f"/api/developer/keys/{key_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

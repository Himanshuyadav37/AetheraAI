from api.models.execution import ProjectExecutionRequest
from api.routes.execution import _get_workspace_mode
from router.agent_router import route_agent
from router.supervisor import route_request


def test_automatic_routes_casual_chat_to_conversation():
    result = route_request("hi, how are you?")
    assert result["agent"] == "conversational"
    assert result["requires_clarification"] is False
    assert set(result) == {"intent", "agent", "confidence", "requires_clarification", "task", "context"}


def test_automatic_routes_all_specialists():
    assert route_request("build a Python API") ["agent"] == "engineer"
    assert route_request("research and compare these models") ["agent"] == "research"
    assert route_request("teach me recursion") ["agent"] == "education"
    assert route_request("remind me every day at 9") ["agent"] == "automation"


def test_manual_contract_uses_agent_without_supervisor():
    request = ProjectExecutionRequest(idea="hello", mode="manual", agent="engineer")
    assert _get_workspace_mode(request) == "manual"
    assert route_agent(request.agent) == "engineer"


def test_manual_routes_every_selected_agent_directly():
    for agent in ("engineer", "conversational", "research", "education", "automation"):
        request = ProjectExecutionRequest(idea="any request", workspace_mode="manual", agent=agent)
        assert _get_workspace_mode(request) == "manual"
        assert route_agent(request.agent) == agent


def test_manual_conversation_alias_routes_directly_without_supervisor():
    request = ProjectExecutionRequest(idea="hello", mode="manual", agent="conversation")
    assert _get_workspace_mode(request) == "manual"
    assert route_agent(request.agent) == "conversational"


def test_automatic_contract_accepts_mode_without_frontend_workspace_field():
    request = ProjectExecutionRequest(idea="hello", mode="automatic")
    assert _get_workspace_mode(request) == "automatic"


def test_invalid_manual_agent_is_rejected_by_backend_router():
    try:
        route_agent("not-an-agent")
    except ValueError:
        pass
    else:
        raise AssertionError("invalid manual agent must not be routed")


def test_automatic_mode_requires_admin_at_the_backend_boundary():
    from api.routes.execution import _can_use_automatic_mode
    assert _can_use_automatic_mode({"email": "ydvhimanshu461@gmail.com", "role": "user"}) is True
    assert _can_use_automatic_mode({"email": "other-admin@example.com", "role": "admin"}) is False
    assert _can_use_automatic_mode({"email": "ydvhimanshu461@gmail.com.evil"}) is False

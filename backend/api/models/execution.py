from pydantic import BaseModel


class ProjectExecutionRequest(
    BaseModel
):
    idea: str
    agent_type: str = "engineer"
    conversation_id: str | None = None
    project_id: str | None = None
    execution_id: str | None = None
    mode: str = "new"
    connectors: dict | None = None
    session_id: str | None = None
    org_id: str | None = None
from pydantic import BaseModel
from typing import Optional, List, Literal


class ProjectExecutionRequest(
    BaseModel
):
    idea: str

    # Manual agent selection.
    # None /automatic mode: None = let Supervisor auto-route; a specific value forces that agent.
    agent_type: Optional[str] = None

    # Backward-compatible public contract: {"mode":"manual", "agent":"engineer"}.
    agent: Optional[str] = None

    # Workspace routing mode
    workspace_mode: Literal["manual", "automatic"] = "manual"

    conversation_id: str | None = None
    project_id: str | None = None
    execution_id: str | None = None

    # Execution lifecycle mode
    mode: str = "new"

    connectors: dict | None = None
    session_id: str | None = None
    org_id: str | None = None
    attachments: Optional[List] = None

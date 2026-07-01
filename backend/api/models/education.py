
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class EducationRequest(BaseModel):
    """
    Education AI Request Model
    """

    prompt: str = Field(
        ...,
        min_length=1,
        description="User educational query",
    )

    conversation_id: Optional[str] = Field(
        default=None,
        description="Conversation identifier",
    )

    mode: Optional[str] = Field(
        default=None,
        description="Optional user-selected mode",
    )

    connectors: Optional[dict] = Field(
        default=None,
        description="Optional active connectors state",
    )

    session_id: Optional[str] = Field(
        default=None,
        description="Session RAG ID",
    )

    org_id: Optional[str] = Field(
        default=None,
        description="Organization RAG ID",
    )

    project_id: Optional[str] = Field(
        default=None,
        description="Project RAG ID",
    )


class EducationResponse(BaseModel):
    """
    Education AI Response Model
    """

    success: bool = True

    agent: str

    mode: str

    title: str

    response: str

    content_type: str = "markdown"

    conversation_id: Optional[str] = None

    timestamp: Optional[str] = None

    metadata: Optional[Dict[str, Any]] = None

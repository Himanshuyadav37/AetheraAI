"""
NexusAI AI - Automation Agent Models

Pydantic models for request/response validation.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ============================================================
# Request
# ============================================================


class AutomationRequest(BaseModel):
    """
    Automation AI request model.
    """

    prompt: str = Field(
        ...,
        min_length=1,
        description="Natural language automation description.",
    )

    conversation_id: Optional[str] = Field(
        default=None,
        description="Optional existing conversation ID.",
    )

    platform: Optional[str] = Field(
        default=None,
        description="Optional target platform override (n8n, make, zapier…).",
    )

    connectors: Optional[dict] = Field(
        default=None,
        description="Optional active connectors state",
    )


# ============================================================
# Sub-models
# ============================================================


class WorkflowNode(BaseModel):
    """A single node inside the workflow."""

    id: str
    name: str
    type: str
    purpose: str
    config: Optional[Dict[str, Any]] = None
    position: Optional[Dict[str, int]] = None


class WorkflowCredential(BaseModel):
    """A required credential / API key."""

    name: str
    description: str
    setup_url: Optional[str] = None
    required: bool = True


class WorkflowStep(BaseModel):
    """One step in the execution flow."""

    step: int
    title: str
    description: str
    node_id: Optional[str] = None


# ============================================================
# Response
# ============================================================


class AutomationResponse(BaseModel):
    """
    Full automation generation response.
    """

    success: bool = True

    agent: str = "automation"

    title: str

    description: str

    platform: str

    platform_alternatives: Optional[List[str]] = None

    workflow_json: Optional[Dict[str, Any]] = None

    workflow_mermaid: Optional[str] = None

    workflow_ascii: Optional[str] = None

    nodes: Optional[List[Dict[str, Any]]] = None

    steps: Optional[List[Dict[str, Any]]] = None

    credentials: Optional[List[Dict[str, Any]]] = None

    deployment: Optional[str] = None

    testing: Optional[str] = None

    error_handling: Optional[str] = None

    security_notes: Optional[str] = None

    validation_errors: Optional[List[str]] = None

    validation_warnings: Optional[List[str]] = None

    timestamp: Optional[str] = None

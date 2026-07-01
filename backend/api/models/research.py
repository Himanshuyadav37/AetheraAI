from pydantic import BaseModel


class ResearchRequest(BaseModel):
    prompt: str
    research_session_id: str | None = None
    conversation_id: str | None = None
    research_depth: str = "normal"


class ResearchContinueRequest(BaseModel):
    prompt: str
    research_depth: str = "normal"
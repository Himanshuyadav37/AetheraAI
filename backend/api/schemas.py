from pydantic import BaseModel

class ProjectCreate(BaseModel):
    title: str
    description: str

class ProjectResponse(BaseModel):
    id: str
    title: str
    description: str
    owner_id: str
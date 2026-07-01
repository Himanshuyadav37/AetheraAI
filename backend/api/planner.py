from fastapi import APIRouter
from pydantic import BaseModel

from agents.planner import planner_agent

router = APIRouter()


class PlannerRequest(BaseModel):
    idea: str


@router.post("/generate")
def generate_plan(request: PlannerRequest):

    return planner_agent(request.idea)
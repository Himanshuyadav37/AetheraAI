from fastapi import APIRouter
from pydantic import BaseModel

from memory.user_memory import (
    get_user_profile,
    save_user_profile,
    add_long_term_memory,
    get_long_term_memories,
)

from auth.optional_auth import get_optional_user
from fastapi import Depends

router = APIRouter()


class UserProfileUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    tech_stack: list[str] | str | None = None
    experience_level: str | None = None
    ai_preference: str | None = None
    onboarding_completed: bool | None = True
    preferences: dict | None = None
    coding_style: str | None = None


class LongTermMemoryAdd(BaseModel):
    fact: str
    category: str = "general"


@router.get("/profile")
def read_user_profile(user=Depends(get_optional_user)):
    user_id = user.get("sub", "default_user") if user else "default_user"
    return get_user_profile(user_id)


@router.put("/profile")
@router.post("/profile")
def update_user_profile(
    profile: UserProfileUpdate,
    user=Depends(get_optional_user),
):
    user_id = user.get("sub", "default_user") if user else "default_user"
    existing = get_user_profile(user_id)
    existing.update(profile.model_dump(exclude_none=True))
    save_user_profile(user_id, existing)
    return existing


@router.get("/long-term")
def read_long_term_memory(user=Depends(get_optional_user)):
    return get_long_term_memories(user["sub"])


@router.post("/long-term")
def create_long_term_memory(
    body: LongTermMemoryAdd,
    user=Depends(get_optional_user),
):
    add_long_term_memory(user["sub"], body.fact, body.category)
    return {"message": "Memory saved"}

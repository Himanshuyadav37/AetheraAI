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
    preferences: dict | None = None
    coding_style: str | None = None


class LongTermMemoryAdd(BaseModel):
    fact: str
    category: str = "general"


@router.get("/profile")
def read_user_profile(user=Depends(get_optional_user)):
    return get_user_profile(user["sub"])


@router.put("/profile")
def update_user_profile(
    profile: UserProfileUpdate,
    user=Depends(get_optional_user),
):
    existing = get_user_profile(user["sub"])
    existing.update(profile.model_dump(exclude_none=True))
    save_user_profile(user["sub"], existing)
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

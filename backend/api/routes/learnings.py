from fastapi import APIRouter, Depends, HTTPException
from auth.optional_auth import get_optional_user
from db.learning_service import (
    get_learnings_by_user,
    toggle_learning_enabled,
    delete_learning_by_id
)

router = APIRouter()

@router.get("")
async def list_learnings(user=Depends(get_optional_user)):
    """
    Get all learning logs recorded for the current user session.
    """
    user_id = user.get("sub", "system")
    return get_learnings_by_user(user_id)

@router.put("/{learning_id}/toggle")
async def toggle_learning(learning_id: str, enabled: bool = None, user=Depends(get_optional_user)):
    """
    Toggle the active/disabled status of a specific learning rule.
    """
    success = toggle_learning_enabled(learning_id, enabled)
    if not success:
        raise HTTPException(status_code=404, detail="Learning rule not found or update failed")
    return {"status": "success", "message": "Learning rule state updated"}

@router.delete("/{learning_id}")
async def delete_learning(learning_id: str, user=Depends(get_optional_user)):
    """
    Permanently delete a learning rule from the user's registry.
    """
    success = delete_learning_by_id(learning_id)
    if not success:
        raise HTTPException(status_code=404, detail="Learning rule not found or deletion failed")
    return {"status": "success", "message": "Learning rule deleted successfully"}

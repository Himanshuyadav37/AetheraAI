from fastapi import APIRouter, Depends, HTTPException
from backend.auth.dependencies import get_current_user
from backend.db.crud import get_run_by_id

router = APIRouter(prefix="/status", tags=["status"])

@router.get("/{run_id}")
async def get_status(run_id: str, user=Depends(get_current_user)):
    run = await get_run_by_id(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run
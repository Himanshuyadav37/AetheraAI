from fastapi import APIRouter, Depends
from backend.auth.dependencies import get_current_user
from backend.db.crud import get_user_runs

router = APIRouter(prefix="/history", tags=["history"])

@router.get("/")
async def get_history(user=Depends(get_current_user)):
    runs = await get_user_runs(user["email"])
    return {"runs": runs}
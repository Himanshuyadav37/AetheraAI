from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.github_service import push_project_to_github
from auth.optional_auth import get_optional_user
from db.execution_service import get_project_history

router = APIRouter()


def _require_project_owner(project_id: str, user):
    user_id = user.get("sub") if user else None
    history = get_project_history(project_id) or []
    if not history:
        raise HTTPException(status_code=404, detail="Project not found")
    if any(item.get("user_id") not in (None, "system", "anonymous", user_id) for item in history):
        raise HTTPException(status_code=403, detail="Access denied")

class GithubPushRequest(BaseModel):
    repo_name: str
    description: str = ""
    private: bool = True
    token: str | None = None

@router.post("/{project_id}/push-to-github")
def push_to_github(
    project_id: str,
    payload: GithubPushRequest,
    user=Depends(get_optional_user)
):
    _require_project_owner(project_id, user)
    try:
        repo_url = push_project_to_github(
            project_id=project_id,
            repo_name=payload.repo_name,
            description=payload.description,
            private=payload.private,
            custom_token=payload.token
        )
        return {
            "status": "success",
            "repo_url": repo_url
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class TokenVerifyRequest(BaseModel):
    token: str

@router.post("/verify-token")
def verify_token(
    payload: TokenVerifyRequest,
    user=Depends(get_optional_user)
):
    from services.github_service import get_github_username
    try:
        username = get_github_username(payload.token)
        return {
            "status": "success",
            "username": username
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

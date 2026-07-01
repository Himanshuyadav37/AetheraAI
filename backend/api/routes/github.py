from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.github_service import push_project_to_github
from auth.optional_auth import get_optional_user

router = APIRouter()

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

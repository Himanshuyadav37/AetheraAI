"""Explicit, owner-authorized local Git operations for Engineer projects."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth.optional_auth import get_optional_user
from db.execution_service import get_project_history
from services.project_storage import get_project_dir
from services import git_service

router = APIRouter()


def _project_dir_for_owner(project_id, user):
    user_id = user.get("sub") if user else None
    history = get_project_history(project_id) or []
    if not history:
        raise HTTPException(status_code=404, detail="Project not found")
    if any(item.get("user_id") not in (None, "system", "anonymous", user_id) for item in history):
        raise HTTPException(status_code=403, detail="Access denied")
    return get_project_dir(project_id)


class BranchRequest(BaseModel):
    name: str


class CommitRequest(BaseModel):
    message: str


class PullRequest(BaseModel):
    remote: str = "origin"
    branch: str | None = None


class ImportRequest(BaseModel):
    remote_url: str
    token: str | None = None


@router.get("/{project_id}/detect")
def detect(project_id: str, user=Depends(get_optional_user)):
    return git_service.detect_git_repo(_project_dir_for_owner(project_id, user))


@router.post("/{project_id}/init")
def init(project_id: str, user=Depends(get_optional_user)):
    ok, note = git_service.git_init(_project_dir_for_owner(project_id, user))
    if not ok:
        raise HTTPException(status_code=400, detail=note)
    return {"ok": True, "message": note}


@router.get("/{project_id}/status")
def status(project_id: str, user=Depends(get_optional_user)):
    return git_service.git_status(_project_dir_for_owner(project_id, user))


@router.get("/{project_id}/diff")
def diff(project_id: str, staged: bool = False, user=Depends(get_optional_user)):
    return {"diff": git_service.git_diff(_project_dir_for_owner(project_id, user), staged=staged)}


@router.post("/{project_id}/branch")
def branch(project_id: str, payload: BranchRequest, user=Depends(get_optional_user)):
    return git_service.git_branch(_project_dir_for_owner(project_id, user), payload.name, create=True)


@router.post("/{project_id}/commit")
def commit(project_id: str, payload: CommitRequest, user=Depends(get_optional_user)):
    result = git_service.git_commit(_project_dir_for_owner(project_id, user), payload.message)
    if not result["ok"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/{project_id}/pull")
def pull(project_id: str, payload: PullRequest, user=Depends(get_optional_user)):
    result = git_service.git_pull(_project_dir_for_owner(project_id, user), payload.remote, payload.branch)
    if result["returncode"] != 0:
        raise HTTPException(status_code=400, detail=result["stderr"])
    return {"ok": True, "stdout": result["stdout"]}


@router.post("/{project_id}/import")
def import_repository(project_id: str, payload: ImportRequest, user=Depends(get_optional_user)):
    target = _project_dir_for_owner(project_id, user)
    # Import is caller-triggered only; service redacts all authenticated URLs.
    result = git_service.git_import_from_github(payload.remote_url, target, token=payload.token)
    if result["returncode"] != 0:
        raise HTTPException(status_code=400, detail=result["stderr"])
    return {"ok": True, "message": "Repository imported"}

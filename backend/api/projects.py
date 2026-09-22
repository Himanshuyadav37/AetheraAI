from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse

from auth.dependencies import get_current_user
from db.project_service import (
    get_project_by_id,
    get_user_projects,
)

router = APIRouter()


def _user_identity(user: dict):
    return (
        str(user.get("sub") or user.get("id") or ""),
        str(user.get("email") or "").lower().strip(),
    )


def _project_belongs_to_user(project: dict, user: dict) -> bool:
    """
    Support the common owner fields already used by Aethera projects.
    If a project has no ownership metadata, do not expose it through
    this user-facing route.
    """
    user_id, user_email = _user_identity(user)

    id_fields = (
        "owner_id",
        "user_id",
        "created_by",
        "created_by_id",
        "userId",
    )
    email_fields = (
        "owner_email",
        "user_email",
        "created_by_email",
        "email",
    )

    for field in id_fields:
        value = project.get(field)
        if value is not None and str(value) == user_id:
            return True

    for field in email_fields:
        value = project.get(field)
        if value and str(value).lower().strip() == user_email:
            return True

    return False


@router.get("/")
def get_projects(
    current_user=Depends(get_current_user),
):
    # Never expose every user's projects from a public endpoint.
    return get_user_projects(
        current_user["sub"]
    )


@router.get("/my-projects")
def my_projects(
    current_user=Depends(get_current_user),
):
    return get_user_projects(
        current_user["sub"]
    )


@router.get("/{project_id}")
def get_project(
    project_id: str,
    current_user=Depends(get_current_user),
):
    project = get_project_by_id(project_id)

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    if not _project_belongs_to_user(project, current_user):
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this project.",
        )

    return project


@router.get("/{project_id}/download")
def download_project(
    project_id: str,
    current_user=Depends(get_current_user),
):
    project = get_project_by_id(project_id)

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found",
        )

    if not _project_belongs_to_user(project, current_user):
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this project.",
        )

    from services.zip_service import create_project_zip

    zip_path = create_project_zip(project_id)
    return FileResponse(
        path=zip_path,
        filename=f"project_{project_id[:12]}.zip",
        media_type="application/zip",
    )

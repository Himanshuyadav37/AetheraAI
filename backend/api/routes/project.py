from fastapi import (
    APIRouter,
    HTTPException,
    Depends
)

from auth.dependencies import (
    get_current_user
)

from db.project_service import (
    get_all_projects,
    get_project_by_id,
    get_user_projects
)

from fastapi.responses import FileResponse

from services.zip_service import (
    create_project_zip
)

router = APIRouter()


@router.get("/")
def get_projects():

    return get_all_projects()


@router.get("/my-projects")
def my_projects(
    current_user=Depends(
        get_current_user
    )
):

    return get_user_projects(
        current_user["sub"]
    )


@router.get("/{project_id}")
def get_project(
    project_id: str
):

    project = get_project_by_id(
        project_id
    )

    if not project:

        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    return project


@router.get(
    "/{project_id}/download"
)
def download_project(
    project_id: str
):

    project = get_project_by_id(
        project_id
    )

    if not project:

        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    zip_path = create_project_zip(
        project_id
    )

    return FileResponse(
        path=zip_path,
        filename=f"{project_id}.zip",
        media_type="application/zip"
    )
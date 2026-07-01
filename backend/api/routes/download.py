from fastapi import APIRouter
from fastapi.responses import FileResponse

from services.zip_service import create_project_zip

router = APIRouter()


@router.get(
    "/download/{project_id}"
)
def download_project(
    project_id: str
):

    zip_path = create_project_zip(
        project_id
    )

    return FileResponse(
        path=zip_path,
        filename=f"{project_id}.zip",
        media_type="application/zip"
    )
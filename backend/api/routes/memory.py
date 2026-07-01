from fastapi import APIRouter

from memory.project_memory import (
    get_project_memory,
    get_recent_memory,
)

router = APIRouter()


@router.get("/{project_id}")
def project_memory(
    project_id: str
):

    return get_project_memory(
        project_id
    )


@router.get("/{project_id}/recent")
def recent_project_memory(
    project_id: str,
    limit: int = 10,
):
    return get_recent_memory(project_id, limit)
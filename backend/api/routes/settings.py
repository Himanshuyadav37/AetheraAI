from fastapi import APIRouter

from db.settings_service import (
    get_settings,
    update_settings
)

router = APIRouter()


@router.get("/")
def fetch_settings():

    return get_settings()


@router.post("/")
def save_settings(
    data: dict
):

    return update_settings(
        data
    )
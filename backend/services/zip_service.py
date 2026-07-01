import zipfile

from fastapi import HTTPException

from services.project_storage import get_project_dir, get_zip_path


def create_project_zip(
    project_id: str
):

    project_folder = get_project_dir(project_id)
    zip_path = get_zip_path(project_id)

    if not project_folder.exists() or not project_folder.is_dir():
        raise HTTPException(
            status_code=404,
            detail="Generated project folder not found"
        )

    with zipfile.ZipFile(
        zip_path,
        "w",
        zipfile.ZIP_DEFLATED
    ) as zipf:

        for file_path in project_folder.rglob("*"):

            if not file_path.is_file():
                continue

            if file_path.resolve() == zip_path.resolve():
                continue

            arcname = file_path.relative_to(
                project_folder
            )

            zipf.write(
                file_path,
                arcname
            )

    return str(zip_path)
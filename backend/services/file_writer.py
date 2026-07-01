import os
import shutil

from services.project_storage import get_project_dir


def write_project_files(
    project_id: str,
    files: list
):

    project_path = str(get_project_dir(project_id))

    os.makedirs(
        project_path,
        exist_ok=True
    )

    for file_data in files:

        path = file_data.get(
            "path"
        )

        code = file_data.get(
            "code",
            ""
        )

        if not path:
            continue

        full_path = os.path.join(
            project_path,
            path
        )

        os.makedirs(
            os.path.dirname(
                full_path
            ),
            exist_ok=True
        )

        with open(
            full_path,
            "w",
            encoding="utf-8"
        ) as f:

            f.write(code)

    zip_path = shutil.make_archive(
        project_path,
        "zip",
        project_path
    )

    return (
        project_path,
        zip_path
    )
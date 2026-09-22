import json
import os
import shutil
from typing import Any, Dict, List

from services.project_storage import get_project_dir


def _normalize_files(files: Any) -> List[Dict[str, str]]:
    """
    Normalize project files into canonical format:

    [
        {
            "path": "src/App.jsx",
            "code": "..."
        }
    ]

    Supports:
    - canonical list format
    - legacy {"files": [...]} format
    """
    if not files:
        return []

    # Canonical format
    if isinstance(files, list):
        normalized = []

        for item in files:
            if not isinstance(item, dict):
                continue

            path = item.get("path")
            code = item.get("code", item.get("content", ""))

            if not path:
                continue

            normalized.append(
                {
                    "path": str(path),
                    "code": _normalize_content(code),
                }
            )

        return normalized

    # Backward compatibility
    if isinstance(files, dict):
        nested_files = files.get("files")

        if isinstance(nested_files, list):
            return _normalize_files(nested_files)

    return []


def _normalize_content(content: Any) -> str:
    """
    Convert generated content into a string suitable for file.write().
    """
    if content is None:
        return ""

    if isinstance(content, str):
        return content

    if isinstance(content, (dict, list)):
        return json.dumps(
            content,
            ensure_ascii=False,
            indent=2
        )

    return str(content)


def _safe_relative_path(path: str) -> str | None:
    """
    Prevent generated code from escaping the project directory.
    """
    if not path:
        return None

    path = str(path).replace("\\", "/").strip()

    # Remove accidental leading slash
    path = path.lstrip("/")

    normalized = os.path.normpath(path)

    if normalized in ("", "."):
        return None

    # Prevent ../ traversal
    if normalized == ".." or normalized.startswith(".." + os.sep):
        return None

    return normalized


def write_project_files(
    project_id: str,
    files: list
):
    """
    Write generated project files to persistent project storage.

    Canonical input:
        [
            {
                "path": "package.json",
                "code": "..."
            },
            {
                "path": "src/App.jsx",
                "code": "..."
            }
        ]

    Returns:
        (project_path, zip_path)
    """

    project_path = str(
        get_project_dir(project_id)
    )

    os.makedirs(
        project_path,
        exist_ok=True
    )

    normalized_files = _normalize_files(files)

    written_files = 0

    for file_data in normalized_files:

        path = _safe_relative_path(
            file_data.get("path")
        )

        if not path:
            continue

        code = _normalize_content(
            file_data.get("code", "")
        )

        full_path = os.path.abspath(
            os.path.join(
                project_path,
                path
            )
        )

        project_root = os.path.abspath(
            project_path
        )

        # Final traversal protection
        if not (
            full_path == project_root
            or full_path.startswith(
                project_root + os.sep
            )
        ):
            continue

        parent_dir = os.path.dirname(
            full_path
        )

        if parent_dir:
            os.makedirs(
                parent_dir,
                exist_ok=True
            )

        with open(
            full_path,
            "w",
            encoding="utf-8"
        ) as f:
            f.write(code)

        written_files += 1

    # Create project ZIP
    zip_path = shutil.make_archive(
        project_path,
        "zip",
        project_path
    )

    print(
        f"[FileWriter] Project: {project_id}"
    )
    print(
        f"[FileWriter] Written files: {written_files}"
    )
    print(
        f"[FileWriter] Path: {project_path}"
    )

    return (
        project_path,
        zip_path
    )
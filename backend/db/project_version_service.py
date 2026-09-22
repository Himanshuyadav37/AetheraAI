from datetime import datetime

from db.mongo_client import db

versions_collection = db["project_versions"]


def _normalize_files(data) -> list:
    """
    Canonical runtime format:

    [
        {"path": "src/main.py", "code": "..."},
        ...
    ]

    Also accepts legacy:
    {"files": [...]}
    """
    if isinstance(data, list):
        return [
            {
                "path": item.get("path", ""),
                "code": item.get("code", ""),
            }
            for item in data
            if isinstance(item, dict) and item.get("path")
        ]

    if isinstance(data, dict):
        legacy_files = data.get("files", [])

        if isinstance(legacy_files, list):
            return [
                {
                    "path": item.get("path", ""),
                    "code": item.get("code", ""),
                }
                for item in legacy_files
                if isinstance(item, dict) and item.get("path")
            ]

    return []


def get_next_version(project_id: str) -> int:
    latest = versions_collection.find_one(
        {"project_id": project_id},
        sort=[("version", -1)],
    )

    return (latest["version"] + 1) if latest else 1


def save_version(
    project_id: str,
    execution_id: str,
    idea: str,
    generated_code,
    fixed_code,
    parent_execution_id: str | None = None,
) -> dict:
    version = get_next_version(project_id)

    normalized_generated = _normalize_files(generated_code)
    normalized_fixed = _normalize_files(fixed_code)

    doc = {
        "project_id": project_id,
        "execution_id": execution_id,
        "parent_execution_id": parent_execution_id,
        "version": version,
        "idea": idea,
        "generated_code": normalized_generated,
        "fixed_code": normalized_fixed,
        "created_at": datetime.utcnow(),
    }

    result = versions_collection.insert_one(doc)

    doc["_id"] = str(result.inserted_id)

    return doc


def get_project_versions(project_id: str) -> list:
    versions = list(
        versions_collection.find(
            {"project_id": project_id}
        ).sort("version", -1)
    )

    for version in versions:
        version["_id"] = str(version["_id"])

        # Keep old database records readable.
        version["generated_code"] = _normalize_files(
            version.get("generated_code")
        )
        version["fixed_code"] = _normalize_files(
            version.get("fixed_code")
        )

    return versions


def get_version_by_number(project_id: str, version: int):
    doc = versions_collection.find_one(
        {
            "project_id": project_id,
            "version": version,
        }
    )

    if doc:
        doc["_id"] = str(doc["_id"])

        doc["generated_code"] = _normalize_files(
            doc.get("generated_code")
        )
        doc["fixed_code"] = _normalize_files(
            doc.get("fixed_code")
        )

    return doc


def compute_code_diff(
    files_a: list,
    files_b: list,
) -> list:
    files_a = _normalize_files(files_a)
    files_b = _normalize_files(files_b)

    map_a = {
        file["path"]: file.get("code", "")
        for file in files_a
    }

    map_b = {
        file["path"]: file.get("code", "")
        for file in files_b
    }

    all_paths = sorted(set(map_a) | set(map_b))

    diffs = []

    for path in all_paths:
        code_a = map_a.get(path)
        code_b = map_b.get(path)

        if code_a is None:
            diffs.append(
                {
                    "path": path,
                    "status": "added",
                    "before": "",
                    "after": code_b,
                }
            )

        elif code_b is None:
            diffs.append(
                {
                    "path": path,
                    "status": "removed",
                    "before": code_a,
                    "after": "",
                }
            )

        elif code_a != code_b:
            diffs.append(
                {
                    "path": path,
                    "status": "modified",
                    "before": code_a,
                    "after": code_b,
                }
            )

    return diffs
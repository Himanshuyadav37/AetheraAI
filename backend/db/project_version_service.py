from datetime import datetime

from bson import ObjectId

from db.mongo_client import db

versions_collection = db["project_versions"]


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
    generated_code: dict,
    fixed_code: dict,
    parent_execution_id: str | None = None,
) -> dict:
    version = get_next_version(project_id)
    doc = {
        "project_id": project_id,
        "execution_id": execution_id,
        "parent_execution_id": parent_execution_id,
        "version": version,
        "idea": idea,
        "generated_code": generated_code,
        "fixed_code": fixed_code,
        "created_at": datetime.utcnow(),
    }
    result = versions_collection.insert_one(doc)
    doc["_id"] = str(result.inserted_id)
    return doc


def get_project_versions(project_id: str) -> list:
    versions = list(
        versions_collection.find({"project_id": project_id}).sort(
            "version", -1
        )
    )
    for v in versions:
        v["_id"] = str(v["_id"])
    return versions


def get_version_by_number(project_id: str, version: int):
    doc = versions_collection.find_one(
        {"project_id": project_id, "version": version}
    )
    if doc:
        doc["_id"] = str(doc["_id"])
    return doc


def compute_code_diff(
    files_a: list,
    files_b: list,
) -> list:
    map_a = {f["path"]: f.get("code", "") for f in (files_a or [])}
    map_b = {f["path"]: f.get("code", "") for f in (files_b or [])}
    all_paths = sorted(set(map_a) | set(map_b))

    diffs = []
    for path in all_paths:
        code_a = map_a.get(path)
        code_b = map_b.get(path)
        if code_a is None:
            diffs.append({"path": path, "status": "added", "before": "", "after": code_b})
        elif code_b is None:
            diffs.append({"path": path, "status": "removed", "before": code_a, "after": ""})
        elif code_a != code_b:
            diffs.append({"path": path, "status": "modified", "before": code_a, "after": code_b})
    return diffs

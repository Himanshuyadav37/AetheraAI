import os
import shutil
import zipfile
from pathlib import Path
from fastapi import HTTPException
from services.project_storage import get_project_dir, get_zip_path


def create_project_zip(project_id: str) -> str:
    if not project_id:
        raise HTTPException(status_code=400, detail="Project ID cannot be empty")

    clean_id = str(project_id).strip()
    project_folder = get_project_dir(clean_id)
    zip_path = get_zip_path(clean_id)

    # 1. If a valid zip already exists and is non-empty, return it immediately
    if zip_path.exists() and zip_path.is_file() and zip_path.stat().st_size > 100:
        return str(zip_path)

    # 2. Check if folder on disk exists and contains any files
    has_files = project_folder.exists() and any(project_folder.iterdir())

    # 3. If folder on disk is missing or empty, recover directly from MongoDB
    if not has_files:
        from db.mongo_client import projects_collection, executions_collection
        from bson import ObjectId

        doc = None
        # Try finding in projects_collection by ObjectId
        if ObjectId.is_valid(clean_id):
            try:
                doc = projects_collection.find_one({"_id": ObjectId(clean_id)})
            except Exception:
                pass

        # Try finding by string project_id in projects_collection
        if not doc:
            doc = projects_collection.find_one({"project_id": clean_id})

        # Try finding in executions_collection
        if not doc and ObjectId.is_valid(clean_id):
            try:
                doc = executions_collection.find_one({"_id": ObjectId(clean_id)})
            except Exception:
                pass

        if not doc:
            doc = (
                executions_collection.find_one({"execution_id": clean_id})
                or executions_collection.find_one({"project_id": clean_id})
            )

        # Extract code files from document
        files = []
        if doc:
            files = (
                (doc.get("fixed_code") or {}).get("files")
                or (doc.get("generated_code") or {}).get("files")
                or []
            )

        if files:
            project_folder.mkdir(parents=True, exist_ok=True)
            for file_entry in files:
                rel_path = file_entry.get("path", "")
                code = file_entry.get("code", "")
                if rel_path:
                    clean_rel = rel_path.lstrip("/\\.").replace("../", "")
                    dest_file = project_folder / clean_rel
                    dest_file.parent.mkdir(parents=True, exist_ok=True)
                    dest_file.write_text(code, encoding="utf-8", errors="ignore")
            has_files = True

    if not project_folder.exists() or not any(project_folder.iterdir()):
        raise HTTPException(
            status_code=404,
            detail=f"No generated files found for project/execution ID '{clean_id}'"
        )

    # 4. Create ZIP archive
    try:
        shutil.make_archive(
            str(project_folder),
            "zip",
            str(project_folder)
        )
    except Exception as archive_err:
        print(f"[create_project_zip] shutil fallback to zipfile: {archive_err}")
        zip_path.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for file_path in project_folder.rglob("*"):
                if not file_path.is_file():
                    continue
                if file_path.resolve() == zip_path.resolve():
                    continue
                arcname = file_path.relative_to(project_folder)
                zipf.write(file_path, arcname)

    return str(zip_path)
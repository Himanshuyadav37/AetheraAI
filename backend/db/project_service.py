from datetime import datetime
from bson import ObjectId

from db.mongo_client import (
    projects_collection
)


from fastapi import HTTPException

def create_project(
    owner_id: str,
    idea: str,
    project_plan: dict
):
    if owner_id and owner_id not in ("system", "anonymous"):
        from db.mongo_client import get_user_limit
        limit = get_user_limit(owner_id)
        existing_count = projects_collection.count_documents({"owner_id": owner_id})
        if existing_count >= limit:
            raise HTTPException(
                status_code=429,
                detail="LIMIT_REACHED"
            )

    project = {
        "owner_id": owner_id,
        "idea": idea,
        "project_plan": project_plan,
        "status": "planned",
        "created_at": datetime.utcnow()
    }

    result = projects_collection.insert_one(
        project
    )

    project_id = str(result.inserted_id)

    # Replicate to PostgreSQL
    try:
        from db.postgres import save_project_pg_sync
        project_name = project_plan.get("project_name", f"Project {project_id[:8]}") if isinstance(project_plan, dict) else f"Project {project_id[:8]}"
        save_project_pg_sync(project_id, owner_id, project_name)
    except Exception as pg_err:
        print(f"[PostgreSQL Error] Failed to replicate project {project_id} creation: {pg_err}")

    return project_id


def get_project(
    project_id: str
):

    project = projects_collection.find_one(
        {
            "_id": ObjectId(project_id)
        }
    )

    if project:
        project["_id"] = str(
            project["_id"]
        )

    return project


def get_all_projects():

    projects = list(
        projects_collection.find()
    )

    for project in projects:

        project["_id"] = str(
            project["_id"]
        )

    return projects


def get_project_by_id(
    project_id: str
):

    project = projects_collection.find_one(
        {
            "_id": ObjectId(project_id)
        }
    )

    if project:

        project["_id"] = str(
            project["_id"]
        )

    return project


def update_project_status(
    project_id: str,
    status: str
):

    projects_collection.update_one(
        {
            "_id": ObjectId(project_id)
        },
        {
            "$set": {
                "status": status
            }
        }
    )


def delete_project(
    project_id: str
):

    projects_collection.delete_one(
        {
            "_id": ObjectId(project_id)
        }
    )


def get_user_projects(
    user_id: str
):

    projects = list(
        projects_collection.find(
            {
                "owner_id": user_id
            }
        )
    )

    for project in projects:

        project["_id"] = str(
            project["_id"]
        )

    return projects
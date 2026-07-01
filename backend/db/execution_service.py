from bson import ObjectId

from db.mongo_client import (
    executions_collection
)


def save_execution(data):

    result = executions_collection.insert_one(
        data
    )

    return str(
        result.inserted_id
    )


def update_execution(execution_id: str, data: dict):

    try:

        result = executions_collection.update_one(
            {
                "_id":
                ObjectId(
                    execution_id
                )
            },
            {
                "$set": data
            }
        )

        return result.matched_count > 0

    except Exception:

        return False


def get_all_executions():

    executions = list(

        executions_collection
        .find()
        .sort(
            "created_at",
            -1
        )

    )

    for execution in executions:

        execution["_id"] = str(
            execution["_id"]
        )

    return executions


def get_execution_by_project_id(project_id: str):

    execution = executions_collection.find_one(
        {"project_id": project_id},
        sort=[("created_at", -1)],
    )

    if execution:

        execution["_id"] = str(
            execution["_id"]
        )

    return execution


def get_project_history(project_id: str):

    executions = list(

        executions_collection.find(
            {
                "project_id": project_id
            }
        ).sort(
            "created_at",
            -1
        )

    )

    for execution in executions:

        execution["_id"] = str(
            execution["_id"]
        )

    return executions


def get_execution_by_id(
    execution_id: str
):

    try:

        execution = executions_collection.find_one(
            {
                "_id":
                ObjectId(
                    execution_id
                )
            }
        )

    except Exception:

        return None

    if execution:

        execution["_id"] = str(
            execution["_id"]
        )

    return execution


# ============================
# DELETE EXECUTION
# ============================

def delete_execution(
    execution_id: str
):

    try:

        result = executions_collection.delete_one(
            {
                "_id":
                ObjectId(
                    execution_id
                )
            }
        )

        return result.deleted_count > 0

    except Exception:

        return False


def get_user_executions(
    user_id: str
):

    executions = list(

        executions_collection
        .find(
            {
                "user_id":
                user_id
            }
        )
        .sort(
            "created_at",
            -1
        )

    )

    for execution in executions:

        execution["_id"] = str(
            execution["_id"]
        )

    return executions


def execution_exists(
    execution_id: str
):

    try:

        execution = executions_collection.find_one(
            {
                "_id":
                ObjectId(
                    execution_id
                )
            }
        )

        return execution is not None

    except Exception:

        return False
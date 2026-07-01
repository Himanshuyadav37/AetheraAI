from db.mongo_client import settings_collection


def get_settings():

    settings = settings_collection.find_one()

    if not settings:

        default_settings = {

            "theme": "dark",

            "auto_debug": True,

            "auto_fix": True,

            "auto_deploy": False,

            "save_logs": True,

            "max_iterations": 3,

            "selected_model":
                "llama-3.3-70b-versatile",

            "temperature": 0.7
        }

        settings_collection.insert_one(
            default_settings
        )

        return default_settings

    settings["_id"] = str(
        settings["_id"]
    )

    return settings


def update_settings(data):

    settings_collection.update_one(
        {},
        {
            "$set": data
        },
        upsert=True
    )

    return {
        "message":
            "Settings Updated"
    }
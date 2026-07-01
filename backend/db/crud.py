from db.mongo_client import users_collection

def create_user(user_data):
    result = users_collection.insert_one(user_data)
    return str(result.inserted_id)


def get_user_by_email(email):
    return users_collection.find_one(
        {"email": email}
    )


def get_user_by_id(user_id):
    return users_collection.find_one(
        {"_id": user_id}
    )
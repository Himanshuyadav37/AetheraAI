import secrets
from datetime import datetime
import requests
from fastapi import HTTPException

from db.mongo_client import users_collection
from core.security import hash_password, create_access_token


def google_login_user(id_token: str):
    """Verify Google ID token → auto create/login user → return JWT. No OTP needed."""
    try:
        res = requests.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}",
            timeout=10
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Google API error: {str(e)}")

    if res.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired Google credential")

    payload = res.json()
    email = payload.get("email")
    name = payload.get("name") or payload.get("given_name") or email.split("@")[0]
    sub = payload.get("sub")

    if not email:
        raise HTTPException(status_code=400, detail="Google token missing email")

    # Find or create user — no OTP, no password needed
    db_user = users_collection.find_one({"email": email})

    if not db_user:
        result = users_collection.insert_one({
            "email": email,
            "username": name,
            "google_id": sub,
            "created_at": datetime.utcnow(),
            "last_login": datetime.utcnow(),
        })
        db_user = users_collection.find_one({"_id": result.inserted_id})
        
        # Trigger welcome email webhook via n8n
        try:
            from auth.otp_service import _trigger_n8n_welcome_webhook
            _trigger_n8n_welcome_webhook(db_user["email"], db_user["username"])
        except Exception as e:
            print(f"Failed to import/trigger n8n welcome email: {e}")
    else:
        users_collection.update_one(
            {"_id": db_user["_id"]},
            {"$set": {"last_login": datetime.utcnow()}}
        )

    token = create_access_token({
        "sub": str(db_user["_id"]),
        "email": db_user["email"]
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(db_user["_id"]),
            "username": db_user.get("username", name),
            "email": db_user["email"]
        }
    }
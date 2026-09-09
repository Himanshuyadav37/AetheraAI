import secrets
from datetime import datetime
import requests
from fastapi import HTTPException

from db.mongo_client import users_collection
from core.security import hash_password, create_access_token


def google_login_user(id_token: str):
    """Verify Google ID token or Access Token → auto create/login user → return JWT. No OTP needed."""
    payload = None
    # 1. Try Google ID token verification endpoint
    try:
        res = requests.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}",
            timeout=10
        )
        if res.status_code == 200:
            payload = res.json()
    except Exception as e:
        print(f"[Google Auth Notice] ID token verification request failed: {e}")

    # 2. Fallback to Google OAuth2 userinfo endpoint if id_token was an access_token
    if not payload:
        try:
            res_userinfo = requests.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {id_token}"},
                timeout=10
            )
            if res_userinfo.status_code == 200:
                payload = res_userinfo.json()
        except Exception as e:
            print(f"[Google Auth Notice] Userinfo verification request failed: {e}")

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired Google credential")

    email = payload.get("email")
    name = payload.get("name") or payload.get("given_name") or (email.split("@")[0] if email else "User")
    sub = payload.get("sub") or payload.get("id")

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
        
        # Replicate to PostgreSQL
        try:
            from db.postgres import save_user_pg_sync
            save_user_pg_sync(str(db_user["_id"]), db_user["email"])
        except Exception as pg_err:
            print(f"[PostgreSQL Error] Failed to replicate user on google login: {pg_err}")
        
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
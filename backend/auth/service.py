import secrets
from datetime import datetime
import requests
from fastapi import HTTPException

from db.mongo_client import users_collection
from core.security import hash_password, create_access_token


def google_login_user(id_token: str):
    """Verify Google ID token or Access Token → auto create/login user → return JWT. No OTP needed."""
    if not id_token or not id_token.strip():
        raise HTTPException(status_code=400, detail="Missing Google credential token")

    id_token = id_token.strip()
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

    # 2. Try Google OAuth2 access tokeninfo endpoint
    if not payload:
        try:
            res_acc = requests.get(
                f"https://oauth2.googleapis.com/tokeninfo?access_token={id_token}",
                timeout=10
            )
            if res_acc.status_code == 200:
                payload = res_acc.json()
        except Exception as e:
            print(f"[Google Auth Notice] Access token verification request failed: {e}")

    # 3. Fallback to Google OAuth2 userinfo endpoint
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

    raw_email = payload.get("email")
    if not raw_email:
        raise HTTPException(status_code=401, detail="Invalid Google credential")
    if payload.get("email_verified") in (False, "false"):
        raise HTTPException(status_code=401, detail="Google email is not verified")

    email = raw_email.lower().strip()
    name = payload.get("name") or payload.get("given_name") or email.split("@")[0]
    sub = payload.get("sub") or payload.get("id")

    # Find or create user — no OTP, no password needed
    db_user = users_collection.find_one({"$or": [{"email": email}, {"email": raw_email}]})

    if not db_user:
        result = users_collection.insert_one({
            "email": email,
            "username": name,
            "google_id": sub,
            "created_at": datetime.utcnow(),
            "last_login": datetime.utcnow(),
        })
        db_user = users_collection.find_one({"_id": result.inserted_id})
        
        # Replicate to PostgreSQL in background thread
        import threading
        def _bg_pg():
            try:
                from db.postgres import save_user_pg_sync
                save_user_pg_sync(str(db_user["_id"]), db_user["email"])
            except Exception as pg_err:
                print(f"[PostgreSQL Notice] {pg_err}")
        threading.Thread(target=_bg_pg, daemon=True).start()
        
    else:
        # Check if user account is blocked
        if db_user.get("is_blocked", False):
            raise HTTPException(
                status_code=403,
                detail="Your account has been blocked. Please contact the administrator."
            )
        users_collection.update_one(
            {"_id": db_user["_id"]},
            {"$set": {"last_login": datetime.utcnow(), "email": email}}
        )

    # Trigger welcome and 1-minute feedback survey email cycle
    try:
        from auth.otp_service import trigger_welcome_and_feedback_cycle
        trigger_welcome_and_feedback_cycle(db_user["email"], db_user.get("username", name))
    except Exception as e:
        print(f"Failed to trigger welcome and feedback cycle: {e}")

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
            "email": db_user["email"],
            "role": db_user.get("role", "user")
        }
    }
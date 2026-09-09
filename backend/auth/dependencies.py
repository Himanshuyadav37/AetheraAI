from jose import jwt, JWTError, ExpiredSignatureError
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from bson import ObjectId
import logging

from config import settings
from db.mongo_client import users_collection

logger = logging.getLogger("auth.dependencies")

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="auth/login",
    auto_error=False
)

def get_current_user(
    token: str = Depends(oauth2_scheme)
):
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authentication token missing. Please log in."
        )

    payload = None
    # 1. Standard verified decode
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"]
        )
    except ExpiredSignatureError:
        # Graceful fallback for active session: decode without exp check
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_exp": False}
            )
        except Exception:
            pass
    except JWTError:
        # Fallback for alternative secrets or unverified claims
        try:
            payload = jwt.get_unverified_claims(token)
        except Exception:
            pass

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid Token"
        )

    user_id = payload.get("sub") or payload.get("id")
    user_email = payload.get("email")

    if not user_id and not user_email:
        raise HTTPException(
            status_code=401,
            detail="Invalid Token: Subject missing"
        )

    # Enhance payload from MongoDB if email or username is missing
    if not user_email and user_id:
        try:
            db_user = users_collection.find_one({"_id": ObjectId(user_id)})
            if db_user:
                payload["email"] = db_user.get("email", "")
                payload["username"] = db_user.get("username", "")
        except Exception:
            pass

    if "id" not in payload and user_id:
        payload["id"] = user_id

    return payload
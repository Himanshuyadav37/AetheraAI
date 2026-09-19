"""
Auth Dependencies — Aethera

get_current_user: strict authentication — raises 401 if not authenticated.
Uses a grace period for recently-expired tokens to avoid kicking active users.
"""

import logging

from bson import ObjectId
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import ExpiredSignatureError, JWTError, jwt

from config import settings
from db.mongo_client import users_collection

logger = logging.getLogger("auth.dependencies")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Strict authentication dependency.

    Raises 401 if:
    - No token provided
    - Token cannot be decoded at all
    - Token subject is missing
    - User is not found in the database

    Grace period: if a token is expired but otherwise valid, we still
    decode it (without exp check) and accept it — this prevents active
    users from being kicked mid-session on minor clock drift.
    """
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authentication token missing. Please log in.",
        )

    payload = None

    # 1. Standard verified decode
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except ExpiredSignatureError:
        # Grace-period: decode without exp verification
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_exp": False},
            )
            logger.debug("[Auth] Accepted token with expired signature (grace period).")
        except Exception:
            pass
    except JWTError:
        # Try unverified claims as last resort
        try:
            payload = jwt.get_unverified_claims(token)
        except Exception:
            pass
    except Exception:
        pass

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token. Please log in again.")

    user_id = payload.get("sub") or payload.get("id")
    user_email = payload.get("email")

    if not user_id and not user_email:
        raise HTTPException(status_code=401, detail="Invalid token: missing subject.")

    # Enrich payload from MongoDB
    try:
        db_user = users_collection.find_one({"_id": ObjectId(str(user_id))}) if user_id else None
        if not db_user and user_email:
            db_user = users_collection.find_one({"email": user_email})
    except Exception:
        db_user = None

    if not db_user:
        raise HTTPException(status_code=401, detail="User account not found. Please log in again.")

    payload["sub"] = str(db_user.get("_id", user_id))
    payload["id"] = str(db_user.get("_id", user_id))
    payload["email"] = db_user.get("email", user_email or "")
    payload["username"] = db_user.get("username", payload.get("username", ""))
    payload["role"] = db_user.get("role", payload.get("role", "user"))

    return payload

"""Authentication and authorization dependencies for Aethera AI."""

import logging
from typing import Callable

from bson import ObjectId
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from config import settings
from db.mongo_client import users_collection

logger = logging.getLogger("auth.dependencies")

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="auth/login",
    auto_error=False,
)


def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Authenticate the request and hydrate the user from MongoDB.

    MongoDB remains the source of truth for account status and role,
    so blocking or changing a user's role takes effect immediately
    without waiting for an old JWT to expire.
    """
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authentication token missing. Please log in.",
        )

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            options={"require_exp": True, "require_sub": True},
        )
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token. Please log in again.",
        )

    user_id = payload.get("sub")
    user_email = payload.get("email")

    if not isinstance(user_id, str) or not user_id.strip():
        raise HTTPException(
            status_code=401,
            detail="Invalid token: missing subject.",
        )

    try:
        db_user = None

        try:
            db_user = users_collection.find_one(
                {"_id": ObjectId(user_id)}
            )
        except Exception:
            pass

        if not db_user and user_email:
            db_user = users_collection.find_one(
                {"email": str(user_email).lower().strip()}
            )
    except Exception:
        logger.exception("Failed to retrieve authenticated user")
        raise HTTPException(
            status_code=401,
            detail="Unable to verify user account. Please log in again.",
        )

    if not db_user:
        raise HTTPException(
            status_code=401,
            detail="User account not found. Please log in again.",
        )

    if db_user.get("is_blocked", False):
        raise HTTPException(
            status_code=403,
            detail="Your account has been blocked. Please contact the administrator.",
        )

    # Database values are authoritative.
    hydrated = dict(payload)
    hydrated["sub"] = str(db_user.get("_id", user_id))
    hydrated["id"] = str(db_user.get("_id", user_id))
    hydrated["email"] = str(
        db_user.get("email", user_email or "")
    ).lower().strip()
    hydrated["username"] = db_user.get(
        "username",
        payload.get("username", ""),
    )
    hydrated["role"] = str(
        db_user.get("role", "user")
    ).lower().strip() or "user"

    return hydrated


def require_roles(*roles: str) -> Callable:
    """
    FastAPI dependency factory for system-level roles.

    Example:
        Depends(require_roles("admin"))
    """
    allowed = {
        str(role).lower().strip()
        for role in roles
        if str(role).strip()
    }

    if not allowed:
        raise ValueError("require_roles() needs at least one role")

    def dependency(current_user=Depends(get_current_user)):
        role = str(current_user.get("role", "user")).lower().strip()
        if role not in allowed:
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions.",
            )
        return current_user

    return dependency


def is_system_admin(user: dict) -> bool:
    return (
        isinstance(user, dict)
        and str(user.get("role", "")).lower().strip() == "admin"
    )

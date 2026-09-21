"""
Optional Auth Dependency — Aethera

Returns user payload if a valid token is provided.
If no token → returns unauthenticated dict (does NOT raise).
If a token is present but invalid or expired, raises HTTP 401.

This allows pages to work for both logged-in and anonymous users.
"""

from typing import Optional

from bson import ObjectId
from jose import JWTError, jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
import logging

from config import settings
from db.mongo_client import users_collection

logger = logging.getLogger("auth.optional")

oauth2_optional = OAuth2PasswordBearer(
    tokenUrl="auth/login",
    auto_error=False,
)

_UNAUTH = {"authenticated": False}


def get_optional_user(
    token: Optional[str] = Depends(oauth2_optional),
):
    """
    Extract user from JWT token if present and valid.

    No token returns an anonymous payload. A supplied token must pass full
    signature, algorithm, subject, and expiry validation.
    If the user account is blocked, access is denied with 403.
    """
    if not token:
        return _UNAUTH

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            options={"require_exp": True, "require_sub": True},
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token. Please log in again.")

    user_id = payload.get("sub")
    if not isinstance(user_id, str) or not user_id.strip():
        raise HTTPException(status_code=401, detail="Invalid token: missing subject.")

    # Verify if user is blocked in MongoDB
    db_user = None
    try:
        if ObjectId.is_valid(user_id):
            db_user = users_collection.find_one({"_id": ObjectId(user_id)})
    except Exception:
        db_user = None

    if not db_user and payload.get("email"):
        db_user = users_collection.find_one({"email": payload.get("email")})

    if db_user and db_user.get("is_blocked", False):
        raise HTTPException(
            status_code=403,
            detail="Your account has been blocked. Please contact the administrator.",
        )

    payload["authenticated"] = True
    return payload

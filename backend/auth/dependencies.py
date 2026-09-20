"""Strict JWT authentication dependency for protected routes."""

import logging

from bson import ObjectId
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

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

    All supplied tokens must pass signature, algorithm, subject, and expiry
    validation. Invalid or expired tokens are always rejected.
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
        raise HTTPException(status_code=401, detail="Invalid or expired token. Please log in again.")

    user_id = payload.get("sub")
    if not isinstance(user_id, str) or not user_id.strip():
        raise HTTPException(status_code=401, detail="Invalid token: missing subject.")

    user_email = payload.get("email")

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

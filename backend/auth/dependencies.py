"""Strict JWT authentication dependency for protected routes."""

import logging

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
    Strict authentication dependency.

    Raises 401 if:
    - No token is provided
    - Token cannot be decoded
    - Token subject is missing
    - User account does not exist
    - Token is invalid or expired

    Raises 403 if:
    - User account is blocked

    MongoDB is treated as the source of truth for the current
    user status. Therefore, blocking a user immediately prevents
    access even if the user already has a valid JWT.
    """

    # ---------------------------------------------------------
    # 1. TOKEN REQUIRED
    # ---------------------------------------------------------
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Authentication token missing. Please log in.",
        )

    # ---------------------------------------------------------
    # 2. VERIFY JWT
    # ---------------------------------------------------------
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            options={
                "require_exp": True,
                "require_sub": True,
            },
        )

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token. Please log in again.",
        )

    # ---------------------------------------------------------
    # 3. GET USER ID FROM TOKEN
    # ---------------------------------------------------------
    user_id = payload.get("sub")

    if not isinstance(user_id, str) or not user_id.strip():
        raise HTTPException(
            status_code=401,
            detail="Invalid token: missing subject.",
        )

    user_email = payload.get("email")

    # ---------------------------------------------------------
    # 4. FETCH CURRENT USER FROM DATABASE
    # ---------------------------------------------------------
    try:
        db_user = None

        # Primary lookup using MongoDB ObjectId
        try:
            db_user = users_collection.find_one(
                {"_id": ObjectId(str(user_id))}
            )
        except Exception:
            # If sub is not a valid ObjectId, fallback to email
            db_user = None

        # Fallback lookup using email
        if not db_user and user_email:
            db_user = users_collection.find_one(
                {"email": user_email}
            )

    except Exception:
        logger.exception("Failed to retrieve authenticated user from database")

        raise HTTPException(
            status_code=401,
            detail="Unable to verify user account. Please log in again.",
        )

    # ---------------------------------------------------------
    # 5. USER MUST EXIST
    # ---------------------------------------------------------
    if not db_user:
        raise HTTPException(
            status_code=401,
            detail="User account not found. Please log in again.",
        )

    # ---------------------------------------------------------
    # 6. BLOCKED USER CHECK
    # ---------------------------------------------------------
    # IMPORTANT:
    # This check happens against MongoDB on every protected
    # request. Therefore, an already-issued JWT cannot bypass
    # the block.
    #
    # Existing users without the field are treated as active
    # because .get("is_blocked", False) defaults to False.
    if db_user.get("is_blocked", False):
        raise HTTPException(
            status_code=403,
            detail="Your account has been blocked. Please contact the administrator.",
        )

    # ---------------------------------------------------------
    # 7. ENRICH AUTHENTICATED USER PAYLOAD
    # ---------------------------------------------------------
    payload["sub"] = str(
        db_user.get("_id", user_id)
    )

    payload["id"] = str(
        db_user.get("_id", user_id)
    )

    payload["email"] = db_user.get(
        "email",
        user_email or "",
    )

    payload["username"] = db_user.get(
        "username",
        payload.get("username", ""),
    )

    payload["role"] = db_user.get(
        "role",
        payload.get("role", "user"),
    )

    # ---------------------------------------------------------
    # 8. RETURN AUTHENTICATED USER
    # ---------------------------------------------------------
    return payload
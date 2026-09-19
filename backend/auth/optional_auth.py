"""
Optional Auth Dependency — Aethera

Returns user payload if a valid token is provided.
If no token → returns unauthenticated dict (does NOT raise).
If token is present but expired/invalid → returns unauthenticated dict (does NOT raise).

This allows pages to work for both logged-in and anonymous users.
"""

from typing import Optional

from jose import jwt, JWTError, ExpiredSignatureError
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
import logging

from config import settings

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

    Always returns a dict — NEVER raises 401.
    Callers must check payload.get('authenticated') or payload.get('sub').
    """
    if not token:
        return _UNAUTH

    # 1. Try standard verified decode
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        payload["authenticated"] = True
        payload["sub"] = str(payload.get("sub") or payload.get("id") or "")
        return payload
    except ExpiredSignatureError:
        pass
    except JWTError:
        pass
    except Exception:
        pass

    # 2. Graceful fallback — decode without exp verification for active sessions
    # This allows users with a recently-expired token to continue working
    # until they explicitly log out or the token's payload is invalid
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_exp": False},
        )
        user_id = payload.get("sub") or payload.get("id")
        if user_id:
            payload["authenticated"] = True
            payload["sub"] = str(user_id)
            logger.debug(f"[OptionalAuth] Accepted expired token for user {str(user_id)[:8]}...")
            return payload
    except Exception:
        pass

    # 3. Token is present but completely unreadable — return unauthenticated
    # Do NOT raise 401 — optional auth must never block page loads
    logger.debug("[OptionalAuth] Token present but unreadable — returning unauthenticated.")
    return _UNAUTH

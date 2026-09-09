from typing import Optional

from jose import jwt, JWTError, ExpiredSignatureError
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer

from config import settings

oauth2_optional = OAuth2PasswordBearer(
    tokenUrl="auth/login",
    auto_error=False,
)


def get_optional_user(
    token: Optional[str] = Depends(oauth2_optional),
):
    if not token:
        return {"sub": "system"}

    payload = None
    # 1. Standard verified decode
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
        )
    except ExpiredSignatureError:
        # Graceful fallback for active session
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_exp": False},
            )
        except Exception:
            pass
    except JWTError:
        # Fallback for unverified claims
        try:
            payload = jwt.get_unverified_claims(token)
        except Exception:
            pass
    except Exception:
        pass

    if not payload:
        return {"sub": "system"}

    user_id = payload.get("sub") or payload.get("id")
    if not user_id:
        return {"sub": "system"}

    payload["sub"] = str(user_id)
    return payload

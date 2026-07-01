from typing import Optional

from jose import jwt, JWTError
from fastapi import Depends, HTTPException
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
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
        )
        user_id = payload.get("sub")
        if not user_id:
            return {"sub": "system"}
        return payload
    except JWTError:
        return {"sub": "system"}

from datetime import datetime, timedelta

import pytest
from jose import jwt
from fastapi import HTTPException

from auth import dependencies, optional_auth
from config import settings


def test_invalid_token_is_rejected():
    with pytest.raises(HTTPException) as error:
        dependencies.get_current_user("not-a-jwt")
    assert error.value.status_code == 401


def test_expired_token_is_rejected():
    token = jwt.encode(
        {"sub": "507f1f77bcf86cd799439011", "exp": datetime.utcnow() - timedelta(minutes=1)},
        settings.JWT_SECRET,
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as error:
        dependencies.get_current_user(token)
    assert error.value.status_code == 401


def test_optional_auth_does_not_create_system_identity():
    assert optional_auth.get_optional_user(None) == {"authenticated": False}


def test_optional_auth_rejects_invalid_token():
    with pytest.raises(HTTPException) as error:
        optional_auth.get_optional_user("not-a-jwt")
    assert error.value.status_code == 401
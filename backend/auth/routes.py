from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from auth.dependencies import get_current_user, is_system_admin
from auth.otp_service import (
    generate_and_store_otp,
    send_otp_email,
    verify_otp_and_login,
)
from auth.service import google_login_user
from db.mongo_client import users_collection
from config import settings

router = APIRouter()


class GoogleLoginRequest(BaseModel):
    id_token: str


class EmailRequest(BaseModel):
    email: EmailStr


class OtpVerifyRequest(BaseModel):
    email: EmailStr
    code: str


@router.post("/send-otp")
def send_otp(payload: EmailRequest):
    """Issue an OTP without revealing whether an account exists."""
    email_clean = str(payload.email).lower().strip()

    existing_user = users_collection.find_one({"email": email_clean})
    if existing_user and existing_user.get("is_blocked", False):
        raise HTTPException(
            status_code=403,
            detail="Your account has been blocked. Please contact the administrator.",
        )

    try:
        code = generate_and_store_otp(email_clean)

        import threading

        def _bg_send():
            try:
                user = users_collection.find_one({"email": email_clean})
                username = (
                    user.get("username")
                    if user
                    else email_clean.split("@")[0]
                )
                send_otp_email(
                    email_clean,
                    code,
                    username or email_clean.split("@")[0],
                )
            except Exception as exc:
                print(f"[OTP BG Error] {exc}")

        threading.Thread(
            target=_bg_send,
            daemon=True,
        ).start()

        return {"message": "OTP sent if the account is eligible."}
    except Exception:
        # Do not expose internal OTP/email errors to clients.
        raise HTTPException(
            status_code=503,
            detail="Unable to process OTP request. Please try again.",
        )


@router.post("/verify-otp")
def verify_otp(payload: OtpVerifyRequest):
    """Verify OTP, then create/login the user and return a JWT."""
    return verify_otp_and_login(
        str(payload.email).lower().strip(),
        payload.code,
    )


@router.post("/google-login")
def google_login(payload: GoogleLoginRequest):
    return google_login_user(payload.id_token)


@router.delete("/clear-users")
def clear_all_users(
    admin_key: str | None = None,
    current_user=Depends(get_current_user),
):
    """
    Emergency administrative endpoint.

    Prefer an authenticated system-admin request. The legacy
    ADMIN_SECRET path is retained for operational compatibility.
    """
    authorized = is_system_admin(current_user)

    if not authorized and admin_key != settings.ADMIN_SECRET:
        raise HTTPException(
            status_code=403,
            detail="Forbidden",
        )

    result = users_collection.delete_many({})
    return {
        "message": f"Deleted {result.deleted_count} users"
    }

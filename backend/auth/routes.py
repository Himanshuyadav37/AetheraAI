from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from auth.otp_service import generate_and_store_otp, send_otp_email, verify_otp_and_login
from auth.service import google_login_user
from db.mongo_client import users_collection

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
    """Send OTP — handles both login and signup automatically with sub-10ms response."""
    email_clean = payload.email.lower().strip()

    # Blocked accounts must not receive OTPs or login
    existing_user = users_collection.find_one({"email": email_clean})
    if existing_user and existing_user.get("is_blocked", False):
        raise HTTPException(
            status_code=403,
            detail="Your account has been blocked. Please contact the administrator."
        )

    try:
        code = generate_and_store_otp(email_clean)
        
        # Dispatch email sending in a non-blocking background thread
        import threading
        def _bg_send():
            try:
                user = users_collection.find_one({"email": email_clean})
                username = user.get("username") if user else email_clean.split("@")[0]
                send_otp_email(email_clean, code, username or email_clean.split("@")[0])
            except Exception as ex:
                print(f"[OTP BG Error] {ex}")
                
        threading.Thread(target=_bg_send, daemon=True).start()
        
        return {"message": "OTP sent if the account is eligible."}
    except Exception as e:
        import traceback
        traceback.print_exc()
        code = generate_and_store_otp(payload.email)
        return {"message": "OTP sent if the account is eligible."}


@router.post("/verify-otp")
def verify_otp(payload: OtpVerifyRequest):
    """Verify OTP → auto create/login user → return JWT."""
    return verify_otp_and_login(payload.email, payload.code)


@router.post("/google-login")
def google_login(payload: GoogleLoginRequest):
    return google_login_user(payload.id_token)


@router.delete("/clear-users")
def clear_all_users(admin_key: str):
    """Admin: delete all existing users — requires admin_key."""
    from config import settings
    if admin_key != settings.ADMIN_SECRET:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Forbidden")
    result = users_collection.delete_many({})
    return {"message": f"Deleted {result.deleted_count} users"}
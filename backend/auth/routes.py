from fastapi import APIRouter
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
    """Send OTP — handles both login and signup automatically."""
    user = users_collection.find_one({"email": payload.email})
    username = user.get("email", "").split("@")[0] if user else payload.email.split("@")[0]
    code = generate_and_store_otp(payload.email)
    send_otp_email(payload.email, code, username)
    return {"message": "OTP sent successfully", "code": code}


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
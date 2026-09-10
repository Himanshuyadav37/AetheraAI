import random
import string
import smtplib
import threading
# Force reload for updated .env settings
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timedelta

from fastapi import HTTPException

from config import settings
from db.mongo_client import db, users_collection
from core.security import create_access_token

otp_collection = db["otp_tokens"]


def _generate_code() -> str:
    return "".join(random.choices(string.digits, k=6))


def generate_and_store_otp(email: str) -> str:
    """Generate a 6-digit OTP, store in MongoDB with 10-min expiry."""
    email = email.lower().strip()
    otp_collection.delete_many({"email": email})

    code = _generate_code()
    otp_collection.insert_one({
        "email": email,
        "code": code,
        "expires_at": datetime.utcnow() + timedelta(minutes=10),
        "created_at": datetime.utcnow(),
    })
    return code


def _send_smtp(email: str, subject: str, html_body: str, from_email: str | None = None):
    """Send email via Resend or SMTP relay (e.g. Brevo) — runs in background thread."""
    email = email.lower().strip()
    # If using Brevo SMTP password (which is a Brevo API key), use Brevo's HTTP API directly for 100% reliability
    brevo_key = settings.SMTP_PASSWORD
    if brevo_key and (brevo_key.startswith("xsmtpsib-") or brevo_key.startswith("xkeysib-")):
        import urllib.request
        import json
        try:
            url = "https://api.brevo.com/v3/smtp/email"
            headers = {
                "api-key": brevo_key,
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            payload = {
                "sender": {
                    "name": "NexusAI AI",
                    "email": "ydvhimanshu461@gmail.com"
                },
                "to": [{"email": email}],
                "subject": subject,
                "htmlContent": html_body
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                response.read()
            print(f"[OTP SUCCESS] Sent email via Brevo API directly to {email}")
            return
        except Exception as e:
            print(f"[OTP ERROR] Failed to send email via Brevo HTTP API: {e}. Falling back...")

    # 1. Try Resend if configured
    if settings.RESEND_API_KEY:
        try:
            import resend
            resend.api_key = settings.RESEND_API_KEY
            resend_sender = "onboarding@resend.dev"
            resend.Emails.send({
                "from": f"NexusAI <{resend_sender}>",
                "to": email,
                "subject": subject,
                "html": html_body
            })
            print(f"[OTP SUCCESS] Resend Email sent successfully to {email}")
            return
        except Exception as e:
            print(f"[OTP ERROR] Resend failed, falling back to SMTP: {e}")

    # 2. Fallback to SMTP
    host = settings.SMTP_HOST
    port = settings.SMTP_PORT
    user = settings.SMTP_USER
    password = settings.SMTP_PASSWORD

    if not user or not password:
        print("[OTP WARNING] SMTP credentials not configured.")
        return

    sender = from_email or settings.SENDER_EMAIL or user
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"NexusAI <{sender}>"
    msg["To"] = email
    msg.attach(MIMEText(html_body, "html"))

    try:
        if int(port) == 465:
            with smtplib.SMTP_SSL(host, int(port), timeout=10) as server:
                server.login(user, password)
                server.sendmail(user, email, msg.as_string())
        else:
            with smtplib.SMTP(host, int(port), timeout=10) as server:
                server.starttls()
                server.login(user, password)
                server.sendmail(user, email, msg.as_string())
        print(f"[OTP SUCCESS] SMTP Email sent successfully to {email}")
    except Exception as e:
        print(f"[OTP ERROR] Failed to send email via SMTP: {e}")


def _trigger_n8n_otp_webhook(email: str, otp_code: str, username: str):
    """Triggers the n8n OTP webhook in a background thread."""
    webhook_url = settings.N8N_OTP_WEBHOOK_URL
    if not webhook_url:
        return

    def send_request():
        import json
        import urllib.request
        try:
            data = json.dumps({
                "event": "otp",
                "email": email,
                "code": otp_code,
                "username": username
            }).encode("utf-8")
            req = urllib.request.Request(
                webhook_url,
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                response.read()
            print(f"[OTP SUCCESS] Triggered n8n OTP webhook successfully to {email}")
        except Exception as e:
            print(f"Failed to trigger n8n OTP webhook: {e}")

    thread = threading.Thread(target=send_request, daemon=True)
    thread.start()


def send_otp_email(email: str, otp_code: str, username: str = "User"):
    """Queue OTP email in background thread — returns instantly."""
    # Always log the OTP to the console so developers/users can find it in server logs
    print(f"==================================================")
    print(f"[OTP LOG] Email: {email} | Code: {otp_code}")
    print(f"==================================================")

    # 1. Trigger n8n OTP webhook asynchronously in parallel if configured (non-blocking)
    if settings.N8N_OTP_WEBHOOK_URL:
        _trigger_n8n_otp_webhook(email, otp_code, username)

    # 2. Prepare and send via Brevo / Resend / SMTP directly
    html_body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #0f0f0f; color: #ffffff; border-radius: 16px; border: 1px solid #2d2d2d;">
        <div style="margin-bottom: 20px;">
            <h2 style="color: #ffffff; margin: 0 0 8px 0; font-size: 22px;">NexusAI Verification Code</h2>
            <p style="color: #9ca3af; margin: 0; font-size: 14px;">Hi {username}, enter this code to complete your login or registration.</p>
        </div>
        <div style="background: #18181b; border: 1px solid #3f3f46; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #ffffff; font-family: monospace;">{otp_code}</span>
        </div>
        <p style="color: #71717a; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
            This code will expire in <strong>10 minutes</strong>. If you did not request this code, you can safely ignore this email.
        </p>
        <div style="border-top: 1px solid #27272a; padding-top: 14px; font-size: 12px; color: #52525b;">
            NexusAI Autonomous Multi-Agent Operating System
        </div>
    </div>
    """

    subject = f"{otp_code} is your NexusAI verification code"

    # Fire and forget — don't block the API response
    thread = threading.Thread(
        target=_send_smtp,
        args=(email, subject, html_body),
        daemon=True
    )
    thread.start()


def _trigger_n8n_welcome_webhook(email: str, username: str):
    """Triggers the n8n signup webhook in a background thread."""
    webhook_url = settings.N8N_SIGNUP_WEBHOOK_URL
    if not webhook_url:
        return

    def send_request():
        import json
        import urllib.request
        try:
            data = json.dumps({
                "event": "welcome",
                "email": email,
                "username": username
            }).encode("utf-8")
            req = urllib.request.Request(
                webhook_url,
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                response.read()
        except Exception as e:
            print(f"Failed to trigger n8n signup welcome webhook: {e}")

    thread = threading.Thread(target=send_request, daemon=True)
    thread.start()


def verify_otp_and_login(email: str, code: str) -> dict:
    """Verify OTP → auto-create user if new → return JWT token."""
    email = email.lower().strip()
    code = code.strip()
    record = otp_collection.find_one({"email": email, "code": code})

    if not record:
        raise HTTPException(status_code=400, detail="Invalid OTP code")

    if datetime.utcnow() > record["expires_at"]:
        otp_collection.delete_one({"_id": record["_id"]})
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    # Delete used OTP
    otp_collection.delete_one({"_id": record["_id"]})

    # Find or auto-create user
    db_user = users_collection.find_one({"email": email})

    if not db_user:
        # New user — create automatically
        result = users_collection.insert_one({
            "email": email,
            "username": email.split("@")[0],
            "created_at": datetime.utcnow(),
            "last_login": datetime.utcnow(),
        })
        db_user = users_collection.find_one({"_id": result.inserted_id})
        
        # Replicate to PostgreSQL
        try:
            from db.postgres import save_user_pg_sync
            save_user_pg_sync(str(db_user["_id"]), db_user["email"])
        except Exception as pg_err:
            print(f"[PostgreSQL Error] Failed to replicate user on OTP verification: {pg_err}")
            
        _trigger_n8n_welcome_webhook(db_user["email"], db_user["username"])
    else:
        # Update last login
        users_collection.update_one(
            {"_id": db_user["_id"]},
            {"$set": {"last_login": datetime.utcnow()}}
        )

    # Generate JWT token
    token = create_access_token({
        "sub": str(db_user["_id"]),
        "email": db_user["email"]
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(db_user["_id"]),
            "username": db_user.get("username", email.split("@")[0]),
            "email": db_user["email"],
            "role": db_user.get("role", "user")
        }
    }

import hashlib
import hmac
import random
import secrets
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
    """Generate a hashed, expiring OTP with resend throttling."""
    email = email.lower().strip()
    now = datetime.utcnow()
    previous = otp_collection.find_one({"email": email})
    if previous and (now - previous.get("created_at", now)).total_seconds() < 30:
        raise HTTPException(status_code=429, detail="Please wait before requesting another code")
    otp_collection.delete_many({"email": email})

    code = _generate_code()
    salt = secrets.token_hex(16)
    code_hash = hashlib.sha256(f"{salt}:{code}".encode()).hexdigest()
    otp_collection.insert_one({
        "email": email,
        "code_hash": code_hash,
        "salt": salt,
        "attempts": 0,
        "expires_at": now + timedelta(minutes=10),
        "created_at": now,
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
    # Note: Duplicate n8n OTP webhook dispatch is intentionally disabled.
    # The direct backend SMTP/Brevo sender guarantees 100% fast, single-email delivery with the verified code.

    # Prepare enterprise-grade startup HTML email template
    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{otp_code} is your NexusAI Passcode</title>
</head>
<body style="margin: 0; padding: 0; background-color: #08090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="background-color: #08090b; padding: 45px 15px; width: 100%; box-sizing: border-box;">
    <div style="max-width: 540px; margin: 0 auto; background: linear-gradient(180deg, #111217 0%, #0d0e12 100%); border: 1px solid #232532; border-radius: 16px; padding: 40px 32px; color: #ffffff; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);">
      
      <!-- Brand Header -->
      <div style="text-align: center; margin-bottom: 26px;">
        <img src="https://raw.githubusercontent.com/Himanshuyadav37/NeuroForge/main/frontend/public/nexusai-logo.png" alt="NexusAI" width="165" style="max-width: 165px; height: auto; display: block; margin: 0 auto 12px auto;" />
        <div style="font-size: 10.5px; font-weight: 700; letter-spacing: 0.14em; color: #71717a; text-transform: uppercase;">Enterprise Autonomous Intelligence</div>
      </div>
      
      <div style="border-top: 1px solid #1f222e; margin-bottom: 28px;"></div>
      
      <!-- Security Code Details -->
      <div style="font-size: 20px; font-weight: 700; color: #ffffff; text-align: center; margin-bottom: 10px; letter-spacing: -0.01em;">
        One-Time Authentication Passcode
      </div>
      <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; text-align: center; margin: 0 0 24px 0;">
        Hello <strong style="color: #ffffff;">{username}</strong>, enter the 6-digit verification key below to authenticate and enter your secure workspace:
      </p>
      
      <!-- Monospace Code Card -->
      <div style="background: linear-gradient(180deg, #171821 0%, #12131a 100%); border: 1px solid #2e3245; border-radius: 12px; padding: 22px 20px; text-align: center; margin: 0 auto 24px auto; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);">
        <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #ffffff; font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; text-shadow: 0 0 16px rgba(255, 255, 255, 0.3);">{otp_code}</span>
      </div>
      
      <!-- Expiration Note -->
      <p style="color: #71717a; font-size: 12.5px; text-align: center; line-height: 1.5; margin: 0 0 24px 0;">
        &#9201; Valid for <strong style="color: #e4e4e7;">10 minutes</strong>. Never share this key with anyone. NexusAI engineers will never ask for your verification code.
      </p>
      
      <!-- Enterprise Security Badges -->
      <div style="background-color: #141620; border: 1px solid #20222e; border-radius: 8px; padding: 12px 14px; margin-bottom: 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="text-align: center; font-size: 11px; color: #a1a1aa; padding: 2px 4px;">
              <span style="color: #10b981; font-weight: bold;">&#10003;</span> SOC-2 Type II
            </td>
            <td style="text-align: center; font-size: 11px; color: #a1a1aa; padding: 2px 4px; border-left: 1px solid #27272a; border-right: 1px solid #27272a;">
              <span style="color: #38bdf8; font-weight: bold;">&#128274;</span> 256-Bit TLS
            </td>
            <td style="text-align: center; font-size: 11px; color: #a1a1aa; padding: 2px 4px;">
              <span style="color: #a855f7; font-weight: bold;">&#9889;</span> Zero-Trust Cloud
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Corporate Enterprise Footer -->
      <div style="border-top: 1px solid #1f222e; padding-top: 24px; text-align: center;">
        <div style="display: inline-block; margin-bottom: 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
            <tr>
              <td style="vertical-align: middle; padding-right: 8px;">
                <img src="https://raw.githubusercontent.com/Himanshuyadav37/NeuroForge/main/frontend/public/aethera-logo.jpg" alt="Aethera" width="22" height="22" style="border-radius: 5px; display: block;" />
              </td>
              <td style="vertical-align: middle; text-align: left;">
                <span style="color: #ffffff; font-size: 12.5px; font-weight: 700; letter-spacing: 0.04em;">Aethera</span>
                <span style="color: #71717a; font-size: 11.5px; margin-left: 4px;">&bull; Intelligence, evolved</span>
              </td>
            </tr>
          </table>
        </div>
        <div style="color: #71717a; font-size: 11px; line-height: 1.6; margin-bottom: 8px;">
          NexusAI Systems Inc. &bull; Enterprise Autonomous Computing Cloud<br />
          India
        </div>
        <div style="color: #52525b; font-size: 11px; line-height: 1.5; margin-bottom: 12px;">
          Security questions? Contact Enterprise Support at <a href="mailto:ydvhimanshu461@gmail.com" style="color: #a1a1aa; text-decoration: underline;">ydvhimanshu461@gmail.com</a>
        </div>
        <div style="color: #3f3f46; font-size: 10px; line-height: 1.4;">
          Confidential authentication transmission intended solely for {email}.<br />
          &copy; 2026 NexusAI Systems, an Aethera ecosystem enterprise. All rights reserved.
        </div>
      </div>
      
    </div>
  </div>
</body>
</html>
"""

    subject = f"{otp_code} is your NexusAI verification code"

    # Fire and forget — don't block the API response
    thread = threading.Thread(
        target=_send_smtp,
        args=(email, subject, html_body),
        daemon=True
    )
    thread.start()


def send_welcome_email(email: str, username: str = "Developer"):
    """Send enterprise welcome email directly via Brevo / SMTP."""
    email = email.lower().strip()
    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to NexusAI</title>
</head>
<body style="margin: 0; padding: 0; background-color: #08090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="background-color: #08090b; padding: 45px 15px; width: 100%; box-sizing: border-box;">
    <div style="max-width: 560px; margin: 0 auto; background: linear-gradient(180deg, #111217 0%, #0d0e12 100%); border: 1px solid #232532; border-radius: 16px; padding: 40px 34px; color: #ffffff; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);">
      
      <!-- Brand Header -->
      <div style="text-align: center; margin-bottom: 26px;">
        <img src="https://raw.githubusercontent.com/Himanshuyadav37/NeuroForge/main/frontend/public/nexusai-logo.png" alt="NexusAI" width="170" style="max-width: 170px; height: auto; display: block; margin: 0 auto 12px auto;" />
        <div style="font-size: 10.5px; font-weight: 700; letter-spacing: 0.14em; color: #71717a; text-transform: uppercase;">Enterprise Autonomous Intelligence Platform</div>
      </div>
      
      <div style="border-top: 1px solid #1f222e; margin-bottom: 28px;"></div>
      
      <!-- Welcome Heading -->
      <div style="font-size: 22px; font-weight: 700; color: #ffffff; text-align: center; margin-bottom: 12px; letter-spacing: -0.01em;">
        Welcome to NexusAI Workspace
      </div>
      <p style="color: #a1a1aa; font-size: 14.5px; line-height: 1.65; text-align: center; margin: 0 0 26px 0;">
        Hi <strong style="color: #ffffff;">{username}</strong>, your multi-agent enterprise runtime is provisioned and ready. Architect, engineer, and orchestrate autonomous systems from a unified console.
      </p>
      
      <!-- Core Capabilities Grid -->
      <div style="background-color: #14151c; border: 1px solid #232532; border-radius: 12px; padding: 22px 20px; margin-bottom: 28px;">
        <div style="font-size: 11px; font-weight: 700; color: #82828e; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.08em;">
          Enterprise Modules Initialized
        </div>
        
        <div style="margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid #1c1e28;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="width: 28px; vertical-align: top; font-size: 16px;">💻</td>
              <td style="vertical-align: top;">
                <div style="font-size: 14px; font-weight: 600; color: #ffffff;">Engineer AI</div>
                <div style="font-size: 12.5px; color: #94949e; line-height: 1.4; margin-top: 2px;">Full-stack autonomous software synthesis, live sandbox preview, and zero-shot debugging.</div>
              </td>
            </tr>
          </table>
        </div>
        
        <div style="margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid #1c1e28;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="width: 28px; vertical-align: top; font-size: 16px;">🔍</td>
              <td style="vertical-align: top;">
                <div style="font-size: 14px; font-weight: 600; color: #ffffff;">Research AI</div>
                <div style="font-size: 12.5px; color: #94949e; line-height: 1.4; margin-top: 2px;">Deep multi-perspective intelligence gathering, vector RAG citations, and structured briefs.</div>
              </td>
            </tr>
          </table>
        </div>
        
        <div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="width: 28px; vertical-align: top; font-size: 16px;">⚙️</td>
              <td style="vertical-align: top;">
                <div style="font-size: 14px; font-weight: 600; color: #ffffff;">Automation AI</div>
                <div style="font-size: 12.5px; color: #94949e; line-height: 1.4; margin-top: 2px;">Event-driven backend pipelines, continuous tool executions, and external webhook bridges.</div>
              </td>
            </tr>
          </table>
        </div>
      </div>
      
      <!-- Primary CTA Button -->
      <div style="text-align: center; margin-bottom: 30px;">
        <a href="https://nexusai.dev/workspace" style="display: inline-block; background-color: #ffffff; color: #0a0a0c; font-size: 14px; font-weight: 700; text-decoration: none; padding: 13px 32px; border-radius: 8px; box-shadow: 0 4px 16px rgba(255, 255, 255, 0.18);">
          Launch NexusAI Console &rarr;
        </a>
      </div>
      
      <!-- Enterprise Security Badges -->
      <div style="background-color: #141620; border: 1px solid #20222e; border-radius: 8px; padding: 12px 14px; margin-bottom: 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="text-align: center; font-size: 11px; color: #a1a1aa; padding: 2px 4px;">
              <span style="color: #10b981; font-weight: bold;">&#10003;</span> SOC-2 Type II
            </td>
            <td style="text-align: center; font-size: 11px; color: #a1a1aa; padding: 2px 4px; border-left: 1px solid #27272a; border-right: 1px solid #27272a;">
              <span style="color: #38bdf8; font-weight: bold;">&#128274;</span> 256-Bit TLS
            </td>
            <td style="text-align: center; font-size: 11px; color: #a1a1aa; padding: 2px 4px;">
              <span style="color: #a855f7; font-weight: bold;">&#9889;</span> Zero-Trust Cloud
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Corporate Enterprise Footer -->
      <div style="border-top: 1px solid #1f222e; padding-top: 24px; text-align: center;">
        <div style="display: inline-block; margin-bottom: 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
            <tr>
              <td style="vertical-align: middle; padding-right: 8px;">
                <img src="https://raw.githubusercontent.com/Himanshuyadav37/NeuroForge/main/frontend/public/aethera-logo.jpg" alt="Aethera" width="22" height="22" style="border-radius: 5px; display: block;" />
              </td>
              <td style="vertical-align: middle; text-align: left;">
                <span style="color: #ffffff; font-size: 12.5px; font-weight: 700; letter-spacing: 0.04em;">Aethera</span>
                <span style="color: #71717a; font-size: 11.5px; margin-left: 4px;">&bull; Intelligence, evolved</span>
              </td>
            </tr>
          </table>
        </div>
        <div style="color: #71717a; font-size: 11px; line-height: 1.6; margin-bottom: 8px;">
          NexusAI Systems Inc. &bull; Enterprise Autonomous Computing Cloud<br />
          India
        </div>
        <div style="color: #52525b; font-size: 11px; line-height: 1.5; margin-bottom: 12px;">
          Enterprise Onboarding Support: <a href="mailto:ydvhimanshu461@gmail.com" style="color: #a1a1aa; text-decoration: underline;">ydvhimanshu461@gmail.com</a>
        </div>
        <div style="color: #3f3f46; font-size: 10px; line-height: 1.4;">
          Account assigned to {email}.<br />
          &copy; 2026 NexusAI Systems, an Aethera ecosystem enterprise. All rights reserved.
        </div>
      </div>
      
    </div>
  </div>
</body>
</html>"""
    subject = "Welcome to NexusAI 👋"
    thread = threading.Thread(target=_send_smtp, args=(email, subject, html_body), daemon=True)
    thread.start()


def send_feedback_email(email: str, username: str = "Developer"):
    """Send enterprise 1-minute feedback survey email directly via Brevo / SMTP."""
    email = email.lower().strip()
    form_base = "https://himanshuydvv-neuroforge-n8n.hf.space/form/3dd074e4-b372-4af0-9914-bca6363df267"
    form_url = f"{form_base}?email={email}&name={username}"
    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>How is your experience with NexusAI?</title>
</head>
<body style="margin: 0; padding: 0; background-color: #08090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="background-color: #08090b; padding: 45px 15px; width: 100%; box-sizing: border-box;">
    <div style="max-width: 560px; margin: 0 auto; background: linear-gradient(180deg, #111217 0%, #0d0e12 100%); border: 1px solid #232532; border-radius: 16px; padding: 40px 34px; color: #ffffff; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);">
      
      <!-- Brand Header -->
      <div style="text-align: center; margin-bottom: 26px;">
        <img src="https://raw.githubusercontent.com/Himanshuyadav37/NeuroForge/main/frontend/public/nexusai-logo.png" alt="NexusAI" width="170" style="max-width: 170px; height: auto; display: block; margin: 0 auto 12px auto;" />
        <div style="font-size: 10.5px; font-weight: 700; letter-spacing: 0.14em; color: #71717a; text-transform: uppercase;">Enterprise Experience Review</div>
      </div>
      
      <div style="border-top: 1px solid #1f222e; margin-bottom: 28px;"></div>
      
      <!-- Feedback Question -->
      <div style="font-size: 21px; font-weight: 700; color: #ffffff; text-align: center; margin-bottom: 12px; letter-spacing: -0.01em;">
        How is your experience so far? 💬
      </div>
      <p style="color: #a1a1aa; font-size: 14.5px; line-height: 1.65; text-align: center; margin: 0 0 24px 0;">
        Hi <strong style="color: #ffffff;">{username}</strong>, your thoughts help us make this workspace better for builders like you.
      </p>
      
      <!-- Interactive Rating Options -->
      <div style="background-color: #14151c; border: 1px solid #232532; border-radius: 12px; padding: 22px 18px; margin-bottom: 24px; text-align: center;">
        <div style="color: #e4e4e7; font-size: 13px; font-weight: 600; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.06em;">
          Rate your initial session:
        </div>
        <div style="margin-bottom: 6px;">
          <a href="{form_url}&rating=5" style="display: inline-block; background: #1f212d; border: 1px solid #32364a; color: #ffffff; padding: 9px 15px; border-radius: 7px; text-decoration: none; font-size: 12.5px; font-weight: 600; margin: 4px;">⭐⭐⭐⭐⭐ Exceptional</a>
          <a href="{form_url}&rating=4" style="display: inline-block; background: #1f212d; border: 1px solid #32364a; color: #ffffff; padding: 9px 15px; border-radius: 7px; text-decoration: none; font-size: 12.5px; font-weight: 600; margin: 4px;">⭐⭐⭐⭐ Smooth</a>
          <a href="{form_url}&rating=3" style="display: inline-block; background: #1f212d; border: 1px solid #32364a; color: #d4d4d8; padding: 9px 15px; border-radius: 7px; text-decoration: none; font-size: 12.5px; font-weight: 600; margin: 4px;">⭐⭐⭐ Average</a>
          <a href="{form_url}&rating=issue" style="display: inline-block; background: #1f212d; border: 1px solid #32364a; color: #f87171; padding: 9px 15px; border-radius: 7px; text-decoration: none; font-size: 12.5px; font-weight: 600; margin: 4px;">⚠️ Encountered Issues</a>
        </div>
      </div>
      
      <!-- Feedback CTA -->
      <div style="text-align: center; margin-bottom: 28px;">
        <a href="{form_url}" style="display: inline-block; background-color: #ffffff; color: #0a0a0c; font-size: 14px; font-weight: 700; text-decoration: none; padding: 13px 32px; border-radius: 8px; box-shadow: 0 4px 16px rgba(255, 255, 255, 0.18);">
          Submit 30-Second Feedback &rarr;
        </a>
      </div>
      
      <!-- Enterprise Security Badges -->
      <div style="background-color: #141620; border: 1px solid #20222e; border-radius: 8px; padding: 12px 14px; margin-bottom: 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="text-align: center; font-size: 11px; color: #a1a1aa; padding: 2px 4px;">
              <span style="color: #10b981; font-weight: bold;">&#10003;</span> SOC-2 Type II
            </td>
            <td style="text-align: center; font-size: 11px; color: #a1a1aa; padding: 2px 4px; border-left: 1px solid #27272a; border-right: 1px solid #27272a;">
              <span style="color: #38bdf8; font-weight: bold;">&#128274;</span> 256-Bit TLS
            </td>
            <td style="text-align: center; font-size: 11px; color: #a1a1aa; padding: 2px 4px;">
              <span style="color: #a855f7; font-weight: bold;">&#9889;</span> Zero-Trust Cloud
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Corporate Enterprise Footer -->
      <div style="border-top: 1px solid #1f222e; padding-top: 24px; text-align: center;">
        <div style="display: inline-block; margin-bottom: 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
            <tr>
              <td style="vertical-align: middle; padding-right: 8px;">
                <img src="https://raw.githubusercontent.com/Himanshuyadav37/NeuroForge/main/frontend/public/aethera-logo.jpg" alt="Aethera" width="22" height="22" style="border-radius: 5px; display: block;" />
              </td>
              <td style="vertical-align: middle; text-align: left;">
                <span style="color: #ffffff; font-size: 12.5px; font-weight: 700; letter-spacing: 0.04em;">Aethera</span>
                <span style="color: #71717a; font-size: 11.5px; margin-left: 4px;">&bull; Intelligence, evolved</span>
              </td>
            </tr>
          </table>
        </div>
        <div style="color: #71717a; font-size: 11px; line-height: 1.6; margin-bottom: 8px;">
          NexusAI Systems Inc. &bull; Enterprise Autonomous Computing Cloud<br />
          India
        </div>
        <div style="color: #52525b; font-size: 11px; line-height: 1.5; margin-bottom: 12px;">
          Direct feedback & support: <a href="mailto:ydvhimanshu461@gmail.com" style="color: #a1a1aa; text-decoration: underline;">ydvhimanshu461@gmail.com</a>
        </div>
        <div style="color: #3f3f46; font-size: 10px; line-height: 1.4;">
          Sent to {email}.<br />
          &copy; 2026 NexusAI Systems, an Aethera ecosystem enterprise. All rights reserved.
        </div>
      </div>
      
    </div>
  </div>
</body>
</html>"""
    subject = "How was your experience with NexusAI? ✨"
    thread = threading.Thread(target=_send_smtp, args=(email, subject, html_body), daemon=True)
    thread.start()


def trigger_welcome_and_feedback_cycle(email: str, username: str = "Developer"):
    """
    1. Send Enterprise Welcome Email immediately.
    2. Schedule Enterprise Feedback Survey Email exactly 60 seconds (1 minute) later.
    3. Trigger n8n webhook in background as well.
    """
    email = email.lower().strip()
    print(f"[WELCOME LIFECYCLE] Starting 1-min feedback lifecycle for {email} ({username})")
    
    # 1. Send Welcome Email immediately
    send_welcome_email(email, username)
    
    # 2. Schedule Feedback Survey Email after exactly 60 seconds (1 minute)
    feedback_timer = threading.Timer(60.0, send_feedback_email, args=(email, username))
    feedback_timer.daemon = True
    feedback_timer.start()
    
    # 3. Trigger n8n webhook
    _trigger_n8n_welcome_webhook(email, username)


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
                "event": "signup",
                "type": "welcome",
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
            print(f"[N8N SUCCESS] Triggered welcome webhook to {email}")
        except Exception as e:
            print(f"Failed to trigger n8n signup welcome webhook: {e}")

    thread = threading.Thread(target=send_request, daemon=True)
    thread.start()


def verify_otp_and_login(email: str, code: str) -> dict:
    """Verify OTP → auto-create user if new → return JWT token."""
    email = email.lower().strip()
    code = code.strip()
    records = list(otp_collection.find({"email": email}).sort("created_at", -1).limit(1))
    record = records[0] if records else None

    if not record or record.get("attempts", 0) >= 5:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    if datetime.utcnow() > record["expires_at"]:
        otp_collection.delete_one({"_id": record["_id"]})
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    supplied_hash = hashlib.sha256(f"{record.get('salt', '')}:{code}".encode()).hexdigest()
    if not hmac.compare_digest(supplied_hash, record.get("code_hash", "")):
        otp_collection.update_one({"_id": record["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

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
        
        # Replicate to PostgreSQL in non-blocking background thread
        def _bg_pg():
            try:
                from db.postgres import save_user_pg_sync
                save_user_pg_sync(str(db_user["_id"]), db_user["email"])
            except Exception as pg_err:
                print(f"[PostgreSQL Notice] {pg_err}")
        import threading
        threading.Thread(target=_bg_pg, daemon=True).start()
    else:
        # Update last login
        users_collection.update_one(
            {"_id": db_user["_id"]},
            {"$set": {"last_login": datetime.utcnow()}}
        )

    # Trigger welcome email + 1-min feedback survey email lifecycle for every login
    trigger_welcome_and_feedback_cycle(db_user["email"], db_user.get("username", email.split("@")[0]))

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

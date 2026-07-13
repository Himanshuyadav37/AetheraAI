from pathlib import Path
from pydantic_settings import BaseSettings
from typing import List

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    GROQ_KEY_1: str
    GROQ_KEY_2: str
    GROQ_KEY_3: str

    MONGO_URL: str
    DB_NAME: str

    JWT_SECRET: str
    JWT_EXPIRE_MINUTES: int = 10080  # 7 days
    ADMIN_SECRET: str = "nexusai-admin-2024"

    CHROMA_HOST: str
    CHROMA_PORT: int

    GEMINI_API_KEY: str = ""

    RESEND_API_KEY: str = ""
    SENDER_EMAIL: str = "onboarding@resend.dev"

    GITHUB_TOKEN: str = ""

    N8N_SIGNUP_WEBHOOK_URL: str = ""
    N8N_OTP_WEBHOOK_URL: str = ""

    GMAIL_USER: str = ""
    GMAIL_APP_PASSWORD: str = ""

    SMTP_HOST: str = "smtp-relay.brevo.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    @property
    def GROQ_KEYS(self) -> List[str]:
        return [
            self.GROQ_KEY_1,
            self.GROQ_KEY_2,
            self.GROQ_KEY_3
        ]

    model_config = {
        "env_file": BASE_DIR / ".env",
        "extra": "ignore"
    }

settings = Settings()



print("Loaded:", settings.DB_NAME)
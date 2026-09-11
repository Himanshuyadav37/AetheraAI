from pathlib import Path
from pydantic_settings import BaseSettings
from typing import List
import logging

logger = logging.getLogger("nexusai.config")

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    ENV: str = "development"

    GROQ_KEY_1: str = ""
    GROQ_KEY_2: str = ""
    GROQ_KEY_3: str = ""

    MONGO_URL: str = "mongodb://localhost:27017"
    DB_NAME: str = "nexusai"

    JWT_SECRET: str = "@123superkey9807"
    JWT_EXPIRE_MINUTES: int = 10080  # 7 days
    ADMIN_SECRET: str = "nexusai-admin-2024"
    ADMIN_EMAILS: str = "ydvhimanshu461@gmail.com,admin.nexusai@gmail.com,admin@nexusai.com,admin@devpilot.ai,ydvvhimanshu461@gmail.com,himanshuydv00001@gmail.com"

    CHROMA_HOST: str = ""
    CHROMA_PORT: int = 8001

    POSTGRES_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/nexusai"
    VECTOR_STORE: str = "pinecone"
    PINECONE_API_KEY: str = ""
    PINECONE_INDEX_NAME: str = "nexusai"
    PINECONE_CLOUD: str = "aws"
    PINECONE_REGION: str = "us-east-1"
    LANGCHAIN_TRACING_V2: str = "false"
    LANGCHAIN_API_KEY: str = ""
    LANGCHAIN_PROJECT: str = "nexusai"

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    GEMINI_API_KEY: str = ""

    RESEND_API_KEY: str = ""
    SENDER_EMAIL: str = "onboarding@resend.dev"

    GITHUB_TOKEN: str = ""

    N8N_SIGNUP_WEBHOOK_URL: str = "https://himanshuydvv-neuroforge-n8n.hf.space/webhook/auth-trigger"
    N8N_OTP_WEBHOOK_URL: str = ""

    GMAIL_USER: str = ""
    GMAIL_APP_PASSWORD: str = ""

    SMTP_HOST: str = "smtp-relay.brevo.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""

    @property
    def GROQ_KEYS(self) -> List[str]:
        keys = [self.GROQ_KEY_1, self.GROQ_KEY_2, self.GROQ_KEY_3]
        return [k for k in keys if k]

    @property
    def ADMIN_EMAILS_LIST(self) -> List[str]:
        return [email.strip() for email in self.ADMIN_EMAILS.split(",") if email.strip()]

    model_config = {
        "env_file": BASE_DIR / ".env",
        "extra": "ignore"
    }

settings = Settings()

# Inject LangSmith environment variables dynamically if enabled
import os
if settings.LANGCHAIN_TRACING_V2.lower() == "true":
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    if settings.LANGCHAIN_API_KEY:
        os.environ["LANGCHAIN_API_KEY"] = settings.LANGCHAIN_API_KEY
    if settings.LANGCHAIN_PROJECT:
        os.environ["LANGCHAIN_PROJECT"] = settings.LANGCHAIN_PROJECT
else:
    os.environ["LANGCHAIN_TRACING_V2"] = "false"

print("Loaded Database:", settings.DB_NAME)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("nexusai")

from db.mongo_client import db

# ============================
# Authentication
# ============================

from auth.routes import router as auth_router

# ============================
# API Routes
# ============================

from api.users import router as user_router
from api.planner import router as planner_router
from api.projects import router as project_router

from api.routes.execution import (
    router as execution_router
)

from api.routes.admin import (
    router as admin_router
)

from api.routes.memory import (
    router as memory_router
)

from api.routes.download import (
    router as download_router
)

from api.routes.settings import (
    router as settings_router
)

from api.routes.research import (
    router as research_router
)

from api.routes.education import (
    router as education_router
)

from api.routes.user_memory import (
    router as user_memory_router
)

from api.routes.automation import (
    router as automation_router
)

from api.routes import conversations

from api.routes.github import (
    router as github_router
)

from api.routes.mcp import (
    router as mcp_router
)

from api.routes.rag import (
    router as rag_router
)

from api.routes.learnings import (
    router as learnings_router
)

from api.routes.custom_agents import (
    router as custom_agents_router
)

from api.routes.teams import (
    router as teams_router
)

from api.routes.integrations import (
    router as integrations_router
)

from api.routes.developer_api import (
    router as developer_api_router
)

from api.routes.feedback import (
    router as feedback_router
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Non-blocking startup actions in background task
    async def _bg_startup():
        # 1. Run Alembic migrations automatically
        try:
            from alembic.config import Config
            from alembic import command
            from pathlib import Path
            
            backend_dir = Path(__file__).resolve().parent
            alembic_ini_path = backend_dir / "alembic.ini"
            
            if alembic_ini_path.exists():
                alembic_cfg = Config(str(alembic_ini_path))
                from config import settings
                alembic_cfg.set_main_option("sqlalchemy.url", settings.POSTGRES_URL)
                command.upgrade(alembic_cfg, "head")
                logger.info("Database migrations completed successfully!")
        except Exception as migration_err:
            logger.warning(f"Database migrations skipped on startup: {migration_err}")

        # 2. Redis connection check
        try:
            from core.redis_client import get_redis_client
            redis_client = get_redis_client()
            pong = await asyncio.wait_for(redis_client.ping(), timeout=1.5)
            logger.info(f"[Startup] Connected to Redis successfully: {pong}")
            await redis_client.close()
        except Exception as e:
            logger.warning(f"[Startup] Redis connection check skipped: {e}")

    import asyncio
    asyncio.create_task(_bg_startup())

    yield

    # Shutdown actions
    try:
        from core.redis_client import close_redis_pool
        await close_redis_pool()
        logger.info("[Shutdown] Redis connection pool closed successfully.")
    except Exception as e:
        logger.warning(f"[Shutdown] Failed to close Redis connection pool: {e}")
    try:
        from core.redis_client import close_redis_pool
        await close_redis_pool()
        logger.info("[Shutdown] Redis connection pool closed successfully.")
    except Exception as e:
        logger.warning(f"[Shutdown] Failed to close Redis connection pool: {e}")


from fastapi import Request
from fastapi.responses import JSONResponse

app = FastAPI(
    title="NexusAI AI",
    description="Autonomous Multi-Agent AI Operating System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    tb = traceback.format_exc()
    logger.error(f"[Global Error] {request.method} {request.url.path}: {exc}\n{tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__}
    )

# ============================
# CORS (Permissive for Cloud & Local Frontends)
# ============================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================
# Root
# ============================

@app.get("/")
def root():
    return {
        "message": "NexusAI AI Running",
        "status": "online"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.get("/debug-info")
def debug_info():
    from config import settings
    return {
        "env": settings.ENV,
        "db_name": settings.DB_NAME,
        "mongo_configured": bool(settings.MONGO_URL),
        "groq_configured": bool(settings.GROQ_KEY_1),
        "resend_configured": bool(settings.RESEND_API_KEY),
    }


# ============================
# Authentication
# ============================

app.include_router(

    auth_router,

    prefix="/auth",

    tags=["Authentication"]

)

# ============================
# Users
# ============================

app.include_router(

    user_router,

    prefix="/users",

    tags=["Users"]

)

app.include_router(

    admin_router,

    prefix="/admin",

    tags=["Admin Panel"]

)

# ============================
# Planner Agent
# ============================

app.include_router(

    planner_router,

    prefix="/planner",

    tags=["Planner Agent"]

)

# ============================
# Projects
# ============================

app.include_router(

    project_router,

    prefix="/projects",

    tags=["Projects"]

)

# ============================
# AI Execution
# ============================

app.include_router(

    execution_router,

    prefix="/ai",

    tags=["NexusAI"]

)

app.include_router(

    learnings_router,

    prefix="/ai/learnings",

    tags=["Self-Learning Loop"]

)

# ============================
# Memory
# ============================

app.include_router(

    memory_router,

    prefix="/memory",

    tags=["Memory"]

)

app.include_router(
    user_memory_router,
    prefix="/memory/user",
    tags=["User Memory"]
)

app.include_router(
    user_memory_router,
    prefix="/user-memory",
    tags=["User Memory"]
)

# ============================
# Research AI
# ============================

app.include_router(

    research_router,

    prefix="/research",

    tags=["Research AI"]

)

# ============================
# Education AI
# ============================

app.include_router(

    education_router,

    prefix="/education",

    tags=["Education AI"]

)

# ============================
# Conversations
# ============================

app.include_router(

    conversations.router,

    prefix="/conversations",

    tags=["Conversations"]

)

# ============================
# Settings
# ============================

app.include_router(

    settings_router,

    prefix="/settings",

    tags=["Settings"]

)

# ============================
# Downloads
# ============================

app.include_router(

    download_router

)

# ============================
# Automation AI
# ============================

app.include_router(

    automation_router,

    prefix="/automation",

    tags=["Automation AI"]

)

# ============================
# GitHub Push Integration
# ============================
app.include_router(
    github_router,
    prefix="/github",
    tags=["GitHub"]
)

# ============================
# MCP Tools Protocol
# ============================
app.include_router(
    mcp_router,
    prefix="/mcp",
    tags=["MCP Tools"]
)

# ============================
# Multi-Layer RAG System
# ============================
app.include_router(
    rag_router,
    prefix="/rag",
    tags=["RAG System"]
)

# ============================
# Custom Agents Studio
# ============================
app.include_router(
    custom_agents_router
)

# ============================
# Team Workspaces & RBAC
# ============================
app.include_router(
    teams_router
)

# ============================
# Enterprise Integrations Hub
# ============================
app.include_router(
    integrations_router
)

# ============================
# Developer API Gateway
# ============================
app.include_router(
    developer_api_router
)


# ============================
# User Experience Feedback (n8n Loop)
# ============================
app.include_router(
    feedback_router,
    prefix="/api"
)


# ============================
# Future Modules
# ============================

# app.include_router(
#     vision_router,
#     prefix="/vision",
#     tags=["Vision AI"]
# )

# Trigger reload: jose conflict resolved.
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    # 1. Run Alembic migrations automatically on startup
    try:
        from alembic.config import Config
        from alembic import command
        from pathlib import Path
        
        backend_dir = Path(__file__).resolve().parent
        alembic_ini_path = backend_dir / "alembic.ini"
        
        if alembic_ini_path.exists():
            logger.info("Running automatic database migrations...")
            alembic_cfg = Config(str(alembic_ini_path))
            from config import settings
            alembic_cfg.set_main_option("sqlalchemy.url", settings.POSTGRES_URL)
            command.upgrade(alembic_cfg, "head")
            logger.info("Database migrations completed successfully!")
        else:
            logger.warning(f"alembic.ini not found at {alembic_ini_path}. Skipping automatic database migrations.")
    except Exception as migration_err:
        logger.warning(f"Database migrations skipped on startup (PostgreSQL may be offline/unreachable): {migration_err}")

    # 2. Initialize and verify Redis connection
    try:
        from core.redis_client import get_redis_client
        redis_client = get_redis_client()
        pong = await redis_client.ping()
        logger.info(f"[Startup] Connected to Redis successfully: {pong}")
        await redis_client.close()
    except Exception as e:
        logger.warning(f"[Startup] Redis connection check skipped (Redis may be offline): {e}")

    # 3. Bootstrap default knowledge base if empty
    try:
        from db.rag_models import documents_collection
        count = documents_collection.count_documents({"kb_id": "nexusai_knowledge"})
        if count == 0:
            import os
            from pathlib import Path
            admin_guide_path = Path(__file__).resolve().parent.parent / "NexusAI_Admin_Guide.pdf"
            if admin_guide_path.exists():
                logger.info(f"[Startup] Found default admin guide: {admin_guide_path}. Bootstrapping global RAG context...")
                from db.rag_models import create_index_job
                from services.background_indexer import process_indexing_job
                
                job_id = create_index_job(target_type="kb", target_id="nexusai_knowledge", total_files=1)
                await process_indexing_job(
                    job_id=job_id,
                    source_path_str=str(admin_guide_path),
                    source_type="file",
                    target_type="kb",
                    target_id="nexusai_knowledge",
                    org_id="nexusai_knowledge"
                )
                logger.info(f"[Startup] Global RAG context bootstrapped successfully with job {job_id}!")
            else:
                logger.info(f"[Startup] Default admin guide not found at {admin_guide_path}. Skipping global RAG bootstrap.")
    except Exception as e:
        logger.warning(f"[Startup] Failed to bootstrap global RAG context: {e}")

    yield

    # Shutdown actions
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
# Future Modules
# ============================

# app.include_router(
#     vision_router,
#     prefix="/vision",
#     tags=["Vision AI"]
# )

# Trigger reload: jose conflict resolved.
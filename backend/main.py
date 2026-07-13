from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


app = FastAPI(

    title="NexusAI AI",

    description="Autonomous Multi-Agent AI Operating System",

    version="1.0.0",

    docs_url=None,

    redoc_url=None,

)


@app.on_event("startup")
async def startup_event():
    # Bootstrap default knowledge base if empty
    try:
        from db.rag_models import documents_collection
        # Check if we have any documents indexed under global "nexusai_knowledge"
        count = documents_collection.count_documents({"kb_id": "nexusai_knowledge"})
        if count == 0:
            import os
            from pathlib import Path
            admin_guide_path = Path(__file__).resolve().parent.parent / "NexusAI_Admin_Guide.pdf"
            if admin_guide_path.exists():
                print(f"[Startup] Found default admin guide: {admin_guide_path}. Bootstrapping global RAG context...")
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
                print(f"[Startup] Global RAG context bootstrapped successfully with job {job_id}!")
            else:
                print(f"[Startup] Default admin guide not found at {admin_guide_path}. Skipping global RAG bootstrap.")
    except Exception as e:
        print(f"[Startup] Failed to bootstrap global RAG context: {e}")

# ============================
# CORS
# ============================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://nexusai-rouge.vercel.app",
        "https://nexusai.vercel.app",
        "https://devpilot-ai.vercel.app",
        "https://devpilot.ai",
        "https://www.devpilot.ai",
    ],
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

        "message": "NexusAI AI Running"

    }


@app.get("/health")
def health_check():

    return {

        "status": "healthy"

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
"""
Aethera AI - Enterprise Knowledge Base & Project Documentation
Contains detailed architectural, functional, and developer context for Aethera AI.
"""

AETHERA_PROJECT_KNOWLEDGE = """
# AETHERA AI — AUTONOMOUS MULTI-AGENT AI OPERATING SYSTEM
=============================================================================

## 👑 COMPANY, CREATOR & DEVELOPER INFORMATION:
- **Company / Brand Name**: **Aethera AI**
- **Primary Product Name**: **Aethera**
- **Tagline**: *"Intelligence beyond boundaries."*
- **Platform Purpose**: An autonomous AI platform for turning ideas into production-ready software and intelligent workflows.
- **Creator & Engineering Team**: **Aethera AI Engineering Team**
- **Role**: Advanced Generative AI Systems & Autonomous Multi-Agent Engineering Group specializing in multi-agent operating systems, scalable microservices, distributed workflows, and modern reactive web platforms.
- **Project Identity**: Aethera (Aethera AI) was designed, engineered, and developed by the **Aethera AI Engineering Team**. If a user asks which company made Aethera, who created/built/developed Aethera / this AI, what is Aethera AI, or who made this platform (in English, Hindi, Hinglish e.g. "kis company ne banaya", "company kya hai", "kisne banaya", "tumhe kisne banaya", "creator kaun hai", "who built you", "what company", "about aethera"):
  - Proudly attribute the system to **Aethera AI** (*"Intelligence beyond boundaries."*), engineered by the **Aethera AI Engineering Team**. Do not mention any personal names or external personal social media / GitHub / LinkedIn links.

---

## 🧠 1. WHAT IS AETHERA AI?
Aethera AI is an **autonomous AI platform for turning ideas into production-ready software and intelligent workflows**, engineered to orchestrate complex cognitive workflows by treating Large Language Models (LLMs) as distributed computational cores. Unlike standard chatbots that provide one-shot text, Aethera AI manages stateful, cyclic, and parallel multi-agent graphs that plan, write code, run AST checks, debug errors, deploy containers, and conduct recursive research autonomously.

### Core Philosophy:
1. **Stateful Graph Execution**: Workflows are modeled as directed cyclic graphs using LangGraph with persistent state checkpoints.
2. **Self-Healing Code Loops**: AST parsing and syntax checkers trigger a specialized Debugger Agent to isolate tracebacks and patch code automatically.
3. **Polyglot Knowledge Grounding**: Multi-tenant RAG indexes organization files, websites, and GitHub repositories with hybrid vector embeddings in ChromaDB.
4. **Enterprise Governance & Security**: Real-time PII masking, jailbreak shields, hallucination verification, and audit trails.

---

## 🛠️ 2. THE 5 SPECIALIZED AI MODULES:

### 1. 💻 Engineer AI (Autonomous Software Engineering):
- **Human-in-the-Loop (HITL) Clarification**: Before blindly generating code on ambiguous prompts, Engineer AI analyzes requirements, clarifies architecture, and presents interactive clickable option pills.
- **Enterprise Blueprints**: Generates structured executive summaries, tech stacks, file tree responsibilities, and key architectural highlights.
- **Multi-File Code Synthesis**: Generates full production-ready codebases (HTML, CSS, JS, Python, React, etc.) with real-time streaming traces.
- **AST Parsing & Self-Healing**: Automatically validates syntax and fixes runtime errors through self-correcting debugger loops.
- **Monaco Editor & Live Sandbox**: Interactive code viewer with live syntax highlighting, file tree navigation, disk sync, and live sandbox preview.
- **1-Click Export & GitHub Push**: Instant ZIP archive downloads and direct deployment/push to GitHub repositories.

### 2. 🔍 Research AI (Deep Web Intelligence & Synthesis):
- Autonomous multi-step deep web search and query decomposition.
- Live source aggregation, citation auditing, and verifiable claim tracking.
- Foldable structured research reports with executive summaries and data tables.

### 3. 🎓 Education AI (8 Specialized Tutoring Modes):
- **Learn Mode**: Concept breakdowns from first principles with real-world analogies.
- **Exam Mode**: Practice questions, mock exams, and scoring criteria.
- **Quiz Mode**: Interactive multiple-choice assessments.
- **Coding Mode**: Algorithmic challenges and step-by-step code walkthroughs.
- **Interview Mode**: Technical & behavioral mock interview simulations.
- **Roadmap Mode**: Structured step-by-step learning paths.
- **Revision Mode**: High-yield cheat sheets and summary flashcards.
- **Notes Mode**: Comprehensive study guides and markdown notes.

### 4. ⚙️ Automation AI (Workflow & Pipeline Generator):
- Visual workflow schemas and automated multi-step pipelines.
- Integrations with n8n, webhooks, Zapier, and autonomous agent triggers.
- JSON-based execution graphs for automated enterprise task processing.

### 5. 💬 Conversational AI (Multi-Turn Cognitive Dialogue):
- Persistent long-term memory across sessions.
- Automated sliding-window conversation summarization.
- User memory & personalization profile ingestion.
- Universal 1-click chat sharing with public read-only links.

---

## 🎨 3. ADDITIONAL ENTERPRISE PLATFORM CAPABILITIES:
- **Agent Studio**: Visual custom agent builder with persona prompt customization, knowledge base grounding, and 1-click iframe web embeds.
- **Collaborative Team Space**: Real-time team chat channels, collaborative Kanban sprint board, shared enterprise prompt vault, and `@aethera` AI co-pilot.
- **Integrations Hub**: 3rd-party connectors (Gmail, GitHub, Slack, Notion), developer API key manager, and live API sandbox.
- **Enterprise Admin Panel**: 5 governance sub-systems: Accounts & System Management, RAG Workspace Manager, Data Ingestion Dock, System Health & Audit Trail, AI Safety Guardrails.
- **Universal 1-Click Chat Sharing**: ChatGPT-style floating share button across all 5 models generating public links (`/share/chat/:id`).

---

## 🏗️ 4. TECHNICAL STACK & ARCHITECTURE:
- **Frontend**: React 18, Vite, TailwindCSS / Monochromatic Design System, Monaco Editor, Lucide Icons.
- **Backend API**: FastAPI (Python 3.11), Uvicorn, SlowAPI rate limiting, Pydantic v2.
- **Orchestration**: LangGraph, LangChain, Custom Multi-Agent Cyclic State Machine.
- **LLM Engine**: Groq High-Speed Inference with automated multi-key rotation (`GROQ_KEY_1`, `GROQ_KEY_2`, `GROQ_KEY_3`).
- **Databases**:
  - **MongoDB**: Conversations, project workspaces, execution traces, research sessions, agent studio configs.
  - **PostgreSQL / SQLite**: Enterprise users, RBAC auth, team spaces, Kanban boards, API keys.
  - **ChromaDB**: Multi-tenant vector database for document embeddings & RAG.
  - **Redis**: Fast caching, task queues, and rate-limiting counters.
- **Deployment**: Docker, Docker Compose, Hugging Face Spaces, Vercel.
=============================================================================
"""

NEXUSAI_PROJECT_KNOWLEDGE = AETHERA_PROJECT_KNOWLEDGE


def get_nexus_knowledge_context() -> str:
    """Returns the formatted project knowledge base string for LLM injection."""
    return AETHERA_PROJECT_KNOWLEDGE.strip()


get_aethera_knowledge_context = get_nexus_knowledge_context


def is_query_about_nexus(query: str) -> bool:
    """Checks if a user query is asking about Aethera AI, its origin, architecture, or creators."""
    q = query.lower()
    aethera_keywords = [
        "aethera", "aethera ai", "aethera-ai", "intelligence beyond boundaries",
        "nexus", "nexusai", "nexus-ai", "neuroforge", "himanshu", "creator",
        "who made you", "who built you", "who created you", "who is your developer",
        "which company", "company", "kis company", "kisne banaya", "tumhe kisne banaya",
        "architecture", "what is this platform", "kya hai ye", "5 models", "agent graphs",
        "features of aethera", "how does aethera work", "intelligence, evolved", "intelligence evolved"
    ]
    return any(kw in q for kw in aethera_keywords)


is_query_about_aethera = is_query_about_nexus

# NexusAI - Admin Configuration & Project Specifications

This guide covers system architecture, dynamic settings, and knowledge ingestion metrics for NexusAI (formerly DevPilot AI).

---

## 1. Project Overview
NexusAI is an advanced agentic software engineering and research assistant platform. It orchestrates autonomous workflows using custom large language model prompts, dynamic execution verification, and runtime isolation.

---

## 2. System Workspaces & Modules
* **🔌 Dynamic MCP Registry:** Connect local stdio processes and remote SSE events (e.g., databases, local filesystem) directly to your engineering workspace agents.
* **💻 Engineer AI:** Supports autonomous project code generation, interactive review sessions, build testing, and repository pushing.
* **🔍 Research AI:** Runs detailed competitor research, market analysis, compiles timeline details, and generates download-ready markdown reports.
* **🎓 Education AI:** Interactive programming workspace for custom tutorials, database guides, and concept tutoring.
* **⚙️ Automation AI:** Execution and scheduling workspace for backend flow integrations and workflows.

---

## 3. Suggested Admin Data & Knowledge Inputs
Admins can safely ingest the following metadata/knowledge files into the agent's context base (RAG/memory databases) to customize behavior:

| Knowledge Category | Suggested Data to Include | Usage / Context Value |
| :--- | :--- | :--- |
| **Coding Standards** | Language styling guidelines, naming conventions, lint rules. | Ensures generated code aligns with team standards. |
| **Workspace Policies** | Allowed workspaces, directory structures, build file definitions. | Keeps agent tasks confined to correct directories. |
| **MCP Integrations** | Commonly approved local processes (e.g., database schemas, filesystem limits). | Helps agent choose correct servers for task execution. |
| **Architecture Standards** | Preferred technology stacks (FastAPI, React, SQLite, Tailwind version). | Prevents compilation issues on final build outputs. |

---

## 4. Data Security Policy (Safe vs. Sensitive Data)
When populating system prompts or RAG knowledge bases, adhere to the following safety specifications:

* **Safe Data (Shareable):**
  * API endpoint signatures
  * Technology stack configurations
  * Allowed directory paths / workspace configurations
  * Database schema names
  * Deployment and build templates
* **Sensitive Data (PROHIBITED):**
  * Database passwords
  * OAuth client secrets
  * Personal Access Tokens (PATs) / SSH keys
  * Raw session tokens / API keys (should be stored in `.env` files, never in context documentation)

---

## 5. Tech Stack Specifications
* **Frontend:** Vite + React + CSS (Glassmorphic monochromatic layout).
* **Backend:** FastAPI + Uvicorn + Python driver processes.
* **Database:** MongoDB for dynamic MCP configurations, ChromaDB for vector memory indexes.
* **LLM Connection:** Groq + dynamic JSON-RPC MCP clients.

---
title: NexusAI Backend
emoji: ⚡
colorFrom: purple
colorTo: indigo
sdk: docker
app_port: 8000
pinned: false
---

# NexusAI - Autonomous Multi-Agent AI Operating System

<div align="center">

<!-- Animated Header Banner -->
<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=220&section=header&text=NexusAI&fontSize=80&fontColor=fff&animation=twinkling&fontAlignY=35&desc=Autonomous%20Multi-Agent%20AI%20Operating%20System%20%7C%20Enterprise%20Edition&descAlignY=55&descSize=20"/>

<!-- Typing SVG Subheading -->
<a href="https://git.io/typing-svg">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=24&pause=800&color=A855F7&center=true&vCenter=true&multiline=true&width=950&height=80&lines=%E2%9A%A1+Plan.+Code.+Test.+Debug.+Deploy.+Autonomously.;%F0%9F%A7%A0+5+Specialized+AI+Agent+Graphs+Running+in+Parallel;%F0%9F%94%90+Enterprise+Admin+Panel+%2B+Multi-Layer+RAG+%2B+AI+Guardrails;%F0%9F%9A%80+From+Concept+to+Production-Ready+Code+in+One+Click" alt="NexusAI Typing SVG" />
</a>

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/React%2018-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React"/>
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"/>
  <img src="https://img.shields.io/badge/Python%203.11-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python"/>
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/ChromaDB-FF4B4B?style=for-the-badge&logo=databricks&logoColor=white" alt="ChromaDB"/>
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis"/>
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"/>
  <img src="https://img.shields.io/badge/LangGraph-FF6B6B?style=for-the-badge&logo=diagram&logoColor=white" alt="LangGraph"/>
</p>

</div>

---

## 📖 Table of Contents

- [🧠 1. What is NexusAI?](#-1-what-is-nexusai)
  - [Core Philosophy](#core-philosophy)
  - [High-Level Architecture](#high-level-architecture)
- [🗄️ 2. Polyglot Database Architecture & Schemas](#️-2-polyglot-database-architecture--schemas)
  - [Entity-Relationship Diagram](#entity-relationship-diagram)
  - [Database Breakdown](#database-breakdown)
- [🛠️ 3. Core AI Modules & Specialized Agent Graphs](#️-3-core-ai-modules--specialized-agent-graphs)
  - [💻 3.1 Engineer AI (Autonomous Software Engineering)](#-31-engineer-ai-autonomous-software-engineering)
  - [🔍 3.2 Research AI (Deep Web Intelligence & Synthesis)](#-32-research-ai-deep-web-intelligence--synthesis)
  - [🎓 3.3 Education AI (8 Specialized Tutoring Modes)](#-33-education-ai-8-specialized-tutoring-modes)
  - [⚙️ 3.4 Automation AI (Workflow & Pipeline Generator)](#️-34-automation-ai-workflow--pipeline-generator)
  - [🔄 3.5 Self-Learning Feedback Loop](#-35-self-learning-feedback-loop)
  - [🔌 3.6 Model Context Protocol (MCP) Gateway](#-36-model-context-protocol-mcp-gateway)
  - [📑 3.7 Multi-Layer Multi-Tenant RAG System](#-37-multi-layer-multi-tenant-rag-system)
  - [👤 3.8 User Memory & Personalized Style Ingestion](#-38-user-memory--personalized-style-ingestion)
- [👑 4. Enterprise Admin Panel (In-Depth Operator Guide)](#-4-enterprise-admin-panel-in-depth-operator-guide)
  - [Admin Access & Security](#admin-access--security)
  - [Tab 1: System & Accounts Management](#tab-1-system--accounts-management)
  - [Tab 2: RAG Workspace Manager](#tab-2-rag-workspace-manager)
  - [Tab 3: Data Ingestion Dock](#tab-3-data-ingestion-dock)
  - [Tab 4: Settings, System Health & Audit Trail](#tab-4-settings-system-health--audit-trail)
  - [Tab 5: AI Safety Guardrails & Incident Monitor](#tab-5-ai-safety-guardrails--incident-monitor)
- [🛡️ 5. Security Architecture & Threat Prevention](#️-5-security-architecture--threat-prevention)
- [🚀 6. Installation & Quick Start Guide](#-6-installation--quick-start-guide)
  - [Prerequisites](#prerequisites)
  - [Option A: Local Development Setup](#option-a-local-development-setup)
  - [Option B: Docker Compose Setup (Recommended)](#option-b-docker-compose-setup-recommended)
- [⚙️ 7. Environment Variables (.env) Reference](#️-7-environment-variables-env-reference)
- [📡 8. Comprehensive REST API Reference](#-8-comprehensive-rest-api-reference)
- [🖥️ 9. Frontend Architecture & Design System](#️-9-frontend-architecture--design-system)
- [🧪 10. Testing & Verification](#-10-testing--verification)
- [❓ 11. Troubleshooting & FAQs](#-11-troubleshooting--faqs)
- [📄 12. License & Acknowledgments](#-12-license--acknowledgments)

---

## 🧠 1. What is NexusAI?

**NexusAI** is an **Autonomous Multi-Agent AI Operating System** designed to orchestrate complex cognitive workflows by treating Large Language Models (LLMs) as dynamic computational cores. Unlike standard chatbots that provide one-shot text responses, NexusAI manages stateful, cyclic, and parallel multi-agent graphs that plan, execute, verify, debug, and improve their own outputs in real-time.

### Core Philosophy

1. **Stateful Graph Execution:** Workflows are modeled as directed cyclic graphs (using **LangGraph**) with persistent state checkpoints.
2. **Self-Correcting Iteration:** Failures in code syntax, build tests, or validation triggers self-healing agents rather than crashing or terminating.
3. **Polyglot Knowledge Retrieval:** Multi-tenant RAG indexes organization repositories, documentation, and external tools to ground AI responses with zero hallucination.
4. **Enterprise Guardrails & Governance:** Every query passes through real-time PII masking, safety filters, grounding verification, and administrative audit logging.

### High-Level Architecture

```mermaid
flowchart TB
    subgraph ClientLayer ["Client Interface Layer (React 18 + Vite)"]
        UI["Modern Glassmorphic Web App"]
        Monaco["Monaco Code Editor & Diff Viewer"]
        Terminal["Interactive Web Terminal (XTerm/WS)"]
        AdminUI["Enterprise Admin Panel (5 Sub-Systems)"]
    end

    subgraph APILayer ["API Gateway Layer (FastAPI + SlowAPI Rate Limiter)"]
        AuthRouter["JWT & Passwordless OTP Auth"]
        AgentRouter["Multi-Agent Router & SSE Streamer"]
        RAGRouter["Multi-Tenant RAG & Embeddings Router"]
        AdminRouter["Admin & Audit Logging API"]
        MCPRouter["Model Context Protocol (MCP) Gateway"]
    end

    subgraph SecurityLayer ["Security & Safety Guardrails"]
        PIIFilter["PII Masking / Redaction Engine"]
        JailbreakShield["Jailbreak & Prompt Injection Shield"]
        GroundingChecker["Contextual Grounding & Hallucination Detector"]
        CrisisRedirect["Crisis Detection & Redirection System"]
    end

    subgraph AgentGraphs ["Autonomous Agent Execution Graphs"]
        EngineerGraph["Engineer AI Graph (Planner → Coder → Tester ⇆ Debugger → Deployer)"]
        ResearchGraph["Research AI (Scraper → Summarizer → Writer → Citation Engine)"]
        EduGraph["Education AI (8 Learning Modes + Interactive Sandbox)"]
        AutoGraph["Automation AI (n8n / Make / Zapier Pipeline Builder)"]
        LearningLoop["Self-Learning Feedback & Memory Generalizer"]
    end

    subgraph StorageLayer ["Polyglot Data & Vector Layer"]
        PostgreSQL[("PostgreSQL\n(Identity, Tasks, Relational Runs)")]
        MongoDB[("MongoDB\n(Chats, Docs, MCP Configs, Guardrails, Audits)")]
        ChromaDB[("ChromaDB / Pinecone\n(Vector Embeddings & Semantic Index)")]
        RedisDB[("Redis\n(Rate Limiting & Session Cache)")]
    end

    UI --> APILayer
    AdminUI --> APILayer
    APILayer --> SecurityLayer
    SecurityLayer --> AgentGraphs
    AgentGraphs --> StorageLayer
```

---

## 🗄️ 2. Polyglot Database Architecture & Schemas

NexusAI implements a **Polyglot Persistence** architecture to satisfy high-throughput transactions, document flexibility, vector similarity search, and ephemeral caching.

### Entity-Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : owns
    PROJECTS ||--o{ TASKS : triggers
    TASKS ||--o{ AGENT_RUNS : logs
    ORGANIZATIONS ||--o{ KNOWLEDGE_BASES : contains
    KNOWLEDGE_BASES ||--o{ DOCUMENTS : indexes
    DOCUMENTS ||--o{ DOCUMENT_CHUNKS : splits_into

    USERS {
        string id PK "User ID (UUID/String)"
        string email "Unique Email Address"
        string hashed_password "Nullable for OTP Auth"
        datetime created_at "Registration Timestamp"
    }

    PROJECTS {
        string id PK "Project ID (UUID/String)"
        string user_id FK "Owner User ID"
        string name "Project / Application Name"
        datetime created_at "Creation Timestamp"
    }

    TASKS {
        string id PK "Execution Task ID"
        string project_id FK "Project ID"
        string status "running | completed | failed"
        string agent_assigned "planner | coder | tester | debugger | deployer"
        datetime created_at "Start Time"
        datetime completed_at "Finish Time"
    }

    AGENT_RUNS {
        int id PK "Auto-Increment Primary Key"
        string task_id FK "Task ID"
        string agent_name "Active Agent Step"
        string input_summary "Truncated Agent Input"
        string output_summary "Generated Artifact / Code Summary"
        string status "success | retry | error"
        int duration_ms "Execution Duration (ms)"
        datetime created_at "Run Timestamp"
    }

    ORGANIZATIONS {
        string id PK "MongoDB ObjectId"
        string name "Organization Name"
        string owner_id "Owner User ID"
        string[] user_ids "Permitted Member IDs"
        datetime created_at "Creation Date"
    }

    KNOWLEDGE_BASES {
        string id PK "MongoDB ObjectId"
        string org_id FK "Organization ID"
        string name "Knowledge Base Name"
        string description "Domain / Purpose Description"
        datetime created_at "Creation Date"
    }

    DOCUMENTS {
        string id PK "MongoDB ObjectId"
        string kb_id FK "Knowledge Base ID"
        string org_id "Organization ID"
        string filename "Original File Name"
        string hash "SHA-256 Checksum"
        int size_bytes "File Size in Bytes"
        int chunk_count "Total Number of Generated Chunks"
        string status "indexing | completed | failed"
        datetime created_at "Upload Timestamp"
    }
```

### Database Breakdown

| Database System | Primary Responsibility | Key Collections / Tables |
| :--- | :--- | :--- |
| **PostgreSQL (Async via SQLAlchemy + Alembic)** | Relational data, strict transactional integrity, execution step timing, user identity. | `users`, `projects`, `tasks`, `agent_runs` |
| **MongoDB (PyMongo)** | Flexible document storage, conversational state, dynamic MCP configs, guardrails configuration, audit logs, RAG metadata. | `users`, `conversations`, `research_sessions`, `automation_conversations`, `organizations`, `knowledge_bases`, `documents`, `index_jobs`, `audit_logs`, `guardrail_logs`, `learnings`, `mcp_servers` |
| **ChromaDB / Pinecone** | High-dimensional vector indexing for semantic similarity search, hybrid dense retrieval, self-learning memory. | `nexusai_knowledge`, `user_memory_{user_id}`, `workspace_{org_id}` |
| **Redis** | In-memory token rate-limiting (`slowapi`), session token cache, real-time background task synchronization. | Ephemeral keys, rate limit counters, lock tokens |

---

## 🛠️ 3. Core AI Modules & Specialized Agent Graphs

---

### 💻 3.1 Engineer AI (Autonomous Software Engineering)

The **Engineer AI** module translates natural language project ideas into full-stack, modular, tested, and containerized applications.

```
                    ┌────────────────────────┐
                    │       User Idea        │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │     PLANNER AGENT      │◄────────────────────────┐
                    │  (Architects Blueprint)│                         │
                    └───────────┬────────────┘                         │
                                │                                      │
                                ▼                                      │
                    ┌────────────────────────┐                         │
                    │      CODER AGENT       │                         │
                    │ (Generates Code & RAG) │                         │
                    └───────────┬────────────┘                         │
                                │                                      │
                                ▼                                      │
                    ┌────────────────────────┐                         │
                    │      TESTER AGENT      │                         │
                    │ (AST & Syntax Analysis)│                         │
                    └───────────┬────────────┘                         │
                                │                                      │
                  ┌─────────────┴─────────────┐                        │
                  ▼                           ▼                        │
          [ Critical Bugs? ]         [ All Tests Pass? ]               │
                  │                           │                        │
                  ▼ Yes                       ▼ Yes                    │
         ┌──────────────────┐        ┌──────────────────┐              │
         │  DEBUGGER AGENT  │        │  DEPLOYER AGENT  │              │
         │ (Patches Source) │        │ (Docker/K8s Gen) │              │
         └────────┬─────────┘        └────────┬─────────┘              │
                  │                           │                        │
                  └───────────────────────────┼────────────────────────┘ (Up to Max Retries)
                                              │
                                              ▼
                                     ┌──────────────────┐
                                     │ Production Build │
                                     │  & GitHub Push   │
                                     └──────────────────┘
```

#### Graph Agents in Detail:
1. **Planner Agent:** Analyzes the user's prompt, queries the Vector DB for matching architectures, blueprints directory structures, file dependencies, and packages.
2. **Coder Agent:** Iterates through the planned files, generating production-grade, modular code while adhering to the user's custom coding guidelines.
3. **Tester Agent:** Validates files using AST parsing, syntax validation, and automated Python compilation checks, returning a structured JSON issue report.
4. **Debugger Agent:** Reads traceback and test failure reports, isolates buggy lines, generates corrected source files, and loops back to the Tester.
5. **Deployer Agent:** Generates container configuration files (`Dockerfile`, `docker-compose.yml`, `k8s-manifest.yaml`) and deployment runbooks.

#### Key Engineering Features:
- **Live SSE Streaming (`/ai/{execution_id}/stream`):** Streams agent transitions, token outputs, and file generations to the client in real-time.
- **Interactive Web Terminal (`/ai/{execution_id}/terminal`):** Run bash/powershell commands inside the isolated project directory directly through the web UI.
- **Visual Code Diffing (`/ai/{execution_id}/diff`):** Side-by-side comparison between execution iterations with one-click snapshot rollback.
- **1-Click AI Error Patching:** Fix compilation or runtime errors with AI-suggested code patches directly within the workspace file viewer.
- **GitHub Sync Integration (`/github/push`):** Creates a public or private GitHub repository using the user's Personal Access Token (PAT) and pushes the generated codebase automatically.

---

### 🔍 3.2 Research AI (Deep Web Intelligence & Synthesis)

A parallelized research assistant that searches the web, crawls content, validates factual grounding, and produces publication-ready Markdown reports.

* **Research Planner:** Deconstructs complex user prompts into targeted sub-queries.
* **Search & Scraper Engine:** Queries search engines and parses semantic webpage content while stripping boilerplate markup.
* **Summarizer Agent:** Distills key metrics, statistical claims, quotes, and findings.
* **Writer Agent:** Assembles findings into a clear, structured report with executive summaries and analytical comparisons.
* **Quality Reviewer:** Checks report consistency against scraped context to eliminate hallucinations.
* **Citation Compiler:** Embeds numbered footnote citations linking back to original sources.
* **Research Depth Modes:**
  - `Fast Mode`: High-speed summary from top search results.
  - `Deep Mode`: Multi-hop recursive research exploring secondary references.

---

### 🎓 3.3 Education AI (8 Specialized Tutoring Modes)

Education AI uses an intelligent keyword router to automatically detect the learner's intent and activate the appropriate educational mode:

| Mode | Target Purpose | Features & Outputs |
| :--- | :--- | :--- |
| **1. Learn Mode** | Conceptual Understanding | Deep conceptual breakdowns, real-world analogies, and interactive code snippets. |
| **2. Coding Sandbox** | Hands-On Practice | Algorithmic programming problems with automated test case evaluation. |
| **3. Interview Prep** | Technical Interview Readiness | Role-specific technical questions, follow-up probes, and structured rubric scoring. |
| **4. Quiz Engine** | Knowledge Assessment | Dynamic Multiple-Choice Questions (MCQs) and True/False assessments with instant explanations. |
| **5. Flashcard Review** | Memory Retention | Spaced-repetition card decks with active recall question/answer pairs. |
| **6. Roadmap Generator** | Structured Learning Paths | Generates visual, interactive learning timeline diagrams rendered in **Mermaid.js**. |
| **7. Smart Notes** | Quick Revision & Study Material | Structured, clean Markdown notes with key takeaways, bulleted summaries, and downloadable formatting. |
| **8. Exam Simulator** | Mock Exam Drills | Timed exam environments with strict grading rubrics and performance analysis. |

---

### ⚙️ 3.4 Automation AI (Workflow & Pipeline Generator)

Converts plain-English automation requests into production-ready workflow files for **n8n**, **Make (Integromat)**, and **Zapier**.

* **Plan Agent:** Extracts triggers, destination services, data mappings, authentication nodes, and conditional branches.
* **Workflow Generator:** Outputs compliant JSON files ready to import directly into n8n or Make.
* **Validator Agent:** Scans the workflow graph for circular loops, orphaned nodes, or missing environment variables.
* **Roadmap Formatter:** Visualizes the automated flow with a Mermaid sequence diagram and provides an environment configuration guide.

---

### 🔄 3.5 Self-Learning Feedback Loop

NexusAI continuously improves by analyzing the outcome of every agent execution:

1. **Execution Telemetry:** Tracks runtime errors, successful bug patches, and user modifications.
2. **Knowledge Generalization:** An LLM distills the root cause and effective solution into a generalized "learning item."
3. **Vector Ingestion:** The lesson is embedded and stored in the vector database.
4. **Dynamic Context Retrieval:** Future runs of Coder and Debugger agents query past learnings, preventing repeat mistakes.
5. **Learnings Management (`/ai/learnings`):** Users and admins can review, enable/disable, or delete stored learnings.

---

### 🔌 3.6 Model Context Protocol (MCP) Gateway

NexusAI functions as an **MCP Client Gateway**, allowing agents to connect to external systems and execute tools dynamically:

* **Dual Transport Support:**
  - `stdio`: Local processes, binaries, and Python scripts.
  - `sse`: Remote microservices communicating via Server-Sent Events.
* **Dynamic Tool Discovery:** Connects to registered MCP servers, fetches their tool definitions via JSON-RPC 2.0, and injects them into the agent toolset.
* **Built-In Connectors:**
  - `send_email`: Email dispatch via Resend API or direct SMTP.
  - `push_to_github`: Automated repository creation and code pushing.
* **MCP Server Management (`/mcp`):** Register, test connection, inspect schemas, and toggle tools via the web UI.

---

### 📑 3.7 Multi-Layer Multi-Tenant RAG System

A high-performance Knowledge Management and Retrieval-Augmented Generation pipeline:

* **Tenant Hierarchy:** `Organizations` ➔ `Workspaces` ➔ `Knowledge Bases` ➔ `Documents` ➔ `Vector Chunks`.
* **Background Ingestion Worker (`background_indexer.py`):** Asynchronously parses, chunks, and vectorizes documents without blocking the main event loop.
* **Supported Ingestion Sources:**
  - **Local Files:** PDF, TXT, DOCX, Markdown (up to 50MB).
  - **Web Scraping:** Single URLs or recursive website crawling.
  - **GitHub Repositories:** Clones and vectorizes public repositories.
* **Chunking Algorithms:**
  - *Recursive Character Splitting* (Hierarchical paragraph/sentence segmentation).
  - *Regular Expression Splitting* (Custom boundary patterns).
  - *Fixed Character Chunking* (Deterministic offset windows).
* **Streaming RAG Chat (`/rag/chat-stream`):** Real-time token-streamed answers with semantic grounding context and source document citations.
* **Chat Promotion:** Promote important chat responses or learnings directly into the RAG Knowledge Base with one click.

---

### 👤 3.8 User Memory & Personalized Style Ingestion

Personalizes LLM responses by maintaining long-term context:

* **Coding Style Preferences:** Configures preferred paradigms (Functional vs OOP), naming conventions (camelCase, snake_case), and commenting styles.
* **Long-Term Memory Storage (`/memory/user`):** Stores user preferences, project background, and tech stack constraints in a dedicated vector space.

---

## 👑 4. Enterprise Admin Panel (In-Depth Operator Guide)

The **Admin Panel** (`/admin`) provides comprehensive visibility, security controls, and resource management across the entire platform.

---

### Admin Access & Security

- **Access Guard:** Restricted to accounts whose email exists in `ADMIN_EMAILS` or has the `admin` role. Unauthorized requests return `403 Forbidden`.
- **JWT Authorization:** Requires a valid `Bearer <token>` with administrative claims.

---

### Tab 1: System & Accounts Management

<div align="center">
  <img width="90%" src="https://img.shields.io/badge/Admin%20Tab-System%20%26%20Accounts-gold?style=for-the-badge&logo=shield" alt="System & Accounts"/>
</div>

#### 1. Live Operational Statistics
- **Users Count:** Total registered system users.
- **Conversations Count:** Total active and archived Generative Chat threads.
- **Education Sessions:** Count of active tutoring and quiz sessions.
- **Projects Count:** Total software applications generated by Engineer AI.
- **Research Runs:** Completed and active market/technical research sessions.
- **Automations:** Active workflow integration graphs.

#### 2. Live Resource & Hardware Telemetry Gauges
- **CPU Load Gauge:** Real-time dynamic processor utilization display.
- **RAM Allocation Gauge:** Live memory consumption percentage.
- **Vector DB Storage Gauge:** Dedicated vector index disk utilization metrics.

#### 3. Active AI Model Distribution Panel
Visualizes model routing distribution across the platform:
- `Groq GPT-OSS 120B (Primary)`: ~65% load
- `AWS Bedrock Claude 3.5 Sonnet`: ~20% load
- `Google Gemini Pro`: ~15% load

#### 4. Registered Accounts Directory & Search
- Instant real-time search across usernames and emails.
- **Role Control:** Change account access levels on the fly (`employee`, `manager`, `admin`).
- **Workspace Query Quota Manager:** Increase or decrease per-user chat and generation limits with `+1` / `-1` quick buttons or custom values.
- **Account Deletion (Cascade Wipe):** Permanently removes the user and automatically deletes all their associated chat threads, projects, research sessions, and automations.

#### 5. Deep 360° User History Inspector
Click any user in the table to open a split-pane deep audit view covering all 5 agent modules:
- **Generative Chat:** Inspect user and assistant conversation transcripts.
- **Education AI:** Review student quiz scores, notes, and roadmaps.
- **Developer AI Projects:** Inspect the project plan, generated code files, timeline steps, and debug iterations.
- **Research AI:** Read generated Markdown research reports, supervisor activity timelines, and inter-agent messages.
- **Automation AI:** View generated n8n/Make workflow configurations and action chains.

---

### Tab 2: RAG Workspace Manager

Manage multi-tenant knowledge bases, organizations, and indexed documents.

* **Organization Management:** Create new organizations, assign owners, and manage team members.
* **Knowledge Base Explorer:** Create scoped knowledge bases within organizations.
* **Indexed Files Table:**
  - Displays file name, SHA-256 hash preview, file size, and total chunk count.
  - Status indicators (`completed`, `indexing`, `failed`).
  - **Reindex Action:** Re-triggers chunking and embedding updates for modified documents.
  - **Delete Action:** Removes the document metadata from MongoDB and purges vector embeddings from ChromaDB.

---

### Tab 3: Data Ingestion Dock

Vectorize external data sources into any target organization and knowledge base:

1. **File Upload Mode:** Drag and drop PDF, TXT, DOCX, and Markdown files (up to 50MB) with batch upload support.
2. **Website Scraper Mode:** Ingest content from any public documentation URL or web page.
3. **GitHub Repository Mode:** Clone and index public GitHub repositories.
4. **Real-Time Progress Tracking:** Live progress bar and chunk ingestion status during background processing.

---

### Tab 4: Settings, System Health & Audit Trail

#### 1. Data Chunking & Splitting Configuration
- **Chunk Character Size:** Set base token/character size per chunk (default: `1000`).
- **Chunk Overlap:** Configure boundary overlap characters to preserve context (default: `150`).
- **Splitting Strategy:** Choose between *Recursive Character Splitting*, *Regex Divider*, or *Fixed Character Offset*.
- **Session Expiry:** Set TTL for temporary workspace sessions (default: `1440` minutes / 24 hours).

#### 2. System Health & Core Metrics
- Host Operating System and architecture.
- Python runtime engine version.
- MongoDB and ChromaDB connection statuses.
- Total vectorized chunk count and total registered document storage size.

#### 3. Security & Activity Audit Trail
- Chronological audit log of all administrative actions (role updates, quota modifications, account deletions, system wipes).
- Includes UTC timestamp, administrator email, action type, and details.
- **Export Logs:** One-click download of audit logs in JSON format.

#### 4. Danger Zone: Global System Cleanup
- **Wipe System Workspace History:** Cleans all project workspaces, chat sessions, research runs, and automations across the platform while preserving user accounts and credentials.

---

### Tab 5: AI Safety Guardrails & Incident Monitor

<div align="center">
  <img width="90%" src="https://img.shields.io/badge/Admin%20Tab-AI%20Safety%20Guardrails-red?style=for-the-badge&logo=security" alt="AI Safety Guardrails"/>
</div>

#### 1. Dynamic Toggleable Defense Switches
- 🛡️ **Content Filters:** Detects and blocks toxic, abusive, or harmful prompts.
- 🚫 **Denied Topics Filter:** Prevents discussions on prohibited topics (e.g., malware creation, illegal actions).
- 🔤 **Restricted Word Filters:** Enforces custom keyword blocklists.
- 🔒 **Sensitive Information (PII) Redaction:** Automatically detects and masks Credit Card numbers, Social Security Numbers (SSN), API keys, and email addresses.
- 🎯 **Contextual Grounding Checks:** Validates LLM responses against retrieved RAG chunks to flag or block hallucinations.
- ⚡ **Jailbreak & Prompt Injection Shield:** Evaluates incoming prompts using semantic LLM classification to block jailbreak patterns.
- 🆘 **Crisis Intervention & Redirects:** Intercepts distress signals and redirects users to verified support helplines.

#### 2. Blocklist & Prohibited Subject Manager
- Add and remove custom blocked words or API key patterns in real-time.
- Manage prohibited topic categories dynamically without redeploying the backend.

#### 3. Live Safety Incidents Audit Log
- Displays real-time security violation events with timestamps, violated filter category, prompt snippet, and action taken (`blocked`, `redacted`, `redirected`).
- **Export Safety Logs:** Download incident reports for compliance reviews.

---

## 🛡️ 5. Security Architecture & Threat Prevention

NexusAI incorporates defense-in-depth principles across all API routes and agent interactions:

```mermaid
flowchart LR
    UserQuery["User Input Prompt"] --> RateLimit["SlowAPI Rate Limiter"]
    RateLimit --> PIIEngine["PII Redaction Engine"]
    PIIEngine --> JailbreakScan["Jailbreak / Injection Detector"]
    JailbreakScan --> TopicCheck["Denied Topics & Word Filter"]
    TopicCheck --> LLM["LLM Processing Core"]
    LLM --> Grounding["Grounding & Hallucination Check"]
    Grounding --> SanitizedResponse["Sanitized Output to User"]
```

1. **Passwordless OTP Authentication:** Time-sensitive 6-digit OTP delivered via SMTP / Resend prevents credential theft and brute-force attacks.
2. **JWT Authorization:** HMAC-SHA256 signed tokens with configurable expiration (default: 7 days) and strict role validation (`admin`, `manager`, `employee`).
3. **Database Injection Protection:** SQLAlchemy ORM parameterization and MongoDB BSON sanitization prevent SQL and NoSQL injection attacks.
4. **Isolated Project Directories:** Every code generation task runs in a dedicated directory under `backend/generated_projects/{execution_id}` with strict path traversal prevention.
5. **Rate Limiting:** IP and user-based request throttling managed via Redis and `slowapi`.

---

## 🚀 6. Installation & Quick Start Guide

### Prerequisites

Ensure you have the following installed on your host machine:
- **Python:** `3.10` or `3.11` (Python 3.11 recommended)
- **Node.js:** `18.x` or `20.x` & `npm`
- **MongoDB:** Local instance on port `27017` or MongoDB Atlas URI
- **PostgreSQL:** Local instance on port `5432` or hosted PostgreSQL
- **Redis:** Local instance on port `6379`
- **Groq API Key:** Free key from [Groq Console](https://console.groq.com)

---

### Option A: Local Development Setup

#### 1. Clone the Repository
```bash
git clone https://github.com/Himanshuyadav37/nexusai-ai.git
cd nexusai-ai
```

#### 2. Backend Setup
```bash
cd backend

# Create and activate Python virtual environment
python -m venv venv

# Windows (PowerShell / CMD):
.\venv\Scripts\activate

# macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env from template
cp .env.example .env
```

Configure your `backend/.env` file (see [Environment Variables Reference](#️-7-environment-variables-env-reference)).

```bash
# Run PostgreSQL database migrations
alembic upgrade head

# Start FastAPI backend server with hot-reloading
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
*The backend API will be available at `http://localhost:8000`.*

#### 3. Frontend Setup
Open a new terminal window:
```bash
cd frontend

# Install Node modules
npm install

# Create .env file
cp .env.example .env
```

Ensure `frontend/.env` contains:
```env
VITE_API_URL=http://localhost:8000
```

```bash
# Start Vite development server
npm run dev
```
*The frontend application will be available at `http://localhost:5173`.*

---

### Option B: Docker Compose Setup (Recommended)

Boot all services (FastAPI, React, PostgreSQL, MongoDB, Redis, and ChromaDB) with a single command:

```bash
# Copy and configure environment variables in the root directory
cp backend/.env.example .env

# Build and start all containers
docker-compose up --build
```

To run in detached background mode:
```bash
docker-compose up -d
```

To stop all services:
```bash
docker-compose down
```

---

## ⚙️ 7. Environment Variables (.env) Reference

### Backend `.env` Configuration

| Variable Name | Required | Default Value | Description |
| :--- | :---: | :--- | :--- |
| `ENV` | Yes | `development` | Environment mode (`development` or `production`). |
| `GROQ_KEY_1` | Yes | — | Primary Groq API key for high-speed LLM inference. |
| `GROQ_KEY_2` | Yes | — | Secondary Groq key for automatic round-robin rotation. |
| `GROQ_KEY_3` | Yes | — | Tertiary Groq key for load distribution. |
| `GROQ_MODEL` | No | `openai/gpt-oss-120b` | Groq model identifier for agent execution. |
| `MONGO_URL` | Yes | `mongodb://localhost:27017` | MongoDB connection connection URI. |
| `DB_NAME` | Yes | `nexusai` | Target MongoDB database name. |
| `POSTGRES_URL` | Yes | `postgresql+asyncpg://postgres:postgres@localhost:5432/nexusai` | PostgreSQL async connection string. |
| `REDIS_HOST` | No | `localhost` | Redis server hostname. |
| `REDIS_PORT` | No | `6379` | Redis server port. |
| `JWT_SECRET` | Yes | — | Secret key used to sign HMAC-SHA256 JWT tokens. |
| `JWT_EXPIRE_MINUTES`| No | `10080` (7 days) | JWT session lifetime in minutes. |
| `ADMIN_SECRET` | Yes | — | Secret key used to bootstrap admin privileges. |
| `ADMIN_EMAILS` | Yes | `admin@nexusai.com` | Comma-separated list of whitelisted admin emails. |
| `VECTOR_STORE` | No | `chroma` | Vector database backend (`chroma` or `pinecone`). |
| `CHROMA_HOST` | No | `localhost` | ChromaDB server host (leave blank for local directory). |
| `CHROMA_PORT` | No | `8001` | ChromaDB server port. |
| `PINECONE_API_KEY` | No | — | Pinecone API key (if using Pinecone as vector store). |
| `PINECONE_INDEX_NAME`| No| `nexusai` | Target Pinecone vector index name. |
| `SMTP_HOST` | No | `smtp-relay.brevo.com` | SMTP relay server for sending OTP emails. |
| `SMTP_PORT` | No | `587` | SMTP port (typically 587 for TLS). |
| `SMTP_USER` | No | — | SMTP account username / email. |
| `SMTP_PASSWORD` | No | — | SMTP account password / API key. |
| `RESEND_API_KEY` | No | — | Resend API key (alternative email dispatch service). |
| `SENDER_EMAIL` | No | `onboarding@resend.dev` | Sender address for transactional emails. |
| `GITHUB_TOKEN` | No | — | Default GitHub Personal Access Token for repository pushes. |
| `LANGCHAIN_TRACING_V2`| No| `false` | Enable LangSmith execution tracing (`true` / `false`). |
| `LANGCHAIN_API_KEY` | No | — | LangSmith API Key for agent graph telemetry. |

---

## 📡 8. Comprehensive REST API Reference

### 🔐 Authentication Endpoints

#### 1. Request Passwordless OTP
```http
POST /auth/send-otp
Content-Type: application/json

{
  "email": "developer@company.com"
}
```
**Response (`200 OK`):**
```json
{
  "message": "Verification OTP sent successfully to developer@company.com"
}
```

#### 2. Verify OTP & Authenticate
```http
POST /auth/verify-otp
Content-Type: application/json

{
  "email": "developer@company.com",
  "code": "849201"
}
```
**Response (`200 OK`):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "65f1a2b3c4d5e6f7a8b9c0d1",
    "email": "developer@company.com",
    "username": "developer",
    "role": "employee",
    "limit": 50
  }
}
```

---

### 💻 Multi-Agent Software Engineering Endpoints

#### 1. Trigger Autonomous Project Generation
```http
POST /ai/generate
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "idea": "Build a real-time collaborative whiteboard using FastAPI, WebSockets, and Canvas API.",
  "project_id": "proj_whiteboard_01"
}
```
**Response (`200 OK`):**
```json
{
  "execution_id": "exec_883921",
  "status": "running",
  "message": "Autonomous multi-agent LangGraph workflow initiated."
}
```

#### 2. Real-Time SSE Stream
```http
GET /ai/exec_883921/stream
Authorization: Bearer <JWT_TOKEN>
Accept: text/event-stream
```
*Streams live JSON events:*
```json
data: {"type": "step", "agent": "planner", "message": "Designing architecture and module layout..."}
data: {"type": "file_write", "file": "main.py", "status": "completed"}
data: {"type": "test_ast", "status": "passed", "errors": []}
data: {"type": "complete", "execution_id": "exec_883921"}
```

#### 3. Execute Terminal Command in Workspace
```http
POST /ai/exec_883921/terminal
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "command": "pytest tests/ -v"
}
```

---

### 📑 Multi-Tenant RAG System Endpoints

#### 1. Create Organization
```http
POST /rag/organizations
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "name": "Acme Engineering"
}
```

#### 2. Ingest Document to Knowledge Base
```http
POST /rag/ingest
Authorization: Bearer <JWT_TOKEN>
Content-Type: multipart/form-data

file: <binary_pdf_or_txt>
org_id: "org_65f1a2"
kb_id: "kb_9921ef"
```

#### 3. Streaming RAG Chat
```http
POST /rag/chat-stream
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "query": "What are our internal coding guidelines for FastAPI error handlers?",
  "org_id": "org_65f1a2",
  "kb_id": "kb_9921ef"
}
```

---

### 👑 Enterprise Admin Endpoints

#### 1. System Statistics & Telemetry
```http
GET /admin/stats
Authorization: Bearer <ADMIN_JWT_TOKEN>
```
**Response (`200 OK`):**
```json
{
  "stats": {
    "users": 142,
    "conversations": 1890,
    "education": 430,
    "projects": 312,
    "research": 185,
    "automation": 94
  },
  "system_info": {
    "os": "Windows 11",
    "python": "3.11.8",
    "db_status": "Connected (MongoDB)",
    "platform_status": "Operational"
  }
}
```

#### 2. Update User Limit & Role
```http
POST /admin/users/65f1a2b3c4d5/limit
Authorization: Bearer <ADMIN_JWT_TOKEN>
Content-Type: application/json

{ "limit": 100 }
```

```http
POST /admin/users/65f1a2b3c4d5/role
Authorization: Bearer <ADMIN_JWT_TOKEN>
Content-Type: application/json

{ "role": "manager" }
```

#### 3. Retrieve Full User Session History Across All 5 Models
```http
GET /admin/users/65f1a2b3c4d5/history
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

#### 4. Save Safety Guardrails Configuration
```http
POST /admin/guardrails/config
Authorization: Bearer <ADMIN_JWT_TOKEN>
Content-Type: application/json

{
  "content_filter_enabled": true,
  "denied_topics_enabled": true,
  "word_filter_enabled": true,
  "pii_filter_enabled": true,
  "grounding_check_enabled": true,
  "jailbreak_shield_enabled": true,
  "crisis_redirection_enabled": true,
  "blocked_words": ["DROP TABLE", "rm -rf", "api_key_secret"],
  "denied_topics": ["malware creation", "credit card generation"]
}
```

---

## 🖥️ 9. Frontend Architecture & Design System

The NexusAI frontend is built with **React 18** and **Vite**, featuring a responsive dark glassmorphic design system:

* **Theme Variables (`theme.css` & `Index.css`):** Consistent HSL color tokens, neon accent borders, smooth gradients, and glassmorphic card backdrops.
* **Component Architecture:**
  - `WorkspacePage.jsx`: Unified full-screen developer workspace with split panes for chat, live execution logs, and file tree exploration.
  - `AdminPanel.jsx`: 5-tab executive control center with real-time gauges, user search, audit tables, and safety controls.
  - `FileViewer.jsx`: Syntax-highlighted code editor with diff view mode and 1-click patching.
  - `Navbar.jsx` & `Sidebar.jsx`: Collapsible navigation with active model status and agent selection.
* **Icons:** Powered by `lucide-react` for clean, modern iconography.

---

## 🧪 10. Testing & Verification

NexusAI includes a suite of automated unit and integration tests covering agent graphs, guardrail filters, RAG indexing, and MCP tool execution.

```bash
cd backend

# Run all pytest suites
pytest tests/ -v

# Run safety guardrail tests specifically
pytest tests/test_guardrails.py -v

# Run RAG vector search tests
pytest tests/test_rag.py -v
```

---

## ❓ 11. Troubleshooting & FAQs

#### Q1: Database connection errors on startup (PostgreSQL or MongoDB).
- Ensure PostgreSQL is running on port `5432` with database `nexusai` created.
- Ensure MongoDB is running on port `27017`.
- Run `alembic upgrade head` in `backend/` to apply PostgreSQL schemas.

#### Q2: Groq rate limit errors (`429 Too Many Requests`).
- NexusAI includes an automated multi-key rotation mechanism. Add up to 3 distinct Groq API keys in `.env` (`GROQ_KEY_1`, `GROQ_KEY_2`, `GROQ_KEY_3`) to automatically balance load and prevent rate limit exhaustion.

#### Q3: How do I grant an account Admin permissions?
- Add the user's email address to `ADMIN_EMAILS` in your backend `.env` file (comma-separated), or update their role to `admin` directly through the Admin Panel (`/admin`).

#### Q4: ChromaDB vector data persistence.
- Vector data is persisted locally in the `chroma_db/` directory. Ensure the backend process has write permissions to this folder.

---

## 📄 12. License & Acknowledgments

Distributed under the **MIT License**. See `LICENSE` for more information.

Built with ❤️ by the **NexusAI Engineering Team**.

<div align="center">
  <sub>NexusAI — Autonomous Multi-Agent AI Operating System. Designed for high performance, modularity, and enterprise reliability.</sub>
</div>

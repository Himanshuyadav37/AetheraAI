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
- [✨ 2. What's New in v2.5 (Latest Platform Enhancements)](#-2-whats-new-in-v25-latest-platform-enhancements)
  - [Unified Foldable Workspace (3-Way View Switcher)](#unified-foldable-workspace-3-way-view-switcher)
  - [ChatGPT / Claude Style Live Agent Timeline](#chatgpt--claude-style-live-agent-timeline)
  - [Continuous Project Memory & Contextual Follow-ups](#continuous-project-memory--contextual-follow-ups)
  - [Monaco Code Editor with Live Save & Disk/DB Sync](#monaco-code-editor-with-live-save--diskdb-sync)
  - [Universal ZIP Recovery & Download Engine](#universal-zip-recovery--download-engine)
  - [Universal Dark & Light Mode Theme Engine](#universal-dark--light-mode-theme-engine)
  - [Foldable Research AI Output & Citation Auditing](#foldable-research-ai-output--citation-auditing)
- [🗄️ 3. Polyglot Database Architecture & Schemas](#️-3-polyglot-database-architecture--schemas)
  - [Entity-Relationship Diagram](#entity-relationship-diagram)
  - [Database Breakdown](#database-breakdown)
- [🛠️ 4. Core AI Modules & Specialized Agent Graphs](#️-4-core-ai-modules--specialized-agent-graphs)
  - [💻 4.1 Engineer AI (Autonomous Software Engineering)](#-41-engineer-ai-autonomous-software-engineering)
  - [🔍 4.2 Research AI (Deep Web Intelligence & Synthesis)](#-42-research-ai-deep-web-intelligence--synthesis)
  - [🎓 4.3 Education AI (8 Specialized Tutoring Modes)](#-43-education-ai-8-specialized-tutoring-modes)
  - [⚙️ 4.4 Automation AI (Workflow & Pipeline Generator)](#️-44-automation-ai-workflow--pipeline-generator)
  - [💬 4.5 Conversational AI (Multi-Turn Cognitive Dialogue)](#-45-conversational-ai-multi-turn-cognitive-dialogue)
  - [🔄 4.6 Self-Learning Feedback Loop](#-46-self-learning-feedback-loop)
  - [🔌 4.7 Model Context Protocol (MCP) Gateway](#-47-model-context-protocol-mcp-gateway)
  - [📑 4.8 Multi-Layer Multi-Tenant RAG System](#-48-multi-layer-multi-tenant-rag-system)
  - [👤 4.9 User Memory & Personalized Style Ingestion](#-49-user-memory--personalized-style-ingestion)
- [🎨 5. Agent Studio (Visual Custom Agent Builder & Public Embeds)](#-5-agent-studio-visual-custom-agent-builder--public-embeds)
  - [Visual Builder & Persona Customization](#visual-builder--persona-customization)
  - [Attached Knowledge Bases & Grounding](#attached-knowledge-bases--grounding)
  - [Interactive Sandbox Testing](#interactive-sandbox-testing)
  - [1-Click Web Embeds & Public Share Links](#1-click-web-embeds--public-share-links)
- [🏢 6. Collaborative Team Space & Sprint Board](#-6-collaborative-team-space--sprint-board)
  - [Multi-Channel Team Communications](#multi-channel-team-communications)
  - [@nexus AI Co-Pilot Collaboration](#nexus-ai-co-pilot-collaboration)
  - [Collaborative Kanban Sprint Board](#collaborative-kanban-sprint-board)
  - [Shared Enterprise Prompt Vault](#shared-enterprise-prompt-vault)
- [🔌 7. Integrations Hub & Developer API Gateway](#-7-integrations-hub--developer-api-gateway)
  - [3rd-Party Enterprise Connectors](#3rd-party-enterprise-connectors)
  - [Developer API Keys & Scopes](#developer-api-keys--scopes)
  - [Interactive API Sandbox & Multi-Language SDK Generator](#interactive-api-sandbox--multi-language-sdk-generator)
- [💼 8. Careers Portal & Talent ATS](#-8-careers-portal--talent-ats)
  - [Dynamic Open Roles Directory](#dynamic-open-roles-directory)
  - [Application Flow & Resume Parsing](#application-flow--resume-parsing)
- [📚 9. Interactive Documentation Hub](#-9-interactive-documentation-hub)
  - [Getting Started & Quickstart Guides](#getting-started--quickstart-guides)
  - [Architecture & Multi-Agent Blueprints](#architecture--multi-agent-blueprints)
  - [Live API Playground](#live-api-playground)
- [👑 10. Enterprise Admin Panel (In-Depth Operator Guide)](#-10-enterprise-admin-panel-in-depth-operator-guide)
  - [Admin Access & Security](#admin-access--security)
  - [Tab 1: System & Accounts Management](#tab-1-system--accounts-management)
  - [Tab 2: RAG Workspace Manager](#tab-2-rag-workspace-manager)
  - [Tab 3: Data Ingestion Dock](#tab-3-data-ingestion-dock)
  - [Tab 4: Settings, System Health & Audit Trail](#tab-4-settings-system-health--audit-trail)
  - [Tab 5: AI Safety Guardrails & Incident Monitor](#tab-5-ai-safety-guardrails--incident-monitor)
- [🛡️ 11. Security Architecture & Threat Prevention](#️-11-security-architecture--threat-prevention)
- [🚀 12. Installation & Quick Start Guide](#-12-installation--quick-start-guide)
  - [Prerequisites](#prerequisites)
  - [Option A: Local Development Setup](#option-a-local-development-setup)
  - [Option B: Docker Compose Setup (Recommended)](#option-b-docker-compose-setup-recommended)
  - [Option C: Hugging Face Spaces & Cloud Deployment](#option-c-hugging-face-spaces--cloud-deployment)
- [⚙️ 13. Environment Variables (.env) Reference](#️-13-environment-variables-env-reference)
- [📡 14. Comprehensive REST API Reference](#-14-comprehensive-rest-api-reference)
- [🖥️ 15. Frontend Architecture & Design System](#️-15-frontend-architecture--design-system)
- [🧪 16. Testing & Verification](#-16-testing--verification)
- [❓ 17. Troubleshooting & FAQs](#-17-troubleshooting--faqs)
- [📄 18. License & Acknowledgments](#-18-license--acknowledgments)

---

## 🧠 1. What is NexusAI?

**NexusAI** is an **Autonomous Multi-Agent AI Operating System** engineered to orchestrate complex cognitive workflows by treating Large Language Models (LLMs) as distributed computational cores. Unlike standard conversational bots that output one-shot responses, NexusAI manages stateful, cyclic, and parallel multi-agent graphs that plan, write code, run AST checks, debug errors, deploy containers, and conduct recursive research autonomously.

### Core Philosophy

1. **Stateful Graph Execution:** Workflows are modeled as directed cyclic graphs (using **LangGraph**) with persistent state checkpoints.
2. **Self-Healing Code Loops:** When syntax, AST parsing, or compiler tests fail, a specialized Debugger Agent isolates tracebacks and patches the code without human intervention.
3. **Polyglot Knowledge Grounding:** Multi-tenant RAG indexes organization files, websites, and GitHub repositories with hybrid vector embeddings to eliminate hallucination.
4. **Enterprise Governance & Security:** Real-time PII masking, jailbreak detection, grounding verification, and administrative audit trails govern every transaction.

### High-Level Architecture

```mermaid
flowchart TB
    subgraph ClientLayer ["Client Interface Layer (React 18 + Vite)"]
        UI["Glassmorphic Multi-Module Workspace"]
        UnifiedWS["Unified Foldable Split View (Chat + Workspace)"]
        StudioUI["Agent Studio (Custom Agent Builder & Embeds)"]
        TeamUI["Team Space (Channels, Kanban, Prompt Vault)"]
        IntegrationsUI["Integrations Hub & API Key Sandbox"]
        DocsUI["Interactive Documentation & Playground"]
        AdminUI["Enterprise Admin Panel (5 Sub-Systems)"]
    end

    subgraph APILayer ["API Gateway Layer (FastAPI + SlowAPI Rate Limiter)"]
        AuthRouter["JWT & Passwordless OTP Auth"]
        AgentRouter["Multi-Agent Router & SSE Streamer"]
        RAGRouter["Multi-Tenant RAG & Embeddings Router"]
        CustomAgentRouter["Agent Studio CRUD & Public Embed API"]
        TeamRouter["Team Chat, Kanban & Prompt Vault Router"]
        IntegrationsRouter["OAuth Connectors, Webhooks & Developer Keys"]
        AdminRouter["Admin & Audit Logging API"]
        ZipService["Universal ZIP Archive Recovery Engine"]
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
        ChatGraph["Conversational AI (Multi-Turn Cognitive Dialogue)"]
        CustomAgentGraph["User-Defined Custom Agents (Custom Tools & Knowledge)"]
        LearningLoop["Self-Learning Feedback & Memory Generalizer"]
    end

    subgraph StorageLayer ["Polyglot Data & Vector Layer"]
        PostgreSQL[("PostgreSQL\n(Identity, Tasks, Relational Runs)")]
        MongoDB[("MongoDB\n(Chats, Projects, Agents, Teams, Audits)")]
        ChromaDB[("ChromaDB / Pinecone\n(Vector Embeddings & Semantic Index)")]
        RedisDB[("Redis\n(Rate Limiting & Session Cache)")]
    end

    ClientLayer --> APILayer
    APILayer --> SecurityLayer
    SecurityLayer --> AgentGraphs
    AgentGraphs --> StorageLayer
```

---

## ✨ 2. What's New in v2.5 (Latest Platform Enhancements)

The latest **v2.5 Enterprise Edition** of NexusAI introduces major architectural and user experience upgrades:

### Unified Foldable Workspace (3-Way View Switcher)
- **Seamless Split Mode:** Chat dialogue and Code Workspace are integrated into a unified responsive pane with smooth CSS grid transitions.
- **Dynamic View Modes:**
  - ⊞ **Split View (Default):** Side-by-side chat stream and Monaco file explorer.
  - 💬 **Chat Only:** Collapses the workspace to provide a distraction-free conversation canvas.
  - 💻 **Workspace Only:** Expands the file explorer and code editor to full viewport width.
- **Floating Restore Pill:** When either side is collapsed, an unobtrusive floating button lets you snap back to split view in one click.

### ChatGPT / Claude Style Live Agent Timeline
- **Single-Line Live Action Feed:** Replaced bulky execution logs with an animated, pulsing single-line status indicator during agent execution (e.g. `⚡ Planner Agent · Designing architecture...`).
- **Collapsible Thought Trace:** Once generation finishes, all reasoning steps fold neatly into a clean, collapsible accordion ("5 steps completed in 4.2s").
- **Smart Self-Correction Indicator:** When the Debugger Agent fixes a syntax issue, the timeline displays an **Emerald Checkmark (Fixed)** instead of a permanent red failure banner.

### Continuous Project Memory & Contextual Follow-ups
- **Iterative Project Modification (`mode="continue"`):** You can now ask follow-up questions or request changes on existing generated projects. The agent reads previously generated files and updates them while preserving full architectural context.
- **Foldable Project Blueprint Card:** Summary metrics, detected tech stack badges, and file counts fold smoothly inside the chat bubble.

### Monaco Code Editor with Live Save & Disk/DB Sync
- **Interactive In-Browser Editor:** Edit any generated file directly in the browser with full syntax highlighting for Python, JavaScript, TypeScript, HTML, CSS, JSON, and Markdown.
- **Real-Time Dual Persistence (`/ai/executions/{id}/save-file`):** Saving updates the code in MongoDB and writes the file to the local disk workspace simultaneously.
- **Visual Save Indicator:** Instant "✓ Saved" confirmation appears on the save button.

### Universal ZIP Recovery & Download Engine
- **Zero 404 Project Archives:** Enhanced `zip_service.py` dynamically resolves project IDs across `projects` and `executions` collections. If files are not on disk, it retrieves the code from MongoDB and generates a clean ZIP archive on-the-fly.

### Universal Dark & Light Mode Theme Engine
- **Instant Global Theme Switching:** Control Hub (Profile Modal) theme toggle instantly shifts the entire application between **Obsidian Dark** and **Clean Light** modes without requiring a page reload.
- **Visual Theme Selection Cards:** Interactive cards for quick 1-tap switching, plus a quick **☀️ / 🌙** header button.
- **Complete CSS Token Coverage:** All modals, panels, tables, and buttons maintain high-contrast readability in both themes.

### Foldable Research AI Output & Citation Auditing
- **Collapsible Cited Sources & Tools:** Footnotes and scraped domain badges fold neatly at the bottom of research reports.
- **Fact & Validation Audit:** Factual consistency scores, supervisor timelines, and audit logs are grouped into collapsible accordions for clean presentation.

---

## 🗄️ 3. Polyglot Database Architecture & Schemas

NexusAI uses a **Polyglot Persistence Strategy** to balance transactional safety, flexible JSON document storage, vector similarity search, and high-speed caching.

### Entity-Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : owns
    PROJECTS ||--o{ TASKS : triggers
    TASKS ||--o{ AGENT_RUNS : logs
    USERS ||--o{ CUSTOM_AGENTS : creates
    ORGANIZATIONS ||--o{ TEAMS : contains
    TEAMS ||--o{ KANBAN_TASKS : assigns
    ORGANIZATIONS ||--o{ KNOWLEDGE_BASES : contains
    KNOWLEDGE_BASES ||--o{ DOCUMENTS : indexes
    DOCUMENTS ||--o{ DOCUMENT_CHUNKS : splits_into

    USERS {
        string id PK "User ID (UUID/String)"
        string email "Unique Email Address"
        string username "Display Username"
        string role "admin | manager | employee"
        int limit "Workspace Generation Quota"
        datetime created_at "Registration Timestamp"
    }

    PROJECTS {
        string id PK "Project ID (UUID/String)"
        string user_id FK "Owner User ID"
        string name "Project / Application Name"
        datetime created_at "Creation Timestamp"
    }

    CUSTOM_AGENTS {
        string id PK "MongoDB ObjectId"
        string user_id FK "Creator User ID"
        string name "Agent Name"
        string avatar "Emoji / Icon Avatar"
        string category "Coding | Research | Legal | Finance"
        string system_prompt "System Instructions"
        float temperature "Sampling Temperature"
        string[] attached_kb_ids "Linked Knowledge Bases"
        boolean is_public "Shareable Public Flag"
        datetime created_at "Creation Date"
    }

    KANBAN_TASKS {
        string id PK "MongoDB ObjectId"
        string team_id FK "Team ID"
        string title "Task Title"
        string status "todo | in_progress | review | completed"
        string priority "low | medium | high | urgent"
        string assignee_id "Assigned User ID"
        datetime due_date "Target Completion"
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
| **PostgreSQL (Async via SQLAlchemy + Alembic)** | Relational data, transactional integrity, execution step timing, user identity. | `users`, `projects`, `tasks`, `agent_runs` |
| **MongoDB (PyMongo)** | Flexible document storage, conversational state, dynamic MCP configs, guardrails configuration, audit logs, RAG metadata, custom agents, team boards. | `users`, `conversations`, `research_sessions`, `automation_conversations`, `custom_agents`, `teams`, `team_messages`, `kanban_tasks`, `prompt_vault`, `developer_keys`, `organizations`, `knowledge_bases`, `documents`, `audit_logs`, `guardrail_logs`, `learnings`, `mcp_servers` |
| **ChromaDB / Pinecone** | High-dimensional vector indexing for semantic similarity search, hybrid dense retrieval, self-learning memory. | `nexusai_knowledge`, `user_memory_{user_id}`, `workspace_{org_id}` |
| **Redis** | In-memory token rate-limiting (`slowapi`), session token cache, real-time background task synchronization. | Ephemeral keys, rate limit counters, lock tokens |

---

## 🛠️ 4. Core AI Modules & Specialized Agent Graphs

---

### 💻 4.1 Engineer AI (Autonomous Software Engineering)

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
3. **Tester Agent:** Validates files using AST parsing, syntax validation, and automated compilation checks, returning a structured JSON issue report.
4. **Debugger Agent:** Reads traceback and test failure reports, isolates buggy lines, generates corrected source files, and loops back to the Tester.
5. **Deployer Agent:** Generates container configuration files (`Dockerfile`, `docker-compose.yml`, `k8s-manifest.yaml`) and deployment runbooks.

#### Key Engineering Features:
- **Live SSE Streaming (`/ai/{execution_id}/stream`):** Streams agent transitions, token outputs, and file generations to the client in real-time.
- **Monaco Code Editor & Live Save (`/ai/executions/{id}/save-file`):** Edit generated code in the browser with instant dual disk and database persistence.
- **Visual Code Diffing (`/ai/{execution_id}/diff`):** Side-by-side comparison between execution iterations with one-click snapshot rollback.
- **1-Click AI Error Patching:** Fix compilation or runtime errors with AI-suggested code patches directly within the workspace file viewer.
- **GitHub Sync Integration (`/github/push`):** Creates a public or private GitHub repository using the user's Personal Access Token (PAT) and pushes the generated codebase automatically.

---

### 🔍 4.2 Research AI (Deep Web Intelligence & Synthesis)

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

### 🎓 4.3 Education AI (8 Specialized Tutoring Modes)

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

### ⚙️ 4.4 Automation AI (Workflow & Pipeline Generator)

Converts plain-English automation requests into production-ready workflow files for **n8n**, **Make (Integromat)**, and **Zapier**.

* **Plan Agent:** Extracts triggers, destination services, data mappings, authentication nodes, and conditional branches.
* **Workflow Generator:** Outputs compliant JSON files ready to import directly into n8n or Make.
* **Validator Agent:** Scans the workflow graph for circular loops, orphaned nodes, or missing environment variables.
* **Roadmap Formatter:** Visualizes the automated flow with a Mermaid sequence diagram and provides an environment configuration guide.

---

### 💬 4.5 Conversational AI (Multi-Turn Cognitive Dialogue)

General-purpose conversational reasoning with long-term memory, personality customization, and live web grounding:

* **Contextual Thread Memory:** Maintains token-efficient rolling summaries of long dialogues.
* **Persona Calibration:** Switch between Executive Architect, Concise Coder, or Detailed Teacher personas.
* **Real-Time Code Execution:** Runs short Python scripts and formulas directly within the chat window.

---

### 🔄 4.6 Self-Learning Feedback Loop

NexusAI continuously improves by analyzing the outcome of every agent execution:

1. **Execution Telemetry:** Tracks runtime errors, successful bug patches, and user modifications.
2. **Knowledge Generalization:** An LLM distills the root cause and effective solution into a generalized "learning item."
3. **Vector Ingestion:** The lesson is embedded and stored in the vector database.
4. **Dynamic Context Retrieval:** Future runs of Coder and Debugger agents query past learnings, preventing repeat mistakes.
5. **Learnings Management (`/ai/learnings`):** Users and admins can review, enable/disable, or delete stored learnings.

---

### 🔌 4.7 Model Context Protocol (MCP) Gateway

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

### 📑 4.8 Multi-Layer Multi-Tenant RAG System

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

### 👤 4.9 User Memory & Personalized Style Ingestion

Personalizes LLM responses by maintaining long-term context:

* **Coding Style Preferences:** Configures preferred paradigms (Functional vs OOP), naming conventions (camelCase, snake_case), and commenting styles.
* **Long-Term Memory Storage (`/memory/user`):** Stores user preferences, project background, and tech stack constraints in a dedicated vector space.

---

## 🎨 5. Agent Studio (Visual Custom Agent Builder & Public Embeds)

The **Agent Studio** (`/agent-studio`) empowers developers to visually construct, calibrate, test, and deploy specialized autonomous AI agents tailored for specific business domains.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AGENT STUDIO WORKSPACE                          │
├──────────────────────────┬─────────────────────────────┬───────────────┤
│    AGENT DIRECTORY       │      CONFIG & BLUEPRINT     │  LIVE SANDBOX │
│                          │                             │               │
│  🤖 Python Lead Dev      │  • Name & Category          │  [User Input] │
│  🧠 Market Analyst       │  • System Prompt & Rules    │       ↓       │
│  ⚖️ Legal Contract Review│  • Attached RAG Knowledge   │  [Agent Live  │
│  🛡️ SecOps Penetration   │  • Temperature & Model      │   Execution]  │
│  [ + Create New Agent ]  │  • Starter Questions        │       ↓       │
│                          │  [ Save & Publish ]         │  [Structured  │
│                          │  [ Share / Embed HTML ]     │   Response]   │
└──────────────────────────┴─────────────────────────────┴───────────────┘
```

### Visual Builder & Persona Customization
- **Domain Specialization:** Group agents by category (`Coding`, `Research`, `Legal`, `Finance`, `Customer Success`, `Custom`).
- **Granular Inference Parameters:** Fine-tune sampling temperature ($0.0 - 1.0$), inference provider (Groq Llama 3.3 70B, DeepSeek R1, GPT-4o, Claude 3.5 Sonnet), and max output tokens.
- **Custom System Instructions:** Define strict persona behavior, output formatting rules, and guardrail constraints.

### Attached Knowledge Bases & Grounding
- **1-Click Knowledge Attachment:** Link custom agents to scoped enterprise RAG Knowledge Bases so they answer strictly from verified organizational context.

### Interactive Sandbox Testing
- Test agent personas in a side-by-side live chat sandbox with full Markdown and code execution support before publishing to production.

### 1-Click Web Embeds & Public Share Links
- **Public Share URL (`/public/agents/:id`):** Generate a standalone, authenticated or guest-accessible chat interface for clients and teammates.
- **Responsive Embed Iframe:** Generate copy-paste HTML iframe code to embed custom agents directly into blogs, portals, or corporate intranets.

---

## 🏢 6. Collaborative Team Space & Sprint Board

The **Team Space** (`/teams` / `/team-workspace`) connects engineers, product managers, and autonomous agents in a shared high-velocity operating environment.

### Multi-Channel Team Communications
- **Dedicated Topic Channels:** Real-time channels including `#general`, `#engineering`, `#design`, `#product`, `#announcements`, and `#random`.
- **Live User Presence:** Active developer avatars, status indicators, and real-time message broadcasting.

### @nexus AI Co-Pilot Collaboration
- Mention `@nexus` in any team channel to summon an AI agent to:
  - Synthesize long discussion threads into action items.
  - Generate code architectures directly into the chat.
  - Review proposed implementation plans against best practices.

### Collaborative Kanban Sprint Board
- **Full-Featured Sprint Management:** Organize work across **To Do**, **In Progress**, **Under Review**, and **Completed** lanes with drag-and-drop mechanics.
- **Task Prioritization:** Urgent, High, Medium, and Low severity color badges.
- **1-Click AI Goal Breakdown:** Enter a high-level product objective, and `@nexus` will automatically decompose it into structured sub-tasks with assigned priorities and checklists.

### Shared Enterprise Prompt Vault
- Store, categorize, search, and run standardized engineering prompt templates across your entire organization with 1-click execution.

---

## 🔌 7. Integrations Hub & Developer API Gateway

The **Integrations Hub** (`/integrations`) allows developers to connect external DevOps tools and access NexusAI programmatically via REST APIs and SDKs.

### 3rd-Party Enterprise Connectors
- 🐙 **GitHub & GitLab:** Automated OAuth repository creation, pull request generation, and branch synchronization.
- 💬 **Slack & Discord:** Webhook notification alerts for completed builds, safety guardrail violations, and team mentions.
- 🎯 **Linear & Jira:** Bidirectional synchronization between NexusAI Kanban tasks and enterprise project trackers.
- 📝 **Notion:** Automated research report and architecture blueprint exporting.
- ☁️ **AWS S3 & Cloudflare R2:** Automated cloud backups for project ZIP archives and generated artifacts.

### Developer API Keys & Scopes
- Generate SHA-256 hashed API keys with custom labels, expiration windows ($30$, $90$, $365$ days), and scoped permissions (`read:executions`, `write:code`, `admin:rag`).
- Instant 1-click key revocation and live usage rate telemetry.

### Interactive API Sandbox & Multi-Language SDK Generator
- In-browser HTTP request runner with live authorization headers.
- **Automated Multi-Language Snippet Generator:** Switch seamlessly between:
  - **cURL / Shell**
  - **Python (Requests / Async aiohttp)**
  - **Node.js / TypeScript (Axios / Fetch)**
  - **Go (net/http)**

---

## 💼 8. Careers Portal & Talent ATS

The **Careers Portal** (`/careers`) is an enterprise-grade recruiting hub showcasing engineering opportunities at NexusAI.

### Dynamic Open Roles Directory
- Filter by department (`AI Research`, `Full-Stack Engineering`, `Infrastructure / DevOps`, `Product & Design`).
- In-depth role dossiers detailing technical stack, team impact, day-to-day responsibilities, and competitive equity/salary bands.

### Application Flow & Resume Parsing
- **Candidate Submission Form:** Upload PDF resumes, link GitHub and LinkedIn profiles, and submit specialized cover letters.
- **Automated Resume Ingestion:** Asynchronously parses applicant profiles and organizes candidates for executive interview review.

---

## 📚 9. Interactive Documentation Hub

The **Documentation Hub** (`/docs`) provides developers with comprehensive technical references and interactive sandboxes.

### Getting Started & Quickstart Guides
- Step-by-step guides for bootstrapping local development environments, connecting MongoDB Atlas, and setting up Groq LLM clusters.

### Architecture & Multi-Agent Blueprints
- Deep-dive architectural breakdowns of the LangGraph state machine, AST test validation loop, and multi-tenant RAG chunking algorithms.

### Live API Playground
- Interactive documentation with copyable payload templates, status code guides, and SSE streaming specifications.

---

## 👑 10. Enterprise Admin Panel (In-Depth Operator Guide)

The **Admin Panel** (`/admin`) provides comprehensive visibility, security controls, and resource management across the entire platform.

---

### Admin Access & Security

- **Access Guard:** Restricted to accounts whose email exists in `ADMIN_EMAILS` or has the `admin` role. Unauthorized requests return `403 Forbidden`.
- **JWT Authorization:** Requires a valid `Bearer <token>` with administrative claims.

---

### Tab 1: System & Accounts Management

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

#### 3. Registered Accounts Directory & Search
- Instant real-time search across usernames and emails.
- **Role Control:** Change account access levels on the fly (`employee`, `manager`, `admin`).
- **Workspace Query Quota Manager:** Increase or decrease per-user chat and generation limits with `+1` / `-1` quick buttons or custom values.
- **Account Deletion (Cascade Wipe):** Permanently removes the user and automatically deletes all their associated chat threads, projects, research sessions, and automations.

#### 4. Deep 360° User History Inspector
Click any user in the table to open a split-pane deep audit view covering all agent modules:
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

#### 2. Security & Activity Audit Trail
- Chronological audit log of all administrative actions (role updates, quota modifications, account deletions, system wipes).
- Includes UTC timestamp, administrator email, action type, and details.
- **Export Logs:** One-click download of audit logs in JSON format.

---

### Tab 5: AI Safety Guardrails & Incident Monitor

#### 1. Dynamic Toggleable Defense Switches
- 🛡️ **Content Filters:** Detects and blocks toxic, abusive, or harmful prompts.
- 🚫 **Denied Topics Filter:** Prevents discussions on prohibited topics (e.g., malware creation, illegal actions).
- 🔤 **Restricted Word Filters:** Enforces custom keyword blocklists.
- 🔒 **Sensitive Information (PII) Redaction:** Automatically detects and masks Credit Card numbers, Social Security Numbers (SSN), API keys, and email addresses.
- 🎯 **Contextual Grounding Checks:** Validates LLM responses against retrieved RAG chunks to flag or block hallucinations.
- ⚡ **Jailbreak & Prompt Injection Shield:** Evaluates incoming prompts using semantic LLM classification to block jailbreak patterns.
- 🆘 **Crisis Intervention & Redirects:** Intercepts distress signals and redirects users to verified support helplines.

---

## 🛡️ 11. Security Architecture & Threat Prevention

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

## 🚀 12. Installation & Quick Start Guide

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

# Windows (PowerShell):
.\venv\Scripts\activate

# macOS / Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env from template
cp .env.example .env
```

Configure your `backend/.env` file. Then run:

```bash
# Run database migrations
alembic upgrade head

# Start FastAPI backend server with hot-reloading
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
*The backend API will be available at `http://localhost:8000`.*

#### 3. Frontend Setup
Open a new terminal window:
```bash
cd frontend

# Install dependencies
npm install

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
docker-compose up --build -d
```

To stop all services:
```bash
docker-compose down
```

---

### Option C: Hugging Face Spaces & Cloud Deployment

NexusAI includes a production-ready `Dockerfile` and `vercel.json` for cloud deployment:
- **Hugging Face Spaces:** Connect your repository and select the **Docker** runtime. The entrypoint `uvicorn main:app --host 0.0.0.0 --port 8000` boots the application automatically.
- **Frontend Vercel Deployment:** Push `frontend/` to Vercel and set `VITE_API_URL` to your backend URL.

---

## ⚙️ 13. Environment Variables (.env) Reference

### Backend `.env` Configuration

| Variable Name | Required | Default Value | Description |
| :--- | :---: | :--- | :--- |
| `ENV` | Yes | `development` | Environment mode (`development` or `production`). |
| `GROQ_KEY_1` | Yes | — | Primary Groq API key for high-speed LLM inference. |
| `GROQ_KEY_2` | Yes | — | Secondary Groq key for automatic round-robin rotation. |
| `GROQ_KEY_3` | Yes | — | Tertiary Groq key for load distribution. |
| `GROQ_MODEL` | No | `groq/llama-3.3-70b-versatile` | Default model identifier for agent execution. |
| `MONGO_URL` | Yes | `mongodb://localhost:27017` | MongoDB connection URI. |
| `DB_NAME` | Yes | `nexusai` | Target MongoDB database name. |
| `POSTGRES_URL` | Yes | `postgresql+asyncpg://postgres:postgres@localhost:5432/nexusai` | PostgreSQL async connection string. |
| `REDIS_HOST` | No | `localhost` | Redis server hostname. |
| `REDIS_PORT` | No | `6379` | Redis server port. |
| `JWT_SECRET` | Yes | — | Secret key used to sign HMAC-SHA256 JWT tokens. |
| `JWT_EXPIRE_MINUTES`| No | `10080` (7 days) | JWT session lifetime in minutes. |
| `ADMIN_SECRET` | Yes | — | Secret key used to bootstrap admin privileges. |
| `ADMIN_EMAILS` | Yes | `admin@nexusai.com` | Comma-separated list of whitelisted admin emails. |
| `VECTOR_STORE` | No | `chroma` | Vector database backend (`chroma` or `pinecone`). |
| `SMTP_HOST` | No | `smtp-relay.brevo.com` | SMTP relay server for sending OTP emails. |
| `SMTP_PORT` | No | `587` | SMTP port (typically 587 for TLS). |
| `SMTP_USER` | No | — | SMTP account username / email. |
| `SMTP_PASSWORD` | No | — | SMTP account password / API key. |

---

## 📡 14. Comprehensive REST API Reference

### 🔐 Authentication Endpoints

#### 1. Request Passwordless OTP
```http
POST /auth/send-otp
Content-Type: application/json

{
  "email": "developer@company.com"
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

---

### 💻 Multi-Agent Execution Endpoints

#### 1. Trigger Autonomous Project Generation
```http
POST /ai/execute-project
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "agent_type": "engineer",
  "idea": "Build a Kanban sprint board in React with drag and drop, FastAPI backend, and SQLite.",
  "mode": "new"
}
```

#### 2. Real-Time SSE Execution Stream
```http
GET /ai/{execution_id}/stream
Authorization: Bearer <JWT_TOKEN>
Accept: text/event-stream
```

#### 3. Save Edited File Directly to Disk & MongoDB
```http
POST /ai/executions/{execution_id}/save-file
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "path": "frontend/src/App.jsx",
  "code": "import React from 'react';\n\nexport default function App() {\n  return <h1>Updated Code</h1>;\n}"
}
```

#### 4. Download Full Project ZIP Archive
```http
GET /ai/projects/{project_id}/download-zip
Authorization: Bearer <JWT_TOKEN>
```

---

### 🎨 Agent Studio Endpoints

#### 1. List All Custom Agents
```http
GET /api/custom-agents
Authorization: Bearer <JWT_TOKEN>
```

#### 2. Create Custom Agent
```http
POST /api/custom-agents
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "name": "SecOps Penetration Advisor",
  "avatar": "🛡️",
  "category": "security",
  "model": "llama-3.3-70b-versatile",
  "system_prompt": "You are a senior security researcher analyzing vulnerabilities in source code.",
  "temperature": 0.3,
  "attached_kb_ids": ["65f1a2b3c4d5e6f7a8b9c0d1"],
  "is_public": true
}
```

---

### 🏢 Team Space Endpoints

#### 1. Fetch Team Channels & Messages
```http
GET /teams/{team_id}/messages?channel=engineering
Authorization: Bearer <JWT_TOKEN>
```

#### 2. Create Kanban Task
```http
POST /teams/{team_id}/tasks
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "title": "Migrate Redis caching to cluster mode",
  "status": "todo",
  "priority": "high",
  "assignee_id": "65f1a2b3c4d5e6f7a8b9c0d1"
}
```

---

### 📑 Multi-Tenant RAG Endpoints

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

---

## 🖥️ 15. Frontend Architecture & Design System

The NexusAI frontend is built with **React 18** and **Vite**, featuring a glassmorphic design system:

* **Theme Variables (`theme.css` & `Index.css`):** Monochromatic obsidian dark tokens, crisp daylight light mode, subtle borders, and smooth transitions.
* **Component Architecture:**
  - `UnifiedWorkspace.jsx`: Unified 3-way split/chat/workspace viewer.
  - `AgentStudioPage.jsx`: Visual agent creator and shareable embed exporter.
  - `TeamWorkspacePage.jsx`: Real-time chat channels, collaborative Kanban, and prompt vault.
  - `IntegrationsHubPage.jsx`: OAuth connector grid, API key manager, and live request sandbox.
  - `CareersPage.jsx`: Dynamic hiring portal with ATS submission.
  - `DocsPage.jsx`: Interactive developer guides and live API playground.
  - `AgentLiveTimeline.jsx`: Single-line pulsating live feed and collapsible trace.
  - `FileViewer.jsx`: Monaco-powered code editor with live syntax highlighting and instant save.
  - `ProfileModal.jsx`: Control Hub with instant theme toggles, API key manager, and 2FA settings.
  - `AdminPanel.jsx`: 5-tab executive control center with real-time gauges, user search, audit tables, and safety controls.

---

## 🧪 16. Testing & Verification

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

## ❓ 17. Troubleshooting & FAQs

#### Q1: Database connection errors on startup (PostgreSQL or MongoDB).
- Ensure PostgreSQL is running on port `5432` with database `nexusai` created.
- Ensure MongoDB is running on port `27017`.
- Run `alembic upgrade head` in `backend/` to apply PostgreSQL schemas.

#### Q2: Groq rate limit errors (`429 Too Many Requests`).
- NexusAI includes an automated multi-key rotation mechanism. Add up to 3 distinct Groq API keys in `.env` (`GROQ_KEY_1`, `GROQ_KEY_2`, `GROQ_KEY_3`) to automatically balance load.

#### Q3: How do I grant an account Admin permissions?
- Add the user's email address to `ADMIN_EMAILS` in your backend `.env` file, or update their role to `admin` directly through the Admin Panel (`/admin`).

---

## 📄 18. License & Acknowledgments

Distributed under the **MIT License**. See `LICENSE` for more information.

Built with ❤️ by the **NexusAI Engineering Team**.

<div align="center">
  <sub>NexusAI — Autonomous Multi-Agent AI Operating System. Designed for high performance, modularity, and enterprise reliability.</sub>
</div>

# NexusAI - Autonomous Multi-Agent AI Operating System

<div align="center">

<!-- Animated Header Banner -->
<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=200&section=header&text=NexusAI&fontSize=80&fontColor=fff&animation=twinkling&fontAlignY=35&desc=Autonomous%20Multi-Agent%20AI%20Operating%20System&descAlignY=55&descSize=22"/>

<!-- Typing SVG -->
<a href="https://git.io/typing-svg">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=24&pause=800&color=A855F7&center=true&vCenter=true&multiline=true&width=900&height=80&lines=%E2%9A%A1+Plan.+Code.+Test.+Debug.+Deploy.+Autonomously.;%F0%9F%A7%A0+5+Specialized+AI+Agents+Running+in+Parallel;%F0%9F%9A%80+From+Idea+to+Production+in+One+Command" alt="Typing SVG" />
</a>

<p>
  <img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white"/>
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB"/>
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white"/>
  <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white"/>
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white"/>
</p>

</div>

---

## 🧠 What is NexusAI?

**NexusAI** is an **Autonomous Multi-Agent AI Operating System** that treats Large Language Models (LLMs) as dynamic processing cores. Instead of simple chatbot interfaces, NexusAI orchestrates multiple specialized, stateful AI agent graphs to automate complex developer workflows, deep academic research, student-focused educational tutoring, custom workflow automation, and self-learning loops.

---

## 🛠️ Complete Feature Walkthrough

### 💻 1. Engineer AI (Software Development Graph)
The Software Development pipeline is built using **LangGraph** to model stateful, cyclic development workflows. It transitions your plain text idea into a fully deployable codebase through iterative execution loops.

```
                  ┌─────────────────┐
                  │   User Idea     │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ PLANNER AGENT   │◄───────────────────────┐
                  └────────┬────────┘                        │
                           │                                 │
                           ▼                                 │
                  ┌─────────────────┐                        │
                  │   CODER AGENT   │                        │
                  └────────┬────────┘                        │
                           │                                 │
                           ▼                                 │
                  ┌─────────────────┐                        │
                  │  TESTER AGENT   │                        │
                  └────────┬────────┘                        │
                           │                                 │
             ┌─────────────┴─────────────┐                   │
             ▼                           ▼                   │
    [ Critical Bugs? ]          [ All Tests Pass? ]          │
             │                           │                   │
             ▼ Yes                       ▼ Yes               │
    ┌─────────────────┐         ┌─────────────────┐          │
    │ DEBUGGER AGENT  │         │ DEPLOYER AGENT  │          │
    └────────┬────────┘         └────────┬────────┘          │
             │                           │                   │
             └───────────────────────────┼───────────────────┘ (Max Iterations Limit)
                                         │
                                         ▼
                                ┌─────────────────┐
                                │ Docker / K8s    │
                                └─────────────────┘
```

*   **Planner Agent**: Parses your requirement, queries the Vector Database (Chroma/Pinecone) for existing code abstractions/templates, and produces a complete system architectural specification (files needed, directory layouts, and dependency list).
*   **Coder Agent**: Iteratively processes each planned file, generating clean, modular code, and injecting relevant RAG context.
*   **Tester Agent**: Performs automated AST checks, syntax parsing, and validation using Python's compilation utilities. It returns a structured JSON bug report.
*   **Debugger Agent**: Traces exceptions to the exact source lines, devises corrective logic, and restarts the Tester loop.
*   **Deployer Agent**: Bundles the code with a containerized environment (generating `Dockerfile` and `docker-compose.yml`) and creates cloud deploy configurations.

---

### 🔍 2. Research AI (Knowledge Scraper & Writer)
A parallelized web-crawling and summary-compilation engine that generates cited reports.

*   **Research Planner**: Breaks down the topic into sub-queries.
*   **Search & Scraper**: Crawls search engines (Google/Bing) and extracts semantic content.
*   **Summarizer Agent**: Extracts critical metrics, claims, and data.
*   **Writer Agent**: Compiles sections into a structured markdown report.
*   **Quality Reviewer**: Validates factual grounding.
*   **Citation Compiler**: Appends footnote references linking to source URLs.

---

### 🎓 3. Education AI (Dynamic Tutor with 8 Modes)
Education AI uses a priority keyword router to inspect student prompts and activate dedicated learning modules:

1.  **Learn Mode**: Explains theoretical concepts with dynamic interactive examples.
2.  **Coding Sandbox**: Presents programming challenges with automated grading.
3.  **Interview Prep**: Simulates standard technical interviews with target reviews.
4.  **Quiz Engine**: Spawns custom MCQs and true-false quizzes.
5.  **Flashcard Review**: Activates spaced-repetition card decks.
6.  **Roadmap Generator**: Automatically draws learning path timelines in **Mermaid.js** format.
7.  **Smart Notes**: Compiles clear, downloadable Markdown notes.
8.  **Exam Simulator**: Runs timed examinations with strict scoring rubrics.

---

### ⚡ 4. Automation AI (Workflow Generator)
Converts plain English automation requests into deployable workflow structures.
*   **Plan Agent**: Extracts triggers, targeted platforms, integrations, variables, and logical conditions.
*   **Workflow Generator**: Builds configuration files compatible with platforms like **n8n** or **Make/Zapier**.
*   **Validator Agent**: Checks configurations for circular loops or disabled endpoints.
*   **Roadmap Formatter**: Draws a Mermaid diagram showing the visual flow and writes a Markdown setup guide.

---

### 🔄 5. Self-Learning Loop
Tracks agent execution results, error logs, and corrections. Success/failure lessons are generalized and indexed into the RAG vector memory database. Subsequent runs fetch these lessons dynamically, ensuring the system becomes more reliable over time.

---

### 📂 6. Model Context Protocol (MCP)
Supports the **Model Context Protocol (MCP)**, allowing external clients to query, execute, and interact with tools, resources, and prompts provided by the agents over Server-Sent Events (SSE).

---

### 🛡️ 7. Security & Guardrails
*   **PII Filters**: Automatically redacts emails, names, phone numbers, and credentials before sending prompts to the LLM.
*   **Rate Limiting**: Integrated using `slowapi` to protect routes from abuse.
*   **Grounding & Crisis Redirection**: Scans inputs/outputs to prevent prompt injection and redirects distress-related questions to safety channels.

---

## 🗄️ Database Architecture

NexusAI uses a **Polyglot Persistence** architecture to balance high-speed transactions with document flexibility.

*   **PostgreSQL**: Handles identity transactions, access levels, relational entities (users, projects, tasks), and execution logs.
*   **MongoDB**: Stores non-relational data, dynamic chat logs, document metadata, and temporary session logs.
*   **ChromaDB / Pinecone**: Stores vector embeddings for semantic code lookup and RAG contexts.

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : owns
    PROJECTS ||--o{ TASKS : triggers
    TASKS ||--o{ AGENT_RUNS : logs

    USERS {
        string id PK "User ID"
        string email "Unique email address"
        string hashed_password
        datetime created_at
    }
    PROJECTS {
        string id PK "Project ID"
        string user_id FK
        string name "Project Name"
        datetime created_at
    }
    TASKS {
        string id PK "Execution Task ID"
        string project_id FK
        string status "running | completed | failed"
        string agent_assigned
        datetime created_at
        datetime completed_at
    }
    AGENT_RUNS {
        int id PK "Auto Increment"
        string task_id FK
        string agent_name "planner | coder | tester | debugger | deployer"
        string input_summary
        string output_summary
        string status
        int duration_ms
        datetime created_at
    }
```

---

## 🚀 Quick Start

### Prerequisites
*   Python `3.10+` (Python `3.11` recommended)
*   Node.js `18+`
*   MongoDB Instance
*   PostgreSQL Database
*   Groq API Key(s)

---

### 1. Clone the Repository
```bash
git clone https://github.com/Himanshuyadav37/nexusai-ai.git
cd nexusai-ai
```

---

### 2. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scriptsctivate          # Windows
source venv/bin/activate        # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env
```

Configure your backend `.env` file:
```env
# Primary Settings
ENV=development

# Groq API Keys (Support multiple keys for dynamic rotation)
GROQ_KEY_1=gsk_xxxxxxxxxxxxxxxxxxxx
GROQ_KEY_2=gsk_xxxxxxxxxxxxxxxxxxxx
GROQ_KEY_3=gsk_xxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.3-70b-versatile

# MongoDB Connection
MONGO_URL=mongodb://localhost:27017
DB_NAME=nexusai

# PostgreSQL Connection
POSTGRES_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/nexusai

# ChromaDB Settings
CHROMA_HOST=localhost
CHROMA_PORT=8001

# Auth
JWT_SECRET=@123superkey9807
JWT_EXPIRE_MINUTES=10080
ADMIN_SECRET=nexusai-admin-2024
ADMIN_EMAILS=admin@devpilot.ai,admin@nexusai.com

# SMTP settings (e.g. Brevo)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-email@domain.com
SMTP_PASSWORD=your-smtp-password
```

#### Run Database Migrations
PostgreSQL tables are tracked using Alembic. Apply the migrations baseline:
```bash
alembic upgrade head
```

#### Start FastAPI Server
```bash
uvicorn main:app --reload --port 8000
```

---

### 3. Frontend Setup
```bash
cd ../frontend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

Configure your frontend `.env` file:
```env
VITE_API_URL=http://localhost:8000
```

#### Start Frontend Dev Server
```bash
npm run dev
```

---

### 🐳 4. Docker Compose Setup (Single Command Boot)
Ensure your `.env` settings are updated, then boot all services (FastAPI, React, PostgreSQL, MongoDB, Redis, and ChromaDB) together:
```bash
docker-compose up --build
```

---

## 📞 API Reference Examples

### Authentication (OTP Login Flow)

#### 1. Request Verification OTP
```http
POST /auth/send-otp
Content-Type: application/json

{
  "email": "user@domain.com"
}
```
*Response (`200 OK`)*:
```json
{
  "message": "OTP sent successfully"
}
```

#### 2. Verify OTP & Retrieve JWT
```http
POST /auth/verify-otp
Content-Type: application/json

{
  "email": "user@domain.com",
  "code": "123456"
}
```
*Response (`200 OK`)*:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "64c911a2f...",
    "email": "user@domain.com",
    "role": "employee"
  }
}
```

---

### Multi-Agent Software Engineering

#### 1. Trigger Autonomous Code Generation
```http
POST /ai/generate
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "idea": "Build a FastAPI WebSocket chat application with message history.",
  "project_id": "proj_9900"
}
```
*Response (`200 OK`)*:
```json
{
  "execution_id": "exec_112233",
  "status": "running",
  "message": "LangGraph multi-agent software engineering graph started."
}
```

#### 2. Fetch Generation Status
```http
GET /ai/status/exec_112233
Authorization: Bearer <JWT_TOKEN>
```
*Response (`200 OK`)*:
```json
{
  "status": "completed",
  "execution_steps": [
    { "agent": "planner", "status": "completed" },
    { "agent": "coder", "status": "completed" },
    { "agent": "tester", "status": "completed" },
    { "agent": "deployer", "status": "completed" }
  ],
  "generated_code": {
    "main.py": "from fastapi import FastAPI...",
    "docker-compose.yml": "version: '3.8'..."
  }
}
```

---

## 🛠️ Running Tests
To run unit and integration tests (validating guardrails, RAG routers, and MCP endpoints):
```bash
cd backend
..env\Scripts\pytest tests
```

---

## 🛡️ License
Distributed under the MIT License. See `LICENSE` for details.

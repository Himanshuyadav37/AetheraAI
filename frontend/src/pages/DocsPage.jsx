import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Search,
  Code2,
  Terminal,
  Cpu,
  Layers,
  Shield,
  Users,
  Zap,
  Sparkles,
  Bot,
  Brain,
  Wrench,
  GraduationCap,
  Copy,
  Check,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  FileCode,
  Lock,
  Workflow,
  Globe,
  Sliders
} from "lucide-react";
import "./Docs.css";

const DOCS_SECTIONS = [
  {
    id: "getting-started",
    heading: "Getting Started",
    items: [
      { id: "overview", title: "Overview & Architecture", icon: <Layers size={15} /> },
      { id: "quickstart", title: "5-Minute Quickstart", icon: <Zap size={15} /> },
      { id: "authentication", title: "API Authentication & Keys", icon: <Lock size={15} /> },
    ],
  },
  {
    id: "core-engines",
    heading: "AI Core Engines",
    items: [
      { id: "engineer-ai", title: "Engineer AI (Full-Stack)", icon: <Wrench size={15} /> },
      { id: "conversational-ai", title: "Conversational AI", icon: <Bot size={15} /> },
      { id: "research-ai", title: "Deep Research AI", icon: <Brain size={15} /> },
      { id: "automation-ai", title: "Automation & Workflows", icon: <Zap size={15} /> },
    ],
  },
  {
    id: "agent-and-rag",
    heading: "Agent Studio & RAG",
    items: [
      { id: "agent-studio", title: "Agent Studio & Sandboxes", icon: <Sparkles size={15} /> },
      { id: "vector-rag", title: "Vector Memory & Collections", icon: <Cpu size={15} /> },
    ],
  },
  {
    id: "routing-and-quotas",
    heading: "Cost & Model Routing",
    items: [
      { id: "model-router", title: "Semantic Complexity Router", icon: <Sliders size={15} /> },
      { id: "budget-caps", title: "Department Quotas & Spend", icon: <Shield size={15} /> },
    ],
  },
  {
    id: "protocols",
    heading: "Protocols & Extensibility",
    items: [
      { id: "mcp-protocol", title: "Model Context Protocol (MCP)", icon: <FileCode size={15} /> },
      { id: "team-spaces", title: "Team Spaces & AI Co-Pilot", icon: <Users size={15} /> },
    ],
  },
  {
    id: "developer-api",
    heading: "API Reference & SDKs",
    items: [
      { id: "rest-api", title: "REST API Reference", icon: <Code2 size={15} /> },
      { id: "python-sdk", title: "Python SDK (nexusai-py)", icon: <Terminal size={15} /> },
      { id: "node-sdk", title: "Node.js / TypeScript SDK", icon: <Globe size={15} /> },
    ],
  },
  {
    id: "security-compliance",
    heading: "Enterprise & Security",
    items: [
      { id: "soc2-security", title: "SOC2 Compliance & Audits", icon: <Shield size={15} /> },
      { id: "ai-guardrails", title: "AI Safety Guardrails", icon: <Lock size={15} /> },
    ],
  },
];

const CODE_EXAMPLES = {
  quickstart: {
    curl: `curl -X POST https://api.nexusai.com/v1/chat/completions \\
  -H "Authorization: Bearer nx_live_79a2f1c8e" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "nexus-neural-mesh-v2.5",
    "messages": [{"role": "user", "content": "Deploy microservice sandbox"}],
    "routing": "auto_cost_optimized"
  }'`,
    python: `from nexusai import NexusAI

client = NexusAI(api_key="nx_live_79a2f1c8e")

response = client.chat.create(
    model="nexus-neural-mesh-v2.5",
    messages=[{"role": "user", "content": "Deploy microservice sandbox"}],
    stream=True,
    enable_mcp=True
)

for chunk in response:
    print(chunk.delta.content, end="", flush=True)`,
    typescript: `import { NexusAI } from "@nexusai/sdk";

const client = new NexusAI({ apiKey: process.env.NEXUS_API_KEY });

const stream = await client.chat.stream({
  model: "nexus-neural-mesh-v2.5",
  messages: [{ role: "user", content: "Deploy microservice sandbox" }],
  ragCollections: ["enterprise-docs-v1"]
});

for await (const chunk of stream) {
  process.stdout.write(chunk.delta?.content || "");
}`,
    go: `package main

import (
	"context"
	"fmt"
	"github.com/nexusai/nexusai-go"
)

func main() {
	client := nexusai.NewClient("nx_live_79a2f1c8e")
	resp, err := client.Chat.Create(context.Background(), &nexusai.ChatParams{
		Model: "nexus-neural-mesh-v2.5",
		Messages: []nexusai.Message{
			{Role: "user", Content: "Deploy microservice sandbox"},
		},
	})
	if err != nil {
		panic(err)
	}
	fmt.Println(resp.Content)
}`
  },
  router: {
    curl: `curl -X POST https://api.nexusai.com/v1/router/classify \\
  -H "Authorization: Bearer nx_live_79a2f1c8e" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "Write a distributed Raft consensus implementation in Rust",
    "max_cost_tier": "tier_1_heavy"
  }'`,
    python: `from nexusai import NexusAI

client = NexusAI(api_key="nx_live_79a2f1c8e")

# Test semantic classifier before routing
classification = client.router.classify(
    prompt="Write a distributed Raft consensus implementation in Rust"
)

print(f"Assigned Model: {classification.selected_model}")
print(f"Estimated Latency: {classification.est_latency_ms}ms")
print(f"Projected Cost: \${classification.est_cost_usd:.6f}")`,
    typescript: `import { NexusAI } from "@nexusai/sdk";

const client = new NexusAI({ apiKey: process.env.NEXUS_API_KEY });

const routingResult = await client.router.classify({
  prompt: "Write a distributed Raft consensus implementation in Rust"
});

console.log("Optimal Provider:", routingResult.provider); // "Groq" | "Gemini" | "Claude"
console.log("Estimated Tokens:", routingResult.tokenEstimate);`,
    go: `// Go semantic router query
res, _ := client.Router.Classify(ctx, "Distributed Raft consensus in Rust")
fmt.Printf("Routed to: %s\\n", res.SelectedModel)`
  }
};

export default function DocsPage() {
  const navigate = useNavigate();
  const [activeDocId, setActiveDocId] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [codeLang, setCodeLang] = useState("python");
  const [copiedCode, setCopiedCode] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Flattened items for search & pagination
  const allDocItems = useMemo(() => {
    return DOCS_SECTIONS.flatMap((sec) =>
      sec.items.map((item) => ({ ...item, section: sec.heading }))
    );
  }, []);

  const currentIndex = allDocItems.findIndex((d) => d.id === activeDocId);
  const prevDoc = currentIndex > 0 ? allDocItems[currentIndex - 1] : null;
  const nextDoc = currentIndex < allDocItems.length - 1 ? allDocItems[currentIndex + 1] : null;

  // Filtered items based on search
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return DOCS_SECTIONS;
    const q = searchQuery.toLowerCase();
    return DOCS_SECTIONS.map((sec) => ({
      ...sec,
      items: sec.items.filter((it) => it.title.toLowerCase().includes(q)),
    })).filter((sec) => sec.items.length > 0);
  }, [searchQuery]);

  const handleCopyCode = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="docs-page">
      {/* Top Sticky Header */}
      <header className="docs-topbar">
        <div className="docs-topbar-left">
          <Link to="/" className="docs-brand">
            <div className="docs-brand-logo">N</div>
            <span className="docs-brand-text">NexusAI</span>
            <span className="docs-badge">Docs v2.5</span>
          </Link>

          <div className="docs-topbar-search">
            <Search size={15} className="docs-search-icon" />
            <input
              type="text"
              placeholder="Search documentation, guides, APIs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="docs-search-kbd">⌘K</span>
          </div>
        </div>

        <div className="docs-topbar-right">
          <Link to="/workspace" className="docs-nav-link-btn">
            Workspace
          </Link>
          <Link to="/careers" className="docs-nav-link-btn">
            Careers
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="docs-nav-link-btn"
          >
            GitHub <ExternalLink size={13} />
          </a>
          <button
            type="button"
            className="docs-btn-primary"
            onClick={() => navigate("/workspace")}
          >
            Launch OS <ArrowRight size={14} />
          </button>
        </div>
      </header>

      {/* Main Documentation Grid Layout */}
      <div className="docs-layout">
        {/* Left Nav Sidebar */}
        <aside className="docs-sidebar">
          {filteredSections.map((sec) => (
            <div key={sec.id} className="docs-sidebar-section">
              <div className="docs-sidebar-heading">{sec.heading}</div>
              {sec.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`docs-sidebar-item ${activeDocId === item.id ? "active" : ""}`}
                  onClick={() => {
                    setActiveDocId(item.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span className="docs-item-icon">{item.icon}</span>
                    <span>{item.title}</span>
                  </div>
                  {item.id === "quickstart" && <span className="docs-item-pill">FAST</span>}
                  {item.id === "model-router" && <span className="docs-item-pill">PRO</span>}
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* Center Article Content */}
        <main className="docs-content">
          <div className="docs-breadcrumb">
            <span>Documentation</span>
            <ChevronRight size={12} />
            <span>{allDocItems.find((d) => d.id === activeDocId)?.section || "Guides"}</span>
            <ChevronRight size={12} />
            <strong style={{ color: "var(--docs-text)" }}>
              {allDocItems.find((d) => d.id === activeDocId)?.title}
            </strong>
          </div>

          {/* ARTICLE CONTENT BY ACTIVE ID */}
          {activeDocId === "overview" && (
            <article className="docs-article">
              <h1>NexusAI Enterprise OS Overview</h1>
              <p className="docs-subtitle">
                The unified neural operating system for autonomous engineering, semantic complexity routing, and multi-agent enterprise coordination.
              </p>

              <div className="docs-callout info">
                <span className="docs-callout-icon">💡</span>
                <div>
                  <strong>Enterprise Ready:</strong> NexusAI OS v2.5 features built-in SOC2 Type II compliance, active PII redaction, isolated Docker/Node code sandboxes, and universal model context mesh across 100+ AI models.
                </div>
              </div>

              <h2>Core Architecture Mesh</h2>
              <p>
                NexusAI is built from first principles on a high-throughput, low-latency asynchronous architecture. It seamlessly routes requests across specialized AI agents, vector stores, and execution sandboxes:
              </p>

              <ul>
                <li><strong>Neural Router:</strong> Real-time heuristic and embedding classifier selecting between Groq Llama 3.3 (140ms latency) for routine tasks and Frontier Gemini/Claude models for complex synthesis.</li>
                <li><strong>Isolated Code Execution Sandbox:</strong> Ephemeral sandboxed runner executing Python, Node.js, and Bash commands in strict hardware limits with sub-millisecond setup.</li>
                <li><strong>Multi-Modal Vector RAG:</strong> Chunking engine supporting semantic similarity, hierarchical document indexing, and hybrid BM25 + dense embedding retrieval.</li>
                <li><strong>Model Context Protocol (MCP):</strong> Native protocol connectivity for SQLite, Postgres, GitHub, and custom private enterprise servers.</li>
              </ul>

              <h2>System Specifications</h2>
              <div className="docs-table-wrapper">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>Module Component</th>
                      <th>Throughput</th>
                      <th>Latency (P95)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span className="param-name">Fast Inference Mesh</span></td>
                      <td>1,200 tokens/sec</td>
                      <td>140ms</td>
                      <td><span className="param-req" style={{ color: "#10b981" }}>Operational</span></td>
                    </tr>
                    <tr>
                      <td><span className="param-name">Vector RAG Search</span></td>
                      <td>15,000 QPS</td>
                      <td>18ms</td>
                      <td><span className="param-req" style={{ color: "#10b981" }}>Operational</span></td>
                    </tr>
                    <tr>
                      <td><span className="param-name">Code Sandbox Spinup</span></td>
                      <td>800 containers/min</td>
                      <td>42ms</td>
                      <td><span className="param-req" style={{ color: "#10b981" }}>Operational</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          )}

          {activeDocId === "quickstart" && (
            <article className="docs-article">
              <h1>5-Minute Quickstart Guide</h1>
              <p className="docs-subtitle">
                Learn how to initialize the NexusAI SDK, authenticate your client, and execute your first autonomous multi-agent task.
              </p>

              <h2>1. Installation</h2>
              <p>Install the official NexusAI client library using your preferred package manager:</p>

              <div className="docs-code-container">
                <div className="docs-code-header">
                  <div className="docs-code-tabs">
                    <button type="button" className="docs-code-tab active">npm / pip / curl</button>
                  </div>
                  <button
                    type="button"
                    className="docs-copy-btn"
                    onClick={() => handleCopyCode("pip install nexusai-py\n# or\nnpm install @nexusai/sdk")}
                  >
                    {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                    {copiedCode ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="docs-code-body">
{`# Python
pip install nexusai-py

# Node.js / TypeScript
npm install @nexusai/sdk

# Go
go get github.com/nexusai/nexusai-go`}
                </pre>
              </div>

              <h2>2. Initialize Client & Make First Request</h2>
              <p>Execute your first completion query with automatic cost optimization:</p>

              <div className="docs-code-container">
                <div className="docs-code-header">
                  <div className="docs-code-tabs">
                    {["python", "typescript", "curl", "go"].map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        className={`docs-code-tab ${codeLang === lang ? "active" : ""}`}
                        onClick={() => setCodeLang(lang)}
                      >
                        {lang.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="docs-copy-btn"
                    onClick={() => handleCopyCode(CODE_EXAMPLES.quickstart[codeLang])}
                  >
                    {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                    {copiedCode ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="docs-code-body">
                  {CODE_EXAMPLES.quickstart[codeLang]}
                </pre>
              </div>

              <div className="docs-callout success">
                <span className="docs-callout-icon">⚡</span>
                <div>
                  <strong>Auto-Optimization Active:</strong> By default, queries under 500 tokens of standard coding logic route via Groq Fast Inference, saving up to 85% on LLM API expenditure.
                </div>
              </div>
            </article>
          )}

          {activeDocId === "model-router" && (
            <article className="docs-article">
              <h1>Semantic Complexity Router & Cost Vault</h1>
              <p className="docs-subtitle">
                Maximize token throughput while minimizing compute expenditure through intelligent, multi-tier LLM classification.
              </p>

              <h2>How Complexity Classification Works</h2>
              <p>
                Every prompt submitted through NexusAI passes through an ultra-fast (2ms) neural embedding classifier that assesses reasoning depth, code complexity, and mathematical requirements:
              </p>

              <div className="docs-table-wrapper">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>Tier Level</th>
                      <th>Complexity Score</th>
                      <th>Primary Model</th>
                      <th>Cost per 1M Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span className="param-name">Tier 1 (Fast Logic)</span></td>
                      <td>0.0 - 0.40</td>
                      <td>Groq Llama 3.3 70B Versatile</td>
                      <td>$0.59 / $0.79</td>
                    </tr>
                    <tr>
                      <td><span className="param-name">Tier 2 (Balanced Reasoning)</span></td>
                      <td>0.41 - 0.75</td>
                      <td>Google Gemini 2.0 Flash</td>
                      <td>$0.10 / $0.40</td>
                    </tr>
                    <tr>
                      <td><span className="param-name">Tier 3 (Deep Frontier)</span></td>
                      <td>0.76 - 1.00</td>
                      <td>Anthropic Claude 3.5 Sonnet / GPT-4o</td>
                      <td>$3.00 / $15.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h2>Programmatic Routing API</h2>
              <div className="docs-code-container">
                <div className="docs-code-header">
                  <div className="docs-code-tabs">
                    {["python", "typescript", "curl"].map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        className={`docs-code-tab ${codeLang === lang ? "active" : ""}`}
                        onClick={() => setCodeLang(lang)}
                      >
                        {lang.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="docs-copy-btn"
                    onClick={() => handleCopyCode(CODE_EXAMPLES.router[codeLang] || CODE_EXAMPLES.router.python)}
                  >
                    {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                    {copiedCode ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="docs-code-body">
                  {CODE_EXAMPLES.router[codeLang] || CODE_EXAMPLES.router.python}
                </pre>
              </div>
            </article>
          )}

          {activeDocId === "authentication" && (
            <article className="docs-article">
              <h1>API Authentication & Keys</h1>
              <p className="docs-subtitle">
                Generate, rotate, and securely configure enterprise API tokens and scoped session credentials.
              </p>

              <h2>Header Specifications</h2>
              <p>Authenticate all HTTP requests by providing your API secret in the standard Authorization Bearer header:</p>

              <div className="docs-code-container">
                <div className="docs-code-body">
{`Authorization: Bearer nx_live_YOUR_SECRET_KEY
X-Nexus-Org-ID: org_enterprise_88291`}
                </div>
              </div>

              <h2>Key Scopes & Roles</h2>
              <div className="docs-table-wrapper">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>Scope Identifier</th>
                      <th>Permissions</th>
                      <th>Recommended Use</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span className="param-name">chat:write</span></td>
                      <td>Execute prompts & agent sessions</td>
                      <td>Frontend web & mobile clients</td>
                    </tr>
                    <tr>
                      <td><span className="param-name">rag:admin</span></td>
                      <td>Ingest, delete, and re-index vector collections</td>
                      <td>Backend CI/CD data ingestion</td>
                    </tr>
                    <tr>
                      <td><span className="param-name">admin:*</span></td>
                      <td>Full root access, quota management, audit logs</td>
                      <td>Enterprise Admin Infrastructure</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          )}

          {activeDocId === "mcp-protocol" && (
            <article className="docs-article">
              <h1>Model Context Protocol (MCP) Integration</h1>
              <p className="docs-subtitle">
                Connect your enterprise databases, internal microservices, and file registries directly to NexusAI agents via standardized MCP servers.
              </p>

              <h2>Connecting an MCP Server</h2>
              <p>Configure your JSON transport settings inside <code>mcp_config.json</code> or register via the Admin Hub:</p>

              <div className="docs-code-container">
                <pre className="docs-code-body">
{`{
  "mcpServers": {
    "sqlite-prod": {
      "command": "uvx",
      "args": ["mcp-server-sqlite", "--db-path", "/var/data/analytics.db"]
    },
    "postgres-read": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://user:pass@db:5432/main"]
    },
    "github-tools": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxx"
      }
    }
  }
}`}
                </pre>
              </div>
            </article>
          )}

          {activeDocId === "soc2-security" && (
            <article className="docs-article">
              <h1>Enterprise Security & SOC2 Compliance</h1>
              <p className="docs-subtitle">
                Zero data retention, hardware-isolated sandboxes, active PII masking, and end-to-end audit logging.
              </p>

              <h2>Security Pillars</h2>
              <ul>
                <li><strong>SOC2 Type II Certified:</strong> Third-party audited access control and continuous automated compliance checks.</li>
                <li><strong>Zero Data Training Guarantee:</strong> Customer telemetry, embeddings, and chat transcripts are strictly isolated and never used for model training.</li>
                <li><strong>Active PII Redaction:</strong> Credit card numbers, API secrets, SSNs, and private tokens are masked in real time before reaching inference endpoints.</li>
              </ul>
            </article>
          )}

          {/* Catch-all for other docs */}
          {!["overview", "quickstart", "model-router", "authentication", "mcp-protocol", "soc2-security"].includes(activeDocId) && (
            <article className="docs-article">
              <h1>{allDocItems.find((d) => d.id === activeDocId)?.title}</h1>
              <p className="docs-subtitle">
                Comprehensive technical guide and reference for {allDocItems.find((d) => d.id === activeDocId)?.title}.
              </p>

              <div className="docs-callout info">
                <span className="docs-callout-icon">📘</span>
                <div>
                  This module is fully supported in NexusAI v2.5. Refer to the standard REST API and SDK methods to programmatically interact with this component.
                </div>
              </div>

              <h2>API Endpoint</h2>
              <div className="docs-code-container">
                <pre className="docs-code-body">
{`POST /api/v1/${activeDocId}/execute
Host: api.nexusai.com
Authorization: Bearer nx_live_...
Content-Type: application/json

{
  "module": "${activeDocId}",
  "stream": true,
  "options": {
    "temperature": 0.2,
    "max_tokens": 4096
  }
}`}
                </pre>
              </div>
            </article>
          )}

          {/* Feedback & Bottom Pagination */}
          <div className="docs-footer-nav">
            {prevDoc ? (
              <button
                type="button"
                className="docs-page-nav-btn"
                onClick={() => {
                  setActiveDocId(prevDoc.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <span className="docs-page-nav-sub">← Previous</span>
                <span className="docs-page-nav-title">{prevDoc.title}</span>
              </button>
            ) : <div />}

            <div className="docs-feedback-box">
              <span>Was this page helpful?</span>
              <button
                type="button"
                className={`docs-feedback-btn ${feedback === "yes" ? "active" : ""}`}
                onClick={() => setFeedback("yes")}
              >
                <ThumbsUp size={13} /> Yes
              </button>
              <button
                type="button"
                className={`docs-feedback-btn ${feedback === "no" ? "active" : ""}`}
                onClick={() => setFeedback("no")}
              >
                <ThumbsDown size={13} /> No
              </button>
            </div>

            {nextDoc && (
              <button
                type="button"
                className="docs-page-nav-btn"
                style={{ textAlign: "right" }}
                onClick={() => {
                  setActiveDocId(nextDoc.id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <span className="docs-page-nav-sub">Next →</span>
                <span className="docs-page-nav-title">{nextDoc.title}</span>
              </button>
            )}
          </div>
        </main>

        {/* Right Table of Contents (Desktop Sticky) */}
        <aside className="docs-toc">
          <div className="docs-toc-title">On This Page</div>
          <ul className="docs-toc-list">
            <li className="docs-toc-item">
              <a href="#overview" className="docs-toc-link">Overview</a>
            </li>
            <li className="docs-toc-item">
              <a href="#architecture" className="docs-toc-link">Core Architecture Mesh</a>
            </li>
            <li className="docs-toc-item">
              <a href="#specs" className="docs-toc-link">System Specifications</a>
            </li>
            <li className="docs-toc-item">
              <a href="#code" className="docs-toc-link">Code Examples & SDK</a>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}

import {
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Settings,
  Plug,
  RefreshCw,
  Terminal,
  Globe,
  ChevronDown,
  ChevronUp,
  Loader,
  Play,
  X,
  Sparkles,
  Download,
  ExternalLink
} from "lucide-react";
import api from "../../services/api";
import "./McpRegistry.css";

const POPULAR_MCP_TEMPLATES = [
  {
    id: "mcp_github",
    name: "GitHub MCP Server",
    tagline: "Official repository management, pull requests, issues & code search",
    icon: "🐙",
    category: "Developer Tools",
    command: "npx",
    args: "-y @modelcontextprotocol/server-github",
    env: [{ key: "GITHUB_PERSONAL_ACCESS_TOKEN", value: "" }],
    docs: "Enables creating branches, reading commits, opening PRs, and reviewing issues."
  },
  {
    id: "mcp_postgres",
    name: "PostgreSQL Database MCP",
    tagline: "Direct SQL queries, schema inspection & table analytics",
    icon: "🐘",
    category: "Databases",
    command: "npx",
    args: "-y @modelcontextprotocol/server-postgres postgresql://localhost/mydb",
    env: [{ key: "POSTGRES_URL", value: "postgresql://postgres:password@localhost:5432/mydb" }],
    docs: "Executes read/write queries and inspects relational schemas."
  },
  {
    id: "mcp_filesystem",
    name: "Local Filesystem MCP",
    tagline: "Read, write, edit, and search files in allowed local directories",
    icon: "📁",
    category: "Core Tools",
    command: "npx",
    args: "-y @modelcontextprotocol/server-filesystem ./",
    env: [],
    docs: "Allows AI to safely view and edit files within specified workspace paths."
  },
  {
    id: "mcp_brave_search",
    name: "Brave Web Search MCP",
    tagline: "Real-time web search, latest news & live internet intelligence",
    icon: "🦁",
    category: "Search & Web",
    command: "npx",
    args: "-y @modelcontextprotocol/server-brave-search",
    env: [{ key: "BRAVE_API_KEY", value: "" }],
    docs: "Provides privacy-first internet queries with verified source citations."
  },
  {
    id: "mcp_fetch",
    name: "Fetch & Web Scraper MCP",
    tagline: "Fetch web pages and convert HTML to structured Markdown text",
    icon: "🌐",
    category: "Search & Web",
    command: "uvx",
    args: "mcp-server-fetch",
    env: [],
    docs: "Extracts readable content and documentation from any public URL."
  },
  {
    id: "mcp_sqlite",
    name: "SQLite Database MCP",
    tagline: "Query local SQLite .db files with automated schema extraction",
    icon: "🗄️",
    category: "Databases",
    command: "uvx",
    args: "mcp-server-sqlite --db-path ./database.sqlite",
    env: [],
    docs: "Enables instant local database exploration and analytics generation."
  },
  {
    id: "mcp_puppeteer",
    name: "Puppeteer Browser Automation MCP",
    tagline: "Headless Chrome navigation, screenshot capture & form interaction",
    icon: "🎭",
    category: "Automation",
    command: "npx",
    args: "-y @modelcontextprotocol/server-puppeteer",
    env: [],
    docs: "Automates web forms, captures screenshots, and clicks interactive elements."
  },
  {
    id: "mcp_slack",
    name: "Slack Collaboration MCP",
    tagline: "Post messages, query channels, and monitor team alerts",
    icon: "💬",
    category: "Communication",
    command: "npx",
    args: "-y @modelcontextprotocol/server-slack",
    env: [{ key: "SLACK_BOT_TOKEN", value: "" }, { key: "SLACK_TEAM_ID", value: "" }],
    docs: "Bridges AI agents directly into your team's Slack workspaces."
  },
  {
    id: "mcp_memory",
    name: "Memory Graph Knowledge MCP",
    tagline: "Persistent entity-relation graph memory across agent conversations",
    icon: "🧠",
    category: "Core Tools",
    command: "npx",
    args: "-y @modelcontextprotocol/server-memory",
    env: [],
    docs: "Maintains structured knowledge graphs and persistent context across sessions."
  },
  {
    id: "mcp_docker",
    name: "Docker Engine MCP",
    tagline: "Inspect containers, review image registries & check daemon logs",
    icon: "🐳",
    category: "DevOps & Cloud",
    command: "uvx",
    args: "mcp-server-docker",
    env: [],
    docs: "Monitors local container status and executes container management tasks."
  },
  {
    id: "mcp_gdrive",
    name: "Google Drive & Docs MCP",
    tagline: "Search Drive, read Google Docs & access team spreadsheets",
    icon: "📄",
    category: "Productivity",
    command: "npx",
    args: "-y @modelcontextprotocol/server-gdrive",
    env: [{ key: "GOOGLE_APPLICATION_CREDENTIALS", value: "" }],
    docs: "Synchronizes enterprise files and presentations with AI context."
  },
  {
    id: "mcp_git",
    name: "Git Version Control MCP",
    tagline: "Execute git diff, status, log, branch, and commit operations",
    icon: "🌿",
    category: "Developer Tools",
    command: "uvx",
    args: "mcp-server-git --repository ./",
    env: [],
    docs: "Provides full programmatic control over local git repositories."
  },
  {
    id: "mcp_aws",
    name: "AWS Cloud Infrastructure MCP",
    tagline: "Inspect S3 buckets, EC2 instances, Lambda functions & metrics",
    icon: "☁️",
    category: "DevOps & Cloud",
    command: "npx",
    args: "-y @modelcontextprotocol/server-aws",
    env: [{ key: "AWS_ACCESS_KEY_ID", value: "" }, { key: "AWS_SECRET_ACCESS_KEY", value: "" }, { key: "AWS_REGION", value: "us-east-1" }],
    docs: "Audits cloud resources and fetches real-time infrastructure telemetry."
  },
  {
    id: "mcp_sentry",
    name: "Sentry Error Telemetry MCP",
    tagline: "Query stack traces, crash events, and issue frequency",
    icon: "🚨",
    category: "Observability",
    command: "uvx",
    args: "mcp-server-sentry",
    env: [{ key: "SENTRY_AUTH_TOKEN", value: "" }],
    docs: "Fetches live production error logs and helps AI diagnose bugs instantly."
  },
  {
    id: "mcp_notion",
    name: "Notion Workspace MCP",
    tagline: "Read pages, search workspace databases & sync project roadmaps",
    icon: "📓",
    category: "Productivity",
    command: "npx",
    args: "-y @modelcontextprotocol/server-notion",
    env: [{ key: "NOTION_API_KEY", value: "" }],
    docs: "Integrates team documentation and task databases directly into AI."
  }
];

function McpRegistry() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [activeTab, setActiveTab] = useState("popular"); // "popular" | "installed"

  // Form State
  const [name, setName] = useState("");
  const [type, setType] = useState("stdio"); // "stdio" | "sse"
  const [status, setStatus] = useState("active");
  const [command, setCommand] = useState("");
  const [argsInput, setArgsInput] = useState(""); // space or comma separated
  const [envList, setEnvList] = useState([{ key: "", value: "" }]);
  const [url, setUrl] = useState("");

  // Testing Connection States
  const [testingId, setTestingId] = useState(null);
  const [testResult, setTestResult] = useState(null); // { success: bool, message: string, tools: [] }
  const [globalTesting, setGlobalTesting] = useState(false);

  // Expaned details view
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchServers();
  }, []);

  async function fetchServers() {
    setLoading(true);
    try {
      const res = await api.get("/mcp/servers");
      setServers(res.data || []);
    } catch (err) {
      console.error("Failed to fetch MCP servers:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleAddEnvRow = () => {
    setEnvList([...envList, { key: "", value: "" }]);
  };

  const handleRemoveEnvRow = (index) => {
    setEnvList(envList.filter((_, idx) => idx !== index));
  };

  const handleEnvChange = (index, field, value) => {
    const updated = [...envList];
    updated[index][field] = value;
    setEnvList(updated);
  };

  const getPayload = () => {
    // Process arguments from input string
    const args = argsInput
      .split(/[\s,]+/)
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    // Process environment variables
    const env = {};
    envList.forEach((item) => {
      if (item.key.trim()) {
        env[item.key.trim()] = item.value.trim();
      }
    });

    return {
      name: name.trim() || "Unnamed Server",
      type,
      status,
      command: type === "stdio" ? command.trim() : "",
      args: type === "stdio" ? args : [],
      env: type === "stdio" ? env : {},
      url: type === "sse" ? url.trim() : ""
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = getPayload();

    try {
      if (editingServer) {
        await api.put(`/mcp/servers/${editingServer._id}`, payload);
      } else {
        await api.post("/mcp/servers", payload);
      }
      resetForm();
      fetchServers();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to save MCP server configuration.");
    }
  };

  const resetForm = () => {
    setName("");
    setType("stdio");
    setStatus("active");
    setCommand("");
    setArgsInput("");
    setEnvList([{ key: "", value: "" }]);
    setUrl("");
    setShowAddForm(false);
    setEditingServer(null);
    setTestResult(null);
  };

  const handleEdit = (server) => {
    setEditingServer(server);
    setName(server.name);
    setType(server.type);
    setStatus(server.status);
    setCommand(server.command || "");
    setArgsInput(server.args ? server.args.join(" ") : "");
    setUrl(server.url || "");

    if (server.env && Object.keys(server.env).length > 0) {
      setEnvList(
        Object.entries(server.env).map(([k, v]) => ({ key: k, value: v }))
      );
    } else {
      setEnvList([{ key: "", value: "" }]);
    }
    setShowAddForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to remove this MCP server?")) return;
    try {
      await api.delete(`/mcp/servers/${id}`);
      fetchServers();
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      alert("Failed to delete MCP server");
    }
  };

  const handleToggleStatus = async (server) => {
    const nextStatus = server.status === "active" ? "inactive" : "active";
    try {
      await api.put(`/mcp/servers/${server._id}`, {
        ...server,
        status: nextStatus
      });
      fetchServers();
    } catch (err) {
      alert("Failed to update status");
    }
  };

  const handleTestConnection = async (server) => {
    setTestingId(server._id);
    setTestResult(null);
    try {
      const res = await api.post("/mcp/servers/test", server);
      setTestResult({
        success: true,
        message: res.data.message,
        tools: res.data.tools || []
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err.response?.data?.detail || "Connection failed. Please check server arguments or endpoint availability."
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleUseMcpTemplate = (template) => {
    resetForm();
    setName(template.name);
    setType("stdio");
    setStatus("active");
    setCommand(template.command);
    setArgsInput(template.args);
    if (template.env && template.env.length > 0) {
      setEnvList(template.env.map(e => ({ ...e })));
    } else {
      setEnvList([{ key: "", value: "" }]);
    }
    setShowAddForm(true);
  };

  const handleTestFormConnection = async () => {
    setGlobalTesting(true);
    setTestResult(null);
    const payload = getPayload();
    try {
      const res = await api.post("/mcp/servers/test", payload);
      setTestResult({
        success: true,
        message: res.data.message,
        tools: res.data.tools || []
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err.response?.data?.detail || "Connection failed. Verify your command line arguments or Server URL."
      });
    } finally {
      setGlobalTesting(false);
    }
  };

  return (
    <div className="mcp-registry-container">
      <div className="mcp-header">
        <div className="mcp-header-title">
          <Plug className="mcp-icon" />
          <div>
            <h1>Dynamic MCP Registry & Tool Hub</h1>
            <p>Connect and orchestrate local filesystem tools, databases, web tools, and cloud microservices directly with the AI models.</p>
          </div>
        </div>
        <button className="mcp-add-btn" onClick={() => { resetForm(); setShowAddForm(true); }}>
          <Plus size={16} />
          Register Custom Server
        </button>
      </div>

      {/* Section Tabs */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "12px" }}>
        <button
          type="button"
          style={{
            background: activeTab === "popular" ? "#ffffff" : "rgba(255, 255, 255, 0.04)",
            color: activeTab === "popular" ? "#000000" : "#a1a1aa",
            border: activeTab === "popular" ? "1px solid #ffffff" : "1px solid rgba(255, 255, 255, 0.08)",
            padding: "8px 16px",
            borderRadius: "8px",
            fontWeight: activeTab === "popular" ? "600" : "500",
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s ease"
          }}
          onClick={() => setActiveTab("popular")}
        >
          <Sparkles size={14} style={{ color: activeTab === "popular" ? "#000000" : "#a1a1aa" }} /> 
          15 Top Most-Used MCP Tools ({POPULAR_MCP_TEMPLATES.length})
        </button>
        <button
          type="button"
          style={{
            background: activeTab === "installed" ? "#ffffff" : "rgba(255, 255, 255, 0.04)",
            color: activeTab === "installed" ? "#000000" : "#a1a1aa",
            border: activeTab === "installed" ? "1px solid #ffffff" : "1px solid rgba(255, 255, 255, 0.08)",
            padding: "8px 16px",
            borderRadius: "8px",
            fontWeight: activeTab === "installed" ? "600" : "500",
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.2s ease"
          }}
          onClick={() => setActiveTab("installed")}
        >
          <Plug size={14} style={{ color: activeTab === "installed" ? "#000000" : "#a1a1aa" }} /> 
          Connected Servers ({servers.length})
        </button>
      </div>

      {/* 1-Click Popular MCP Tools Marketplace */}
      {activeTab === "popular" && (
        <div style={{ marginBottom: "32px" }}>
          <div style={{ fontSize: "12px", color: "#a1a1aa", marginBottom: "14px", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px" }}>
            ⚡ 1-Click Connect Industry Standard MCP Tools
          </div>
          <div className="mcp-grid">
            {POPULAR_MCP_TEMPLATES.map((template) => {
              const isAlreadyInstalled = servers.some(s => s.name?.toLowerCase() === template.name?.toLowerCase() || s.args?.join(" ").includes(template.id));

              return (
                <div key={template.id} className="mcp-card active-card" style={{ background: "#18181b", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <div className="card-header">
                    <div className="card-title-group">
                      <div style={{ fontSize: "24px", width: "38px", height: "38px", background: "rgba(255, 255, 255, 0.06)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                        {template.icon}
                      </div>
                      <div>
                        <h3>{template.name}</h3>
                        <div className="badge-row">
                          <span className="type-badge">
                            {template.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card-body">
                    <p style={{ fontSize: "13px", color: "#d4d4d8", margin: "0 0 8px 0", lineHeight: "1.4" }}>
                      {template.tagline}
                    </p>
                    <div className="command-display">
                      <code>
                        $ {template.command} {template.args}
                      </code>
                    </div>
                  </div>

                  <div className="card-footer" style={{ justifyContent: "flex-end" }}>
                    <button
                      className="mcp-add-btn"
                      style={{ padding: "6px 14px", fontSize: "12px" }}
                      onClick={() => handleUseMcpTemplate(template)}
                    >
                      <Download size={13} /> {isAlreadyInstalled ? "Configure & Re-test" : "Configure & Connect"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="mcp-modal-backdrop">
          <div className="mcp-modal">
            <div className="mcp-modal-header">
              <h2>{editingServer ? "Edit MCP Server" : "Register New MCP Server"}</h2>
              <button className="mcp-close-btn" onClick={resetForm}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="mcp-form">
              <div className="form-group-row">
                <div className="form-item">
                  <label>Server Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Local Filesystem, PostgreSQL Connector"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="form-item">
                  <label>Transport Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value)}>
                    <option value="stdio">Stdio (Local Process)</option>
                    <option value="sse">SSE (Server-Sent Events HTTP Endpoint)</option>
                  </select>
                </div>
              </div>

              {type === "stdio" ? (
                <div className="mcp-stdio-fields">
                  <div className="form-item">
                    <label>Command / Executable</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. node, python, npx, docker"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                    />
                  </div>
                  <div className="form-item">
                    <label>Arguments (space-separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. -y @modelcontextprotocol/server-filesystem D:\workspace"
                      value={argsInput}
                      onChange={(e) => setArgsInput(e.target.value)}
                    />
                  </div>
                  <div className="form-item">
                    <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      Environment Variables
                      <button type="button" className="add-env-btn" onClick={handleAddEnvRow}>
                        + Add Row
                      </button>
                    </label>
                    <div className="env-variables-list">
                      {envList.map((env, index) => (
                        <div key={index} className="env-row">
                          <input
                            type="text"
                            placeholder="KEY (e.g. ALLOWED_DIRS)"
                            value={env.key}
                            onChange={(e) => handleEnvChange(index, "key", e.target.value)}
                          />
                          <input
                            type="text"
                            placeholder="VALUE"
                            value={env.value}
                            onChange={(e) => handleEnvChange(index, "value", e.target.value)}
                          />
                          <button
                            type="button"
                            className="remove-env-btn"
                            disabled={envList.length === 1 && !env.key && !env.value}
                            onClick={() => handleRemoveEnvRow(index)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mcp-sse-fields">
                  <div className="form-item">
                    <label>SSE Connection Endpoint URL</label>
                    <input
                      type="url"
                      required
                      placeholder="e.g. http://localhost:3000/sse"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="mcp-form-actions">
                <button
                  type="button"
                  className="test-conn-btn"
                  disabled={globalTesting}
                  onClick={handleTestFormConnection}
                >
                  {globalTesting ? (
                    <>
                      <Loader className="spin" size={14} />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Play size={14} />
                      Test Connection
                    </>
                  )}
                </button>
                <div className="submit-actions">
                  <button type="button" className="cancel-btn" onClick={resetForm}>
                    Cancel
                  </button>
                  <button type="submit" className="save-btn">
                    Save Server
                  </button>
                </div>
              </div>

              {testResult && (
                <div className={`test-feedback-box ${testResult.success ? "success" : "failure"}`}>
                  <div className="feedback-header">
                    {testResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
                    <span>{testResult.message}</span>
                  </div>
                  {testResult.success && testResult.tools.length > 0 && (
                    <div className="discovered-tools">
                      <h4>Discovered Tools ({testResult.tools.length}):</h4>
                      <ul>
                        {testResult.tools.map((t, idx) => (
                          <li key={idx}>
                            <code>{t.name}</code>: {t.description || "No description provided"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mcp-loader-container">
          <Loader className="spin" size={40} />
          <p>Scanning registry for active servers...</p>
        </div>
      ) : servers.length === 0 ? (
        <div className="mcp-empty-state">
          <Plug size={48} className="empty-icon" />
          <h3>No External MCP Servers Registered</h3>
          <p>Connect third-party databases, command execution wrappers, or network utilities. Registered tools are automatically accessible by your AI workspace agents.</p>
          <button className="mcp-add-btn" onClick={() => setShowAddForm(true)}>
            Register Your First Server
          </button>
        </div>
      ) : (
        <div className="mcp-grid">
          {servers.map((server) => {
            const isExpanded = expandedId === server._id;
            const isTesting = testingId === server._id;

            return (
              <div key={server._id} className={`mcp-card ${server.status === "active" ? "active-card" : "inactive-card"}`}>
                <div className="card-header">
                  <div className="card-title-group">
                    <div className="status-indicator">
                      <span className={`dot ${server.status === "active" ? "active" : "inactive"}`} />
                    </div>
                    <div>
                      <h3>{server.name}</h3>
                      <div className="badge-row">
                        <span className="type-badge">
                          {server.type === "stdio" ? <Terminal size={10} /> : <Globe size={10} />}
                          {server.type.toUpperCase()}
                        </span>
                        {server.status === "active" && (
                          <span className="live-badge">CONNECTED</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="card-actions">
                    <button
                      className="test-action-btn"
                      title="Test Connection"
                      disabled={isTesting}
                      onClick={() => handleTestConnection(server)}
                    >
                      {isTesting ? <Loader className="spin" size={14} /> : <Play size={14} />}
                    </button>
                    <button className="edit-action-btn" title="Edit Server" onClick={() => handleEdit(server)}>
                      <Settings size={14} />
                    </button>
                    <button className="delete-action-btn" title="Delete Server" onClick={() => handleDelete(server._id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="card-body">
                  {server.type === "stdio" ? (
                    <div className="command-display">
                      <code>
                        $ {server.command} {server.args?.join(" ")}
                      </code>
                    </div>
                  ) : (
                    <div className="url-display">
                      <Globe size={12} />
                      <a href={server.url} target="_blank" rel="noopener noreferrer">
                        {server.url}
                      </a>
                    </div>
                  )}
                </div>

                <div className="card-footer">
                  <button className="toggle-status-btn" onClick={() => handleToggleStatus(server)}>
                    {server.status === "active" ? "Disable Server" : "Enable Server"}
                  </button>
                  <button className="expand-tools-btn" onClick={() => setExpandedId(isExpanded ? null : server._id)}>
                    View Discovered Tools
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="expanded-tools-panel">
                    <McpServerToolsList server={server} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function McpServerToolsList({ server }) {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTools = async () => {
      try {
        const res = await api.post("/mcp/servers/test", server);
        setTools(res.data.tools || []);
      } catch (err) {
        setError(err.response?.data?.detail || "Could not fetch tools list. Server might be inactive or offline.");
      } finally {
        setLoading(false);
      }
    };
    fetchTools();
  }, [server]);

  if (loading) {
    return (
      <div className="panel-loading">
        <Loader className="spin" size={14} />
        <span>Querying tools schema...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel-error">
        <AlertCircle size={14} />
        <span>{error}</span>
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <div className="panel-empty">
        <AlertCircle size={14} />
        <span>This server did not expose any tools to the registry.</span>
      </div>
    );
  }

  return (
    <div className="panel-tools-list">
      {tools.map((t, idx) => (
        <div key={idx} className="mcp-tool-item">
          <div className="tool-title-row">
            <span className="tool-name">{t.name}</span>
          </div>
          <p className="tool-desc">{t.description || "No description provided."}</p>
          {t.inputSchema && t.inputSchema.properties && Object.keys(t.inputSchema.properties).length > 0 && (
            <div className="tool-schema">
              <strong>Parameters:</strong>
              <div className="schema-properties">
                {Object.entries(t.inputSchema.properties).map(([propName, propVal]) => (
                  <div key={propName} className="schema-prop">
                    <span className="prop-name">{propName}</span>
                    <span className="prop-type">({propVal.type || "string"})</span>
                    {t.inputSchema.required?.includes(propName) && (
                      <span className="required-tag">*required</span>
                    )}
                    <span className="prop-desc">{propVal.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default McpRegistry;

import React, { useState, useEffect } from "react";
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
  X
} from "lucide-react";
import api from "../../services/api";
import "./McpRegistry.css";

function McpRegistry() {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingServer, setEditingServer] = useState(null);

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
            <h1>Dynamic MCP Registry</h1>
            <p>Connect and orchestrate local filesystem tools, databases, and microservices directly with the AI agents.</p>
          </div>
        </div>
        <button className="mcp-add-btn" onClick={() => { resetForm(); setShowAddForm(true); }}>
          <Plus size={16} />
          Register Server
        </button>
      </div>

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

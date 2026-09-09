import React, { useState, useEffect } from "react";
import { 
  Plug, Key, Check, Copy, Trash2, Plus, RefreshCw, 
  ExternalLink, Code2, Globe, Shield, Terminal, Zap, CheckCircle2 
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import api from "../services/api";
import "./IntegrationsHub.css";

function IntegrationsHubPage() {
  const [activeTab, setActiveTab] = useState("connectors"); // connectors, apikeys, docs
  const [integrations, setIntegrations] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);

  // Configure modal
  const [configModal, setConfigModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [configApiKey, setConfigApiKey] = useState("");
  const [configWebhook, setConfigWebhook] = useState("");
  const [configTarget, setConfigTarget] = useState("");

  // Create Key modal
  const [createKeyModal, setCreateKeyModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyRateLimit, setNewKeyRateLimit] = useState(60);
  const [generatedSecret, setGeneratedSecret] = useState(null);

  // Docs snippet tab
  const [docsLanguage, setDocsLanguage] = useState("curl"); // curl, python, javascript
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    loadIntegrations();
    loadApiKeys();
  }, []);

  async function loadIntegrations() {
    try {
      const res = await api.get("/api/integrations");
      setIntegrations(res.data || []);
    } catch (e) {
      console.warn("Could not load integrations", e);
    }
  }

  async function loadApiKeys() {
    try {
      const res = await api.get("/api/developer/keys");
      setApiKeys(res.data || []);
    } catch (e) {
      console.warn("Could not load API keys", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig(e) {
    e.preventDefault();
    if (!selectedApp) return;
    try {
      await api.post(`/api/integrations/${selectedApp.app_id}/configure`, {
        api_key: configApiKey,
        webhook_url: configWebhook,
        target_repo_or_folder: configTarget
      });
      alert(`Integration '${selectedApp.name}' connected successfully!`);
      setConfigModal(false);
      loadIntegrations();
    } catch (err) {
      alert("Error configuring integration: " + (err.response?.data?.detail || err.message));
    }
  }

  async function handleSyncIntegration(appId) {
    try {
      const res = await api.post(`/api/integrations/${appId}/sync`);
      alert(res.data.message);
      loadIntegrations();
    } catch (err) {
      alert("Sync failed: " + (err.response?.data?.detail || err.message));
    }
  }

  async function handleCreateApiKey(e) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    try {
      const res = await api.post("/api/developer/keys", {
        name: newKeyName.trim(),
        rate_limit_rpm: newKeyRateLimit
      });
      setGeneratedSecret(res.data);
      loadApiKeys();
    } catch (err) {
      alert("Error creating API Key: " + (err.response?.data?.detail || err.message));
    }
  }

  async function handleRevokeKey(keyId) {
    if (!window.confirm("Are you sure you want to revoke this API key? Apps using this key will immediately lose access.")) return;
    try {
      await api.delete(`/api/developer/keys/${keyId}`);
      setApiKeys(apiKeys.filter(k => k.id !== keyId));
    } catch (err) {
      alert("Error revoking key");
    }
  }

  const sampleApiKey = apiKeys[0]?.prefix || "nx_live_xxxxxxxxxxxxxxxxxxxxxxxx";

  const curlSnippet = `curl -X POST "${window.location.origin}/api/v1/chat/completions" \\
  -H "Authorization: Bearer ${sampleApiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "llama-3.3-70b-versatile",
    "messages": [
      {"role": "user", "content": "Explain how NexusAI RAG workspace works."}
    ]
  }'`;

  const pythonSnippet = `import requests

url = "${window.location.origin}/api/v1/chat/completions"
headers = {
    "Authorization": "Bearer ${sampleApiKey}",
    "Content-Type": "application/json"
}
payload = {
    "model": "llama-3.3-70b-versatile",
    "messages": [{"role": "user", "content": "Explain how NexusAI RAG workspace works."}]
}

response = requests.post(url, headers=headers, json=payload)
print(response.json()["choices"][0]["message"]["content"])`;

  const jsSnippet = `const response = await fetch("${window.location.origin}/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${sampleApiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: "Explain how NexusAI RAG workspace works." }]
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);`;

  return (
    <DashboardLayout>
      <div className="hub-page">
        {/* Header */}
        <div className="hub-header">
          <div className="hub-header-title">
            <Plug className="hub-shield-icon" />
            <div>
              <h1>Enterprise Integration Hub & Developer API Gateway</h1>
              <p>Connect third-party SaaS cloud tools, sync RAG knowledge bases, and generate secure developer API keys.</p>
            </div>
          </div>
          {activeTab === "apikeys" && (
            <button 
              type="button" 
              className="admin-primary-btn" 
              onClick={() => { setGeneratedSecret(null); setNewKeyName(""); setCreateKeyModal(true); }}
            >
              <Plus size={16} /> Generate New API Key
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="team-tabs-nav" style={{ marginBottom: "24px" }}>
          <button 
            type="button" 
            className={`team-tab-btn ${activeTab === "connectors" ? "active" : ""}`}
            onClick={() => setActiveTab("connectors")}
          >
            <Plug size={14} /> SaaS Connectors Directory ({integrations.length})
          </button>
          <button 
            type="button" 
            className={`team-tab-btn ${activeTab === "apikeys" ? "active" : ""}`}
            onClick={() => setActiveTab("apikeys")}
          >
            <Key size={14} /> Developer API Keys ({apiKeys.length})
          </button>
          <button 
            type="button" 
            className={`team-tab-btn ${activeTab === "docs" ? "active" : ""}`}
            onClick={() => setActiveTab("docs")}
          >
            <Terminal size={14} /> REST API Quickstart & Docs
          </button>
        </div>

        {/* Tab 1: Connectors Directory */}
        {activeTab === "connectors" && (
          <div className="connectors-grid">
            {integrations.map((app) => (
              <div key={app.app_id} className="connector-card">
                <div>
                  <div className="connector-top">
                    <div className="connector-info">
                      <div className="connector-icon-box">
                        {app.app_id === "github" ? "🐙" : app.app_id === "slack" ? "💬" : app.app_id === "google_drive" ? "📁" : app.app_id === "notion" ? "📝" : "🎯"}
                      </div>
                      <div>
                        <div className="connector-name">{app.name}</div>
                        <div className="connector-category">{app.category}</div>
                      </div>
                    </div>
                    <span className={`user-stats-badges ${app.status === "connected" ? "badge-green" : "badge-yellow"}`}>
                      {app.status === "connected" ? "Connected" : "Not Linked"}
                    </span>
                  </div>

                  <div className="connector-desc">{app.description}</div>

                  <div className="connector-features">
                    {app.supported_features?.map((feat, fIdx) => (
                      <span key={fIdx} className="connector-feature-tag">{feat}</span>
                    ))}
                  </div>
                </div>

                <div className="connector-bottom">
                  <span style={{ fontSize: "11px", color: "#71717a" }}>
                    {app.last_synced_at ? `Synced ${app.last_synced_at.substring(0, 10)}` : "Manual / Realtime"}
                  </span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {app.status === "connected" && (
                      <button 
                        className="admin-refresh-btn" 
                        style={{ padding: "4px 8px", fontSize: "11px" }}
                        onClick={() => handleSyncIntegration(app.app_id)}
                        title="Sync now"
                      >
                        <RefreshCw size={12} /> Sync
                      </button>
                    )}
                    <button 
                      className="admin-primary-btn" 
                      style={{ padding: "4px 10px", fontSize: "11px" }}
                      onClick={() => {
                        setSelectedApp(app);
                        setConfigApiKey("");
                        setConfigWebhook("");
                        setConfigTarget(app.target_repo_or_folder || "");
                        setConfigModal(true);
                      }}
                    >
                      {app.status === "connected" ? "Configure" : "Connect"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Developer API Keys */}
        {activeTab === "apikeys" && (
          <div className="admin-card">
            <div className="admin-card-header">
              <h3>Active API Keys</h3>
              <span className="user-stats-badges badge-cyan">Bearer nx_live_...</span>
            </div>
            <div className="users-table-container">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>Key Name</th>
                    <th>Secret Key Prefix</th>
                    <th>Rate Limit</th>
                    <th>Total Requests</th>
                    <th>Created</th>
                    <th>Last Used</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.length === 0 ? (
                    <tr><td colSpan="7" className="table-empty">No API keys generated yet. Click 'Generate New API Key' above.</td></tr>
                  ) : apiKeys.map((k) => (
                    <tr key={k.id}>
                      <td style={{ fontWeight: "600", fontSize: "13px" }}>{k.name}</td>
                      <td>
                        <code style={{ background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: "4px", fontSize: "12px" }}>{k.prefix}</code>
                      </td>
                      <td style={{ fontSize: "12px" }}>{k.rate_limit_rpm} req/min</td>
                      <td style={{ fontSize: "12px", fontWeight: "600", color: "#38bdf8" }}>{k.total_requests.toLocaleString()}</td>
                      <td className="user-date-display">{k.created_at?.substring(0, 10)}</td>
                      <td className="user-date-display">{k.last_used_at ? k.last_used_at.substring(0, 10) : "Never"}</td>
                      <td>
                        <button className="user-delete-btn" onClick={() => handleRevokeKey(k.id)}>
                          <Trash2 size={12} /> Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Documentation Quickstart */}
        {activeTab === "docs" && (
          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h3 style={{ margin: 0 }}>OpenAI-Compatible REST API Quickstart</h3>
                <p style={{ color: "#a1a1aa", fontSize: "12px", marginTop: "4px" }}>
                  Call NexusAI's Specialized Agents and RAG Vector Memory programmatically from your applications.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", margin: "16px 0 10px 0" }}>
              <button 
                type="button" 
                className={`canvas-tab-btn ${docsLanguage === "curl" ? "active" : ""}`}
                onClick={() => setDocsLanguage("curl")}
              >
                cURL
              </button>
              <button 
                type="button" 
                className={`canvas-tab-btn ${docsLanguage === "python" ? "active" : ""}`}
                onClick={() => setDocsLanguage("python")}
              >
                Python (requests)
              </button>
              <button 
                type="button" 
                className={`canvas-tab-btn ${docsLanguage === "javascript" ? "active" : ""}`}
                onClick={() => setDocsLanguage("javascript")}
              >
                JavaScript (fetch)
              </button>
            </div>

            <div style={{ position: "relative" }}>
              <pre className="api-snippet-box">
                <code>
                  {docsLanguage === "curl" ? curlSnippet : docsLanguage === "python" ? pythonSnippet : jsSnippet}
                </code>
              </pre>
              <button 
                className="admin-primary-btn" 
                style={{ position: "absolute", top: "20px", right: "20px", padding: "6px 12px", fontSize: "11px" }}
                onClick={() => {
                  const code = docsLanguage === "curl" ? curlSnippet : docsLanguage === "python" ? pythonSnippet : jsSnippet;
                  navigator.clipboard.writeText(code);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
              >
                {copiedCode ? <Check size={12} /> : <Copy size={12} />} Copy Code
              </button>
            </div>
          </div>
        )}

        {/* Modal: Configure Integration */}
        {configModal && selectedApp && (
          <div className="admin-modal-backdrop" onClick={() => setConfigModal(false)}>
            <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
              <h3>Connect {selectedApp.name}</h3>
              <form onSubmit={handleSaveConfig} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
                <div className="admin-input-group">
                  <label>Access Token / API Key</label>
                  <input type="password" className="admin-input" placeholder="e.g. ghp_xxxxxxxx or xoxb-xxxxxxxx" value={configApiKey} onChange={(e) => setConfigApiKey(e.target.value)} />
                </div>
                <div className="admin-input-group">
                  <label>Target Repository / Folder ID / Channel</label>
                  <input type="text" className="admin-input" placeholder="e.g. owner/repo or 1A2b3C_FolderID" value={configTarget} onChange={(e) => setConfigTarget(e.target.value)} />
                </div>
                <div className="admin-input-group">
                  <label>Webhook URL (Optional for real-time events)</label>
                  <input type="url" className="admin-input" placeholder="https://hooks.slack.com/services/..." value={configWebhook} onChange={(e) => setConfigWebhook(e.target.value)} />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button type="button" className="admin-refresh-btn" onClick={() => setConfigModal(false)}>Cancel</button>
                  <button type="submit" className="admin-primary-btn">Save & Authorize</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Generate API Key */}
        {createKeyModal && (
          <div className="admin-modal-backdrop" onClick={() => setCreateKeyModal(false)}>
            <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
              <h3>Generate Developer API Key</h3>
              {!generatedSecret ? (
                <form onSubmit={handleCreateApiKey} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
                  <div className="admin-input-group">
                    <label>Key Name *</label>
                    <input type="text" className="admin-input" placeholder="e.g. Production Backend Service" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} required />
                  </div>
                  <div className="admin-input-group">
                    <label>Rate Limit (Requests per Minute)</label>
                    <input type="number" className="admin-input" min="10" max="600" value={newKeyRateLimit} onChange={(e) => setNewKeyRateLimit(parseInt(e.target.value) || 60)} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                    <button type="button" className="admin-refresh-btn" onClick={() => setCreateKeyModal(false)}>Cancel</button>
                    <button type="submit" className="admin-primary-btn">Generate Key</button>
                  </div>
                </form>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "16px" }}>
                  <div style={{ padding: "12px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "8px", color: "#34d399", fontSize: "13px" }}>
                    ✅ API Key generated! Copy it now. You will not be able to see it again.
                  </div>
                  <div className="admin-input-group">
                    <label>Secret API Key</label>
                    <input type="text" readOnly className="admin-input" value={generatedSecret.raw_key} style={{ color: "#38bdf8", fontWeight: "600" }} />
                  </div>
                  <button 
                    className="admin-primary-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedSecret.raw_key);
                      alert("API Key copied to clipboard!");
                      setCreateKeyModal(false);
                      setGeneratedSecret(null);
                    }}
                  >
                    <Copy size={14} /> Copy Secret Key & Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

export default IntegrationsHubPage;

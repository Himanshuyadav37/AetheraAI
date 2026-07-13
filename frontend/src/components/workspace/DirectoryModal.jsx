import { useState } from "react";
import { X } from "lucide-react";
import api from "../../services/api";

function DirectoryModal({ isOpen, onClose }) {
  const [directoryTab, setDirectoryTab] = useState("connectors"); // 'skills' | 'connectors' | 'plugins'
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedConnector, setExpandedConnector] = useState(null);

  // Verification loading states
  const [verifyingConnector, setVerifyingConnector] = useState(null);
  const [verificationError, setVerificationError] = useState("");
  const [verificationSuccess, setVerificationSuccess] = useState("");

  // Connectors config state
  const [connectors, setConnectors] = useState(() => {
    const saved = localStorage.getItem("workspace_connectors");
    const hasGithubToken = !!localStorage.getItem("github_token");
    const hasGmailRecipient = !!localStorage.getItem("default_recipient_email");

    return saved ? JSON.parse(saved) : {
      gmail: { 
        enabled: hasGmailRecipient, 
        connected: hasGmailRecipient, 
        recipient: localStorage.getItem("default_recipient_email") || "" 
      },
      github: { 
        enabled: hasGithubToken, 
        connected: hasGithubToken, 
        token: localStorage.getItem("github_token") || "" 
      },
      google_drive: { 
        enabled: false, 
        connected: false, 
        token: "" 
      }
    };
  });

  // Input states for modal forms
  const [githubInput, setGithubInput] = useState(connectors.github.token || "");
  const [gmailInput, setGmailInput] = useState(connectors.gmail.recipient || "");
  const [driveInput, setDriveInput] = useState(connectors.google_drive.token || "");

  const handleToggleConnector = (key) => {
    if (!connectors[key].connected) {
      alert(`Please setup and connect the ${key} connector first by entering credentials!`);
      return;
    }
    const updated = {
      ...connectors,
      [key]: {
        ...connectors[key],
        enabled: !connectors[key].enabled
      }
    };
    setConnectors(updated);
    localStorage.setItem("workspace_connectors", JSON.stringify(updated));
    window.dispatchEvent(new Event("workspace_connectors_changed"));
  };

  const handleVerifyAndConnectGitHub = async (token) => {
    if (!token.trim()) {
      setVerificationError("Please enter a Personal Access Token.");
      return;
    }
    setVerifyingConnector("github");
    setVerificationError("");
    setVerificationSuccess("");

    try {
      const res = await api.post("/github/verify-token", { token: token.trim() });
      if (res.data?.status === "success") {
        const updated = {
          ...connectors,
          github: {
            enabled: true,
            connected: true,
            token: token.trim()
          }
        };
        setConnectors(updated);
        localStorage.setItem("workspace_connectors", JSON.stringify(updated));
        localStorage.setItem("github_token", token.trim());
        setVerificationSuccess(`Connected successfully as user: ${res.data.username}`);
        window.dispatchEvent(new Event("workspace_connectors_changed"));
      }
    } catch (err) {
      setVerificationError(err.response?.data?.detail || err.message || "Invalid GitHub token.");
    } finally {
      setVerifyingConnector(null);
    }
  };

  const handleConnectGmail = (email) => {
    if (!email.trim() || !email.includes("@")) {
      setVerificationError("Please enter a valid recipient email address.");
      return;
    }
    
    setVerifyingConnector("gmail");
    setVerificationError("");
    setVerificationSuccess("");

    setTimeout(() => {
      const updated = {
        ...connectors,
        gmail: {
          enabled: true,
          connected: true,
          recipient: email.trim()
        }
      };
      setConnectors(updated);
      localStorage.setItem("workspace_connectors", JSON.stringify(updated));
      localStorage.setItem("default_recipient_email", email.trim());
      setVerificationSuccess("Gmail integration connected successfully!");
      setVerifyingConnector(null);
      window.dispatchEvent(new Event("workspace_connectors_changed"));
    }, 1000);
  };

  const handleConnectGoogleDrive = (token) => {
    if (!token.trim()) {
      setVerificationError("Please enter an access token.");
      return;
    }
    
    setVerifyingConnector("google_drive");
    setVerificationError("");
    setVerificationSuccess("");

    setTimeout(() => {
      const updated = {
        ...connectors,
        google_drive: {
          enabled: true,
          connected: true,
          token: token.trim()
        }
      };
      setConnectors(updated);
      localStorage.setItem("workspace_connectors", JSON.stringify(updated));
      setVerificationSuccess("Google Drive connected successfully!");
      setVerifyingConnector(null);
      window.dispatchEvent(new Event("workspace_connectors_changed"));
    }, 1000);
  };

  const handleDisconnectConnector = (key) => {
    const updated = {
      ...connectors,
      [key]: {
        enabled: false,
        connected: false,
        token: "",
        recipient: ""
      }
    };
    setConnectors(updated);
    localStorage.setItem("workspace_connectors", JSON.stringify(updated));
    
    if (key === "github") {
      localStorage.removeItem("github_token");
    } else if (key === "gmail") {
      localStorage.removeItem("default_recipient_email");
    }
    setVerificationSuccess("");
    setVerificationError("");
    window.dispatchEvent(new Event("workspace_connectors_changed"));
  };

  if (!isOpen) return null;

  return (
    <div className="ws-modal-overlay">
      <div className="directory-modal-container">
        <div className="directory-modal-header">
          <h2>NexusAI Hub</h2>
          <button className="directory-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="directory-body">
          {/* Sidebar */}
          <div className="directory-sidebar">
            <button 
              className={`directory-sidebar-btn ${directoryTab === "skills" ? "active" : ""}`}
              onClick={() => setDirectoryTab("skills")}
            >
              📝 Abilities
            </button>
            <button 
              className={`directory-sidebar-btn ${directoryTab === "connectors" ? "active" : ""}`}
              onClick={() => setDirectoryTab("connectors")}
            >
              🔌 Connectors
            </button>
            <button 
              className={`directory-sidebar-btn ${directoryTab === "plugins" ? "active" : ""}`}
              onClick={() => setDirectoryTab("plugins")}
            >
              🧩 Marketplace
            </button>
          </div>

          {/* Main Content */}
          <div className="directory-main">
            <input
              type="text"
              className="directory-search-bar"
              placeholder={`Filter ${directoryTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {directoryTab === "connectors" && (
              <div className="connector-grid">
                {/* GitHub Card */}
                <div className="connector-card">
                  <div className="connector-card-header">
                    <div className="connector-icon-wrapper">🐙</div>
                    <div className="connector-meta">
                      <span className="connector-card-name">GitHub Connection</span>
                      <div style={{ marginTop: "4px" }}>
                        <span className={`connector-status-badge ${connectors.github.connected ? "connected" : "setup"}`}>
                          {connectors.github.connected ? "Connected" : "Setup Required"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="connector-card-description">
                    Required to create new repositories and push generated workspaces directly to your GitHub profile.
                  </p>
                  
                  {expandedConnector === "github" && (
                    <div className="ws-form-group" style={{ marginTop: "10px" }}>
                      <label>GitHub Personal Access Token (PAT)</label>
                      <input
                        type="password"
                        value={githubInput}
                        onChange={(e) => setGithubInput(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxx"
                        disabled={verifyingConnector === "github"}
                      />
                      <span style={{ fontSize: "11px", color: "#a3a3a3", marginTop: "4px" }}>
                        Requires `repo` scope permissions.
                      </span>
                    </div>
                  )}

                  {expandedConnector === "github" && (verificationError || verificationSuccess) && (
                    <div style={{ 
                      fontSize: "12px", 
                      padding: "8px", 
                      borderRadius: "6px", 
                      marginTop: "8px",
                      background: verificationError ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                      color: verificationError ? "#ef4444" : "#34d399",
                      border: verificationError ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid rgba(16, 185, 129, 0.2)"
                    }}>
                      {verificationError ? `❌ ${verificationError}` : `✓ ${verificationSuccess}`}
                    </div>
                  )}

                  <div className="connector-card-actions">
                    {expandedConnector === "github" ? (
                      <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                        <button 
                          className="connector-btn-setup" 
                          onClick={() => handleVerifyAndConnectGitHub(githubInput)}
                          disabled={verifyingConnector === "github"}
                        >
                          {verifyingConnector === "github" ? "Verifying..." : "Verify & Connect"}
                        </button>
                        {connectors.github.connected && (
                          <button 
                            className="connector-btn-setup" 
                            style={{ background: "rgba(239, 68, 68, 0.1)", color: "#f87171", borderColor: "rgba(239, 68, 68, 0.2)" }}
                            onClick={() => {
                              handleDisconnectConnector("github");
                              setGithubInput("");
                            }}
                          >
                            Disconnect
                          </button>
                        )}
                      </div>
                    ) : (
                      <button 
                        className="connector-btn-setup"
                        onClick={() => setExpandedConnector("github")}
                      >
                        ⚙️ Setup Connection
                      </button>
                    )}
                    <label className="ws-switch" style={{ opacity: connectors.github.connected ? 1 : 0.4 }}>
                      <input 
                        type="checkbox" 
                        checked={connectors.github.enabled}
                        disabled={!connectors.github.connected}
                        onChange={() => handleToggleConnector("github")}
                      />
                      <span className="ws-slider"></span>
                    </label>
                  </div>
                </div>

                {/* Gmail Card */}
                <div className="connector-card">
                  <div className="connector-card-header">
                    <div className="connector-icon-wrapper">📧</div>
                    <div className="connector-meta">
                      <span className="connector-card-name">Gmail Alerts</span>
                      <div style={{ marginTop: "4px" }}>
                        <span className={`connector-status-badge ${connectors.gmail.connected ? "connected" : "setup"}`}>
                          {connectors.gmail.connected ? "Connected" : "Setup Required"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="connector-card-description">
                    Sends system notifications, summaries, and OTP authentication details to your email inbox.
                  </p>
                  
                  {expandedConnector === "gmail" && (
                    <div className="ws-form-group" style={{ marginTop: "10px" }}>
                      <label>Default Recipient Email</label>
                      <input
                        type="email"
                        value={gmailInput}
                        onChange={(e) => setGmailInput(e.target.value)}
                        placeholder="user@example.com"
                        disabled={verifyingConnector === "gmail"}
                      />
                    </div>
                  )}

                  {expandedConnector === "gmail" && (verificationError || verificationSuccess) && (
                    <div style={{ 
                      fontSize: "12px", 
                      padding: "8px", 
                      borderRadius: "6px", 
                      marginTop: "8px",
                      background: verificationError ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                      color: verificationError ? "#ef4444" : "#34d399",
                      border: verificationError ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid rgba(16, 185, 129, 0.2)"
                    }}>
                      {verificationError ? `❌ ${verificationError}` : `✓ ${verificationSuccess}`}
                    </div>
                  )}

                  <div className="connector-card-actions">
                    {expandedConnector === "gmail" ? (
                      <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                        <button 
                          className="connector-btn-setup" 
                          onClick={() => handleConnectGmail(gmailInput)}
                          disabled={verifyingConnector === "gmail"}
                        >
                          {verifyingConnector === "gmail" ? "Connecting..." : "Verify & Connect"}
                        </button>
                        {connectors.gmail.connected && (
                          <button 
                            className="connector-btn-setup" 
                            style={{ background: "rgba(239, 68, 68, 0.1)", color: "#f87171", borderColor: "rgba(239, 68, 68, 0.2)" }}
                            onClick={() => {
                              handleDisconnectConnector("gmail");
                              setGmailInput("");
                            }}
                          >
                            Disconnect
                          </button>
                        )}
                      </div>
                    ) : (
                      <button 
                        className="connector-btn-setup"
                        onClick={() => setExpandedConnector("gmail")}
                      >
                        ⚙️ Setup Connection
                      </button>
                    )}
                    <label className="ws-switch" style={{ opacity: connectors.gmail.connected ? 1 : 0.4 }}>
                      <input 
                        type="checkbox" 
                        checked={connectors.gmail.enabled}
                        disabled={!connectors.gmail.connected}
                        onChange={() => handleToggleConnector("gmail")}
                      />
                      <span className="ws-slider"></span>
                    </label>
                  </div>
                </div>

                {/* Google Drive Card */}
                <div className="connector-card">
                  <div className="connector-card-header">
                    <div className="connector-icon-wrapper">📁</div>
                    <div className="connector-meta">
                      <span className="connector-card-name">Google Drive Storage</span>
                      <div style={{ marginTop: "4px" }}>
                        <span className={`connector-status-badge ${connectors.google_drive.connected ? "connected" : "setup"}`}>
                          {connectors.google_drive.connected ? "Connected" : "Setup Required"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="connector-card-description">
                    Mounts your drive storage to easily import file contexts or save code outputs and documents.
                  </p>

                  {expandedConnector === "google_drive" && (
                    <div className="ws-form-group" style={{ marginTop: "10px" }}>
                      <label>OAuth Access Key</label>
                      <input
                        type="password"
                        value={driveInput}
                        onChange={(e) => setDriveInput(e.target.value)}
                        placeholder="Enter Google Drive API Token"
                        disabled={verifyingConnector === "google_drive"}
                      />
                    </div>
                  )}

                  {expandedConnector === "google_drive" && (verificationError || verificationSuccess) && (
                    <div style={{ 
                      fontSize: "12px", 
                      padding: "8px", 
                      borderRadius: "6px", 
                      marginTop: "8px",
                      background: verificationError ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                      color: verificationError ? "#ef4444" : "#34d399",
                      border: verificationError ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid rgba(16, 185, 129, 0.2)"
                    }}>
                      {verificationError ? `❌ ${verificationError}` : `✓ ${verificationSuccess}`}
                    </div>
                  )}

                  <div className="connector-card-actions">
                    {expandedConnector === "google_drive" ? (
                      <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                        <button 
                          className="connector-btn-setup" 
                          onClick={() => handleConnectGoogleDrive(driveInput)}
                          disabled={verifyingConnector === "google_drive"}
                        >
                          {verifyingConnector === "google_drive" ? "Connecting..." : "Verify & Connect"}
                        </button>
                        {connectors.google_drive.connected && (
                          <button 
                            className="connector-btn-setup" 
                            style={{ background: "rgba(239, 68, 68, 0.1)", color: "#f87171", borderColor: "rgba(239, 68, 68, 0.2)" }}
                            onClick={() => {
                              handleDisconnectConnector("google_drive");
                              setDriveInput("");
                            }}
                          >
                            Disconnect
                          </button>
                        )}
                      </div>
                    ) : (
                      <button 
                        className="connector-btn-setup"
                        onClick={() => setExpandedConnector("google_drive")}
                      >
                        ⚙️ Setup Connection
                      </button>
                    )}
                    <label className="ws-switch" style={{ opacity: connectors.google_drive.connected ? 1 : 0.4 }}>
                      <input 
                        type="checkbox" 
                        checked={connectors.google_drive.enabled}
                        disabled={!connectors.google_drive.connected}
                        onChange={() => handleToggleConnector("google_drive")}
                      />
                      <span className="ws-slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {directoryTab === "skills" && (
              <div className="connector-grid">
                {/* Skill Card 1 */}
                <div className="connector-card">
                  <div className="connector-card-header">
                    <div className="connector-icon-wrapper">💻</div>
                    <div className="connector-meta">
                      <span className="connector-card-name">Senior Fullstack Architect</span>
                      <div style={{ marginTop: "4px" }}>
                        <span className="connector-status-badge connected">Active</span>
                      </div>
                    </div>
                  </div>
                  <p className="connector-card-description">
                    Instructs the Coder and Planner agents to prioritize clean code structure, architectural design patterns, and comprehensive unit testing.
                  </p>
                  <div className="connector-card-actions" style={{ justifyContent: "flex-end" }}>
                    <label className="ws-switch">
                      <input type="checkbox" defaultChecked />
                      <span className="ws-slider"></span>
                    </label>
                  </div>
                </div>

                {/* Skill Card 2 */}
                <div className="connector-card">
                  <div className="connector-card-header">
                    <div className="connector-icon-wrapper">🔍</div>
                    <div className="connector-meta">
                      <span className="connector-card-name">Academic Research Mode</span>
                      <div style={{ marginTop: "4px" }}>
                        <span className="connector-status-badge setup">Inactive</span>
                      </div>
                    </div>
                  </div>
                  <p className="connector-card-description">
                    Configures the Research agent to write highly detailed reports with academic styling, source citations, and structured reference appendix.
                  </p>
                  <div className="connector-card-actions" style={{ justifyContent: "flex-end" }}>
                    <label className="ws-switch">
                      <input type="checkbox" />
                      <span className="ws-slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {directoryTab === "plugins" && (
              <div className="connector-grid">
                {/* Plugin Card 1 */}
                <div className="connector-card">
                  <div className="connector-card-header">
                    <div className="connector-icon-wrapper">🗄️</div>
                    <div className="connector-meta">
                      <span className="connector-card-name">PostgreSQL Tool Server</span>
                      <div style={{ marginTop: "4px" }}>
                        <span className="connector-status-badge connected">Installed</span>
                      </div>
                    </div>
                  </div>
                  <p className="connector-card-description">
                    Provides direct SQL querying, schema introspection, and database design capabilities directly from the chat prompt.
                  </p>
                  <div className="connector-card-actions">
                    <button className="connector-btn-setup" style={{ background: "rgba(239, 68, 68, 0.1)", color: "#f87171", borderColor: "rgba(239, 68, 68, 0.2)" }}>
                      Uninstall
                    </button>
                    <label className="ws-switch">
                      <input type="checkbox" defaultChecked />
                      <span className="ws-slider"></span>
                    </label>
                  </div>
                </div>

                {/* Plugin Card 2 */}
                <div className="connector-card">
                  <div className="connector-card-header">
                    <div className="connector-icon-wrapper">🌐</div>
                    <div className="connector-meta">
                      <span className="connector-card-name">Web Scraper & Crawler</span>
                      <div style={{ marginTop: "4px" }}>
                        <span className="connector-status-badge setup">Available</span>
                      </div>
                    </div>
                  </div>
                  <p className="connector-card-description">
                    Allows agents to search the live web, crawl target pages, and read markdown content from public URLs dynamically.
                  </p>
                  <div className="connector-card-actions">
                    <button className="connector-btn-setup">
                      Install Plugin
                    </button>
                    <label className="ws-switch" style={{ opacity: 0.4 }}>
                      <input type="checkbox" disabled />
                      <span className="ws-slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DirectoryModal;

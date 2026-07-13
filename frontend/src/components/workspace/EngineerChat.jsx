import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { SendHorizonal, Wrench, ArrowRight, Plus, X } from "lucide-react";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useAuth } from "../../contexts/AuthContext";
import EngineerPanel, { formatProjectOutput } from "../EngineerPanel";
import api, { getBaseURL } from "../../services/api";
import "../../styles/workspace.css";
import { getAvatarStyle } from "../../utils/avatarHelper";
import MarkdownRenderer from "../education/MarkdownRenderer";
import McpRegistry from "./McpRegistry";

const PLACEHOLDER = "Build an AI Resume Analyzer using FastAPI and MongoDB...";

function EngineerChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const continueProjectId = searchParams.get("projectId");
  const continueExecutionId = searchParams.get("executionId");

  const {
    moduleState,
    setMessages,
    setResult,
    setActiveId,
    setLoading,
    refreshHistory,
    setDirectoryModalOpen,
  } = useWorkspace();

  const { messages, result, loading, activeId } = moduleState.engineer;

  const [prompt, setPrompt] = useState("");
  const [file, setFile] = useState(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // New features state
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [hoveredSubmenu, setHoveredSubmenu] = useState(null); // 'skills' | 'connectors' | null
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [pushProject, setPushProject] = useState(null);
  const [repoName, setRepoName] = useState("");
  const [repoDesc, setRepoDesc] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [githubToken, setGithubToken] = useState(() => {
    const savedToken = localStorage.getItem("github_token");
    if (savedToken) return savedToken;
    try {
      const savedConnectors = localStorage.getItem("workspace_connectors");
      if (savedConnectors) {
        const parsed = JSON.parse(savedConnectors);
        return parsed?.github?.token || "";
      }
    } catch (e) {}
    return "";
  });
  const [pushing, setPushing] = useState(false);
  const [pushError, setPushError] = useState("");
  const [pushSuccessUrl, setPushSuccessUrl] = useState("");

  // Directory Modal state
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [mcpTools, setMcpTools] = useState([]);
  const [loadingTools, setLoadingTools] = useState(false);

  // Verification loading states
  const [verifyingConnector, setVerifyingConnector] = useState(null); // 'github' | 'gmail' | 'google_drive' | null
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

  const [mcpServers, setMcpServers] = useState([]);
  const [mcpModalOpen, setMcpModalOpen] = useState(false);

  const fetchMcpServers = async () => {
    try {
      const res = await api.get("/mcp/servers");
      setMcpServers(res.data || []);
    } catch (err) {
      console.error("Failed to fetch MCP servers in Chat:", err);
    }
  };

  useEffect(() => {
    fetchMcpServers();
  }, []);

  const handleToggleMcpServer = async (server) => {
    const nextStatus = server.status === "active" ? "inactive" : "active";
    try {
      await api.put(`/mcp/servers/${server._id}`, {
        ...server,
        status: nextStatus
      });
      fetchMcpServers();
    } catch (err) {
      alert("Failed to update MCP server status");
    }
  };

  // Sync connectors state across models when directory config is saved
  useEffect(() => {
    const handleUpdate = () => {
      const saved = localStorage.getItem("workspace_connectors");
      if (saved) {
        const parsed = JSON.parse(saved);
        setConnectors(parsed);
        setGithubInput(parsed.github.token || "");
        setGmailInput(parsed.gmail.recipient || "");
        setDriveInput(parsed.google_drive.token || "");
      }
    };
    window.addEventListener("workspace_connectors_changed", handleUpdate);
    return () => window.removeEventListener("workspace_connectors_changed", handleUpdate);
  }, []);

  // Load project from execution history (continue development mode)
  useEffect(() => {
    if (!continueProjectId && !continueExecutionId) return;

    async function loadProjectHistory() {
      try {
        setLoading("engineer", true);
        
        let executions = [];
        if (continueProjectId) {
          const historyRes = await api.get(`/ai/projects/${continueProjectId}/history`);
          executions = historyRes.data || [];
        }

        // Fallback if no history or only executionId is present
        if (executions.length === 0 && continueExecutionId) {
          const execRes = await api.get(`/ai/executions/${continueExecutionId}`);
          if (execRes.data) executions = [execRes.data];
        }

        if (executions.length > 0) {
          // Sort chronological (oldest to newest)
          const sorted = [...executions].reverse();
          
          // Set the last execution as active result in state
          const latestExec = sorted[sorted.length - 1];
          setResult("engineer", latestExec);
          setActiveId("engineer", latestExec.conversation_id || null);

          // Build message chain of all historical prompts and generation results
          const chatMessages = [];
          sorted.forEach((exec) => {
            chatMessages.push({
              id: `user-${exec._id}`,
              role: "user",
              content: exec.idea || "Generate project",
            });
            chatMessages.push({
              id: `assistant-${exec._id}`,
              role: "assistant",
              content: formatProjectOutput(exec),
              result: exec,
            });
          });

          setMessages("engineer", chatMessages);
        }
      } catch (err) {
        console.error("Failed to load project history", err);
      } finally {
        setLoading("engineer", false);
      }
    }

    loadProjectHistory();
  }, [continueProjectId, continueExecutionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Click outside attach menu to close it
  useEffect(() => {
    function handleClickOutside(e) {
      if (showAttachMenu && !e.target.closest(".ws-attach-menu-container")) {
        setShowAttachMenu(false);
        setHoveredSubmenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAttachMenu]);

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
      const res = await api.post("/projects/verify-token", { token: token.trim() });
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
        setGithubToken(token.trim());
        setVerificationSuccess(`Connected successfully as user: ${res.data.username}`);
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
      setGithubToken("");
    } else if (key === "gmail") {
      localStorage.removeItem("default_recipient_email");
    }
    setVerificationSuccess("");
    setVerificationError("");
  };

  const fetchMcpTools = async () => {
    try {
      setLoadingTools(true);
      const res = await api.get("/mcp/tools");
      setMcpTools(res.data || []);
    } catch (err) {
      console.error("Failed to fetch MCP tools", err);
    } finally {
      setLoadingTools(false);
    }
  };

  const handleOpenDirectory = () => {
    setShowAttachMenu(false);
    setDirectoryModalOpen(true);
  };

  const handleOpenGithubPushModal = (projectResult) => {
    setPushProject(projectResult);
    // Set default repo name based on project plan or ID
    const planName = projectResult?.project_plan?.project_name;
    const cleanRepoName = planName 
      ? planName.toLowerCase().replace(/[^a-z0-9-_]/g, "-")
      : `nexusai-project-${projectResult?.project_id || "app"}`;
    
    setRepoName(cleanRepoName);
    setRepoDesc(projectResult?.project_plan?.description || "Generated by NexusAI AI");
    setPushSuccessUrl("");
    setPushError("");
    
    // Refresh token state from connectors
    try {
      const savedConnectors = localStorage.getItem("workspace_connectors");
      if (savedConnectors) {
        const parsed = JSON.parse(savedConnectors);
        if (parsed?.github?.token) {
          setGithubToken(parsed.github.token);
        }
      }
    } catch (e) {}

    setPushModalOpen(true);
  };

  const handlePushToGithub = async () => {
    if (!repoName.trim()) {
      setPushError("Repository name is required.");
      return;
    }
    
    setPushing(true);
    setPushError("");
    setPushSuccessUrl("");

    try {
      const payload = {
        repo_name: repoName.trim(),
        description: repoDesc.trim(),
        private: isPrivate,
        token: githubToken.trim() || undefined
      };

      const res = await api.post(`/github/${pushProject.project_id}/push-to-github`, payload);
      if (res.data?.status === "success") {
        setPushSuccessUrl(res.data.repo_url);
        // Persist token if provided and successful
        if (githubToken.trim()) {
          localStorage.setItem("github_token", githubToken.trim());
        }
      } else {
        setPushError(res.data?.message || "Failed to push to GitHub.");
      }
    } catch (err) {
      setPushError(err.response?.data?.detail || err.message || "An error occurred during push.");
    } finally {
      setPushing(false);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    const ext = selected.name.split(".").pop().toLowerCase();
    const textExtensions = ["txt", "py", "js", "ts", "jsx", "tsx", "json", "md", "html", "css", "yaml", "yml", "ini", "conf", "csv", "sql", "sh", "bat", "ps1"];
    const isImage = selected.type.startsWith("image/");

    if (!isImage && !textExtensions.includes(ext)) {
      alert(
        "Unsupported file format for direct code attachment. Please upload text/code files (like .txt, .py, .js, .json, .md, etc.) or images.\n\n" +
        "For PDFs, Word documents, or Excel files, please use the Conversational or Research chat tabs to upload them to the RAG knowledge base."
      );
      e.target.value = null;
      return;
    }

    const reader = new FileReader();
    if (isImage) {
      reader.readAsDataURL(selected);
      reader.onload = () => {
        setFile({
          name: selected.name,
          type: selected.type,
          size: (selected.size / 1024).toFixed(1) + " KB",
          data: reader.result,
          isImage: true,
        });
      };
    } else {
      reader.readAsText(selected);
      reader.onload = () => {
        setFile({
          name: selected.name,
          type: selected.type,
          size: (selected.size / 1024).toFixed(1) + " KB",
          data: reader.result,
          isImage: false,
        });
      };
    }
    e.target.value = null;
  };

  async function handleSend(textOverride) {
    const text = (typeof textOverride === "string" ? textOverride : prompt).trim();
    if (!text || loading) return;

    // Attach file/photo context directly inside prompt before API dispatch
    let promptText = text;
    if (file) {
      if (file.isImage) {
        promptText = `${text}\n\n[Attached Image: ${file.data}]`;
      } else {
        promptText = `${text}\n\n[Attached File Context: ${file.name}]\nContent:\n${file.data}`;
      }
    }

    const userMsg = { id: crypto.randomUUID(), role: "user", content: text };
    const loadingMsg = { id: "loading", role: "loading", content: "" };

    setMessages("engineer", [...messages, userMsg, loadingMsg]);
    setLoading("engineer", true);
    setPrompt("");
    setFile(null);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const isContinue = !!continueExecutionId;
      const payload = {
        idea: promptText,
        agent_type: "engineer",
        conversation_id: activeId || undefined,
        connectors,
      };

      if (isContinue) {
        payload.mode = "continue";
        payload.project_id = continueProjectId;
        payload.execution_id = continueExecutionId;
      }

      const res = await api.post("/ai/execute-project", payload);
      const data = res.data;
      const convId = data.conversation_id || activeId;

      if (convId) {
        setActiveId("engineer", convId);
        refreshHistory("engineer");
      }

      // Initialize result state to hold streaming execution details
      const initialStreamResult = {
        execution_id: data.execution_id,
        status: "running",
        execution_steps: []
      };
      setResult("engineer", initialStreamResult);

      // Connect to the SSE stream
      const streamUrl = `${getBaseURL()}/ai/${data.execution_id}/stream`;
      const eventSource = new EventSource(streamUrl);

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          
          if (parsed.type === "step") {
            setResult("engineer", (prev) => {
              const currentSteps = prev?.execution_steps || [];
              const exists = currentSteps.some(
                (s) => s.step === parsed.data.step && s.status === parsed.data.status && s.timestamp === parsed.data.timestamp
              );
              if (exists) return prev;
              return {
                ...prev,
                execution_steps: [...currentSteps, parsed.data]
              };
            });
          } else if (parsed.type === "complete") {
            eventSource.close();
            setResult("engineer", parsed.data);
            setLoading("engineer", false);
            
            const aiMsg = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: formatProjectOutput(parsed.data),
              result: parsed.data,
            };
            setMessages("engineer", (prev) => {
              const cleaned = prev.filter((m) => m.id !== "loading");
              return [...cleaned, aiMsg];
            });
            refreshHistory("engineer");
          } else if (parsed.type === "failed") {
            eventSource.close();
            setLoading("engineer", false);
            const errorMsg = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `❌ Error: ${parsed.error || "Execution failed."}`,
            };
            setMessages("engineer", (prev) => {
              const cleaned = prev.filter((m) => m.id !== "loading");
              return [...cleaned, errorMsg];
            });
          }
        } catch (err) {
          console.error("Error parsing SSE stream message:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE stream error:", err);
        eventSource.close();
        setLoading("engineer", false);
        setMessages("engineer", (prev) => {
          const cleaned = prev.filter((m) => m.id !== "loading");
          return [...cleaned, {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "❌ Connection to execution stream lost."
          }];
        });
      };

    } catch (err) {
      const errMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `❌ Error: ${err.response?.data?.detail || err.message || "Failed to execute project."}`,
      };
      setMessages("engineer", [...messages, userMsg, errMsg]);
      setLoading("engineer", false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput(e) {
    setPrompt(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }

  return (
    <div className="ws-chat">
      {/* Messages */}
      <div className="ws-messages">
        {continueExecutionId && (
          <div className="continue-banner" style={{ margin: "0 0 16px 0", background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.2)", borderRadius: 12, padding: "12px 16px", color: "#93c5fd", display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
            <ArrowRight size={16} />
            <span>Continuing project <strong>{result?.project_plan?.project_name || continueProjectId}</strong>. Describe modifications or updates you want to make in the chat below.</span>
          </div>
        )}

        {messages.length === 0 && !loading && (
          <div className="ws-empty">
            <div className="ws-empty-icon"><Wrench size={24} /></div>
            <h2>Engineer AI</h2>
            <p>Build production-ready software using autonomous AI agents. Describe your idea and NexusAI will plan, code, test and debug it.</p>
            
            <div className="ws-starter-grid">
              {[
                "Build a simple URL shortener backend in Python",
                "Create a responsive landing page layout using React",
                "Design a database schema for an e-commerce order system",
                "Write a script to automate daily database backups"
              ].map((starterText) => (
                <div 
                  key={starterText} 
                  className="ws-starter-card" 
                  onClick={() => handleSend(starterText)}
                >
                  <p>{starterText}</p>
                  <div className="ws-starter-action">Build &rarr;</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.filter((m) => m.role !== "loading").map((msg) => {
          if (msg.role === "user") {
            return (
              <div key={msg.id} className="ws-message user">
                <div className="ws-avatar user-av" style={getAvatarStyle(user?.username)}>{user?.username?.[0]?.toUpperCase() || "U"}</div>
                <div className="ws-msg-body">
                  <div className="ws-user-bubble">{msg.content}</div>
                </div>
              </div>
            );
          }
          if (msg.role === "assistant") {
            console.log("Rendering assistant message with ID:", msg.id, "hasResult:", !!msg.result, "resultData:", msg.result);
            const hasResult = !!msg.result;
            const getExecId = (res) => res?.execution_id || res?._id;
            const isViewingThis = hasResult && result && getExecId(result) === getExecId(msg.result);
            return (
              <div key={msg.id} className="ws-message">
                <div className="ws-avatar ai-av">AI</div>
                <div className="ws-msg-body">
                  <div className="ws-ai-response ws-markdown">
                    <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                  </div>
                  {hasResult && (
                    <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => handleOpenGithubPushModal(msg.result)}
                        style={{
                          padding: "8px 14px",
                          background: "rgba(255, 255, 255, 0.08)",
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          color: "#ffffff",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "600",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          transition: "all 0.2s ease"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                        }}
                      >
                        <span>🐙</span>
                        Push to GitHub
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          }
          return null;
        })}

        {loading && (
          <div className="ws-loading">
            <div className="ws-avatar ai-av thinking">AI</div>
            <div className="ws-loading-dots">
              <span /><span /><span />
              <span className="ws-loading-text">Planner, Coder, Tester collaborating…</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="ws-input-bar">
        {file && (
          <div className="ws-attachment-preview">
            {file.isImage ? (
              <img src={file.data} alt="Upload preview" className="ws-attachment-thumbnail" />
            ) : (
              <div className="ws-attachment-thumbnail" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#212121", color: "#a3a3a3", fontSize: "11px", fontWeight: "700" }}>DOC</div>
            )}
            <div className="ws-attachment-info">
              <span className="ws-attachment-name">{file.name}</span>
              <span className="ws-attachment-size">{file.size}</span>
            </div>
            <button className="ws-attachment-remove" onClick={() => setFile(null)} title="Remove attachment">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="ws-input-inner">
          <div className="ws-attach-menu-container">
            <button
              type="button"
              className="ws-attach-btn"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              title="NexusAI Control Panel"
            >
              <Plus size={18} />
            </button>
            {showAttachMenu && (
              <div className="ws-attach-menu">
                {/* Quick Actions Grid */}
                <div className="ws-menu-header">
                  <span>Quick Actions</span>
                  <span className="ws-menu-header-line"></span>
                </div>
                <div className="ws-menu-action-group">
                  <button
                    type="button"
                    className="ws-menu-quick-action"
                    onClick={() => {
                      setShowAttachMenu(false);
                      fileInputRef.current?.click();
                    }}
                  >
                    <span style={{ fontSize: "16px" }}>📎</span>
                    <span>Upload File</span>
                  </button>
                  <button
                    type="button"
                    className="ws-menu-quick-action"
                    onClick={() => {
                      setShowAttachMenu(false);
                      alert("Screenshot tool coming soon!");
                    }}
                  >
                    <span style={{ fontSize: "16px" }}>📸</span>
                    <span>Screenshot</span>
                  </button>
                </div>

                {/* Abilities/Skills */}
                <div className="ws-menu-header" style={{ marginTop: "6px" }}>
                  <span>Abilities</span>
                  <span className="ws-menu-header-line"></span>
                </div>
                <div 
                  className="ws-attach-submenu-container"
                  onMouseEnter={() => setHoveredSubmenu("skills")}
                  onMouseLeave={() => setHoveredSubmenu(null)}
                >
                  <button type="button" className="ws-menu-item-row">
                    <span>📝 Skills</span>
                    <span style={{ fontSize: "10px", color: "#a78bfa" }}>&gt;</span>
                  </button>
                  {hoveredSubmenu === "skills" && (
                    <div className="ws-attach-submenu">
                      <div className="ws-submenu-toggle-item">
                        <span className="ws-submenu-label">💻 Developer Mode</span>
                        <label className="ws-switch">
                          <input type="checkbox" defaultChecked />
                          <span className="ws-slider"></span>
                        </label>
                      </div>
                      <div className="ws-submenu-toggle-item">
                        <span className="ws-submenu-label">🔍 Code Reviewer</span>
                        <label className="ws-switch">
                          <input type="checkbox" defaultChecked />
                          <span className="ws-slider"></span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Integrations/Connectors */}
                <div className="ws-menu-header">
                  <span>Integrations</span>
                  <span className="ws-menu-header-line"></span>
                </div>
                <div 
                  className="ws-attach-submenu-container"
                  onMouseEnter={() => setHoveredSubmenu("connectors")}
                  onMouseLeave={() => setHoveredSubmenu(null)}
                >
                  <button type="button" className="ws-menu-item-row">
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>🔌 Connectors</span>
                      <span className={`status-indicator-dot ${
                        (connectors.github.enabled || connectors.gmail.enabled || connectors.google_drive.enabled || mcpServers.some(s => s.status === "active")) 
                          ? "active" : "inactive"
                      }`}></span>
                    </span>
                    <span style={{ fontSize: "10px", color: "#a78bfa" }}>&gt;</span>
                  </button>
                  {hoveredSubmenu === "connectors" && (
                    <div className="ws-attach-submenu">
                      {/* Gmail Toggle */}
                      <div className="ws-submenu-toggle-item">
                        <span className="ws-submenu-label" style={{ opacity: connectors.gmail.connected ? 1 : 0.5 }}>
                          📧 Gmail 
                          <span className={`status-indicator-dot ${connectors.gmail.connected ? "active" : "inactive"}`} style={{ width: 4, height: 4 }}></span>
                        </span>
                        <label className="ws-switch">
                          <input 
                            type="checkbox" 
                            checked={connectors.gmail.enabled} 
                            disabled={!connectors.gmail.connected}
                            onChange={() => handleToggleConnector("gmail")}
                          />
                          <span className="ws-slider"></span>
                        </label>
                      </div>
                      {/* GitHub Toggle */}
                      <div className="ws-submenu-toggle-item">
                        <span className="ws-submenu-label" style={{ opacity: connectors.github.connected ? 1 : 0.5 }}>
                          🐙 GitHub
                          <span className={`status-indicator-dot ${connectors.github.connected ? "active" : "inactive"}`} style={{ width: 4, height: 4 }}></span>
                        </span>
                        <label className="ws-switch">
                          <input 
                            type="checkbox" 
                            checked={connectors.github.enabled} 
                            disabled={!connectors.github.connected}
                            onChange={() => handleToggleConnector("github")}
                          />
                          <span className="ws-slider"></span>
                        </label>
                      </div>
                      {/* Google Drive Toggle */}
                      <div className="ws-submenu-toggle-item">
                        <span className="ws-submenu-label" style={{ opacity: connectors.google_drive.connected ? 1 : 0.5 }}>
                          📁 Drive
                          <span className={`status-indicator-dot ${connectors.google_drive.connected ? "active" : "inactive"}`} style={{ width: 4, height: 4 }}></span>
                        </span>
                        <label className="ws-switch">
                          <input 
                            type="checkbox" 
                            checked={connectors.google_drive.enabled} 
                            disabled={!connectors.google_drive.connected}
                            onChange={() => handleToggleConnector("google_drive")}
                          />
                          <span className="ws-slider"></span>
                        </label>
                      </div>

                      {/* MCP Servers Divider */}
                      {mcpServers.length > 0 && (
                        <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", margin: "6px 0" }}></div>
                      )}

                      {/* Dynamic MCP Servers */}
                      {mcpServers.map((server) => (
                        <div key={server._id} className="ws-submenu-toggle-item">
                          <span className="ws-submenu-label" style={{ opacity: server.status === "active" ? 1 : 0.5 }}>
                            🔌 {server.name}
                            <span className={`status-indicator-dot ${server.status === "active" ? "active" : "inactive"}`} style={{ width: 4, height: 4 }}></span>
                          </span>
                          <label className="ws-switch">
                            <input 
                              type="checkbox" 
                              checked={server.status === "active"}
                              onChange={() => handleToggleMcpServer(server)}
                            />
                            <span className="ws-slider"></span>
                          </label>
                        </div>
                      ))}

                      {/* Configure Link */}
                      <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", margin: "6px 0" }}></div>
                      <div 
                        className="ws-submenu-toggle-item" 
                        onClick={() => { setMcpModalOpen(true); setShowAttachMenu(false); }} 
                        style={{ cursor: "pointer", justifyContent: "center", color: "#ffffff", background: "rgba(255,255,255,0.05)", borderRadius: "4px", padding: "6px 0", margin: "4px 0" }}
                      >
                        <span style={{ fontSize: "11px", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
                          ➕ Register Server
                        </span>
                      </div>
                      <div 
                        className="ws-submenu-toggle-item" 
                        onClick={() => navigate("/mcp")} 
                        style={{ cursor: "pointer", justifyContent: "center", color: "#cbd5e1" }}
                      >
                        <span style={{ fontSize: "11px", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                          ⚙️ Configure MCP Registry
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* System Controls */}
                <div className="ws-menu-header">
                  <span>System Controls</span>
                  <span className="ws-menu-header-line"></span>
                </div>
                <button type="button" className="ws-menu-item-row" onClick={handleOpenDirectory}>
                  <span>🧩 Add plugins / Directory</span>
                </button>

                <div className="ws-submenu-toggle-item">
                  <span className="ws-submenu-label">🌐 Web search</span>
                  <label className="ws-switch">
                    <input 
                      type="checkbox" 
                      checked={webSearchEnabled} 
                      onChange={() => setWebSearchEnabled(!webSearchEnabled)}
                    />
                    <span className="ws-slider"></span>
                  </label>
                </div>
              </div>
            )}
          </div>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept="image/*,text/*,application/json,application/pdf"
            onChange={handleFileChange}
          />
          <textarea
            ref={textareaRef}
            rows={1}
            value={prompt}
            onInput={handleInput}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER}
            disabled={loading}
            id="engineer-input"
          />
          <button
            className="ws-send-btn"
            onClick={handleSend}
            disabled={!prompt.trim() || loading}
            id="engineer-send-btn"
            aria-label="Generate project"
          >
            <SendHorizonal size={16} />
          </button>
        </div>
        <div className="ws-input-hint">Press Enter to send · Shift+Enter for new line</div>
      </div>

      {/* GitHub Push Modal */}
      {pushModalOpen && (
        <div className="ws-modal-overlay">
          <div className="ws-modal-content">
            <div className="ws-modal-header">
              <h3>🚀 Push Project to GitHub</h3>
              <button className="ws-modal-close-btn" onClick={() => setPushModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            
            {pushSuccessUrl ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <span style={{ fontSize: "40px" }}>🎉</span>
                <h4 style={{ color: "#34d399", margin: "10px 0" }}>Successfully Pushed!</h4>
                <p style={{ color: "#a3a3a3", fontSize: "13px", marginBottom: "20px" }}>
                  Your repository has been created and files have been pushed.
                </p>
                <a
                  href={pushSuccessUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ws-btn ws-btn-primary"
                  style={{ textDecoration: "none", display: "inline-block" }}
                >
                  View Repo on GitHub ↗
                </a>
              </div>
            ) : (
              <>
                <div className="ws-form-group">
                  <label>Repository Name</label>
                  <input
                    type="text"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    placeholder="e.g. my-awesome-app"
                    disabled={pushing}
                  />
                </div>
                <div className="ws-form-group">
                  <label>Description</label>
                  <textarea
                    value={repoDesc}
                    onChange={(e) => setRepoDesc(e.target.value)}
                    placeholder="Repository description..."
                    rows={2}
                    disabled={pushing}
                  />
                </div>
                <div className="ws-form-group">
                  <label>Privacy Setting</label>
                  <select
                    value={isPrivate ? "private" : "public"}
                    onChange={(e) => setIsPrivate(e.target.value === "private")}
                    disabled={pushing}
                  >
                    <option value="private">Private Repository</option>
                    <option value="public">Public Repository</option>
                  </select>
                </div>
                <div className="ws-form-group">
                  <label>GitHub Personal Access Token (Optional if GITHUB_TOKEN is configured in backend)</label>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxx"
                    disabled={pushing}
                  />
                  <span style={{ fontSize: "11px", color: "#a3a3a3" }}>
                    Your token will be saved locally in your browser for convenience.
                  </span>
                </div>

                {pushError && (
                  <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "10px", background: "rgba(239, 68, 68, 0.1)", padding: "10px", borderRadius: "6px", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                    ❌ {pushError}
                  </div>
                )}

                <div className="ws-modal-actions">
                  <button className="ws-btn ws-btn-secondary" onClick={() => setPushModalOpen(false)} disabled={pushing}>
                    Cancel
                  </button>
                  <button className="ws-btn ws-btn-primary" onClick={handlePushToGithub} disabled={pushing}>
                    {pushing ? "Pushing..." : "Create & Push"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {mcpModalOpen && (
        <div className="mcp-modal-backdrop" style={{ zIndex: 900 }}>
          <div className="mcp-modal" style={{ width: "800px", maxWidth: "95%" }}>
            <div className="mcp-modal-header">
              <h2>MCP Registry & Config</h2>
              <button className="mcp-close-btn" onClick={() => { setMcpModalOpen(false); fetchMcpServers(); }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ maxHeight: "80vh", overflowY: "auto" }}>
              <McpRegistry />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EngineerChat;

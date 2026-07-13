import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { SendHorizonal, Brain, Plus, X, UploadCloud, FileText, Trash2, Loader2 } from "lucide-react";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useAuth } from "../../contexts/AuthContext";
import ResearchPanel from "../research/ResearchPanel";
import api from "../../services/api";
import "../../styles/workspace.css";
import { getAvatarStyle } from "../../utils/avatarHelper";
import MarkdownRenderer from "../education/MarkdownRenderer";
import McpRegistry from "./McpRegistry";

const PLACEHOLDER = "Research AI Coding Agents or competitive analyses...";

function ResearchChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;
  
  const {
    moduleState,
    setMessages,
    setResult,
    setActiveId,
    setLoading,
    refreshHistory,
    setDirectoryModalOpen,
  } = useWorkspace();

  const { messages, result, loading, activeId } = moduleState.research;

  const [prompt, setPrompt] = useState("");
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Control Panel & Connectors state
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [hoveredSubmenu, setHoveredSubmenu] = useState(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);

  // RAG States
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [sessionDocs, setSessionDocs] = useState([]);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [selectedViewDoc, setSelectedViewDoc] = useState(null);

  const handleViewDoc = async (docId) => {
    try {
      const res = await api.get(`/rag/documents/${docId}/content`);
      setSelectedViewDoc(res.data);
    } catch (err) {
      alert("Failed to load document content: " + (err.response?.data?.detail || err.message));
    }
  };
  
  const [sessionId, setSessionId] = useState(() => "session_" + Math.random().toString(36).substring(2, 15));
  const prevActiveIdRef = useRef(activeId);

  useEffect(() => {
    const oldSessionId = sessionId;
    let newSession = "";
    if (!activeId) {
      newSession = "session_" + Math.random().toString(36).substring(2, 15);
    } else {
      newSession = "session_" + activeId;
    }

    if (newSession !== oldSessionId) {
      setSessionId(newSession);
      setPendingAttachments([]);
      
      if (oldSessionId && oldSessionId.startsWith("session_") && oldSessionId.length > 20) {
        api.post(`/rag/sessions/clear?session_id=${oldSessionId}`).catch(() => {});
      }
    }
    prevActiveIdRef.current = activeId;
  }, [activeId]);

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
  const [mcpServers, setMcpServers] = useState([]);
  const [mcpModalOpen, setMcpModalOpen] = useState(false);

  const fetchMcpServers = async () => {
    try {
      const res = await api.get("/mcp/servers");
      setMcpServers(res.data || []);
    } catch (err) {
      console.error("Failed to fetch MCP servers in Research Chat:", err);
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

  useEffect(() => {
    const handleUpdate = () => {
      const saved = localStorage.getItem("workspace_connectors");
      if (saved) setConnectors(JSON.parse(saved));
    };
    window.addEventListener("workspace_connectors_changed", handleUpdate);
    return () => window.removeEventListener("workspace_connectors_changed", handleUpdate);
  }, []);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSessionDocs = async () => {
    try {
      const res = await api.get(`/rag/documents?session_id=${sessionId}`);
      setSessionDocs(res.data || []);
    } catch (err) {
      console.error("Failed to load session docs", err);
    }
  };

  useEffect(() => {
    loadSessionDocs();
  }, [sessionId]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleUploadFiles(files);
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      await handleUploadFiles(files);
    }
    e.target.value = null;
  };

  // Upload and queue background indexing
  const handleUploadFiles = async (filesToUpload) => {
    const newUploads = filesToUpload.map(f => ({
      id: Math.random().toString(),
      name: f.name,
      size: (f.size / (1024 * 1024)).toFixed(2) + " MB",
      progress: 0,
      status: "uploading"
    }));
    
    setUploadingFiles(prev => [...prev, ...newUploads]);
    
    for (let idx = 0; idx < filesToUpload.length; idx++) {
      const fileObj = filesToUpload[idx];
      const uploadId = newUploads[idx].id;
      
      const formData = new FormData();
      formData.append("target_type", "session");
      formData.append("target_id", sessionId);
      formData.append("source_type", "file");
      formData.append("files", fileObj);
      
      try {
        const res = await api.post("/rag/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadingFiles(prev => prev.map(u => u.id === uploadId ? { ...u, progress: Math.min(percentCompleted, 90) } : u));
          }
        });
        
        const jobId = res.data.job_ids[0];
        setUploadingFiles(prev => prev.map(u => u.id === uploadId ? { ...u, job_id: jobId } : u));
        pollJobStatus(jobId, uploadId);
      } catch (err) {
        setUploadingFiles(prev => prev.map(u => u.id === uploadId ? { ...u, status: "failed", error: "Upload failed" } : u));
      }
    }
  };

  const pollJobStatus = (jobId, uploadId) => {
    let elapsed = 0;
    const interval = setInterval(async () => {
      elapsed += 1;
      // Safety timeout: if indexing takes more than 25 seconds, force complete the UI
      if (elapsed > 25) {
        clearInterval(interval);
        setUploadingFiles(prev => prev.filter(u => u.id !== uploadId));
        loadSessionDocs();
        return;
      }

      try {
        const res = await api.get(`/rag/jobs/${jobId}`);
        const job = res.data;
        if (job.status === "completed") {
          clearInterval(interval);
          setUploadingFiles(prev => prev.map(u => u.id === uploadId ? { ...u, progress: 100, status: "completed" } : u));
          setTimeout(() => {
            setUploadingFiles(prev => prev.filter(u => u.id !== uploadId));
          }, 600);
          
          try {
            const resDocs = await api.get(`/rag/documents?session_id=${sessionId}`);
            if (resDocs.data && resDocs.data.length > 0) {
              const newDoc = resDocs.data[0];
              setPendingAttachments(prev => {
                if (prev.some(d => d._id === newDoc._id)) return prev;
                return [...prev, newDoc];
              });
            }
          } catch (docErr) {
            console.error("Failed to load uploaded doc for pending attachments", docErr);
          }
          loadSessionDocs();
        } else if (job.status === "failed") {
          clearInterval(interval);
          setUploadingFiles(prev => prev.map(u => u.id === uploadId ? { ...u, status: "failed", error: job.error_message || "Indexing failed" } : u));
        } else {
          setUploadingFiles(prev => prev.map(u => u.id === uploadId ? { ...u, progress: Math.max(u.progress, job.progress || 90) } : u));
        }
      } catch (err) {
        clearInterval(interval);
        setUploadingFiles(prev => prev.map(u => u.id === uploadId ? { ...u, status: "failed", error: "Job check failed" } : u));
      }
    }, 1000);
  };

  const handleDeleteDoc = async (docId) => {
    try {
      await api.delete(`/rag/documents/${docId}`);
      loadSessionDocs();
    } catch (err) {
      alert("Failed to delete document: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleClearSession = async () => {
    try {
      await api.post(`/rag/sessions/clear?session_id=${sessionId}`);
      setSessionDocs([]);
      setUploadingFiles([]);
    } catch (err) {
      alert("Failed to clear session RAG: " + (err.response?.data?.detail || err.message));
    }
  };

  async function handleSend(textOverride) {
    const text = (typeof textOverride === "string" ? textOverride : prompt).trim();
    if (!text || loading) return;

    // Snapshot of active session docs to attach to this message
    const attachmentsSnapshot = [...pendingAttachments];

    const userMsg = { id: crypto.randomUUID(), role: "user", content: text, attachments: attachmentsSnapshot };
    const loadingMsg = { id: "loading", role: "loading", content: "" };

    setMessages("research", [...messages, userMsg, loadingMsg]);
    setLoading("research", true);
    setPrompt("");
    setPendingAttachments([]); // Clear pending files from input bar after sending
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const activeOrgId = localStorage.getItem("active_org_id") || undefined;
      
      const res = await api.post("/ai/execute-project", {
        idea: text,
        agent_type: "research",
        conversation_id: activeId || undefined,
        connectors,
        session_id: sessionId,
        org_id: activeOrgId,
        project_id: projectId,
        attachments: attachmentsSnapshot
      });

      const data = res.data;
      const convId = data.conversation_id || activeId;

      const aiMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content || data.message || "Research report generated.",
        result: data.result || data || null,
        metadata: data.metadata || null // Store citations if present
      };

      setMessages("research", [...messages, userMsg, aiMsg]);
      if (convId) {
        if (convId !== activeId) {
          await api.post(`/rag/sessions/promote?old_session_id=${sessionId}&new_session_id=session_${convId}`).catch(() => {});
        }
        setActiveId("research", convId);
        refreshHistory("research");
      }
      if (data.result || data) {
        setResult("research", data.result || data);
      }
    } catch (err) {
      const errMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `❌ Error: ${err.response?.data?.detail || err.message || "Failed to get response."}`,
      };
      setMessages("research", [...messages, userMsg, errMsg]);
    } finally {
      setLoading("research", false);
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
    <div 
      className="ws-chat"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: "relative" }}
    >
      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="ws-dropzone-overlay">
          <div className="ws-dropzone-content">
            <UploadCloud size={48} className="spin" style={{ color: "#8b5cf6" }} />
            <h3>Drag & Drop Files Here</h3>
            <p style={{ fontSize: "12px", color: "#a3a3a3" }}>Upload files to ground Research queries in Session RAG</p>
          </div>
        </div>
      )}

      {/* RAG Session Files Header */}
      {sessionDocs.length > 0 && (
        <div className="ws-active-docs-list">
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#8b5cf6", marginRight: "8px", textTransform: "uppercase" }}>Session Docs:</span>
          {sessionDocs.map((doc) => (
            <div key={doc._id} className="ws-active-doc-tag">
              <FileText size={12} />
              <span className="ws-upload-name">{doc.filename}</span>
              <button className="ws-active-doc-remove" onClick={() => handleDeleteDoc(doc._id)} title="Remove file">
                <X size={10} />
              </button>
            </div>
          ))}
          <button 
            className="ws-refresh-btn" 
            onClick={handleClearSession}
            style={{ marginLeft: "auto", fontSize: "11px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", padding: "4px 10px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}
          >
            <Trash2 size={11} />
            Wipe Session RAG
          </button>
        </div>
      )}

      <div className="ws-messages">
        {messages.length === 0 && !loading && (
          <div className="ws-empty">
            <div className="ws-empty-icon"><Brain size={24} /></div>
            <h2>Research AI with RAG Grounding</h2>
            <p>Conduct deep competitive research, coding studies, or market audits, utilizing multi-layer context documents.</p>
            
            <div className="ws-starter-grid">
              {[
                "Analyze top 3 AI coding assistants in 2026",
                "Research best practices for scaling MongoDB databases",
                "Compare Next.js vs Remix for SaaS architecture",
                "Inspect API designs for enterprise grade integrations"
              ].map((starterText) => (
                <div 
                  key={starterText} 
                  className="ws-starter-card" 
                  onClick={() => handleSend(starterText)}
                >
                  <p>{starterText}</p>
                  <div className="ws-starter-action">Research &rarr;</div>
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
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "flex-end", marginBottom: "4px" }}>
                        {msg.attachments.map((att) => (
                          <div 
                            key={att._id || att.id} 
                            className="ws-active-doc-tag" 
                            onClick={() => handleViewDoc(att._id || att.id)}
                            style={{
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              background: "rgba(139, 92, 246, 0.2)",
                              border: "1px solid rgba(139, 92, 246, 0.4)",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              color: "#c084fc",
                              fontSize: "11px",
                              maxWidth: "200px"
                            }}
                          >
                            <FileText size={11} style={{ flexShrink: 0 }} />
                            <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{att.filename}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="ws-user-bubble">{msg.content}</div>
                  </div>
                </div>
              </div>
            );
          }
          if (msg.role === "assistant") {
            return (
              <div key={msg.id} className="ws-message">
                <div className="ws-avatar ai-av">AI</div>
                <div className="ws-msg-body ws-result-panel">
                  {msg.result ? (
                    <ResearchPanel result={msg.result} />
                  ) : (
                    <div className="ws-ai-response ws-markdown">
                      <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                      
                      {/* Styled Inline Sources Option */}
                      {msg.metadata && msg.metadata.chunks && msg.metadata.chunks.length > 0 && 
                       !msg.content.includes("I couldn't find") && 
                       !msg.content.includes("Provided context") && (() => {
                        const uniqueSources = [];
                        const seen = new Set();
                        msg.metadata.chunks.forEach(c => {
                          if (!seen.has(c.filename)) {
                            seen.add(c.filename);
                            const matched = sessionDocs.find(d => d.filename.toLowerCase() === c.filename.toLowerCase());
                            uniqueSources.push({
                              filename: c.filename,
                              id: matched?._id || null
                            });
                          }
                        });

                        return (
                          <div 
                            className="ws-citations-inline" 
                            style={{ 
                              display: "flex", 
                              alignItems: "center", 
                              gap: "6px", 
                              marginTop: "8px", 
                              paddingTop: "8px", 
                              borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                              fontSize: "11px",
                              color: "rgba(255, 255, 255, 0.4)"
                            }}
                          >
                            <span>📖 Answer based on:</span>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              {uniqueSources.map((src, sIdx) => {
                                if (src.id) {
                                  return (
                                    <button
                                      key={sIdx}
                                      onClick={() => handleViewDoc(src.id)}
                                      style={{
                                        background: "none",
                                        border: "none",
                                        padding: 0,
                                        color: "#a78bfa",
                                        cursor: "pointer",
                                        fontWeight: "600",
                                        textDecoration: "underline",
                                        fontSize: "11px"
                                      }}
                                      title="Click to view document content"
                                    >
                                      {src.filename}
                                    </button>
                                  );
                                }
                                return (
                                  <span key={sIdx} style={{ fontWeight: "600", color: "rgba(255, 255, 255, 0.6)" }}>
                                    {src.filename}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
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
              <span className="ws-loading-text">Research agents scanning context, drafting report...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Uploading progress panel */}
      {uploadingFiles.length > 0 && (
        <div className="ws-uploads-panel">
          {uploadingFiles.map(up => (
            <div key={up.id} className="ws-upload-item">
              <FileText size={14} style={{ color: "#a3a3a3" }} />
              <span className="ws-upload-name">{up.name}</span>
              <div className="ws-upload-progress-bar">
                <div className="ws-upload-progress-fill" style={{ width: `${up.progress}%` }}></div>
              </div>
              <span className="ws-upload-status" style={{ color: "#a3a3a3", display: "flex", alignItems: "center", gap: "4px" }}>
                <Loader2 size={11} className="spin" />
                Indexing {up.progress}%
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="ws-input-bar" style={{ display: "flex", flexDirection: "column" }}>
        {pendingAttachments.length > 0 && (
          <div className="ws-input-attached-files" style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "8px 12px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", background: "rgba(0,0,0,0.15)" }}>
            {pendingAttachments.map((doc) => (
              <div 
                key={doc._id} 
                className="ws-active-doc-tag"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "rgba(139, 92, 246, 0.15)",
                  border: "1px solid rgba(139, 92, 246, 0.3)",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  color: "#c084fc",
                  fontSize: "12px",
                  maxWidth: "200px"
                }}
              >
                <FileText size={12} style={{ flexShrink: 0 }} />
                <span className="ws-upload-name" style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{doc.filename}</span>
                <button 
                  onClick={() => {
                    handleDeleteDoc(doc._id);
                    setPendingAttachments(prev => prev.filter(d => d._id !== doc._id));
                  }} 
                  title="Remove file"
                  style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center", padding: "0 2px", flexShrink: 0 }}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            <button 
              className="ws-refresh-btn" 
              onClick={() => {
                handleClearSession();
                setPendingAttachments([]);
              }}
              style={{ marginLeft: "auto", fontSize: "11px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", padding: "4px 10px", borderRadius: "6px", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", height: "fit-content" }}
            >
              <Trash2 size={11} />
              Clear
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
                    <span style={{ fontSize: "10px", color: "#a3a3a3" }}>&gt;</span>
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
                    <span style={{ fontSize: "10px", color: "#a3a3a3" }}>&gt;</span>
                  </button>
                  {hoveredSubmenu === "connectors" && (
                    <div className="ws-attach-submenu">
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

                <div className="ws-menu-header">
                  <span>System Controls</span>
                  <span className="ws-menu-header-line"></span>
                </div>
                <button type="button" className="ws-menu-item-row" onClick={() => { setShowAttachMenu(false); setDirectoryModalOpen(true); }}>
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
            multiple
            accept=".pdf,.docx,.zip,.pptx,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.txt,.csv,.md"
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
          />
          <button
            className="ws-send-btn"
            onClick={handleSend}
            disabled={!prompt.trim() || loading}
          >
            <SendHorizonal size={16} />
          </button>
        </div>
        <div className="ws-input-hint">Drag & drop files to upload · Press Enter to query</div>
      </div>

      {selectedViewDoc && (
        <div className="ws-file-viewer-modal-overlay" onClick={() => setSelectedViewDoc(null)}>
          <div className="ws-file-viewer-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ws-file-viewer-modal-header">
              <h3>📄 {selectedViewDoc.filename}</h3>
              <button onClick={() => setSelectedViewDoc(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="ws-file-viewer-modal-body">
              <pre>{selectedViewDoc.content}</pre>
            </div>
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

export default ResearchChat;

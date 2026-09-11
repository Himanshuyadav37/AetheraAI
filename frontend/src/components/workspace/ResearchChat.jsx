import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { SendHorizonal, Brain, Plus, X, UploadCloud, FileText, Trash2, Loader2, FileUp, Camera, Globe, Layers, FolderGit2, ChevronRight } from "lucide-react";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useAuth } from "../../contexts/AuthContext";
import ResearchPanel from "../research/ResearchPanel";
import api, { getBaseURL } from "../../services/api";
import "../../styles/workspace.css";
import { getAvatarStyle } from "../../utils/avatarHelper";
import MarkdownRenderer from "../education/MarkdownRenderer";
import McpRegistry from "./McpRegistry";
import AgentLiveTimeline from "./AgentLiveTimeline";

const PLACEHOLDER = "Research AI Coding Agents or competitive analyses...";

function ResearchChat() {
  const { user, requireAuth } = useAuth();
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

  const isUploading = uploadingFiles.some(f => f.status === "uploading" || (f.progress !== undefined && f.progress < 100));

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
      requireAuth(async () => {
        await handleUploadFiles(files);
      }, "Authentication Required", "Sign in to upload research documents.");
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      requireAuth(async () => {
        await handleUploadFiles(files);
      }, "Authentication Required", "Sign in to upload research documents.");
    }
    e.target.value = null;
  };

  // Upload and queue background indexing
  const handleUploadFiles = async (filesToUpload) => {
    const newUploads = filesToUpload.map(f => ({
      id: "up_" + Math.random().toString(36).substring(2, 9),
      name: f.name,
      filename: f.name,
      size: (f.size / (1024 * 1024)).toFixed(2) + " MB",
      progress: 0,
      status: "uploading"
    }));
    
    setUploadingFiles(prev => [...prev, ...newUploads]);

    setPendingAttachments(prev => {
      const existing = new Set(prev.map(p => p.filename || p.name));
      const filtered = newUploads.filter(u => !existing.has(u.name));
      return [...prev, ...filtered];
    });
    
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
    if (!text || loading || isUploading) return;

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

      if (convId) {
        if (convId !== activeId) {
          await api.post(`/rag/sessions/promote?old_session_id=${sessionId}&new_session_id=session_${convId}`).catch(() => {});
        }
        setActiveId("research", convId);
        refreshHistory("research");
      }

      // Initialize result state to hold streaming research details
      const initialStreamResult = {
        execution_id: data.execution_id,
        status: "running",
        execution_steps: []
      };
      setResult("research", initialStreamResult);

      // Connect to the SSE stream
      const streamUrl = `${getBaseURL()}/ai/${data.execution_id}/stream`;
      const eventSource = new EventSource(streamUrl);

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          
          if (parsed.type === "step") {
            setResult("research", (prev) => {
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
            setResult("research", parsed.data);
            setLoading("research", false);
            
            const aiMsg = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: parsed.data.message || parsed.data.report || "Research report generated.",
              result: parsed.data,
            };
            setMessages("research", (prev) => {
              const cleaned = prev.filter((m) => m.id !== "loading");
              return [...cleaned, aiMsg];
            });
            refreshHistory("research");
          } else if (parsed.type === "failed") {
            eventSource.close();
            setLoading("research", false);
            const errorMsg = {
              id: crypto.randomUUID(),
              role: "assistant",
              content: `❌ Error: ${parsed.error || "Research execution failed."}`,
            };
            setMessages("research", (prev) => {
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
        setLoading("research", false);
        setMessages("research", (prev) => {
          const cleaned = prev.filter((m) => m.id !== "loading");
          return [...cleaned, {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "❌ Connection to research stream lost."
          }];
        });
      };

    } catch (err) {
      const errMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `❌ Error: ${err.response?.data?.detail || err.message || "Failed to get response."}`,
      };
      setMessages("research", (prev) => {
        const cleaned = prev.filter((m) => m.id !== "loading");
        return [...cleaned, errMsg];
      });
      setLoading("research", false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isUploading) return;
      if (prompt.trim() && !loading) {
        requireAuth(() => handleSend(), "Authentication Required", "Sign in to run Research AI analysis.");
      }
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
            <div className="ws-empty-hero clean-minimal">
              <h1 className="hero-gradient-title">Research Intelligence Engine</h1>
              <p className="hero-subtitle">
                Conduct autonomous research, technical benchmarking, and deep web synthesis.
              </p>
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
                      <div className="ws-user-attachments-grid">
                        {msg.attachments.map((att) => (
                          <div 
                            key={att._id || att.id} 
                            className="ws-attached-file-chip" 
                            onClick={() => handleViewDoc(att._id || att.id)}
                            title="Click to view file content"
                          >
                            <div className="ws-chip-icon">
                              <FileText size={13} />
                            </div>
                            <span className="ws-chip-name">{att.filename}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="ws-user-bubble ws-markdown">
                      <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                    </div>
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
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", maxWidth: "680px" }}>
                      {(msg.result.execution_steps || msg.result.timeline) && (
                        <div className="ws-timeline-wrapper">
                          <AgentLiveTimeline steps={msg.result.execution_steps || msg.result.timeline} loading={false} />
                        </div>
                      )}
                      <ResearchPanel result={msg.result} />
                    </div>
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
                          <div className="ws-citations-inline">
                            <span className="ws-citations-label">📖 Answer based on:</span>
                            <div className="ws-citations-list-wrap">
                              {uniqueSources.map((src, sIdx) => {
                                if (src.id) {
                                  return (
                                    <button
                                      key={sIdx}
                                      onClick={() => handleViewDoc(src.id)}
                                      className="ws-citation-link"
                                      title="Click to view document content"
                                    >
                                      {src.filename}
                                    </button>
                                  );
                                }
                                return (
                                  <span key={sIdx} className="ws-citation-source-text">
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
          <div className="ws-message">
            <div className="ws-avatar ai-av thinking">AI</div>
            <div className="ws-msg-body">
              <div className="ws-timeline-wrapper">
                <AgentLiveTimeline steps={result?.execution_steps || []} loading={true} />
              </div>
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
        {/* Floating Pending Attachments Shelf (Above input box) */}
        {pendingAttachments.length > 0 && (
          <div className="ws-pending-shelf">
            <div className="ws-pending-shelf-inner">
              <span className="ws-pending-shelf-label">📎 Attached to message:</span>
              {pendingAttachments.map((doc, dIdx) => {
                const displayName = doc.filename || doc.name || "Document";
                const isDocUploading = doc.status === "uploading" || (doc.progress !== undefined && doc.progress < 100);
                return (
                  <div 
                    key={doc._id || doc.id || dIdx} 
                    className="ws-pending-doc-tag"
                    onClick={() => (doc._id || doc.id) && handleViewDoc(doc._id || doc.id)}
                    title={doc._id ? "Click to view file content" : displayName}
                  >
                    {isDocUploading ? (
                      <Loader2 size={12} className="spin" style={{ color: "#a5b4fc", flexShrink: 0 }} />
                    ) : (
                      <FileText size={12} style={{ color: "#a5b4fc", flexShrink: 0 }} />
                    )}
                    <span className="ws-upload-name">{displayName}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDoc(doc._id || doc.id);
                        setPendingAttachments(prev => prev.filter(d => (d._id || d.id) !== (doc._id || doc.id)));
                      }}
                      className="ws-pending-remove-btn"
                      title="Remove from message"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
              <button 
                type="button"
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
          </div>
        )}

        <div className="ws-input-inner">
          <div className="ws-attach-menu-container">
            <button
              type="button"
              className={`ws-attach-btn ${showAttachMenu ? "open" : ""}`}
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              title="Add attachment or tools"
            >
              <Plus size={18} />
            </button>
            {showAttachMenu && (
              <div className="ws-attach-menu">
                <div className="ws-menu-section-title">Upload & Media</div>
                <div className="ws-menu-grid">
                  <button
                    type="button"
                    className="ws-menu-tile-btn"
                    onClick={() => {
                      setShowAttachMenu(false);
                      requireAuth(() => fileInputRef.current?.click(), "Authentication Required", "Sign in to upload documents.");
                    }}
                  >
                    <div className="ws-menu-tile-icon">
                      <FileUp size={16} />
                    </div>
                    <div className="ws-menu-tile-text">
                      <strong>Upload File</strong>
                      <span>PDF, DOCX, CSV</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="ws-menu-tile-btn"
                    onClick={() => {
                      setShowAttachMenu(false);
                      requireAuth(() => fileInputRef.current?.click(), "Authentication Required", "Sign in to upload screenshots.");
                    }}
                  >
                    <div className="ws-menu-tile-icon">
                      <Camera size={16} />
                    </div>
                    <div className="ws-menu-tile-text">
                      <strong>Screenshot</strong>
                      <span>Visual diagram or UI</span>
                    </div>
                  </button>
                </div>

                <div className="ws-menu-divider-clean" />
                <div className="ws-menu-section-title">Context & Intelligence</div>

                <div 
                  className="ws-menu-toggle-row"
                  onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                >
                  <div className="ws-menu-toggle-left">
                    <div className="ws-menu-row-icon">
                      <Globe size={15} />
                    </div>
                    <div className="ws-menu-row-text">
                      <strong>Web Search</strong>
                      <span>Realtime internet synthesis</span>
                    </div>
                  </div>
                  <label className="ws-clean-switch" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      checked={webSearchEnabled} 
                      onChange={() => setWebSearchEnabled(!webSearchEnabled)}
                    />
                    <span className="ws-clean-slider" />
                  </label>
                </div>

                <button
                  type="button"
                  className="ws-menu-row-btn"
                  onClick={() => {
                    setShowAttachMenu(false);
                    requireAuth(() => navigate("/integrations"), "Authentication Required", "Sign in to access connectors and integrations.");
                  }}
                >
                  <div className="ws-menu-row-icon">
                    <Layers size={15} />
                  </div>
                  <div className="ws-menu-row-text">
                    <strong>Connectors & MCP</strong>
                    <span>GitHub, Database, Tools</span>
                  </div>
                  <ChevronRight size={13} className="ws-menu-chevron" />
                </button>

                <button
                  type="button"
                  className="ws-menu-row-btn"
                  onClick={() => {
                    setShowAttachMenu(false);
                    requireAuth(() => setDirectoryModalOpen(true), "Authentication Required", "Sign in to browse the plugin directory.");
                  }}
                >
                  <div className="ws-menu-row-icon">
                    <FolderGit2 size={15} />
                  </div>
                  <div className="ws-menu-row-text">
                    <strong>Plugin Directory</strong>
                    <span>Browse extension toolkits</span>
                  </div>
                  <ChevronRight size={13} className="ws-menu-chevron" />
                </button>
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
            onClick={() => requireAuth(() => handleSend(), "Authentication Required", "Sign in to run Research AI analysis.")}
            disabled={!prompt.trim() || loading || isUploading}
            title={isUploading ? "Uploading files, please wait..." : "Send query"}
          >
            {isUploading ? <Loader2 size={16} className="spin" /> : <SendHorizonal size={16} />}
          </button>
        </div>
        <div className="ws-input-hint">
          {isUploading ? (
            <span style={{ color: "#a1a1aa", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Loader2 size={11} className="spin" /> Uploading & indexing files... please wait
            </span>
          ) : (
            "Drag & drop files to upload · Enter to send · Shift+Enter for new line"
          )}
        </div>
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

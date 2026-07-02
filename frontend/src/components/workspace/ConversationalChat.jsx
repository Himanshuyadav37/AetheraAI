import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SendHorizonal, Bot, Plus, X, UploadCloud, FileText, Trash2, Loader2 } from "lucide-react";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useAuth } from "../../contexts/AuthContext";
import api, { getBaseURL } from "../../services/api";
import "../../styles/workspace.css";
import { getAvatarStyle } from "../../utils/avatarHelper";
import MarkdownRenderer from "../education/MarkdownRenderer";

const PLACEHOLDER = "Ask NeuroForge anything...";

function ConversationalChat() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId") || undefined;
  
  const {
    moduleState,
    setMessages,
    setActiveId,
    setLoading,
    refreshHistory,
    setDirectoryModalOpen,
  } = useWorkspace();

  const { messages, loading, activeId } = moduleState.conversational;

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
  
  // Temporary RAG Session ID
  const [sessionId, setSessionId] = useState(() => "session_" + Math.random().toString(36).substring(2, 15));
  const prevActiveIdRef = useRef(activeId);

  useEffect(() => {
    const oldSessionId = sessionId;
    if (!activeId) {
      // Transition to a new chat: clean slate!
      const newSession = "session_" + Math.random().toString(36).substring(2, 15);
      setSessionId(newSession);
      setPendingAttachments([]);
      
      // Clean up previous temporary session files from backend
      if (oldSessionId && oldSessionId !== newSession) {
        api.post(`/rag/sessions/clear?session_id=${oldSessionId}`).catch(() => {});
      }
    } else {
      // Transition to an existing conversation:
      // Only set it if we transitioned from ANOTHER valid conversation (not from null!)
      if (prevActiveIdRef.current && prevActiveIdRef.current !== activeId) {
        const newSession = "session_" + activeId;
        setSessionId(newSession);
        
        // Clean up previous temporary session files from backend
        if (oldSessionId && oldSessionId !== newSession) {
          api.post(`/rag/sessions/clear?session_id=${oldSessionId}`).catch(() => {});
        }
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

  // Load documents in the active temporary session
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

  // Handle Drag & Drop Upload
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
    e.target.value = null; // Reset file input
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
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/rag/jobs/${jobId}`);
        const job = res.data;
        if (job.status === "completed") {
          clearInterval(interval);
          setUploadingFiles(prev => prev.filter(u => u.id !== uploadId));
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
          setUploadingFiles(prev => prev.map(u => u.id === uploadId ? { ...u, status: "failed", error: job.error_message } : u));
        } else {
          setUploadingFiles(prev => prev.map(u => u.id === uploadId ? { ...u, progress: Math.max(u.progress, job.progress) } : u));
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

  // SSE Streaming RAG Chat Action
  async function handleSend(textOverride) {
    const text = (typeof textOverride === "string" ? textOverride : prompt).trim();
    if (!text || loading) return;

    // Snapshot of active session docs to attach to this message
    const attachmentsSnapshot = [...pendingAttachments];

    const userMsg = { id: crypto.randomUUID(), role: "user", content: text, attachments: attachmentsSnapshot };
    const loadingMsg = { id: "loading", role: "loading", content: "" };

    setMessages("conversational", [...messages, userMsg, loadingMsg]);
    setLoading("conversational", true);
    setPrompt("");
    setPendingAttachments([]); // Clear pending files from input bar after sending
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Set up assistant streaming message placeholder
    const aiMessageId = crypto.randomUUID();
    let accumulatedText = "";
    let metadataPacket = null;

    try {
      const token = localStorage.getItem("token");
      const activeOrgId = localStorage.getItem("active_org_id") || undefined;
      
      const response = await fetch(`${getBaseURL()}/rag/chat-stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: text,
          conversation_id: activeId || undefined,
          project_id: projectId,
          org_id: activeOrgId,
          session_id: sessionId,
          connectors
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize stream: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      // Replace loading message with streaming message
      setMessages("conversational", [...messages, userMsg, { id: aiMessageId, role: "assistant", content: "", metadata: null }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.substring(6));
              if (data.type === "metadata") {
                metadataPacket = data;
                if (data.session_cleared) {
                  setSessionDocs([]);
                  setPendingAttachments([]);
                }
                setMessages("conversational", (prev) =>
                  prev.map(m => m.id === aiMessageId ? { ...m, metadata: metadataPacket } : m)
                );
              } else if (data.type === "content") {
                accumulatedText += data.delta;
                setMessages("conversational", (prev) =>
                  prev.map(m => m.id === aiMessageId ? { ...m, content: accumulatedText } : m)
                );
              }
            } catch (e) {
              // Ignore partial JSON parsing errors
            }
          }
        }
      }

      // Save complete conversation to history in Mongo (non-blocking log update)
      try {
        const convId = activeId || await api.post("/conversations", {
          user_id: user?.id || "system",
          agent_type: "conversational",
          title: text.substring(0, 60)
        }).then(r => r.data._id);
        
        await api.post(`/conversations/${convId}/messages`, { role: "user", content: text, attachments: attachmentsSnapshot });
        await api.post(`/conversations/${convId}/messages`, { role: "assistant", content: accumulatedText, metadata: metadataPacket });
        
        if (convId && convId !== activeId) {
          setActiveId("conversational", convId);
          refreshHistory("conversational");
        }
      } catch (convErr) {
        console.error("Failed to log conversation to history", convErr);
      }

    } catch (err) {
      const errorContent = `❌ Error: ${err.message || "Failed to parse streaming response."}`;
      setMessages("conversational", (prev) =>
        prev.map(m => m.id === aiMessageId ? { ...m, content: errorContent } : m)
      );
    } finally {
      setLoading("conversational", false);
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
            <p style={{ fontSize: "12px", color: "#a3a3a3" }}>Upload PDF, DOCX, PPTX, XLSX, TXT, CSV or Image files to Session RAG</p>
          </div>
        </div>
      )}

      {/* Active Session Docs moved inside input bar */}

      <div className="ws-messages">
        {messages.length === 0 && !loading && (
          <div className="ws-empty">
            <div className="ws-empty-icon"><Bot size={24} /></div>
            <div style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.4)", textTransform: "uppercase", letterSpacing: "1.5px", fontWeight: "700", marginBottom: "4px" }}>
              Welcome back, {user?.username || "Developer"}
            </div>
            <h2>Conversational AI with Multi-Layer RAG</h2>
            <p>Ground answers on Projects, Organizations, or temporary Session documents simply by dragging and dropping them here.</p>
            
            <div className="ws-starter-grid">
              {[
                "Ground answers from my active Project files",
                "Query the Organization Knowledge Base docs",
                "Explain the data inside my temporary CSV files",
                "Review the system code layout for optimization options"
              ].map((starterText) => (
                <div 
                  key={starterText} 
                  className="ws-starter-card" 
                  onClick={() => handleSend(starterText)}
                >
                  <p>{starterText}</p>
                  <div className="ws-starter-action">Ask assistant &rarr;</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.filter((m) => m.role !== "loading").map((msg) => (
          <div key={msg.id} className={`ws-message ${msg.role === "user" ? "user" : ""}`}>
            <div 
              className={`ws-avatar ${msg.role === "user" ? "user-av" : "ai-av"}`}
              style={msg.role === "user" ? getAvatarStyle(user?.username) : {}}
            >
              {msg.role === "user" ? (user?.username?.[0]?.toUpperCase() || "U") : "AI"}
            </div>
            <div className="ws-msg-body">
              {msg.role === "user" ? (
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
        ))}

        {loading && (
          <div className="ws-loading">
            <div className="ws-avatar ai-av thinking">AI</div>
            <div className="ws-loading-dots">
              <span /><span /><span />
              <span className="ws-loading-text">Generating Response…</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* In-progress uploads progress panel */}
      {uploadingFiles.length > 0 && (
        <div className="ws-uploads-panel">
          {uploadingFiles.map(up => (
            <div key={up.id} className="ws-upload-item">
              <FileText size={14} style={{ color: "#a3a3a3" }} />
              <span className="ws-upload-name">{up.name}</span>
              <div className="ws-upload-progress-bar">
                <div className="ws-upload-progress-fill" style={{ width: `${up.progress}%` }}></div>
              </div>
              {up.status === "uploading" ? (
                <span className="ws-upload-status" style={{ color: "#a3a3a3", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Loader2 size={11} className="spin" />
                  Indexing {up.progress}%
                </span>
              ) : (
                <span className={`ws-upload-status ${up.status}`}>{up.status}</span>
              )}
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
              title="NeuroForge Control Panel"
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
                        (connectors.github.enabled || connectors.gmail.enabled || connectors.google_drive.enabled) 
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
            accept=".pdf,.docx,.pptx,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.txt,.csv,.md"
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
            id="conversational-input"
          />
          <button
            className="ws-send-btn"
            onClick={handleSend}
            disabled={!prompt.trim() || loading}
            id="conversational-send-btn"
            aria-label="Send message"
          >
            <SendHorizonal size={16} />
          </button>
        </div>
        <div className="ws-input-hint">Drag & drop files to upload · Press Enter to send · Shift+Enter for new line</div>
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
    </div>
  );
}

export default ConversationalChat;

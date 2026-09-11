import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { SendHorizonal, GraduationCap, Plus, X, UploadCloud, FileText, Trash2, Loader2, FileUp, Camera, Globe, Layers, FolderGit2, ChevronRight } from "lucide-react";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useAuth } from "../../contexts/AuthContext";
import { getAvatarStyle } from "../../utils/avatarHelper";
import MarkdownRenderer from "../education/MarkdownRenderer";
import AgentLiveTimeline from "./AgentLiveTimeline";
import ResponseToolbar from "../education/ResponseToolbar";
import { streamEducationAI } from "../../services/EducationApi";
import api, { getBaseURL } from "../../services/api";
import "../../styles/workspace.css";

const PLACEHOLDER = "Teach me DBMS Normalization or write a Python explanation...";

function EducationChat() {
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

  const { messages, loading, activeId } = moduleState.education;

  const [prompt, setPrompt] = useState("");
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const liveMessages = useRef([]);

  // Control Panel & Connectors state
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [hoveredSubmenu, setHoveredSubmenu] = useState(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [collapsedMsgIds, setCollapsedMsgIds] = useState({});

  const toggleMsgCollapse = (msgId) => {
    setCollapsedMsgIds((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

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

  async function handleSend(customText) {
    const text = (typeof customText === "string" ? customText : prompt).trim();
    if (!text || loading || isUploading) return;

    // Snapshot of active session docs to attach to this message
    const attachmentsSnapshot = [...pendingAttachments];

    const userMsg = { id: crypto.randomUUID(), role: "user", content: text, attachments: attachmentsSnapshot };
    const loadingMsg = { id: "loading", role: "loading", content: "" };

    setMessages("education", (prev) => [...prev.filter((m) => m.id !== "loading"), userMsg, loadingMsg]);
    setPrompt("");
    setPendingAttachments([]); // Clear pending files from input bar after sending
    setLoading("education", true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const activeOrgId = localStorage.getItem("active_org_id") || undefined;
      
      const res = await api.post("/ai/execute-project", {
        idea: text,
        agent_type: "education",
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
        setActiveId("education", convId);
        refreshHistory("education");
      }

      // Initialize result state for streaming steps
      const initialStreamResult = {
        execution_id: data.execution_id,
        status: "running",
        execution_steps: []
      };
      setResult("education", initialStreamResult);

      // Connect to the SSE stream
      const streamUrl = `${getBaseURL()}/ai/${data.execution_id}/stream`;
      const eventSource = new EventSource(streamUrl);

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          
          if (parsed.type === "step") {
            setResult("education", (prev) => {
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
            setResult("education", parsed.data);
            setLoading("education", false);
            
            const aiMsg = {
              id: crypto.randomUUID(),
              role: "assistant",
              title: parsed.data.title || "NexusAI Education AI",
              mode: parsed.data.mode || "learn",
              content: parsed.data.response || parsed.data.content || "Educational response generated.",
              result: parsed.data,
            };
            setMessages("education", (prev) => {
              const cleaned = prev.filter((m) => m.id !== "loading");
              const hasUser = cleaned.some((m) => m.id === userMsg.id || (m.role === "user" && m.content === userMsg.content));
              if (!hasUser) {
                return [...cleaned, userMsg, aiMsg];
              }
              return [...cleaned, aiMsg];
            });
            refreshHistory("education");
          } else if (parsed.type === "failed") {
            eventSource.close();
            setLoading("education", false);
            const errorMsg = {
              id: crypto.randomUUID(),
              role: "assistant",
              title: "Error",
              mode: "error",
              content: `❌ Error: ${parsed.error || "Education session failed."}`,
            };
            setMessages("education", (prev) => {
              const cleaned = prev.filter((m) => m.id !== "loading");
              const hasUser = cleaned.some((m) => m.id === userMsg.id || (m.role === "user" && m.content === userMsg.content));
              if (!hasUser) {
                return [...cleaned, userMsg, errorMsg];
              }
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
        setLoading("education", false);
        setMessages("education", (prev) => {
          const cleaned = prev.filter((m) => m.id !== "loading");
          const hasUser = cleaned.some((m) => m.id === userMsg.id || (m.role === "user" && m.content === userMsg.content));
          const errObj = {
            id: crypto.randomUUID(),
            role: "assistant",
            title: "Error",
            mode: "error",
            content: "❌ Connection to tutoring stream lost."
          };
          if (!hasUser) {
            return [...cleaned, userMsg, errObj];
          }
          return [...cleaned, errObj];
        });
      };

    } catch (err) {
      const errMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        title: "Error",
        mode: "error",
        content: `❌ Error: ${err.response?.data?.detail || err.message || "Failed to get response."}`,
      };
      setMessages("education", (prev) => {
        const cleaned = prev.filter((m) => m.id !== "loading");
        const hasUser = cleaned.some((m) => m.id === userMsg.id || (m.role === "user" && m.content === userMsg.content));
        if (!hasUser) {
          return [...cleaned, userMsg, errMsg];
        }
        return [...cleaned, errMsg];
      });
      setLoading("education", false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isUploading) return;
      handleSend();
    }
  }

  function handleInput(e) {
    setPrompt(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
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
            <p style={{ fontSize: "12px", color: "#a3a3a3" }}>Upload reference study files to Session RAG</p>
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
              <h1 className="hero-gradient-title">Education AI Masterclass</h1>
              <p className="hero-subtitle">
                Master complex engineering principles, distributed systems, algorithmic design, and system architecture.
              </p>
            </div>
          </div>
        )}

        {messages.filter((m) => m.role !== "loading").map((msg, index) => {
          const isGenerating = loading && index === messages.length - 1;
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
            const eduTitle = msg.title || msg.result?.title || "Education Masterclass";
            const mode = (msg.mode || msg.result?.mode || "learn").toLowerCase();
            const steps = msg.result?.execution_steps || msg.result?.steps || msg.execution_steps;

            return (
              <div key={msg.id} className="ws-message">
                <div className="ws-avatar ai-av">AI</div>
                <div className="ws-msg-body">
                  {/* Execution Timeline Trace at top-left of response */}
                  {steps && steps.length > 0 && (
                    <div className="ws-timeline-wrapper">
                      <AgentLiveTimeline steps={steps} loading={false} />
                    </div>
                  )}

                  {/* Clean Topic Badge Header */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <span className="ws-blueprint-icon" style={{ fontSize: "14px" }}>🎓</span>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {eduTitle}
                    </span>
                    <span className="ws-blueprint-badge" style={{ textTransform: "uppercase", fontSize: "9.5px" }}>
                      {mode}
                    </span>
                  </div>

                  {/* Boxed Output Container with Smart Collapsible Sections inside */}
                  {msg.content && (
                    <div className="ws-project-blueprint-box ws-markdown">
                      <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                      
                      {/* RAG Citations Panel */}
                      {msg.metadata && msg.metadata.chunks && msg.metadata.chunks.length > 0 && (
                        <div className="ws-citations-list">
                          <div className="ws-citations-header">
                            Sources ({msg.metadata.layer.toUpperCase()} RAG)
                          </div>
                          <div className="ws-citations-grid">
                            {msg.metadata.chunks.map((cit, cIdx) => (
                              <div key={cIdx} className="ws-citation-card" title={cit.text_preview}>
                                <div className="ws-citation-filename">{cit.filename}</div>
                                <div className="ws-citation-page">Page {cit.page_num}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sleek Modern Micro Toolbar */}
                  {!isGenerating && msg.content && (
                    <div style={{ marginTop: "2px", maxWidth: "680px" }}>
                      <ResponseToolbar 
                        content={msg.content} 
                        onRegenerate={() => handleSend(msg.content)} 
                      />
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
                <AgentLiveTimeline 
                  steps={moduleState.education.result?.execution_steps || []} 
                  loading={true} 
                />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Upload progress list */}
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

      {/* Floating Pending Attachments Shelf (Above input box) */}
      {pendingAttachments.length > 0 && (
        <div className="ws-pending-shelf">
          <div className="ws-pending-shelf-inner">
            <span className="ws-pending-shelf-label">📎 Ready to attach:</span>
            {pendingAttachments.map((doc) => (
              <div 
                key={doc._id || doc.id} 
                className="ws-pending-doc-tag"
                onClick={() => handleViewDoc(doc._id || doc.id)}
                title="Click to view file content"
              >
                <FileText size={12} style={{ color: "#a5b4fc", flexShrink: 0 }} />
                <span className="ws-upload-name">{doc.filename}</span>
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
            ))}
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

      <div className="ws-input-bar" style={{ display: "flex", flexDirection: "column" }}>
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
                      fileInputRef.current?.click();
                    }}
                  >
                    <div className="ws-menu-tile-icon">
                      <FileUp size={16} />
                    </div>
                    <div className="ws-menu-tile-text">
                      <strong>Upload File</strong>
                      <span>PDF, Notes, Docs</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="ws-menu-tile-btn"
                    onClick={() => {
                      setShowAttachMenu(false);
                      fileInputRef.current?.click();
                    }}
                  >
                    <div className="ws-menu-tile-icon">
                      <Camera size={16} />
                    </div>
                    <div className="ws-menu-tile-text">
                      <strong>Screenshot</strong>
                      <span>Problem or diagram</span>
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
                      <span>Realtime syllabus lookup</span>
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
                    navigate("/integrations");
                  }}
                >
                  <div className="ws-menu-row-icon">
                    <Layers size={15} />
                  </div>
                  <div className="ws-menu-row-text">
                    <strong>Connectors & Hub</strong>
                    <span>Google Drive, Notion</span>
                  </div>
                  <ChevronRight size={13} className="ws-menu-chevron" />
                </button>

                <button
                  type="button"
                  className="ws-menu-row-btn"
                  onClick={() => {
                    setShowAttachMenu(false);
                    setDirectoryModalOpen(true);
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
            onClick={handleSend}
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
    </div>
  );
}

export default EducationChat;

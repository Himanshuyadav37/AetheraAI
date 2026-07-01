import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SendHorizonal, Wrench, ArrowRight, Plus, X, UploadCloud, FileText, Trash2, Loader2 } from "lucide-react";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useAuth } from "../../contexts/AuthContext";
import EngineerPanel, { formatProjectOutput } from "../EngineerPanel";
import api from "../../services/api";
import "../../styles/workspace.css";
import { getAvatarStyle } from "../../utils/avatarHelper";
import MarkdownRenderer from "../education/MarkdownRenderer";

const PLACEHOLDER = "Build an AI Resume Analyzer using FastAPI and MongoDB...";

function EngineerChat() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const continueProjectId = searchParams.get("projectId") || undefined;
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
  const [githubToken, setGithubToken] = useState(localStorage.getItem("github_token") || "");
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

  // RAG States
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [sessionDocs, setSessionDocs] = useState([]);
  const [selectedViewDoc, setSelectedViewDoc] = useState(null);

  const handleViewDoc = async (docId) => {
    try {
      const res = await api.get(`/rag/documents/${docId}/content`);
      setSelectedViewDoc(res.data);
    } catch (err) {
      alert("Failed to load document content: " + (err.response?.data?.detail || err.message));
    }
  };
  
  const [sessionId] = useState(() => {
    let id = sessionStorage.getItem("rag_session_id");
    if (!id) {
      id = "session_" + Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem("rag_session_id", id);
    }
    return id;
  });

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

        if (continueExecutionId) {
          const targetExec = executions.find(e => e.execution_id === continueExecutionId || e._id === continueExecutionId);
          if (targetExec) {
            setResult("engineer", targetExec.result || targetExec);
          } else {
            const singleRes = await api.get(`/ai/executions/${continueExecutionId}`);
            if (singleRes.data) {
              setResult("engineer", singleRes.data.result || singleRes.data);
            }
          }
        } else if (executions.length > 0) {
          const latest = executions[executions.length - 1];
          setResult("engineer", latest.result || latest);
        }
      } catch (err) {
        console.error("Failed to load project history:", err);
      } finally {
        setLoading("engineer", false);
      }
    }
    loadProjectHistory();
  }, [continueProjectId, continueExecutionId]);

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

  async function handleSend(textOverride) {
    const text = (typeof textOverride === "string" ? textOverride : prompt).trim();
    if (!text || loading) return;

    // Snapshot of active session docs to attach to this message
    const attachmentsSnapshot = [...sessionDocs];

    const userMsg = { id: crypto.randomUUID(), role: "user", content: text, attachments: attachmentsSnapshot };
    const loadingMsg = { id: "loading", role: "loading", content: "" };

    setMessages("engineer", [...messages, userMsg, loadingMsg]);
    setLoading("engineer", true);
    setPrompt("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const isContinue = !!continueExecutionId;
      const activeOrgId = localStorage.getItem("active_org_id") || undefined;
      const payload = {
        idea: text,
        agent_type: "engineer",
        conversation_id: activeId || undefined,
        connectors,
        session_id: sessionId,
        org_id: activeOrgId,
        project_id: continueProjectId || undefined,
        attachments: attachmentsSnapshot
      };

      if (isContinue) {
        payload.mode = "continue";
        payload.project_id = continueProjectId;
        payload.execution_id = continueExecutionId;
      }

      const res = await api.post("/ai/execute-project", payload);

      const data = res.data;
      const convId = data.conversation_id || activeId;

      const aiMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: formatProjectOutput(data),
        result: data,
        metadata: data.metadata || null // Store citations if present
      };

      setMessages("engineer", [...messages, userMsg, aiMsg]);
      if (convId) {
        setActiveId("engineer", convId);
        refreshHistory("engineer");
      }
      setResult("engineer", data);
    } catch (err) {
      const errMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `❌ Error: ${err.response?.data?.detail || err.message || "Failed to execute project."}`,
      };
      setMessages("engineer", [...messages, userMsg, errMsg]);
    } finally {
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
            <p style={{ fontSize: "12px", color: "#a3a3a3" }}>Upload references to ground Code generation in Session RAG</p>
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
            <h2>Engineer AI with RAG</h2>
            <p>Build production-ready code plans grounded on structural architectural guides and API documentation.</p>
            
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
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "flex-end" }}>
                        {msg.attachments.map((att) => (
                          <div 
                            key={att._id} 
                            className="ws-active-doc-tag" 
                            onClick={() => handleViewDoc(att._id)}
                            style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                          >
                            <FileText size={11} />
                            <span>{att.filename}</span>
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
            const hasResult = !!msg.result;
            const getExecId = (res) => res?.execution_id || res?._id;
            const isViewingThis = hasResult && result && getExecId(result) === getExecId(msg.result);
            return (
              <div key={msg.id} className="ws-message">
                <div className="ws-avatar ai-av">AI</div>
                <div className="ws-msg-body">
                  <div className="ws-ai-response ws-markdown">
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
                  {hasResult && (
                    <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
                      <button
                        className={`view-code-btn ${isViewingThis ? "active" : ""}`}
                        onClick={() => {
                          setResult("engineer", msg.result);
                        }}
                        style={{
                          padding: "8px 14px",
                          background: isViewingThis ? "rgba(16, 185, 129, 0.15)" : "rgba(59, 130, 246, 0.15)",
                          border: isViewingThis ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(59, 130, 246, 0.4)",
                          color: isViewingThis ? "#34d399" : "#60a5fa",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontSize: "12px",
                          fontWeight: "600",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          transition: "all 0.2s ease"
                        }}
                      >
                        <span>📁</span>
                        {isViewingThis ? "Viewing Code in Side Panel" : "View Code in Side Panel"}
                      </button>

                      {(() => {
                        const downloadUrl = msg.result?.zip_url
                          ? `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}${msg.result.zip_url}`
                          : msg.result?.project_id
                            ? `${import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"}/projects/${msg.result.project_id}/download`
                            : "";
                        return downloadUrl ? (
                          <div style={{ display: "flex", gap: "10px" }}>
                            <a
                              href={downloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                padding: "8px 14px",
                                background: "rgba(255, 255, 255, 0.08)",
                                border: "1px solid rgba(255, 255, 255, 0.15)",
                                color: "#ffffff",
                                borderRadius: "8px",
                                textDecoration: "none",
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
                              <span>📦</span>
                              Download ZIP
                            </a>
                            <button
                              onClick={() => {
                                setPushProject(msg.result);
                                setPushModalOpen(true);
                              }}
                              style={{
                                padding: "8px 14px",
                                background: "rgba(139, 92, 246, 0.15)",
                                border: "1px solid rgba(139, 92, 246, 0.4)",
                                color: "#c084fc",
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
                                e.currentTarget.style.background = "rgba(139, 92, 246, 0.25)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(139, 92, 246, 0.15)";
                              }}
                            >
                              <span>🚀</span>
                              Push to GitHub
                            </button>
                          </div>
                        ) : null;
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
              <span className="ws-loading-text">Engineer planning code architectures, implementing changes...</span>
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

      {/* Input bar */}
      <div className="ws-input-bar">
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
                    <span>Upload References</span>
                  </button>
                </div>
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
        <div className="ws-input-hint">Drag & drop files to upload · Press Enter to send to engineer</div>
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

export default EngineerChat;

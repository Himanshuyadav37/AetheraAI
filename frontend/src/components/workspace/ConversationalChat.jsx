import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  SendHorizonal,
  Bot,
  Plus,
  X,
  UploadCloud,
  FileText,
  Trash2,
  Loader2,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  Zap,
  Database,
  Layers,
  ShieldCheck,
  Terminal,
  Compass,
  FileUp,
  Camera,
  Globe,
  FolderGit2,
  ChevronRight
} from "lucide-react";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useAuth } from "../../contexts/AuthContext";
import api, { getBaseURL } from "../../services/api";
import "../../styles/workspace.css";
import { getAvatarStyle } from "../../utils/avatarHelper";
import MarkdownRenderer from "../education/MarkdownRenderer";
import LimitReachedModal from "./LimitReachedModal";

const PLACEHOLDER = "Ask NexusAI anything or ground answers with connected knowledge bases...";

function ConversationalChat() {
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

  const { messages, loading, activeId } = moduleState.conversational;

  const [prompt, setPrompt] = useState("");
  const [showLimitModal, setShowLimitModal] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Control Panel & Connectors state
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [hoveredSubmenu, setHoveredSubmenu] = useState(null);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [provider, setProvider] = useState("groq");
  const [showModelMenu, setShowModelMenu] = useState(false);

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

  // Temporary RAG Session ID
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
        api.post(`/rag/sessions/clear?session_id=${oldSessionId}`).catch(() => { });
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
      requireAuth(async () => {
        await handleUploadFiles(files);
      }, "Authentication Required", "Sign in to upload documents and ground AI responses.");
    }
  };

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      requireAuth(async () => {
        await handleUploadFiles(files);
      }, "Authentication Required", "Sign in to upload documents and ground AI responses.");
    }
    e.target.value = null; // Reset file input
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

    // Immediately show attached file tags above the writing bar
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
          }, 500);

          try {
            const resDocs = await api.get(`/rag/documents?session_id=${sessionId}`);
            if (resDocs.data && Array.isArray(resDocs.data)) {
              setSessionDocs(resDocs.data);
              // Update pending attachments with server doc metadata & id
              setPendingAttachments(prev => {
                return prev.map(p => {
                  const match = resDocs.data.find(d => d.filename === (p.filename || p.name));
                  if (match) {
                    return { ...p, ...match, _id: match._id, id: match._id, status: "ready" };
                  }
                  return p;
                });
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
      if (docId && !docId.startsWith("up_")) {
        await api.delete(`/rag/documents/${docId}`);
      }
      setPendingAttachments(prev => prev.filter(d => (d._id || d.id) !== docId));
      loadSessionDocs();
    } catch (err) {
      alert("Failed to delete document: " + (err.response?.data?.detail || err.message));
    }
  };

  const handleClearSession = async () => {
    try {
      await api.post(`/rag/sessions/clear?session_id=${sessionId}`);
      setSessionDocs([]);
      setPendingAttachments([]);
      setUploadingFiles([]);
    } catch (err) {
      alert("Failed to clear session RAG: " + (err.response?.data?.detail || err.message));
    }
  };

  // SSE Streaming RAG Chat Action
  async function handleSend(textOverride) {
    if (isUploading) return;
    const text = (typeof textOverride === "string" ? textOverride : prompt).trim();
    if (!text || loading) return;

    // Snapshot of active session docs to attach to this message ONLY if currently pending
    let attachmentsSnapshot = [];
    if (pendingAttachments.length > 0) {
      attachmentsSnapshot = pendingAttachments.map(doc => ({
        id: doc._id || doc.id || Math.random().toString(),
        _id: doc._id || doc.id,
        filename: doc.filename || doc.name,
        name: doc.filename || doc.name,
        size: doc.size
      }));
    }

    const userMsg = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      attachments: attachmentsSnapshot
    };
    const aiMessageId = crypto.randomUUID();
    const initialAiMsg = { id: aiMessageId, role: "assistant", content: "", isStreaming: true, metadata: null };

    setMessages("conversational", [...messages, userMsg, initialAiMsg]);
    setLoading("conversational", true);
    setPrompt("");
    setPendingAttachments([]); // Clear attached files from input bar immediately upon sending!
    if (textareaRef.current) textareaRef.current.style.height = "auto";

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
          connectors,
          provider,
          messages: messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role, content: m.content }))
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize stream: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

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
                  prev.map(m => m.id === aiMessageId ? { ...m, content: accumulatedText, isStreaming: true } : m)
                );
              }
            } catch (e) {
              // Ignore partial JSON parsing errors
            }
          }
        }
      }

      setMessages("conversational", (prev) =>
        prev.map(m => m.id === aiMessageId ? { ...m, content: accumulatedText, isStreaming: false } : m)
      );

      // Save complete conversation to history in Mongo (non-blocking log update)
      try {
        const userId = user?.id || user?._id || user?.sub || "system";
        let convId = activeId;
        if (!convId) {
          const createRes = await api.post("/conversations", {
            user_id: userId,
            agent_type: "conversational",
            title: text.substring(0, 60)
          });
          convId = createRes.data._id;
          setActiveId("conversational", convId);
          if (sessionId) {
            await api.post(`/rag/sessions/promote?old_session_id=${sessionId}&new_session_id=session_${convId}`).catch(() => { });
          }
        }

        await api.post(`/conversations/${convId}/messages`, { role: "user", content: text, attachments: attachmentsSnapshot });
        await api.post(`/conversations/${convId}/messages`, { role: "assistant", content: accumulatedText, metadata: metadataPacket });

        refreshHistory("conversational");
      } catch (convErr) {
        // Show limit modal if 429
        if (convErr?.response?.status === 429 || convErr?.response?.data?.detail === "LIMIT_REACHED") {
          setShowLimitModal(true);
          // Remove the user + loading messages since we're blocking
          setMessages("conversational", messages);
          return;
        }
        console.error("Failed to log conversation to history", convErr);
      }

    } catch (err) {
      const errorContent = `❌ Error: ${err.message || "Failed to parse streaming response."}`;
      setMessages("conversational", (prev) =>
        prev.map(m => m.id === aiMessageId ? { ...m, content: errorContent, isStreaming: false } : m)
      );
    } finally {
      setLoading("conversational", false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isUploading && prompt.trim() && !loading) {
        requireAuth(() => handleSend(), "Authentication Required", "Sign in to send prompts and interact with NexusAI.");
      }
    }
  }

  function handleInput(e) {
    setPrompt(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }

  return (
    <div
      className={`ws-chat ${isDragging ? "ws-dragging-active" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Limit Reached Modal */}
      {showLimitModal && <LimitReachedModal onClose={() => setShowLimitModal(false)} />}

      {/* Visual Drag & Drop Overlay */}
      {isDragging && (
        <div className="ws-drag-overlay">
          <div className="ws-drag-card">
            <UploadCloud size={48} className="ws-drag-icon" />
            <h3>Drop Documents Here to Ground AI</h3>
            <p>Upload PDFs, code files, CSVs, or text for context synthesis</p>
          </div>
        </div>
      )}

      <div className="ws-messages">
        {messages.length === 0 && (
          <div className="ws-empty">
            <div className="ws-empty-hero clean-minimal">
              <h1 className="hero-gradient-title">Conversational AI Engine</h1>
              <p className="hero-subtitle">
                Context-aware conversational intelligence grounded on project knowledge bases, live web search, and document RAG.
              </p>
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
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="ws-user-attachments-grid">
                      {msg.attachments.map((att, attIdx) => {
                        const displayName = att.filename || att.name || "Attached Document";
                        const docId = att._id || att.id;
                        return (
                          <div
                            key={docId || attIdx}
                            className="ws-attached-file-chip"
                            onClick={() => docId && handleViewDoc(docId)}
                            title={docId ? "Click to view file content" : displayName}
                          >
                            <div className="ws-chip-icon">
                              <FileText size={14} />
                            </div>
                            <span className="ws-chip-name">{displayName}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="ws-user-bubble ws-markdown">
                    <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                  </div>
                </div>
              ) : (
                <div className="ws-ai-response ws-markdown">
                  {!msg.content ? (
                    <div className="ws-loading-dots">
                      <div className="ws-dot-pulse">
                        <span />
                        <span />
                        <span />
                      </div>
                      <span className="ws-loading-text">Thinking…</span>
                    </div>
                  ) : (
                    <>
                      <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                      {msg.isStreaming && <span className="ws-streaming-cursor" />}
                    </>
                  )}

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
        ))}

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
        {/* Floating Pending Attachments Shelf (Directly above writing bar) */}
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
                      <span>PDF, CSV, images</span>
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

          {/* Model Selector Button next to + */}
          <div className="ws-model-dropdown-wrapper" style={{ position: "relative" }}>
            <button
              type="button"
              className="ws-model-select-btn"
              onClick={() => setShowModelMenu(!showModelMenu)}
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                color: "rgba(255, 255, 255, 0.8)",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
                height: "32px",
                transition: "all 0.2s"
              }}
            >
              <span>{provider === "groq" ? "Groq GPT-OSS" : "AWS Bedrock (Free Titan)"}</span>
              <span style={{ fontSize: "8px", opacity: 0.6 }}>▼</span>
            </button>
            {showModelMenu && (
              <div
                className="ws-model-menu-dropdown"
                style={{
                  position: "absolute",
                  bottom: "calc(100% + 8px)",
                  left: 0,
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                  padding: "4px",
                  width: "180px",
                  zIndex: 100,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.5)"
                }}
              >
                <button
                  type="button"
                  onClick={() => { setProvider("groq"); setShowModelMenu(false); }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: provider === "groq" ? "rgba(255,255,255,0.08)" : "transparent",
                    border: "none",
                    color: provider === "groq" ? "#ffffff" : "rgba(255,255,255,0.6)",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  Groq GPT-OSS
                </button>
                <button
                  type="button"
                  onClick={() => { setProvider("bedrock"); setShowModelMenu(false); }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    background: provider === "bedrock" ? "rgba(255,255,255,0.08)" : "transparent",
                    border: "none",
                    color: provider === "bedrock" ? "#ffffff" : "rgba(255,255,255,0.6)",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  AWS Bedrock (Free Titan)
                </button>
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
            onClick={() => requireAuth(() => handleSend(), "Authentication Required", "Sign in to send prompts and interact with NexusAI.")}
            disabled={!prompt.trim() || loading || isUploading}
            id="conversational-send-btn"
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

export default ConversationalChat;

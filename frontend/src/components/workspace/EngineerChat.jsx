import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { SendHorizonal, Wrench, ArrowRight, Plus, X, Globe, Square, FileUp, Camera, Layers, FolderGit2, ChevronRight } from "lucide-react";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useAuth } from "../../contexts/AuthContext";
import EngineerPanel, { formatProjectOutput } from "../EngineerPanel";
import LiveWebPreview from "../LiveWebPreview";
import api, { getBaseURL } from "../../services/api";
import "../../styles/workspace.css";
import { getAvatarStyle } from "../../utils/avatarHelper";
import MarkdownRenderer from "../education/MarkdownRenderer";
import McpRegistry from "./McpRegistry";
import AgentLiveTimeline from "./AgentLiveTimeline";

const PLACEHOLDER = "Describe the system you want to build (e.g. Real-Time Analytics Pipeline in FastAPI & Redis)...";

const STARTER_PROMPTS = {
  all: [
    { tag: "FULL-STACK APP", icon: "🚀", title: "Collaborative Realtime Workspace", text: "Build a production-ready Kanban board with drag-and-drop, WebSocket live sync, and Postgres schema.", badge: "Next.js 15 + FastAPI" },
    { tag: "BACKEND API", icon: "⚡", title: "Distributed Task Queue & Rate Limiter", text: "Create an async background worker in FastAPI with Redis token bucket rate limiting and retry backoff.", badge: "FastAPI + Celery" },
    { tag: "AGENTIC RAG", icon: "🧠", title: "Pinecone Multi-Document Synthesis", text: "Architect a vector search pipeline that chunks PDFs, generates text embeddings, and provides citation references.", badge: "Pinecone + RAG" },
    { tag: "DEVOPS & CI/CD", icon: "🛡️", title: "Production Multi-Stage Pipeline", text: "Write an optimized multi-stage Dockerfile, docker-compose orchestration, and automated GitHub Actions CI.", badge: "Docker + Actions" },
  ],
  backend: [
    { tag: "FASTAPI", icon: "⚡", title: "High-Throughput URL Shortener", text: "Build a high-performance URL shortener in FastAPI with Redis caching, analytics click tracking, and custom aliases.", badge: "FastAPI + Redis" },
    { tag: "DATABASE", icon: "🗄️", title: "Multi-Tenant PostgreSQL Architecture", text: "Design an ACID-compliant schema with row-level security, indexing strategies, and automated migrations.", badge: "PostgreSQL 16" },
    { tag: "AUTH MESH", icon: "🔑", title: "JWT + OAuth2 + 2FA Enterprise Engine", text: "Implement secure session tokens with refresh rotations, bcrypt hashing, and TOTP two-factor authentication.", badge: "OAuth2 / JWT" },
    { tag: "STREAMING", icon: "📡", title: "Server-Sent Events (SSE) Live Feed", text: "Create an event-driven telemetry streamer pushing sub-millisecond AI token generation events to clients.", badge: "SSE + Asyncio" },
  ],
  fullstack: [
    { tag: "REACT 19", icon: "🚀", title: "Interactive AI Artifacts Canvas", text: "Build a split-screen workspace with interactive markdown rendering, code execution sandbox, and live DOM preview.", badge: "React 19 + Vite" },
    { tag: "COMMERCE", icon: "💎", title: "Stripe Usage-Based Metered Billing", text: "Implement webhook handlers for token quota enforcement, tier upgrades, and automated invoice PDF generation.", badge: "Stripe + Webhooks" },
    { tag: "CHAT MESH", icon: "💬", title: "Autonomous Multi-Agent Debate Arena", text: "Create a UI where two specialized AI agents critique each other's code solutions in real-time until convergence.", badge: "WebSockets" },
    { tag: "MOBILE PWA", icon: "📱", title: "Offline-First Mobile Engineering Hub", text: "Configure IndexedDB local caching, service worker background sync, and fluid touch gesture navigation.", badge: "PWA + Tailwind" },
  ],
  ai_rag: [
    { tag: "MEMORY", icon: "🧠", title: "Self-Reflective Agent Memory Engine", text: "Implement an agent learner that inspects user bug fixes and extracts persistent architectural rules for future sessions.", badge: "Vector Memory" },
    { tag: "RESEARCH", icon: "🌐", title: "Autonomous Web Deep Crawler", text: "Build an agent that queries DuckDuckGo, distills top 5 articles, extracts citations, and exports markdown dossiers.", badge: "Autonomous RAG" },
    { tag: "MCP HUB", icon: "🔌", title: "Model Context Protocol Tool Server", text: "Expose filesystem operations, database inspection, and GitHub PR creation tools over standardized MCP stdio.", badge: "MCP Protocol" },
    { tag: "EVALUATION", icon: "📈", title: "Automated LLM Benchmark Matrix", text: "Run automated unit tests on generated code, grade syntax compliance, and calculate pass@1 accuracy scores.", badge: "Pytest Matrix" },
  ],
};

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
  const [activePromptCategory, setActivePromptCategory] = useState("all");
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const activeEventSourceRef = useRef(null);
  const activePollIntervalRef = useRef(null);
  const currentExecutionIdRef = useRef(null);

  const handleStop = async () => {
    if (activeEventSourceRef.current) {
      activeEventSourceRef.current.close();
      activeEventSourceRef.current = null;
    }
    if (activePollIntervalRef.current) {
      clearInterval(activePollIntervalRef.current);
      activePollIntervalRef.current = null;
    }
    const execId = currentExecutionIdRef.current;
    if (execId) {
      try {
        await api.post(`/ai/executions/${execId}/stop`);
      } catch (err) {
        console.warn("Stop execution error:", err);
      }
    }
    setLoading("engineer", false);
    setMessages("engineer", (prev) => {
      const cleaned = prev.filter((m) => m.id !== "loading");
      return [...cleaned, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "⏹️ **Generation stopped by user.** You can refine your prompt or start a new request."
      }];
    });
  };

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
  const [collapsedMsgIds, setCollapsedMsgIds] = useState({});
  const [previewModalResult, setPreviewModalResult] = useState(null);

  const toggleMsgCollapse = (msgId) => {
    setCollapsedMsgIds(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

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
      const activeExecId = continueExecutionId || result?.execution_id || result?._id;
      const activeProjId = continueProjectId || result?.project_id;
      const isContinue = !!(activeExecId || activeProjId);

      const payload = {
        idea: promptText,
        agent_type: "engineer",
        conversation_id: activeId || undefined,
        connectors,
      };

      if (isContinue) {
        payload.mode = "continue";
        payload.project_id = activeProjId || "";
        payload.execution_id = activeExecId || "";
      }

      const res = await api.post("/ai/execute-project", payload);
      const data = res.data;
      const convId = data.conversation_id || activeId;

      if (convId) {
        setActiveId("engineer", convId);
        refreshHistory("engineer");
      }

      if (!data.execution_id) {
        setLoading("engineer", false);
        const directMsg = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.message || data.content || "Response received.",
          result: data.result || data,
        };
        setMessages("engineer", (prev) => {
          const cleaned = prev.filter((m) => m.id !== "loading");
          return [...cleaned, directMsg];
        });
        if (data.generated_code?.files?.length > 0 || data.fixed_code?.files?.length > 0) {
          setResult("engineer", data);
        }
        return;
      }

      // Initialize result state to hold streaming execution details
      currentExecutionIdRef.current = data.execution_id;
      const initialStreamResult = {
        execution_id: data.execution_id,
        status: "running",
        execution_steps: []
      };
      setResult("engineer", initialStreamResult);

      const handleExecutionCompletion = (execData) => {
        if (activeEventSourceRef.current) {
          activeEventSourceRef.current.close();
          activeEventSourceRef.current = null;
        }
        if (activePollIntervalRef.current) {
          clearInterval(activePollIntervalRef.current);
          activePollIntervalRef.current = null;
        }
        setResult("engineer", execData);
        setLoading("engineer", false);
        
        const aiMsg = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: formatProjectOutput(execData),
          result: execData,
        };
        setMessages("engineer", (prev) => {
          const cleaned = prev.filter((m) => m.id !== "loading");
          return [...cleaned, aiMsg];
        });
        refreshHistory("engineer");
      };

      const handleExecutionFailure = (errorText) => {
        if (activeEventSourceRef.current) {
          activeEventSourceRef.current.close();
          activeEventSourceRef.current = null;
        }
        if (activePollIntervalRef.current) {
          clearInterval(activePollIntervalRef.current);
          activePollIntervalRef.current = null;
        }
        setLoading("engineer", false);
        const errorMsg = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `❌ Error: ${errorText || "Execution failed."}`,
        };
        setMessages("engineer", (prev) => {
          const cleaned = prev.filter((m) => m.id !== "loading");
          return [...cleaned, errorMsg];
        });
      };

      // Connect to the SSE stream
      const streamUrl = `${getBaseURL()}/ai/${data.execution_id}/stream`;
      const eventSource = new EventSource(streamUrl);
      activeEventSourceRef.current = eventSource;

      let isFinished = false;

      const fallbackPoll = () => {
        if (isFinished) return;
        let pollCount = 0;
        const maxPolls = 60; // 2 minutes max

        const pollInterval = setInterval(async () => {
          if (isFinished || pollCount >= maxPolls) {
            clearInterval(pollInterval);
            activePollIntervalRef.current = null;
            if (!isFinished) {
              handleExecutionFailure("Connection to execution stream timed out.");
            }
            return;
          }
          pollCount++;

          try {
            const res = await api.get(`/ai/executions/${data.execution_id}`);
            const exec = res.data;
            if (exec) {
              if (exec.execution_steps?.length > 0) {
                setResult("engineer", (prev) => ({
                  ...prev,
                  execution_steps: exec.execution_steps
                }));
              }

              if (exec.status === "completed") {
                isFinished = true;
                clearInterval(pollInterval);
                activePollIntervalRef.current = null;
                handleExecutionCompletion(exec);
              } else if (exec.status === "failed") {
                isFinished = true;
                clearInterval(pollInterval);
                activePollIntervalRef.current = null;
                handleExecutionFailure(exec.debug_report || "Execution failed.");
              }
            }
          } catch (pollErr) {
            console.error("Polling error:", pollErr);
          }
        }, 2000);
        activePollIntervalRef.current = pollInterval;
      };

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
            isFinished = true;
            eventSource.close();
            handleExecutionCompletion(parsed.data);
          } else if (parsed.type === "failed") {
            isFinished = true;
            eventSource.close();
            handleExecutionFailure(parsed.error);
          }
        } catch (err) {
          console.error("Error parsing SSE stream message:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.warn("SSE stream disconnected, falling back to live polling:", err);
        eventSource.close();
        if (!isFinished) {
          fallbackPoll();
        }
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
          <div className="continue-banner">
            <ArrowRight size={15} />
            <span>Continuing project <strong>{result?.project_plan?.project_name || continueProjectId}</strong>. Describe modifications or updates you want to make in the chat below.</span>
          </div>
        )}

        {messages.length === 0 && !loading && (
          <div className="ws-empty">
            <div className="ws-empty-hero clean-minimal">
              <h1 className="hero-gradient-title">What will you engineer today?</h1>
              <p className="hero-subtitle">
                Architect, write, test, and deploy production software with multi-agent orchestration.
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
                  <div className="ws-user-bubble ws-markdown">
                    <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                  </div>
                </div>
              </div>
            );
          }
          if (msg.role === "assistant") {
            const hasResult = !!msg.result;
            const isClarification = msg.result?.is_clarification || msg.result?.type === "clarification" || msg.result?.status === "clarification_needed";
            const isFolded = !!collapsedMsgIds[msg.id];
            const projectName = msg.result?.project_plan?.project_name || msg.result?.project_name || "Autonomous AI Project";
            const filesCount = (msg.result?.fixed_code?.files || msg.result?.generated_code?.files || []).length;

            return (
              <div key={msg.id} className="ws-message">
                <div className="ws-avatar ai-av">AI</div>
                <div className="ws-msg-body">
                  {hasResult && !isClarification && (msg.result.execution_steps || msg.result.steps) && (
                    <div className="ws-timeline-wrapper">
                      <AgentLiveTimeline steps={msg.result.execution_steps || msg.result.steps} loading={false} />
                    </div>
                  )}

                  {hasResult && !isClarification && (
                    <div 
                      onClick={() => toggleMsgCollapse(msg.id)}
                      className="ws-blueprint-collapse-card"
                    >
                      <div className="ws-blueprint-card-left">
                        <span className="ws-blueprint-icon">⚡</span>
                        <span className="ws-blueprint-title">
                          {projectName}
                        </span>
                        {filesCount > 0 && (
                          <span className="ws-blueprint-badge">
                            {filesCount} files
                          </span>
                        )}
                      </div>
                      <span className="ws-blueprint-toggle-text">
                        {isFolded ? "View Plan ▼" : "Hide Plan ▲"}
                      </span>
                    </div>
                  )}

                  {!isFolded && (
                    hasResult && !isClarification ? (
                      <div className="ws-project-blueprint-box ws-markdown">
                        <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                      </div>
                    ) : (
                      <div className="ws-ai-response ws-markdown">
                        <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                      </div>
                    )
                  )}

                  {/* Interactive Human-in-the-Loop Clarification Widget */}
                  {isClarification && msg.result?.questions?.length > 0 && (
                    <div className="ws-clarification-card">
                      <div className="ws-clarification-header">
                        <span>⚡</span>
                        <span>Interactive Specifications & Option Chips</span>
                      </div>
                      
                      {msg.result.questions.map((q, qIdx) => (
                        <div key={q.id || qIdx} className="ws-clarification-group">
                          <span className="ws-clarification-q">{q.question}</span>
                          <div className="ws-clarification-chips">
                            {q.options?.map((opt, optIdx) => (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() => handleSend(`Selected ${q.id || 'preference'}: ${opt}. Proceed with project generation.`)}
                                className="ws-chip-btn"
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}

                      <div className="ws-clarification-footer">
                        <button
                          type="button"
                          onClick={() => handleSend("Confirm and proceed with recommended architecture and default settings.")}
                          className="ws-confirm-btn"
                        >
                          <span>🚀 Confirm & Generate Project</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {hasResult && !isClarification && (
                    <div className="ws-project-action-strip">
                      <button
                        type="button"
                        className="ws-btn-view-project"
                        onClick={() => {
                          setResult("engineer", msg.result);
                          setPreviewModalResult(msg.result);
                        }}
                      >
                        <Layers size={14} />
                        <span>Open Project Workspace</span>
                        <span className="ws-live-pulse-dot" />
                      </button>
                      <button
                        type="button"
                        className="ws-btn-secondary-action ws-btn-github"
                        onClick={() => handleOpenGithubPushModal(msg.result)}
                      >
                        <svg height="14" width="14" viewBox="0 0 16 16" fill="currentColor" style={{ flexShrink: 0 }}>
                          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                        </svg>
                        <span>Push to GitHub</span>
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
          <div className="ws-message ws-message-loading">
            <div className="ws-avatar ai-av thinking">AI</div>
            <div className="ws-msg-body ws-loading-timeline-body">
              <AgentLiveTimeline steps={result?.execution_steps || []} loading={true} />
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
              <div className="ws-attachment-thumbnail ws-attachment-doc">DOC</div>
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
                      <span>Code, specs, zip</span>
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
                      <span>UI clip or error</span>
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
                    navigate("/integrations");
                  }}
                >
                  <div className="ws-menu-row-icon">
                    <Layers size={15} />
                  </div>
                  <div className="ws-menu-row-text">
                    <strong>Connectors & MCP</strong>
                    <span>GitHub, PostgreSQL, Docker</span>
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
          {loading ? (
            <button
              className="ws-send-btn ws-stop-btn"
              onClick={handleStop}
              id="engineer-stop-btn"
              title="Stop Generation"
              aria-label="Stop generation"
              type="button"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              className="ws-send-btn"
              onClick={handleSend}
              disabled={!prompt.trim()}
              id="engineer-send-btn"
              aria-label="Generate project"
              type="button"
            >
              <SendHorizonal size={16} />
            </button>
          )}
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

      {/* Standalone Project Workspace Modal from Chat (Pop style full workspace) */}
      {previewModalResult && (
        <div 
          className="ws-modal-overlay ws-workspace-modal-overlay" 
          role="dialog" 
          aria-modal="true" 
          onClick={() => setPreviewModalResult(null)}
        >
          <div className="ws-workspace-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <EngineerPanel
              result={previewModalResult}
              loading={false}
              isModal={true}
              initialMode="code"
              onClose={() => setPreviewModalResult(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default EngineerChat;

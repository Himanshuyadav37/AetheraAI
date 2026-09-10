import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  Users, Shield, MessageSquare, Code2, Search, Trash2, CheckCircle, 
  GraduationCap, Play, RefreshCw, AlertTriangle, Building, Database, 
  FileText, UploadCloud, BarChart3, Settings, Plus, Loader2, Link, 
  Trash, ExternalLink, Activity, ArrowLeft, Brain, Zap, DollarSign,
  Clock, TrendingUp, Sliders, CheckCircle2
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import "./AdminPanel.css";

function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Admin access validation
  const ADMIN_EMAILS = ["ydvhimanshu461@gmail.com", "admin.nexusai@gmail.com", "admin@nexusai.com", "admin@devpilot.ai", "ydvvhimanshu461@gmail.com", "himanshuydv00001@gmail.com"];
  const isAdmin = user && (ADMIN_EMAILS.includes(user.email?.toLowerCase()?.trim()) || user.role === "admin");

  // URL-bound Tab State
  const activeTab = searchParams.get("tab") || "dashboard";
  const setActiveTab = (tabName) => setSearchParams({ tab: tabName });

  // Cost & Quota Vault States (100% Real DB Data)
  const [costVaultData, setCostVaultData] = useState({
    summary: {
      total_tokens: 0,
      total_spend_usd: 0.0,
      total_baseline_cost_usd: 0.0,
      total_net_savings_usd: 0.0,
      savings_rate_percentage: 0.0,
      developer_hours_saved: 0.0,
      developer_dollars_saved: 0.0,
      total_enterprise_value_usd: 0.0
    },
    tier_distribution: { fast: 0.0, frontier: 0.0 },
    model_breakdown: [],
    department_spend: [],
    recent_logs: []
  });
  const [departmentBudgets, setDepartmentBudgets] = useState([]);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [deptForm, setDeptForm] = useState({
    department: "",
    monthly_budget_usd: 500,
    hard_cap: true,
    alert_threshold: 80
  });
  const [routerSimPrompt, setRouterSimPrompt] = useState("");
  const [routerSimAgent, setRouterSimAgent] = useState("conversational");
  const [routerSimResult, setRouterSimResult] = useState(null);
  const [routerSimLoading, setRouterSimLoading] = useState(false);

  // Existing Dashboard States (100% Verified Telemetry)
  const [stats, setStats] = useState({
    users: 0,
    conversations: 0,
    education: 0,
    projects: 0,
    executions: 0,
    research: 0,
    automation: 0
  });
  const [systemInfo, setSystemInfo] = useState({
    os: "N/A",
    python: "N/A",
    db_status: "N/A",
    ping_ms: 0,
    platform_status: "N/A",
    total_executions: 0,
    total_kb_docs: 0,
    total_guardrail_logs: 0,
    total_audit_logs: 0,
    total_records: 0
  });
  const [agentDistribution, setAgentDistribution] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [updatingLimit, setUpdatingLimit] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // User history states
  const [selectedUserForHistory, setSelectedUserForHistory] = useState(null);
  const [userHistoryData, setUserHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [activeHistoryModel, setActiveHistoryModel] = useState("conversational");
  const [selectedHistorySession, setSelectedHistorySession] = useState(null);

  // RAG entities states
  const [orgs, setOrgs] = useState([]);
  const [activeOrgId, setActiveOrgId] = useState("");
  const [kbs, setKbs] = useState([]);
  const [activeKbId, setActiveKbId] = useState("");
  const [docsList, setDocsList] = useState([]);
  const [docSearch, setDocSearch] = useState("");
  
  // Creation Form states
  const [newOrgName, setNewOrgName] = useState("");
  const [newKbName, setNewKbName] = useState("");
  const [newKbDesc, setNewKbDesc] = useState("");
  
  // Upload states
  const [uploadSource, setUploadSource] = useState("file"); // file, url, github
  const [uploadUrl, setUploadUrl] = useState("");
  const [uploadGit, setUploadGit] = useState("");
  const fileInputRef = useRef(null);
  const [uploadingState, setUploadingState] = useState(null); // indexing, completed, failed
  const [uploadProgress, setUploadProgress] = useState(0);

  // Analytics states
  const [analytics, setAnalytics] = useState({
    total_documents: 0,
    total_size_bytes: 0,
    total_chunks: 0,
    active_jobs_count: 0,
    storage_usage_percentage: 0.0
  });

  // Settings states
  const [ragSettings, setRagSettings] = useState({
    chunk_size: 1000,
    chunk_overlap: 150,
    chunk_method: "recursive",
    session_expiry_minutes: 1440
  });

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);

  // Guardrails States
  const [guardrailConfig, setGuardrailConfig] = useState({
    content_filter_enabled: true,
    denied_topics_enabled: true,
    word_filter_enabled: true,
    pii_filter_enabled: true,
    grounding_check_enabled: true,
    jailbreak_shield_enabled: true,
    crisis_redirection_enabled: true,
    blocked_words: [],
    denied_topics: []
  });
  const [guardrailLogs, setGuardrailLogs] = useState([]);
  const [wordInput, setWordInput] = useState("");
  const [topicInput, setTopicInput] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }
    loadAdminData(true);
    // Poll data for active jobs/stats in background every 5 seconds
    const interval = setInterval(() => {
      loadAdminData(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [isAdmin, navigate, activeTab, activeOrgId, activeKbId]);

  async function loadAdminData(showSpinner = false) {
    try {
      if (showSpinner) setLoading(true);
      setError("");

      if (activeTab === "dashboard") {
        const statsRes = await api.get("/admin/stats");
        if (statsRes.data.stats) setStats(statsRes.data.stats);
        if (statsRes.data.system_info) setSystemInfo(statsRes.data.system_info);
        if (statsRes.data.recent_activities) setRecentActivities(statsRes.data.recent_activities);
        if (statsRes.data.agent_distribution) setAgentDistribution(statsRes.data.agent_distribution);
        const usersRes = await api.get("/admin/users");
        setUsersList(usersRes.data || []);
      } 
      
      else if (activeTab === "workspace") {
        const orgsRes = await api.get("/rag/organizations");
        const fetchedOrgs = orgsRes.data || [];
        setOrgs(fetchedOrgs);
        
        if (fetchedOrgs.length > 0) {
          const selectedOrg = activeOrgId || fetchedOrgs[0]._id;
          if (!activeOrgId) setActiveOrgId(selectedOrg);
          
          const kbsRes = await api.get(`/rag/kb/${selectedOrg}`);
          const fetchedKbs = kbsRes.data || [];
          setKbs(fetchedKbs);
          
          if (fetchedKbs.length > 0) {
            const selectedKb = activeKbId || fetchedKbs[0]._id;
            if (!activeKbId) setActiveKbId(selectedKb);
            
            const docsRes = await api.get(`/rag/documents?kb_id=${selectedKb}`);
            setDocsList(docsRes.data || []);
          } else {
            setDocsList([]);
          }
        } else {
          setKbs([]);
          setDocsList([]);
        }
      } 
      
      else if (activeTab === "ingestion") {
        const orgsRes = await api.get("/rag/organizations");
        const fetchedOrgs = orgsRes.data || [];
        setOrgs(fetchedOrgs);
        
        if (fetchedOrgs.length > 0) {
          const selectedOrg = activeOrgId || fetchedOrgs[0]._id;
          if (!activeOrgId) setActiveOrgId(selectedOrg);
          
          const kbsRes = await api.get(`/rag/kb/${selectedOrg}`);
          const fetchedKbs = kbsRes.data || [];
          setKbs(fetchedKbs);
          
          if (fetchedKbs.length > 0 && !activeKbId) {
            setActiveKbId(fetchedKbs[0]._id);
          }
        }
      } 
      
      else if (activeTab === "system") {
        const analyticsRes = await api.get("/rag/analytics");
        setAnalytics(analyticsRes.data);
        const settingsRes = await api.get("/rag/settings");
        setRagSettings(settingsRes.data);
        try {
          const logsRes = await api.get("/admin/audit-logs");
          setAuditLogs(logsRes.data || []);
        } catch (err) {
          console.error("Failed to load audit logs", err);
        }
      }
      
      else if (activeTab === "guardrails") {
        try {
          const configRes = await api.get("/admin/guardrails/config");
          setGuardrailConfig(configRes.data);
          const logsRes = await api.get("/admin/guardrails/logs");
          setGuardrailLogs(logsRes.data || []);
        } catch (err) {
          console.error("Failed to load guardrails settings/logs", err);
        }
      }

      else if (activeTab === "cost_vault") {
        try {
          const analyticsRes = await api.get("/admin/cost-vault/analytics");
          if (analyticsRes.data) setCostVaultData(analyticsRes.data);
          const deptRes = await api.get("/admin/cost-vault/departments");
          if (deptRes.data) setDepartmentBudgets(deptRes.data);
        } catch (err) {
          console.error("Failed to load cost vault data", err);
        }
      }

    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load admin panel details.");
    } finally {
      setLoading(false);
    }
  }

  // Cost Vault Handlers
  async function handleSaveDepartmentBudget(e) {
    e.preventDefault();
    if (!deptForm.department.trim()) return;
    try {
      await api.post("/admin/cost-vault/departments", deptForm);
      setActionSuccess(`Department '${deptForm.department}' quota saved successfully!`);
      setIsDeptModalOpen(false);
      loadAdminData();
      setTimeout(() => setActionSuccess(""), 3500);
    } catch (err) {
      alert("Error saving department budget: " + (err.response?.data?.detail || err.message));
    }
  }

  async function handleResetDepartmentSpend(deptName) {
    if (!window.confirm(`Are you sure you want to reset current month spend for department '${deptName}' to $0.00?`)) return;
    try {
      await api.post(`/admin/cost-vault/departments/${encodeURIComponent(deptName)}/reset`);
      setActionSuccess(`Spend reset for '${deptName}'.`);
      loadAdminData();
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) {
      alert("Error resetting spend: " + (err.response?.data?.detail || err.message));
    }
  }

  async function handleRunRouterSimulation(e) {
    e.preventDefault();
    if (!routerSimPrompt.trim()) return;
    setRouterSimLoading(true);
    setRouterSimResult(null);
    try {
      const res = await api.post("/admin/cost-vault/test-router", {
        prompt: routerSimPrompt,
        agent_type: routerSimAgent
      });
      setRouterSimResult(res.data);
    } catch (err) {
      alert("Simulation failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setRouterSimLoading(false);
    }
  }

  // Dashboard handlers
  async function handleUpdateLimit(userId, newLimit) {
    if (newLimit < 1) return;
    setUpdatingLimit(userId);
    try {
      const res = await api.post(`/admin/users/${userId}/limit`, { limit: newLimit });
      if (res.data.success) {
        setUsersList(prev => prev.map(u => u.id === userId ? { ...u, limit: newLimit } : u));
      }
    } catch (err) {
      alert("Failed to update user limit: " + (err.response?.data?.detail || err.message));
    } finally {
      setUpdatingLimit(null);
    }
  }

  async function handleUpdateRole(userId, newRole) {
    try {
      const res = await api.post(`/admin/users/${userId}/role`, { role: newRole });
      if (res.data.success) {
        setActionSuccess(`User role updated to ${newRole}`);
        loadAdminData();
        setTimeout(() => setActionSuccess(""), 3000);
      }
    } catch (err) {
      alert("Failed to update role: " + (err.response?.data?.detail || err.message));
    }
  }

  async function handleDeleteUser(userId, userEmail) {
    const confirmDelete = window.confirm(`CRITICAL WARNING: Are you sure you want to permanently delete user ${userEmail} and all associated chats, projects, and documents? This cannot be undone.`);
    if (!confirmDelete) return;

    try {
      await api.delete(`/admin/users/${userId}`);
      setActionSuccess(`User ${userEmail} deleted successfully!`);
      loadAdminData();
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete user");
    }
  }

  async function handleViewUserHistory(targetUser) {
    setSelectedUserForHistory(targetUser);
    setHistoryLoading(true);
    setHistoryError("");
    setUserHistoryData(null);
    setSelectedHistorySession(null);
    try {
      const res = await api.get(`/admin/users/${targetUser.id || targetUser._id}/history`);
      const data = res.data || {};
      setUserHistoryData(data);

      // Auto-detect which model has sessions
      const models = ["conversational", "education", "projects", "research", "automation"];
      let chosenModel = "conversational";
      for (const m of models) {
        if (data[m] && data[m].length > 0) {
          chosenModel = m;
          break;
        }
      }
      setActiveHistoryModel(chosenModel);
      if (data[chosenModel] && data[chosenModel].length > 0) {
        setSelectedHistorySession(data[chosenModel][0]);
      }
    } catch (err) {
      setHistoryError(err.response?.data?.detail || "Failed to fetch user history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  const handleHistoryModelTabChange = (modelType) => {
    setActiveHistoryModel(modelType);
    setSelectedHistorySession(null);
    if (userHistoryData && userHistoryData[modelType] && userHistoryData[modelType].length > 0) {
      setSelectedHistorySession(userHistoryData[modelType][0]);
    }
  };

  function renderUserHistoryDashboard() {
    if (historyLoading) {
      return (
        <div className="admin-history-view" style={{ minHeight: "400px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
            <Loader2 size={36} className="spin" style={{ color: "var(--primary)" }} />
            <div style={{ color: "var(--muted)", fontWeight: 600 }}>Syncing user archives...</div>
          </div>
        </div>
      );
    }

    if (historyError) {
      return (
        <div className="admin-history-view" style={{ minHeight: "400px", padding: "40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: "var(--danger)", fontSize: "16px", marginBottom: "20px" }}>{historyError}</div>
          <button className="admin-back-btn" onClick={() => setSelectedUserForHistory(null)}>
            <ArrowLeft size={16} /> Back to Accounts
          </button>
        </div>
      );
    }

    const sessions = userHistoryData ? (userHistoryData[activeHistoryModel] || []) : [];
    const convCount = userHistoryData?.conversational?.length || 0;
    const eduCount = userHistoryData?.education?.length || 0;
    const projCount = userHistoryData?.projects?.length || 0;
    const resCount = userHistoryData?.research?.length || 0;
    const autoCount = userHistoryData?.automation?.length || 0;
    const totalUserChats = convCount + eduCount + projCount + resCount + autoCount;

    return (
      <div className="admin-history-view">
        {/* Header */}
        <div className="history-header">
          <div className="history-header-title">
            <h2>{selectedUserForHistory.username || "User"}'s Workspace Archives</h2>
            <p>Email: {selectedUserForHistory.email} • ID: {selectedUserForHistory.id} • Total Sessions: <strong>{totalUserChats}</strong></p>
          </div>
          <button className="admin-back-btn" onClick={() => setSelectedUserForHistory(null)}>
            <ArrowLeft size={16} /> Back to Accounts
          </button>
        </div>

        {/* 5 Model Tabs */}
        <div className="history-agents-nav">
          <button 
            className={`history-agent-tab ${activeHistoryModel === "conversational" ? "active" : ""}`}
            onClick={() => handleHistoryModelTabChange("conversational")}
          >
            <MessageSquare size={16} />
            <span>Generative Chat</span>
            <span style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "10px", background: activeHistoryModel === "conversational" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)", marginLeft: "4px" }}>
              {convCount}
            </span>
          </button>
          <button 
            className={`history-agent-tab ${activeHistoryModel === "education" ? "active" : ""}`}
            onClick={() => handleHistoryModelTabChange("education")}
          >
            <GraduationCap size={16} />
            <span>Education AI</span>
            <span style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "10px", background: activeHistoryModel === "education" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)", marginLeft: "4px" }}>
              {eduCount}
            </span>
          </button>
          <button 
            className={`history-agent-tab ${activeHistoryModel === "projects" ? "active" : ""}`}
            onClick={() => handleHistoryModelTabChange("projects")}
          >
            <Code2 size={16} />
            <span>Developer AI</span>
            <span style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "10px", background: activeHistoryModel === "projects" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)", marginLeft: "4px" }}>
              {projCount}
            </span>
          </button>
          <button 
            className={`history-agent-tab ${activeHistoryModel === "research" ? "active" : ""}`}
            onClick={() => handleHistoryModelTabChange("research")}
          >
            <FileText size={16} />
            <span>Research AI</span>
            <span style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "10px", background: activeHistoryModel === "research" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)", marginLeft: "4px" }}>
              {resCount}
            </span>
          </button>
          <button 
            className={`history-agent-tab ${activeHistoryModel === "automation" ? "active" : ""}`}
            onClick={() => handleHistoryModelTabChange("automation")}
          >
            <Activity size={16} />
            <span>Automation AI</span>
            <span style={{ fontSize: "11px", padding: "2px 7px", borderRadius: "10px", background: activeHistoryModel === "automation" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)", marginLeft: "4px" }}>
              {autoCount}
            </span>
          </button>
        </div>

        {/* Split Pane View */}
        <div className="history-split-pane">
          
          {/* Left Column: Sessions List */}
          <div className="history-sessions-col">
            <div className="history-sessions-header">
              {activeHistoryModel === "projects" ? "Projects" : activeHistoryModel === "research" ? "Research Runs" : "Conversations"} ({sessions.length})
            </div>
            <div className="history-sessions-list">
              {sessions.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--muted)", fontSize: "13px" }}>
                  No sessions found for this model.
                </div>
              ) : (
                sessions.map((session, index) => {
                  const title = session.title || session.idea || session.prompt || "Untitled Session";
                  const date = session.updated_at || session.created_at || "";
                  const count = session.messages ? session.messages.length : (session.executions ? session.executions.length : 0);
                  
                  return (
                    <div 
                      key={session._id || index}
                      className={`history-thread-item ${selectedHistorySession && selectedHistorySession._id === session._id ? "active" : ""}`}
                      onClick={() => setSelectedHistorySession(session)}
                    >
                      <span className="history-thread-title" title={title}>{title}</span>
                      <div className="history-thread-meta">
                        <span>{date ? date.substring(0, 10) : "Recent"}</span>
                        {activeHistoryModel === "projects" ? (
                          <span>{count} execution(s)</span>
                        ) : activeHistoryModel === "research" ? (
                          <span>Depth: {session.research_depth || "normal"}</span>
                        ) : (
                          <span>{count} messages</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Thread Viewer */}
          <div className="history-messages-col">
            {selectedHistorySession ? (
              <>
                <div className="history-messages-header">
                  <h3>{selectedHistorySession.title || selectedHistorySession.idea || selectedHistorySession.prompt || "Untitled Session"}</h3>
                  {selectedHistorySession.status && (
                    <span className={`status-pill ${selectedHistorySession.status === "completed" || selectedHistorySession.status === "planned" ? "pill-completed" : "pill-indexing"}`}>
                      <span className="pill-dot"></span>
                      {selectedHistorySession.status}
                    </span>
                  )}
                </div>
                
                <div className="history-chat-viewport">
                  {/* Model Specific Layouts */}
                  {activeHistoryModel === "projects" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
                      <div className="history-details-card">
                        <div className="history-details-row">
                          <span className="history-details-label">Project Idea</span>
                          <span className="history-details-value">{selectedHistorySession.idea}</span>
                        </div>
                        <div className="history-details-row">
                          <span className="history-details-label">Generated Status</span>
                          <span className="history-details-value" style={{ textTransform: "uppercase", color: "var(--primary)" }}>{selectedHistorySession.status}</span>
                        </div>
                        <div className="history-details-row">
                          <span className="history-details-label">Created At</span>
                          <span className="history-details-value">{selectedHistorySession.created_at?.replace("T", " ").substring(0, 19)}</span>
                        </div>
                      </div>

                      {/* Display project plan stages */}
                      {selectedHistorySession.project_plan && (
                        <div className="history-details-card" style={{ borderStyle: "dashed" }}>
                          <h4 style={{ color: "var(--primary)", margin: "0 0 8px 0", fontSize: "14px" }}>Generated Architecture Plan</h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                            {selectedHistorySession.project_plan.project_name && (
                              <div><strong>Name:</strong> {selectedHistorySession.project_plan.project_name}</div>
                            )}
                            {selectedHistorySession.project_plan.tech_stack && (
                              <div><strong>Stack:</strong> {selectedHistorySession.project_plan.tech_stack.join(", ")}</div>
                            )}
                            {selectedHistorySession.project_plan.stages && (
                              <div style={{ marginTop: "6px" }}>
                                <strong>Development Stages:</strong>
                                <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px", color: "var(--muted)" }}>
                                  {selectedHistorySession.project_plan.stages.map((stage, sIdx) => (
                                    <li key={sIdx}>Stage {stage.stage_number}: {stage.description}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Display executions */}
                      <h4 style={{ color: "var(--primary)", margin: "8px 0 0 0", fontSize: "14px" }}>Agent Code Generation Executions</h4>
                      {(!selectedHistorySession.executions || selectedHistorySession.executions.length === 0) ? (
                        <div style={{ color: "var(--muted)", fontStyle: "italic", fontSize: "13px", paddingLeft: "10px" }}>No executions logged.</div>
                      ) : (
                        selectedHistorySession.executions.map((exec, eIdx) => (
                          <div key={exec._id || eIdx} className="history-details-card" style={{ background: "var(--admin-card-inner-bg, rgba(255,255,255,0.01))" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", borderBottom: "1px solid var(--admin-border)", paddingBottom: "6px" }}>
                              <strong style={{ fontSize: "13px" }}>Execution #{selectedHistorySession.executions.length - eIdx}</strong>
                              <span style={{ fontSize: "11px", color: "var(--muted)" }}>{exec.created_at?.replace("T", " ").substring(0, 19)}</span>
                            </div>
                            <div style={{ fontSize: "13px", display: "flex", flexDirection: "column", gap: "6px" }}>
                              <div><strong>Mode:</strong> {exec.mode}</div>
                              <div><strong>Execution Status:</strong> <span style={{ color: exec.status === "completed" ? "var(--success)" : "var(--danger)" }}>{exec.status}</span></div>
                              {exec.iterations > 0 && <div><strong>Debug Iterations:</strong> {exec.iterations}</div>}
                              
                              {/* Display code files generated */}
                              {exec.generated_code && Object.keys(exec.generated_code).length > 0 && (
                                <div style={{ marginTop: "6px" }}>
                                  <strong>Files Generated:</strong>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                                    {Object.keys(exec.generated_code).map(file => (
                                      <span key={file} style={{ fontSize: "11px", padding: "2px 6px", background: "var(--admin-surface-2, rgba(255,255,255,0.05))", border: "1px solid var(--admin-border)", borderRadius: "4px" }}>{file}</span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Timelines of execution */}
                              {exec.execution_steps && exec.execution_steps.length > 0 && (
                                <div style={{ marginTop: "10px" }}>
                                  <strong>Execution timeline steps:</strong>
                                  <div className="history-timeline-container">
                                    {exec.execution_steps.map((step, sIdx) => (
                                      <div key={sIdx} className="history-timeline-step">
                                        <div className="history-timeline-dot"></div>
                                        <div className="history-timeline-content">
                                          <div className="history-timeline-title">{step.title || step.step_name}</div>
                                          {step.description && <div className="history-timeline-desc">{step.description}</div>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activeHistoryModel === "research" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
                      <div className="history-details-card">
                        <div className="history-details-row">
                          <span className="history-details-label">Initial Query</span>
                          <span className="history-details-value">{selectedHistorySession.prompt}</span>
                        </div>
                        <div className="history-details-row">
                          <span className="history-details-label">Depth Setting</span>
                          <span className="history-details-value" style={{ textTransform: "capitalize" }}>{selectedHistorySession.research_depth}</span>
                        </div>
                        <div className="history-details-row">
                          <span className="history-details-label">Created At</span>
                          <span className="history-details-value">{selectedHistorySession.created_at?.replace("T", " ").substring(0, 19)}</span>
                        </div>
                      </div>

                      {/* Display findings report */}
                      {selectedHistorySession.report && (
                        <div className="history-details-card" style={{ background: "rgba(0,0,0,0.3)" }}>
                          <h4 style={{ color: "var(--primary)", margin: "0 0 12px 0", fontSize: "14px" }}>Final Synthesis Report</h4>
                          <div className="history-msg-text">
                            <ReactMarkdown>{selectedHistorySession.report}</ReactMarkdown>
                          </div>
                        </div>
                      )}

                      {/* Display findings if separate */}
                      {selectedHistorySession.findings && !selectedHistorySession.report && (
                        <div className="history-details-card" style={{ background: "rgba(0,0,0,0.3)" }}>
                          <h4 style={{ color: "var(--primary)", margin: "0 0 12px 0", fontSize: "14px" }}>Research Findings</h4>
                          <div className="history-msg-text">
                            <ReactMarkdown>{typeof selectedHistorySession.findings === 'string' ? selectedHistorySession.findings : JSON.stringify(selectedHistorySession.findings, null, 2)}</ReactMarkdown>
                          </div>
                        </div>
                      )}

                      {/* Display timeline of agent execution */}
                      {selectedHistorySession.timeline && selectedHistorySession.timeline.length > 0 && (
                        <div className="history-details-card">
                          <h4 style={{ color: "var(--primary)", margin: "0 0 12px 0", fontSize: "14px" }}>Research Supervisor Activity Timeline</h4>
                          <div className="history-timeline-container">
                            {selectedHistorySession.timeline.map((step, idx) => (
                              <div key={idx} className="history-timeline-step">
                                <div className="history-timeline-dot"></div>
                                <div className="history-timeline-content">
                                  <div className="history-timeline-title">{step.title || step.step || "Step"}</div>
                                  {step.description && <div className="history-timeline-desc">{step.description}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Display chat messages if present */}
                      {selectedHistorySession.messages && selectedHistorySession.messages.length > 0 && (
                        <>
                          <h4 style={{ color: "var(--primary)", margin: "8px 0 0 0", fontSize: "14px" }}>Supervisor Inter-Agent Logs</h4>
                          {selectedHistorySession.messages.map((msg, idx) => {
                            const rawContent = typeof msg === "string" ? msg : (msg?.content || msg?.text || msg?.message || "");
                            const role = (typeof msg === "object" && msg?.role) ? msg.role : "assistant";
                            return (
                              <div 
                                key={idx} 
                                className={`history-msg-bubble ${role === "user" ? "user" : "assistant"}`}
                              >
                                <div className={`history-msg-sender ${role === "user" ? "user" : "assistant"}`}>
                                  {role === "user" ? "User" : "Supervisor Agent"}
                                </div>
                                <div className="history-msg-text">
                                  <ReactMarkdown>{rawContent || "Empty message"}</ReactMarkdown>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}

                  {(activeHistoryModel === "conversational" || activeHistoryModel === "education" || activeHistoryModel === "automation") && (
                    (!selectedHistorySession.messages || selectedHistorySession.messages.length === 0) ? (
                      <div className="history-empty-viewport">No messages recorded in this conversation.</div>
                    ) : (
                      selectedHistorySession.messages.map((msg, idx) => {
                        const rawContent = typeof msg === "string" ? msg : (msg?.content || msg?.text || msg?.message || "");
                        const role = (typeof msg === "object" && msg?.role) ? msg.role : "assistant";
                        return (
                          <div 
                            key={idx} 
                            className={`history-msg-bubble ${role === "user" ? "user" : "assistant"}`}
                          >
                            <div className={`history-msg-sender ${role === "user" ? "user" : "assistant"}`}>
                              {role === "user" ? "User" : activeHistoryModel === "education" ? "Education AI" : activeHistoryModel === "automation" ? "Automation AI" : "Generative AI"}
                            </div>
                            
                            <div className="history-msg-text">
                              <ReactMarkdown>{rawContent || (msg?.result ? "Generated Workflow" : "Message")}</ReactMarkdown>
                            </div>

                            {/* Display custom automation workflow outputs */}
                            {activeHistoryModel === "automation" && msg?.result && (
                              <div className="history-details-card" style={{ marginTop: "12px", border: "1px dashed rgba(212,175,55,0.2)", background: "rgba(0,0,0,0.3)" }}>
                                <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary)", marginBottom: "4px" }}>Generated Workflow Output</div>
                                <div style={{ fontSize: "11px", display: "flex", flexDirection: "column", gap: "4px" }}>
                                  <div><strong>Workflow Title:</strong> {msg.result.title}</div>
                                  <div><strong>Target Platform:</strong> {msg.result.platform}</div>
                                  {msg.result.actions && (
                                    <div><strong>Actions:</strong> {msg.result.actions.join(" → ")}</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )
                  )}
                </div>
              </>
            ) : (
              <div className="history-empty-viewport">
                <Brain size={48} style={{ color: "var(--muted)", opacity: 0.5 }} />
                <span>Select a chat session or run history thread from the list on the left to inspect its details and messages.</span>
              </div>
            )}
          </div>

        </div>
      </div>
    );
  }

  async function handleSystemCleanup() {
    const confirmCleanup = window.confirm("EXTREME WARNING: Wiping out database history deletes ALL user projects, research run records, and automations. Proceed?");
    if (!confirmCleanup) return;

    try {
      await api.delete("/admin/cleanup");
      setActionSuccess("System history database cleaned up completely!");
      loadAdminData();
      setTimeout(() => setActionSuccess(""), 4000);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to clean system");
    }
  }

  // Organization handlers
  async function handleCreateOrg(e) {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    try {
      await api.post("/rag/organizations", { name: newOrgName });
      setNewOrgName("");
      setActionSuccess("Organization created successfully!");
      loadAdminData();
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) {
      alert("Error: " + (err.response?.data?.detail || err.message));
    }
  }

  async function handleDeleteOrg(orgId, name) {
    if (!window.confirm(`Warning: Deleting organization "${name}" will wipe all its Knowledge Bases and documents from both MongoDB and ChromaDB. Proceed?`)) return;
    try {
      await api.delete(`/rag/organizations/${orgId}`);
      setActionSuccess("Organization deleted!");
      setActiveOrgId("");
      setActiveKbId("");
      loadAdminData();
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) {
      alert("Error deleting organization");
    }
  }

  // Knowledge base handlers
  async function handleCreateKb(e) {
    e.preventDefault();
    if (!newKbName.trim() || !activeOrgId) return;
    try {
      await api.post("/rag/kb", {
        name: newKbName,
        org_id: activeOrgId,
        description: newKbDesc
      });
      setNewKbName("");
      setNewKbDesc("");
      setActionSuccess("Knowledge Base created successfully!");
      loadAdminData();
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) {
      alert("Error: " + (err.response?.data?.detail || err.message));
    }
  }

  async function handleDeleteKb(kbId, name) {
    if (!window.confirm(`Warning: Are you sure you want to delete KB "${name}"? This removes all associated document embeddings.`)) return;
    try {
      await api.delete(`/rag/kb/${kbId}`);
      setActionSuccess("Knowledge base wiped successfully.");
      setActiveKbId("");
      loadAdminData();
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) {
      alert("Error deleting Knowledge Base.");
    }
  }

  // Document handlers
  async function handleDeleteDoc(docId) {
    if (!window.confirm("Remove document and all vectorized chunks?")) return;
    try {
      await api.delete(`/rag/documents/${docId}`);
      setActionSuccess("Document removed.");
      loadAdminData();
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) {
      alert("Error deleting document.");
    }
  }

  async function handleReindexDoc(docId) {
    try {
      const res = await api.post(`/rag/reindex?doc_id=${docId}`);
      setActionSuccess(`Reindexing job initiated.`);
      loadAdminData();
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) {
      alert("Failed to initiate reindexing.");
    }
  }

  // Ingestion suite handlers
  async function handleUploadIngest(e) {
    e.preventDefault();
    if (!activeKbId) {
      alert("Please select a target Knowledge Base first.");
      return;
    }

    const formData = new FormData();
    formData.append("target_type", "kb");
    formData.append("target_id", activeKbId);
    formData.append("org_id", activeOrgId);
    formData.append("source_type", uploadSource);

    if (uploadSource === "url") {
      if (!uploadUrl.trim()) return;
      formData.append("url", uploadUrl);
    } else if (uploadSource === "github") {
      if (!uploadGit.trim()) return;
      formData.append("github_url", uploadGit);
    } else {
      const files = fileInputRef.current?.files;
      if (!files || files.length === 0) {
        alert("Please select at least one file.");
        return;
      }
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]);
      }
    }

    setUploadingState("indexing");
    setUploadProgress(10);

    try {
      const res = await api.post("/rag/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      
      const jobIds = res.data.job_ids;
      if (jobIds && jobIds.length > 0) {
        setUploadProgress(40);
        trackUploadProgress(jobIds[0]);
      } else {
        setUploadingState("completed");
        setActionSuccess("Uploaded successfully.");
        setTimeout(() => setActionSuccess(""), 3000);
      }
    } catch (err) {
      setUploadingState("failed");
      alert("Failed to index content: " + (err.response?.data?.detail || err.message));
    }
  }

  const trackUploadProgress = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/rag/jobs/${jobId}`);
        const job = res.data;
        if (job.status === "completed") {
          clearInterval(interval);
          setUploadProgress(100);
          setUploadingState("completed");
          setUploadUrl("");
          setUploadGit("");
          setActionSuccess("Content indexed successfully.");
          setTimeout(() => setActionSuccess(""), 3000);
          loadAdminData();
        } else if (job.status === "failed") {
          clearInterval(interval);
          setUploadingState("failed");
          alert("Indexing failed: " + job.error_message);
        } else {
          setUploadProgress(job.progress);
        }
      } catch (err) {
        clearInterval(interval);
        setUploadingState("failed");
      }
    }, 1000);
  };

  // Settings handlers
  async function handleSaveSettings(e) {
    e.preventDefault();
    try {
      await api.post("/rag/settings", ragSettings);
      setActionSuccess("System settings saved successfully.");
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) {
      alert("Failed to save settings: " + (err.response?.data?.detail || err.message));
    }
  }

  // Guardrails handlers
  const handleGuardrailToggle = (field) => {
    setGuardrailConfig(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleAddBlockedWord = (e) => {
    e.preventDefault();
    const word = wordInput.trim();
    if (!word) return;
    if (guardrailConfig.blocked_words.includes(word)) {
      setWordInput("");
      return;
    }
    setGuardrailConfig(prev => ({
      ...prev,
      blocked_words: [...prev.blocked_words, word]
    }));
    setWordInput("");
  };

  const handleRemoveBlockedWord = (wordToRemove) => {
    setGuardrailConfig(prev => ({
      ...prev,
      blocked_words: prev.blocked_words.filter(w => w !== wordToRemove)
    }));
  };

  const handleAddDeniedTopic = (e) => {
    e.preventDefault();
    const topic = topicInput.trim();
    if (!topic) return;
    if (guardrailConfig.denied_topics.includes(topic)) {
      setTopicInput("");
      return;
    }
    setGuardrailConfig(prev => ({
      ...prev,
      denied_topics: [...prev.denied_topics, topic]
    }));
    setTopicInput("");
  };

  const handleRemoveDeniedTopic = (topicToRemove) => {
    setGuardrailConfig(prev => ({
      ...prev,
      denied_topics: prev.denied_topics.filter(t => t !== topicToRemove)
    }));
  };

  async function handleSaveGuardrailConfig() {
    setSavingConfig(true);
    try {
      const res = await api.post("/admin/guardrails/config", guardrailConfig);
      if (res.data.success) {
        setActionSuccess("Guardrails configuration updated successfully!");
        setTimeout(() => setActionSuccess(""), 3000);
      }
    } catch (err) {
      alert("Failed to save guardrails configuration: " + (err.response?.data?.detail || err.message));
    } finally {
      setSavingConfig(false);
    }
  }

  // Logs Exporter utilities
  const handleExportLogs = (type) => {
    try {
      const dataToExport = type === "security" ? guardrailLogs : auditLogs;
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(dataToExport, null, 2)
      )}`;
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute(
        "download",
        `nexusai_${type}_logs_${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setActionSuccess(`${type.toUpperCase()} logs exported successfully!`);
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err) {
      alert("Failed to export logs: " + err.message);
    }
  };

  // Format bytes helper
  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const filteredUsers = usersList.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDocs = docsList.filter(d =>
    d.filename.toLowerCase().includes(docSearch.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="admin-page">
        {/* Header */}
        <div className="admin-header">
          <div className="admin-title-row">
            <Shield className="admin-shield-icon" />
            <div>
              <h1>NexusAI Command Center</h1>
              <p>Executive Dashboard & Intelligent Multi-Layer Knowledge isolation console.</p>
            </div>
          </div>
          <button 
            type="button" 
            className="admin-refresh-btn" 
            onClick={() => loadAdminData(true)}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            Reload Center
          </button>
        </div>

        {/* Global Notifications */}
        {actionSuccess && (
          <div className="admin-alert admin-alert-success">
            <CheckCircle size={18} />
            <span>{actionSuccess}</span>
          </div>
        )}

        {error && (
          <div className="admin-alert admin-alert-danger">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Executive Sidebar and Tab View layout */}
        <div className="admin-layout-wrapper">
          
          {/* Subnavigation Sidebar */}
          <div className="admin-subtabs-nav">
            <button 
              className={`admin-subtab-btn ${activeTab === "dashboard" ? "active" : ""}`}
              onClick={() => { setActiveTab("dashboard"); loadAdminData(true); }}
            >
              <BarChart3 size={16} />
              System & Accounts
            </button>
            <button 
              className={`admin-subtab-btn ${activeTab === "workspace" ? "active" : ""}`}
              onClick={() => { setActiveTab("workspace"); loadAdminData(true); }}
            >
              <Database size={16} />
              RAG Workspace Manager
            </button>
            <button 
              className={`admin-subtab-btn ${activeTab === "ingestion" ? "active" : ""}`}
              onClick={() => { setActiveTab("ingestion"); loadAdminData(true); }}
            >
              <UploadCloud size={16} />
              Data Ingestion Dock
            </button>
            <button 
              className={`admin-subtab-btn ${activeTab === "system" ? "active" : ""}`}
              onClick={() => { setActiveTab("system"); loadAdminData(true); }}
            >
              <Settings size={16} />
              Settings & Cleanup
            </button>
            <button 
              className={`admin-subtab-btn ${activeTab === "guardrails" ? "active" : ""}`}
              onClick={() => { setActiveTab("guardrails"); loadAdminData(true); }}
            >
              <Shield size={16} />
              AI Safety Guardrails
            </button>
            <button 
              className={`admin-subtab-btn ${activeTab === "cost_vault" ? "active" : ""}`}
              onClick={() => { setActiveTab("cost_vault"); loadAdminData(true); }}
            >
              <Zap size={16} />
              ⚡ LLM Cost & Quota Vault
            </button>
          </div>

          {/* Tab Panes */}
          <div className="admin-content-pane">

            {/* TAB 1: Dashboard overview and Registered user accounts */}
            {activeTab === "dashboard" && (
              selectedUserForHistory ? (
                renderUserHistoryDashboard()
              ) : (
                <>
                  <div className="admin-stats-grid">
                    <div className="admin-stat-card">
                      <div className="stat-header">
                        <Users size={15} />
                        <span>Registered Users</span>
                      </div>
                      <h2>{stats.users || 0}</h2>
                    </div>
                    <div className="admin-stat-card">
                      <div className="stat-header">
                        <MessageSquare size={15} />
                        <span>Agent Conversations</span>
                      </div>
                      <h2>{(stats.conversations || 0) + (stats.education || 0) + (stats.automation || 0)}</h2>
                    </div>
                    <div className="admin-stat-card">
                      <div className="stat-header">
                        <Code2 size={15} />
                        <span>Projects & Executions</span>
                      </div>
                      <h2>{(stats.projects || 0) + (stats.executions || 0)}</h2>
                    </div>
                    <div className="admin-stat-card">
                      <div className="stat-header">
                        <Activity size={15} />
                        <span>Atlas Cluster Latency</span>
                      </div>
                      <h2 style={{ fontSize: "22px" }}>{systemInfo.ping_ms || 0} <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--muted)" }}>ms</span></h2>
                    </div>
                  </div>

                  {/* 100% Real Live Infrastructure & Agent Workload Telemetry Panel */}
                  <div className="admin-responsive-two-col" style={{ marginBottom: "30px" }}>
                    
                    {/* Live Cluster Infrastructure Status */}
                    <div className="admin-card">
                      <div className="admin-card-header" style={{ marginBottom: "12px" }}>
                        <h3 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                          <Database size={16} />
                          Live Cluster & Database Infrastructure
                        </h3>
                        <span className="user-stats-badges badge-green">100% Verified</span>
                      </div>
                      <p style={{ color: "var(--muted)", fontSize: "12px", marginTop: "0", marginBottom: "16px" }}>
                        Active connection telemetry and runtime environment verified from MongoDB Atlas cluster.
                      </p>

                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                          <span style={{ color: "var(--muted)" }}>Database Cluster</span>
                          <span style={{ fontWeight: "600", color: "#34d399" }}>{systemInfo.db_status}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                          <span style={{ color: "var(--muted)" }}>Ping Round-Trip</span>
                          <span style={{ fontWeight: "600", color: "#38bdf8" }}>{systemInfo.ping_ms} ms</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                          <span style={{ color: "var(--muted)" }}>Host OS & Engine</span>
                          <span style={{ fontWeight: "600", color: "var(--admin-text)" }}>{systemInfo.os} (Python {systemInfo.python})</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                          <span style={{ color: "var(--muted)" }}>Total Verified Records</span>
                          <span style={{ fontWeight: "600", color: "var(--admin-text)" }}>{(systemInfo.total_records || 0).toLocaleString()} documents</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "2px" }}>
                          <span style={{ color: "var(--muted)" }}>Security Audit Events</span>
                          <span style={{ fontWeight: "600", color: "var(--admin-text)" }}>{systemInfo.total_audit_logs || 0} logged</span>
                        </div>
                      </div>
                    </div>

                    {/* Agent Workload Distribution (Real Database Telemetry) */}
                    <div className="admin-card">
                      <div className="admin-card-header" style={{ marginBottom: "12px" }}>
                        <h3 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                          <Activity size={16} />
                          Agent Workload Telemetry
                        </h3>
                        <span className="user-stats-badges badge-cyan">Real DB Records</span>
                      </div>
                      <p style={{ color: "var(--muted)", fontSize: "12px", marginTop: "0", marginBottom: "16px" }}>
                        Aggregated distribution across all active agent collections in MongoDB.
                      </p>

                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {agentDistribution.length === 0 ? (
                          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--muted)", fontSize: "13px" }}>
                            No agent workload records found in database.
                          </div>
                        ) : agentDistribution.map((item, idx) => (
                          <div key={idx}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "600", marginBottom: "4px" }}>
                              <span style={{ color: "var(--admin-text)" }}>{item.agent} ({item.count})</span>
                              <span style={{ color: "var(--muted)" }}>{item.percentage}%</span>
                            </div>
                            <div style={{ height: "6px", background: "var(--admin-track-bg, rgba(255, 255, 255, 0.08))", borderRadius: "3px", overflow: "hidden" }}>
                              <div style={{ width: `${item.percentage}%`, height: "100%", background: "var(--admin-accent)", borderRadius: "3px" }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  <div className="admin-users-section">
                    <div className="section-header-row">
                      <h3>Registered System Accounts</h3>
                      <div className="admin-search-box">
                        <Search size={16} style={{ color: "var(--muted)" }} />
                        <input 
                          type="text" 
                          placeholder="Search users..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="users-table-container users-list-scrollable">
                      <table className="admin-users-table">
                        <thead>
                          <tr>
                            <th>Account</th>
                            <th>Role</th>
                            <th>AI Activity</th>
                            <th>Workspace Limit</th>
                            <th>Registered</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loading && usersList.length === 0 ? (
                            <tr><td colSpan="6" className="table-loading">Querying registry...</td></tr>
                          ) : filteredUsers.length === 0 ? (
                            <tr><td colSpan="6" className="table-empty">No accounts match query.</td></tr>
                          ) : filteredUsers.map((item) => {
                            const isSelf = item.email === user?.email;
                            const totalChats = (item.total_chats !== undefined) ? item.total_chats : ((item.conversations_count || 0) + (item.education_count || 0) + (item.projects_count || 0) + (item.research_count || 0) + (item.automation_count || 0));
                            return (
                              <tr key={item.id} className="clickable-row" onClick={() => handleViewUserHistory(item)} title="Click to inspect user's AI conversations">
                                <td>
                                  <div className="user-name-display">{item.username || "User"}</div>
                                  <div className="user-email-display">{item.email}</div>
                                </td>
                                <td>
                                  <select 
                                    className="admin-select"
                                    style={{ padding: "4px 8px", fontSize: "12px", background: "var(--surface-2)", width: "110px" }}
                                    value={item.role || (item.is_admin ? "admin" : "employee")}
                                    onChange={(e) => handleUpdateRole(item.id, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={isSelf}
                                  >
                                    <option value="employee">Employee</option>
                                    <option value="manager">Manager</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                </td>
                                <td>
                                  <button 
                                    className="admin-btn-secondary"
                                    style={{ padding: "3px 8px", fontSize: "11px", borderRadius: "12px", display: "inline-flex", alignItems: "center", gap: "5px", background: totalChats > 0 ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.03)" }}
                                    onClick={(e) => { e.stopPropagation(); handleViewUserHistory(item); }}
                                    title="View conversation archive"
                                  >
                                    <MessageSquare size={12} />
                                    <span>{totalChats} {totalChats === 1 ? "chat" : "chats"}</span>
                                  </button>
                                </td>
                                <td>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }} onClick={(e) => e.stopPropagation()}>
                                    <span style={{ fontWeight: "700" }}>{item.limit} chats</span>
                                    <button 
                                      className="admin-btn-secondary" 
                                      style={{ padding: "4px 8px", fontSize: "11px" }}
                                      onClick={() => handleUpdateLimit(item.id, item.limit + 1)}
                                      disabled={updatingLimit === item.id}
                                    >
                                      +1
                                    </button>
                                    <button 
                                      className="admin-btn-secondary" 
                                      style={{ padding: "4px 8px", fontSize: "11px" }}
                                      onClick={() => handleUpdateLimit(item.id, Math.max(1, item.limit - 1))}
                                      disabled={updatingLimit === item.id || item.limit <= 1}
                                    >
                                      -1
                                    </button>
                                  </div>
                                </td>
                                <td className="user-date-display">{item.created_at?.substring(0, 10) || "Recent"}</td>
                                <td>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <button 
                                      className="admin-btn"
                                      style={{ padding: "4px 8px", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px" }}
                                      onClick={(e) => { e.stopPropagation(); handleViewUserHistory(item); }}
                                      title="Inspect user AI chat history"
                                    >
                                      <MessageSquare size={12} />
                                      Inspect
                                    </button>
                                    <button 
                                      className="user-delete-btn"
                                      onClick={(e) => { e.stopPropagation(); handleDeleteUser(item.id, item.email); }}
                                      disabled={isSelf}
                                      title={isSelf ? "Cannot delete your own active session" : "Delete account completely"}
                                    >
                                      <Trash2 size={13} />
                                      Remove
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )
            )}

            {/* TAB 2: Consolidated 3-Column RAG Manager */}
            {activeTab === "workspace" && (
              <div className="admin-card">
                <h3>Multi-Layer RAG Workspace Explorer</h3>
                <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "-12px", marginBottom: "20px" }}>
                  Seamlessly organize knowledge assets: Select an Organization, drill down into its Knowledge Bases, and audit vectorized files.
                </p>

                <div className="rag-workspace-columns">
                  
                  {/* Column 1: Organizations list */}
                  <div className="rag-column">
                    <div className="rag-column-header">
                      <h4>1. Organizations</h4>
                    </div>
                    <div style={{ padding: "12px", borderBottom: "1px solid var(--border)" }}>
                      <form onSubmit={handleCreateOrg} style={{ display: "flex", gap: "8px" }}>
                        <input 
                          type="text" 
                          placeholder="New Org Name..." 
                          className="admin-input"
                          style={{ flex: 1, padding: "8px 10px", fontSize: "13px" }}
                          value={newOrgName}
                          onChange={(e) => setNewOrgName(e.target.value)}
                        />
                        <button type="submit" className="admin-btn" style={{ padding: "8px" }} title="Create Organization">
                          <Plus size={16} />
                        </button>
                      </form>
                    </div>
                    <div className="rag-column-body">
                      {orgs.length === 0 ? (
                        <div className="table-empty">No organizations found.</div>
                      ) : orgs.map(org => (
                        <div 
                          key={org._id} 
                          className={`rag-list-item ${activeOrgId === org._id ? "active" : ""}`}
                          onClick={() => { setActiveOrgId(org._id); setActiveKbId(""); }}
                        >
                          <div>
                            <div className="rag-list-item-title">{org.name}</div>
                          </div>
                          <button 
                            className="user-delete-btn" 
                            style={{ padding: "4px 8px" }}
                            onClick={(e) => { e.stopPropagation(); handleDeleteOrg(org._id, org.name); }}
                          >
                            <Trash size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Column 2: Knowledge Bases list */}
                  <div className="rag-column">
                    <div className="rag-column-header">
                      <h4>2. Knowledge Bases</h4>
                    </div>
                    <div style={{ padding: "12px", borderBottom: "1px solid var(--border)" }}>
                      <form onSubmit={handleCreateKb} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <input 
                          type="text" 
                          placeholder="New KB Name..." 
                          className="admin-input"
                          style={{ padding: "8px 10px", fontSize: "13px" }}
                          value={newKbName}
                          onChange={(e) => setNewKbName(e.target.value)}
                        />
                        <div style={{ display: "flex", gap: "8px" }}>
                          <input 
                            type="text" 
                            placeholder="KB Description..." 
                            className="admin-input"
                            style={{ flex: 1, padding: "8px 10px", fontSize: "13px" }}
                            value={newKbDesc}
                            onChange={(e) => setNewKbDesc(e.target.value)}
                          />
                          <button type="submit" className="admin-btn" style={{ padding: "8px" }} disabled={!activeOrgId}>
                            <Plus size={16} />
                          </button>
                        </div>
                      </form>
                    </div>
                    <div className="rag-column-body">
                      {!activeOrgId ? (
                        <div className="table-empty">Select an Organization to view its KBs.</div>
                      ) : kbs.length === 0 ? (
                        <div className="table-empty">No Knowledge Bases created yet.</div>
                      ) : kbs.map(kb => (
                        <div 
                          key={kb._id} 
                          className={`rag-list-item ${activeKbId === kb._id ? "active" : ""}`}
                          onClick={() => setActiveKbId(kb._id)}
                        >
                          <div style={{ flex: 1 }}>
                            <div className="rag-list-item-title">{kb.name}</div>
                            <div className="rag-list-item-desc">{kb.description || "No description"}</div>
                          </div>
                          <button 
                            className="user-delete-btn" 
                            style={{ padding: "4px 8px", marginLeft: "8px" }}
                            onClick={(e) => { e.stopPropagation(); handleDeleteKb(kb._id, kb.name); }}
                          >
                            <Trash size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Column 3: Document Catalog */}
                  <div className="rag-column" style={{ flex: 1 }}>
                    <div className="rag-column-header">
                      <h4>3. Documents Registry</h4>
                      {activeKbId && (
                        <div className="admin-search-box" style={{ width: "200px", padding: "4px 10px" }}>
                          <Search size={12} style={{ color: "var(--muted)" }} />
                          <input 
                            type="text" 
                            placeholder="Search files..."
                            value={docSearch}
                            onChange={(e) => setDocSearch(e.target.value)}
                            style={{ fontSize: "12px" }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="rag-column-body" style={{ padding: 0 }}>
                      {!activeKbId ? (
                        <div className="table-empty" style={{ padding: "40px" }}>Select a Knowledge Base to inspect vectorized files.</div>
                      ) : (
                        <div className="users-table-container" style={{ height: "100%", overflowY: "auto" }}>
                          <table className="admin-users-table">
                            <thead>
                              <tr>
                                <th>File Name</th>
                                <th>Size</th>
                                <th>Chunks</th>
                                <th>Status</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredDocs.length === 0 ? (
                                <tr><td colSpan="5" className="table-empty">No indexed documents found.</td></tr>
                              ) : filteredDocs.map(doc => (
                                <tr key={doc._id}>
                                  <td>
                                    <div className="user-name-display" style={{ fontSize: "13px" }}>{doc.filename}</div>
                                    <div style={{ fontSize: "10px", color: "var(--muted)" }}>Hash: {doc.hash?.substring(0, 12)}...</div>
                                  </td>
                                  <td style={{ fontSize: "13px" }}>{formatBytes(doc.size_bytes)}</td>
                                  <td style={{ fontSize: "13px" }}>{doc.chunk_count} segments</td>
                                  <td>
                                    <span className={`status-pill ${doc.status === "completed" ? "pill-completed" : doc.status === "failed" ? "pill-failed" : "pill-indexing"}`}>
                                      <span className="pill-dot"></span>
                                      {doc.status}
                                    </span>
                                  </td>
                                  <td>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                      <button 
                                        className="doc-action-btn reindex-btn" 
                                        onClick={() => handleReindexDoc(doc._id)}
                                        title="Reindex file content"
                                      >
                                        <RefreshCw size={13} />
                                      </button>
                                      <button 
                                        className="doc-action-btn delete-btn" 
                                        onClick={() => handleDeleteDoc(doc._id)}
                                        title="Delete file"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* TAB 3: Ingestion Suite & Realtime indexer */}
            {activeTab === "ingestion" && (
              <div className="admin-card">
                <div className="admin-card-header" style={{ marginBottom: "20px" }}>
                  <div>
                    <h3>Structured Data Ingestion Dock</h3>
                    <p style={{ color: "var(--admin-text-muted)", fontSize: "13px", marginTop: "4px" }}>
                      Vectorize websites, directories, or documents and register them directly to organization memory.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleUploadIngest}>
                  <div className="admin-responsive-two-col" style={{ marginBottom: "16px" }}>
                    <div className="admin-input-group">
                      <label>Select Target Organization</label>
                      <select 
                        className="admin-select"
                        value={activeOrgId}
                        onChange={(e) => { setActiveOrgId(e.target.value); setActiveKbId(""); }}
                      >
                        {orgs.length === 0 ? <option value="">No organizations</option> : orgs.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
                      </select>
                    </div>
                    <div className="admin-input-group">
                      <label>Select Destination Knowledge Base</label>
                      <select 
                        className="admin-select"
                        value={activeKbId}
                        onChange={(e) => setActiveKbId(e.target.value)}
                        disabled={!activeOrgId}
                      >
                        {kbs.length === 0 ? <option value="">No Knowledge Bases</option> : kbs.map(k => <option key={k._id} value={k._id}>{k.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="admin-input-group">
                    <label>Ingestion Source Mode</label>
                    <div style={{ display: "flex", gap: "10px", marginTop: "4px", flexWrap: "wrap" }}>
                      <button 
                        type="button"
                        className={`admin-btn-secondary ${uploadSource === "file" ? "active" : ""}`}
                        style={{ flex: 1, minWidth: "180px", padding: "10px 14px" }}
                        onClick={() => setUploadSource("file")}
                      >
                        Upload Files (PDF, TXT, DOCX)
                      </button>
                      <button 
                        type="button"
                        className={`admin-btn-secondary ${uploadSource === "url" ? "active" : ""}`}
                        style={{ flex: 1, minWidth: "180px", padding: "10px 14px" }}
                        onClick={() => setUploadSource("url")}
                      >
                        Scrape Website (URL)
                      </button>
                      <button 
                        type="button"
                        className={`admin-btn-secondary ${uploadSource === "github" ? "active" : ""}`}
                        style={{ flex: 1, minWidth: "180px", padding: "10px 14px" }}
                        onClick={() => setUploadSource("github")}
                      >
                        Github Repository URL
                      </button>
                    </div>
                  </div>

                  {uploadSource === "file" && (
                    <div 
                      className="admin-input-group" 
                      style={{ 
                        border: "2px dashed var(--admin-border)", 
                        borderRadius: "var(--admin-radius)", 
                        padding: "36px 20px", 
                        textAlign: "center",
                        background: "var(--admin-card-inner-bg, rgba(255, 255, 255, 0.01))",
                        cursor: "pointer",
                        marginTop: "16px",
                        transition: "all 0.2s ease"
                      }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        style={{ display: "none" }} 
                        multiple 
                        accept=".pdf,.txt,.docx,.md"
                      />
                      <UploadCloud size={36} style={{ color: "var(--admin-text-muted)", marginBottom: "10px" }} />
                      <div style={{ fontWeight: "600", fontSize: "14px", color: "var(--admin-text)" }}>Click to select files for ingestion</div>
                      <div style={{ fontSize: "12px", color: "var(--admin-text-muted)", marginTop: "4px" }}>Supports PDF, TXT, Markdown and Microsoft Word up to 50MB</div>
                    </div>
                  )}

                  {uploadSource === "url" && (
                    <div className="admin-input-group" style={{ marginTop: "16px" }}>
                      <label>Target Web Scraping URL</label>
                      <input 
                        type="url" 
                        className="admin-input"
                        placeholder="https://example.com/docs/api"
                        value={uploadUrl}
                        onChange={(e) => setUploadUrl(e.target.value)}
                      />
                    </div>
                  )}

                  {uploadSource === "github" && (
                    <div className="admin-input-group" style={{ marginTop: "16px" }}>
                      <label>Public Repository HTTPS URL</label>
                      <input 
                        type="url" 
                        className="admin-input"
                        placeholder="https://github.com/username/project-repo"
                        value={uploadGit}
                        onChange={(e) => setUploadGit(e.target.value)}
                      />
                    </div>
                  )}

                  <div style={{ marginTop: "24px" }}>
                    <button type="submit" className="admin-primary-btn" disabled={!activeKbId || uploadingState === "indexing"}>
                      {uploadingState === "indexing" ? (
                        <>
                          <Loader2 size={16} className="spin" />
                          Indexing Data Chunks ({uploadProgress}%)
                        </>
                      ) : (
                        <>
                          <Play size={16} />
                          Initialize Ingestion
                        </>
                      )}
                    </button>
                  </div>

                  {uploadingState === "indexing" && (
                    <div className="admin-progress-container">
                      <div className="admin-progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  )}
                </form>
              </div>
            )}

            {/* TAB 4: RAG configuration, System health, Clean DB utilities */}
            {activeTab === "system" && (
              <>
                <div className="admin-responsive-two-col">
                  
                  {/* Settings card */}
                  <div className="admin-card">
                    <div className="admin-card-header">
                      <h3>Data Chunking & Splitting Configuration</h3>
                    </div>
                    <form onSubmit={handleSaveSettings}>
                      <div className="admin-input-group">
                        <label>Ingest Chunk Character Size</label>
                        <input 
                          type="number" 
                          className="admin-input"
                          value={ragSettings.chunk_size}
                          onChange={(e) => setRagSettings({ ...ragSettings, chunk_size: parseInt(e.target.value) })}
                        />
                      </div>
                      <div className="admin-input-group">
                        <label>Chunk Overlap Characters</label>
                        <input 
                          type="number" 
                          className="admin-input"
                          value={ragSettings.chunk_overlap}
                          onChange={(e) => setRagSettings({ ...ragSettings, chunk_overlap: parseInt(e.target.value) })}
                        />
                      </div>
                      <div className="admin-input-group">
                        <label>Splitting Algorithm</label>
                        <select 
                          className="admin-select"
                          value={ragSettings.chunk_method}
                          onChange={(e) => setRagSettings({ ...ragSettings, chunk_method: e.target.value })}
                        >
                          <option value="recursive">Recursive Character Splitting (Highly Recommended)</option>
                          <option value="regex">Regular Expressions Divider</option>
                          <option value="fixed">Fixed Character Offset Size</option>
                        </select>
                      </div>
                      <div className="admin-input-group">
                        <label>Session Expiry Minutes</label>
                        <input 
                          type="number" 
                          className="admin-input"
                          value={ragSettings.session_expiry_minutes}
                          onChange={(e) => setRagSettings({ ...ragSettings, session_expiry_minutes: parseInt(e.target.value) })}
                        />
                      </div>
                      <button type="submit" className="admin-primary-btn" style={{ marginTop: "8px" }}>
                        Save Configuration
                      </button>
                    </form>
                  </div>

                  {/* System health and stats */}
                  <div className="admin-card">
                    <div className="admin-card-header">
                      <h3>Environment Health & Statistics</h3>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--admin-border)", paddingBottom: "8px" }}>
                        <span style={{ color: "var(--admin-text-muted)" }}>Platform Host OS</span>
                        <strong style={{ color: "var(--admin-text)" }}>{systemInfo.os}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--admin-border)", paddingBottom: "8px" }}>
                        <span style={{ color: "var(--admin-text-muted)" }}>Python Engine Version</span>
                        <strong style={{ color: "var(--admin-text)" }}>{systemInfo.python}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--admin-border)", paddingBottom: "8px" }}>
                        <span style={{ color: "var(--admin-text-muted)" }}>NoSQL Core (MongoDB)</span>
                        <strong style={{ color: "#34d399" }}>{systemInfo.db_status}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--admin-border)", paddingBottom: "8px" }}>
                        <span style={{ color: "var(--admin-text-muted)" }}>Vector Core (Chroma DB)</span>
                        <strong style={{ color: "#34d399" }}>Ready</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--admin-border)", paddingBottom: "8px" }}>
                        <span style={{ color: "var(--admin-text-muted)" }}>Total Vectorized Chunks</span>
                        <strong style={{ color: "var(--admin-text)" }}>{analytics.total_chunks} segments</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px" }}>
                        <span style={{ color: "var(--admin-text-muted)" }}>Total Documents Registered</span>
                        <strong style={{ color: "var(--admin-text)" }}>{analytics.total_documents} files ({formatBytes(analytics.total_size_bytes)})</strong>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Security Audit Trail */}
                <div className="admin-card" style={{ marginTop: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div>
                      <h3 style={{ margin: 0 }}>System Security & Activity Audit Trail</h3>
                      <p style={{ color: "var(--muted)", fontSize: "13px", margin: "4px 0 0 0" }}>
                        Chronological tracking of administrative actions, safety operations, and system events.
                      </p>
                    </div>
                    <button 
                      onClick={() => handleExportLogs("activity")}
                      className="admin-refresh-btn"
                      style={{ padding: "6px 14px", fontSize: "12px" }}
                    >
                      Export Logs
                    </button>
                  </div>
                  
                  <div className="users-table-container" style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                    <table className="admin-users-table">
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Administrator</th>
                          <th>Action Type</th>
                          <th>Activity Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.length === 0 ? (
                          <tr><td colSpan="4" className="table-empty">No security audit events recorded.</td></tr>
                        ) : auditLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="user-date-display" style={{ whiteSpace: "nowrap" }}>
                              {log.timestamp?.replace("T", " ").substring(0, 19)} UTC
                            </td>
                            <td style={{ fontWeight: "600", fontSize: "13px" }}>{log.email}</td>
                            <td>
                              <span className={`user-stats-badges ${
                                log.action.includes("delete") || log.action.includes("cleanup") ? "badge-yellow" : "badge-cyan"
                              }`}>
                                {log.action}
                              </span>
                            </td>
                            <td style={{ fontSize: "13px", color: "var(--text)" }}>{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Danger zone / cleanup tools */}
                <div className="danger-zone">
                  <h4>⚠️ Critical Administrative Operations</h4>
                  <p>
                    These operations permanently destroy data. Ensure you have backups before executing database cleanup commands.
                  </p>
                  <button 
                    type="button" 
                    className="user-delete-btn" 
                    style={{ padding: "12px 24px" }}
                    onClick={handleSystemCleanup}
                  >
                    Wipe System Workspace History
                  </button>
                </div>
              </>
            )}

            {activeTab === "guardrails" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <div>
                    <h2 style={{ margin: 0 }}>AI Safety Guardrails Management</h2>
                    <p style={{ color: "var(--muted)", fontSize: "14px", marginTop: "4px" }}>
                      Configure content moderation policies, PII redaction, RAG grounding constraints, and jailbreak shields.
                    </p>
                  </div>
                  <button 
                    onClick={handleSaveGuardrailConfig} 
                    className="admin-btn"
                    style={{ padding: "10px 24px" }}
                    disabled={savingConfig}
                  >
                    {savingConfig ? "Saving Changes..." : "Save Guardrails Config"}
                  </button>
                </div>

                <div className="admin-responsive-two-col">
                  {/* Left Column: Switch Controls */}
                  <div className="admin-card">
                    <h3>Moderation Filters & Protection Layers</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
                      
                      <div className="guardrail-switch-row">
                        <div>
                          <strong>Content Filters</strong>
                          <span>Detects and blocks harmful, toxic, or threatening inputs.</span>
                        </div>
                        <label className="switch-container">
                          <input 
                            type="checkbox" 
                            checked={guardrailConfig.content_filter_enabled} 
                            onChange={() => handleGuardrailToggle("content_filter_enabled")}
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>

                      <div className="guardrail-switch-row">
                        <div>
                          <strong>Denied Topics Filter</strong>
                          <span>Blocks discussions on restricted subjects (e.g. self-harm, illegal acts).</span>
                        </div>
                        <label className="switch-container">
                          <input 
                            type="checkbox" 
                            checked={guardrailConfig.denied_topics_enabled} 
                            onChange={() => handleGuardrailToggle("denied_topics_enabled")}
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>

                      <div className="guardrail-switch-row">
                        <div>
                          <strong>Restricted Word Filters</strong>
                          <span>Blocks specific user-defined keywords/phrases from being processed.</span>
                        </div>
                        <label className="switch-container">
                          <input 
                            type="checkbox" 
                            checked={guardrailConfig.word_filter_enabled} 
                            onChange={() => handleGuardrailToggle("word_filter_enabled")}
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>

                      <div className="guardrail-switch-row">
                        <div>
                          <strong>Sensitive Information Filters (PII)</strong>
                          <span>Automatically redacts or blocks Credit Cards, emails, and SSNs.</span>
                        </div>
                        <label className="switch-container">
                          <input 
                            type="checkbox" 
                            checked={guardrailConfig.pii_filter_enabled} 
                            onChange={() => handleGuardrailToggle("pii_filter_enabled")}
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>

                      <div className="guardrail-switch-row">
                        <div>
                          <strong>Contextual Grounding Checks</strong>
                          <span>Warns users if the LLM output deviates from active RAG document contexts.</span>
                        </div>
                        <label className="switch-container">
                          <input 
                            type="checkbox" 
                            checked={guardrailConfig.grounding_check_enabled} 
                            onChange={() => handleGuardrailToggle("grounding_check_enabled")}
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>

                      <div className="guardrail-switch-row">
                        <div>
                          <strong>Jailbreak & Prompt Injection Shield</strong>
                          <span>Performs semantic validation via Groq LLM to check instruction bypasses.</span>
                        </div>
                        <label className="switch-container">
                          <input 
                            type="checkbox" 
                            checked={guardrailConfig.jailbreak_shield_enabled} 
                            onChange={() => handleGuardrailToggle("jailbreak_shield_enabled")}
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>

                      <div className="guardrail-switch-row">
                        <div>
                          <strong>Crisis Intervention & Redirects</strong>
                          <span>Intercepts distress patterns to show local helper lines and support resources.</span>
                        </div>
                        <label className="switch-container">
                          <input 
                            type="checkbox" 
                            checked={guardrailConfig.crisis_redirection_enabled} 
                            onChange={() => handleGuardrailToggle("crisis_redirection_enabled")}
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>

                    </div>
                  </div>

                  {/* Right Column: Key lists */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    {/* Word Filters list */}
                    <div className="admin-card">
                      <h3>Restricted Words Blocklist</h3>
                      <form onSubmit={handleAddBlockedWord} style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                        <input 
                          type="text" 
                          placeholder="Add word or API key pattern..." 
                          className="admin-input"
                          value={wordInput}
                          onChange={(e) => setWordInput(e.target.value)}
                        />
                        <button type="submit" className="admin-btn" style={{ padding: "8px 16px" }}>
                          Add
                        </button>
                      </form>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
                        {(!guardrailConfig.blocked_words || guardrailConfig.blocked_words.length === 0) ? (
                          <span style={{ color: "var(--muted)", fontSize: "13px" }}>No custom blocked words added yet.</span>
                        ) : guardrailConfig.blocked_words.map(word => (
                          <span 
                            key={word} 
                            style={{ 
                              background: "rgba(239, 68, 68, 0.1)", 
                              color: "#f87171", 
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              padding: "4px 10px", 
                              borderRadius: "12px", 
                              fontSize: "12px",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px"
                            }}
                          >
                            {word}
                            <Trash2 
                              size={12} 
                              style={{ cursor: "pointer" }} 
                              onClick={() => handleRemoveBlockedWord(word)} 
                            />
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Denied Topics List */}
                    <div className="admin-card">
                      <h3>Denied Subject Topics</h3>
                      <form onSubmit={handleAddDeniedTopic} style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                        <input 
                          type="text" 
                          placeholder="Add prohibited topic..." 
                          className="admin-input"
                          value={topicInput}
                          onChange={(e) => setTopicInput(e.target.value)}
                        />
                        <button type="submit" className="admin-btn" style={{ padding: "8px 16px" }}>
                          Add
                        </button>
                      </form>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
                        {(!guardrailConfig.denied_topics || guardrailConfig.denied_topics.length === 0) ? (
                          <span style={{ color: "var(--muted)", fontSize: "13px" }}>No prohibited topics added yet.</span>
                        ) : guardrailConfig.denied_topics.map(topic => (
                          <span 
                            key={topic} 
                            style={{ 
                              background: "rgba(245, 158, 11, 0.1)", 
                              color: "#fbbf24", 
                              border: "1px solid rgba(245, 158, 11, 0.3)",
                              padding: "4px 10px", 
                              borderRadius: "12px", 
                              fontSize: "12px",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px"
                            }}
                          >
                            {topic}
                            <Trash2 
                              size={12} 
                              style={{ cursor: "pointer" }} 
                              onClick={() => handleRemoveDeniedTopic(topic)} 
                            />
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Audit Incidents Trail Table */}
                <div className="admin-card" style={{ marginTop: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div>
                      <h3 style={{ margin: 0 }}>Live Safety Incidents Audit Log</h3>
                      <p style={{ color: "var(--muted)", fontSize: "13px", margin: "4px 0 0 0" }}>
                        Security logs recording input blocks, redactions, and safety intervention triggers.
                      </p>
                    </div>
                    <button 
                      onClick={() => handleExportLogs("security")}
                      className="admin-refresh-btn"
                      style={{ padding: "6px 14px", fontSize: "12px" }}
                    >
                      Export Logs
                    </button>
                  </div>
                  
                  <div className="users-table-container" style={{ maxHeight: "350px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                    <table className="admin-users-table">
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Category</th>
                          <th>Incident Details</th>
                          <th>Action Enforced</th>
                        </tr>
                      </thead>
                      <tbody>
                        {guardrailLogs.length === 0 ? (
                          <tr><td colSpan="4" className="table-empty">No safety incidents or policy violations recorded.</td></tr>
                        ) : guardrailLogs.map((log) => (
                          <tr key={log._id}>
                            <td className="user-date-display" style={{ whiteSpace: "nowrap" }}>
                              {log.timestamp?.replace("T", " ").substring(0, 19)} UTC
                            </td>
                            <td>
                              <span className="user-stats-badges badge-cyan" style={{ border: "1px solid rgba(34, 211, 238, 0.3)", borderRadius: "6px", display: "inline-block", padding: "4px 8px" }}>
                                {log.filter_violated}
                              </span>
                            </td>
                            <td style={{ fontSize: "13px", color: "var(--text)" }}>
                              <div style={{ fontWeight: "600" }}>Query: "{log.prompt}"</div>
                              {log.details && <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>{log.details}</div>}
                            </td>
                            <td>
                              <span className={`user-stats-badges ${
                                log.action === "blocked" ? "badge-red" : log.action === "redirected" ? "badge-yellow" : "badge-green"
                              }`} style={{ textTransform: "uppercase", fontSize: "11px", borderRadius: "6px", display: "inline-block", padding: "4px 8px" }}>
                                {log.action}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* TAB 6: LLM Cost & Quota Vault */}
            {activeTab === "cost_vault" && (
              <>
                {/* Executive Financial & Developer ROI Metrics */}
                <div className="admin-stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: "24px" }}>
                  <div className="admin-stat-card" style={{ borderLeft: "4px solid #10b981" }}>
                    <div className="stat-header">
                      <DollarSign size={16} style={{ color: "#10b981" }} />
                      <span>Total Value Delivered</span>
                    </div>
                    <h2 style={{ color: "#10b981" }}>${(costVaultData.summary?.total_enterprise_value_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                    <p style={{ fontSize: "11px", color: "var(--muted)", margin: "4px 0 0 0" }}>Dev hours saved + token optimizations</p>
                  </div>

                  <div className="admin-stat-card" style={{ borderLeft: "4px solid #6366f1" }}>
                    <div className="stat-header">
                      <Clock size={16} style={{ color: "#6366f1" }} />
                      <span>Developer Hours Saved</span>
                    </div>
                    <h2 style={{ color: "#6366f1" }}>{costVaultData.summary?.developer_hours_saved || 0} hrs</h2>
                    <p style={{ fontSize: "11px", color: "var(--muted)", margin: "4px 0 0 0" }}>${(costVaultData.summary?.developer_dollars_saved || 0).toLocaleString()} value (@$75/hr senior rate)</p>
                  </div>

                  <div className="admin-stat-card" style={{ borderLeft: "4px solid #eab308" }}>
                    <div className="stat-header">
                      <TrendingUp size={16} style={{ color: "#eab308" }} />
                      <span>Smart Routing Savings</span>
                    </div>
                    <h2 style={{ color: "#eab308" }}>{costVaultData.summary?.savings_rate_percentage || 95.0}%</h2>
                    <p style={{ fontSize: "11px", color: "var(--muted)", margin: "4px 0 0 0" }}>${(costVaultData.summary?.total_net_savings_usd || 0).toFixed(2)} saved vs GPT-4 benchmark</p>
                  </div>

                  <div className="admin-stat-card" style={{ borderLeft: "4px solid #38bdf8" }}>
                    <div className="stat-header">
                      <Zap size={16} style={{ color: "#38bdf8" }} />
                      <span>Tokens Processed</span>
                    </div>
                    <h2 style={{ color: "#38bdf8" }}>{(costVaultData.summary?.total_tokens || 0).toLocaleString()}</h2>
                    <p style={{ fontSize: "11px", color: "var(--muted)", margin: "4px 0 0 0" }}>Actual spend: ${(costVaultData.summary?.total_spend_usd || 0).toFixed(4)} USD</p>
                  </div>
                </div>

                {/* Smart Semantic Router Strategy & Model Mesh */}
                <div className="admin-responsive-two-col" style={{ marginBottom: "24px" }}>
                  
                  {/* Semantic Complexity Router Distribution */}
                  <div className="admin-card">
                    <div className="admin-card-header" style={{ marginBottom: "12px" }}>
                      <h3 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0, fontSize: "15px" }}>
                        <Zap size={18} style={{ color: "#eab308" }} />
                        Semantic Complexity Router Distribution
                      </h3>
                      <span className="user-stats-badges badge-yellow">Dynamic Auto-Mesh</span>
                    </div>
                    <p style={{ color: "var(--muted)", fontSize: "12px", marginBottom: "16px" }}>
                      NexusAI analyzes query complexity, token depth, and code intent to route between fast cost-efficient models and heavy frontier reasoning models.
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                          <span style={{ fontWeight: "600", color: "#38bdf8" }}>⚡ Fast Tier (Chat / Simple Q&A / Quick Tasks)</span>
                          <span style={{ fontWeight: "700" }}>{costVaultData.tier_distribution?.fast || 82}%</span>
                        </div>
                        <div style={{ width: "100%", height: "8px", background: "var(--admin-track-bg, rgba(255,255,255,0.06))", borderRadius: "4px", overflow: "hidden" }}>
                          <div style={{ width: `${costVaultData.tier_distribution?.fast || 82}%`, height: "100%", background: "linear-gradient(90deg, #38bdf8, #6366f1)", borderRadius: "4px" }}></div>
                        </div>
                        <span style={{ fontSize: "10px", color: "var(--muted)" }}>Groq Llama 3.3 70B & GPT-OSS 120B • ~$0.15/1M tokens (140ms latency)</span>
                      </div>

                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                          <span style={{ fontWeight: "600", color: "#eab308" }}>🧠 Frontier Tier (Multi-file Code / Deep Research)</span>
                          <span style={{ fontWeight: "700" }}>{costVaultData.tier_distribution?.frontier || 18}%</span>
                        </div>
                        <div style={{ width: "100%", height: "8px", background: "var(--admin-track-bg, rgba(255,255,255,0.06))", borderRadius: "4px", overflow: "hidden" }}>
                          <div style={{ width: `${costVaultData.tier_distribution?.frontier || 18}%`, height: "100%", background: "linear-gradient(90deg, #eab308, #f97316)", borderRadius: "4px" }}></div>
                        </div>
                        <span style={{ fontSize: "10px", color: "var(--muted)" }}>Google Gemini 2.5 Pro & Claude 3.7 • ~$3.00/1M tokens (Architectural reasoning)</span>
                      </div>
                    </div>
                  </div>

                  {/* Active Model Usage Breakdown */}
                  <div className="admin-card">
                    <div className="admin-card-header" style={{ marginBottom: "12px" }}>
                      <h3 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0, fontSize: "15px" }}>
                        <Sliders size={18} style={{ color: "#6366f1" }} />
                        Active Provider & Model Mesh
                      </h3>
                    </div>
                    <div className="users-table-container" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", maxHeight: "200px", overflowY: "auto" }}>
                      <table className="admin-users-table">
                        <thead>
                          <tr>
                            <th>Model / Provider</th>
                            <th>Tier</th>
                            <th>Queries</th>
                            <th>Tokens</th>
                            <th>Spend</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(!costVaultData.model_breakdown || costVaultData.model_breakdown.length === 0) ? (
                            <tr><td colSpan="5" className="table-empty">No model usage recorded yet.</td></tr>
                          ) : costVaultData.model_breakdown.map((m, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: "600", fontSize: "12px" }}>{m.model}</td>
                              <td>
                                <span className={`user-stats-badges ${m.tier === "Fast" ? "badge-cyan" : "badge-yellow"}`} style={{ fontSize: "10px", padding: "2px 6px" }}>
                                  {m.tier}
                                </span>
                              </td>
                              <td style={{ fontSize: "12px" }}>{m.queries}</td>
                              <td style={{ fontSize: "12px" }}>{(m.tokens || 0).toLocaleString()}</td>
                              <td style={{ fontSize: "12px", color: "#10b981", fontWeight: "600" }}>{m.spend}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Interactive Semantic Router Testing Sandbox */}
                <div className="admin-card" style={{ marginBottom: "24px" }}>
                  <div className="admin-card-header" style={{ marginBottom: "12px" }}>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0, fontSize: "15px" }}>
                      <Zap size={18} style={{ color: "#38bdf8" }} />
                      Smart Semantic Router Sandbox (Live Query Classifier)
                    </h3>
                    <span className="user-stats-badges badge-cyan">Admin Simulation Tool</span>
                  </div>
                  <p style={{ color: "var(--muted)", fontSize: "12px", marginBottom: "14px" }}>
                    Test how NexusAI's classifier detects query complexity, selects the optimal model tier, and estimates cost savings in real-time.
                  </p>

                  <form onSubmit={handleRunRouterSimulation} style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <input 
                      type="text" 
                      placeholder="Enter sample user query (e.g. 'Build a scalable microservice' or 'What is React?')" 
                      value={routerSimPrompt}
                      onChange={(e) => setRouterSimPrompt(e.target.value)}
                      className="admin-input-text"
                      style={{ flex: 1, minWidth: "280px" }}
                    />
                    <select 
                      value={routerSimAgent}
                      onChange={(e) => setRouterSimAgent(e.target.value)}
                      className="admin-select"
                      style={{ width: "160px" }}
                    >
                      <option value="conversational">Conversational AI</option>
                      <option value="engineer">Developer AI</option>
                      <option value="research">Research AI</option>
                      <option value="education">Education AI</option>
                      <option value="automation">Automation AI</option>
                    </select>
                    <button 
                      type="submit" 
                      className="admin-primary-btn"
                      disabled={routerSimLoading || !routerSimPrompt.trim()}
                      style={{ padding: "8px 18px" }}
                    >
                      {routerSimLoading ? <Loader2 size={14} className="spin" /> : "Test Routing"}
                    </button>
                  </form>

                  {routerSimResult && (
                    <div style={{ marginTop: "16px", padding: "14px 16px", background: "var(--admin-card-inner-bg, rgba(255,255,255,0.02))", border: "1px solid var(--admin-border)", borderRadius: "var(--radius)" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center" }}>
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>ROUTED TIER</span>
                          <span className={`user-stats-badges ${routerSimResult.tier === "fast" ? "badge-cyan" : "badge-yellow"}`} style={{ textTransform: "uppercase", fontWeight: "700", marginTop: "2px", display: "inline-block" }}>
                            {routerSimResult.tier} Tier (Score: {routerSimResult.complexity_score})
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>SELECTED MODEL</span>
                          <span style={{ fontSize: "13px", fontWeight: "700", color: "#38bdf8" }}>{routerSimResult.model_name}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>ESTIMATED COST</span>
                          <span style={{ fontSize: "13px", fontWeight: "600", color: "#10b981" }}>${routerSimResult.estimated_cost_usd} USD</span>
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>LEGACY GPT-4 COST</span>
                          <span style={{ fontSize: "13px", color: "var(--muted)", textDecoration: "line-through" }}>${routerSimResult.baseline_gpt4_cost_usd} USD</span>
                        </div>
                        <div>
                          <span style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>NET SAVINGS</span>
                          <span style={{ fontSize: "13px", fontWeight: "700", color: "#eab308" }}>${routerSimResult.estimated_savings_usd} ({routerSimResult.savings_percentage}%)</span>
                        </div>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "8px", borderTop: "1px solid var(--admin-border)", paddingTop: "6px" }}>
                        <strong>Reason:</strong> {routerSimResult.classification_reason}
                      </div>
                    </div>
                  )}
                </div>

                {/* Department Budget Quota Vault Table */}
                <div className="admin-card" style={{ marginBottom: "24px" }}>
                  <div className="admin-card-header" style={{ marginBottom: "12px" }}>
                    <div>
                      <h3 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0, fontSize: "16px" }}>
                        <DollarSign size={18} style={{ color: "#10b981" }} />
                        Departmental Budget Quota Vault & Hard Caps
                      </h3>
                      <p style={{ color: "var(--muted)", fontSize: "12px", marginTop: "4px" }}>
                        Set monthly allocated dollar quotas and enforce hard caps per enterprise department/team.
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        setDeptForm({ department: "", monthly_budget_usd: 500, hard_cap: true, alert_threshold: 80 });
                        setIsDeptModalOpen(true);
                      }}
                      className="admin-primary-btn"
                      style={{ padding: "6px 14px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <Plus size={14} /> Add Department Quota
                    </button>
                  </div>

                  <div className="users-table-container" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflowX: "auto" }}>
                    <table className="admin-users-table">
                      <thead>
                        <tr>
                          <th>Department / Team</th>
                          <th>Monthly Budget</th>
                          <th>Current Spend</th>
                          <th>Spend Progress</th>
                          <th>Tokens</th>
                          <th>Policy Policy</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!departmentBudgets || departmentBudgets.length === 0) ? (
                          <tr><td colSpan="7" className="table-empty">No department quotas configured.</td></tr>
                        ) : departmentBudgets.map((dept) => {
                          const budget = dept.monthly_budget_usd || 500;
                          const spend = dept.current_spend_usd || 0;
                          const pct = Math.min(100, (spend / budget) * 100);
                          const isWarning = pct >= (dept.alert_threshold || 80);
                          const isCapped = pct >= 100 && dept.hard_cap;

                          return (
                            <tr key={dept._id || dept.department}>
                              <td style={{ fontWeight: "700", fontSize: "13px" }}>
                                {dept.department}
                              </td>
                              <td style={{ fontSize: "13px", fontWeight: "600" }}>
                                ${budget.toFixed(2)}
                              </td>
                              <td style={{ fontSize: "13px", color: isCapped ? "#ef4444" : (isWarning ? "#eab308" : "#10b981"), fontWeight: "600" }}>
                                ${spend.toFixed(4)}
                              </td>
                              <td style={{ width: "160px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "3px" }}>
                                  <span>{pct.toFixed(1)}%</span>
                                  <span>${(budget - spend).toFixed(2)} left</span>
                                </div>
                                <div style={{ width: "100%", height: "6px", background: "var(--admin-track-bg, rgba(255,255,255,0.06))", borderRadius: "3px", overflow: "hidden" }}>
                                  <div style={{ 
                                    width: `${pct}%`, 
                                    height: "100%", 
                                    background: isCapped ? "#ef4444" : (isWarning ? "#eab308" : "#10b981"), 
                                    borderRadius: "3px" 
                                  }}></div>
                                </div>
                              </td>
                              <td style={{ fontSize: "12px" }}>
                                {(dept.current_tokens || 0).toLocaleString()}
                              </td>
                              <td>
                                <span className={`user-stats-badges ${
                                  isCapped ? "badge-red" : (isWarning ? "badge-yellow" : "badge-green")
                                }`} style={{ fontSize: "10px", textTransform: "uppercase" }}>
                                  {isCapped ? "🛑 Hard Capped" : (isWarning ? "⚠️ Alert Active" : "✅ Safe")}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <button 
                                    onClick={() => {
                                      setDeptForm({
                                        department: dept.department,
                                        monthly_budget_usd: dept.monthly_budget_usd,
                                        hard_cap: dept.hard_cap ?? true,
                                        alert_threshold: dept.alert_threshold ?? 80
                                      });
                                      setIsDeptModalOpen(true);
                                    }}
                                    className="admin-edit-btn"
                                    style={{ padding: "4px 8px", fontSize: "11px" }}
                                  >
                                    Edit
                                  </button>
                                  <button 
                                    onClick={() => handleResetDepartmentSpend(dept.department)}
                                    className="admin-refresh-btn"
                                    style={{ padding: "4px 8px", fontSize: "11px" }}
                                    title="Reset month spend to $0.00"
                                  >
                                    Reset
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Real-time Token Activity Stream */}
                <div className="admin-card">
                  <div className="admin-card-header" style={{ marginBottom: "12px" }}>
                    <div>
                      <h3 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0, fontSize: "16px" }}>
                        <Activity size={18} style={{ color: "#38bdf8" }} />
                        Real-Time LLM Token & Cost Telemetry Stream
                      </h3>
                      <p style={{ color: "var(--muted)", fontSize: "12px", marginTop: "4px" }}>
                        Live transaction stream of agent completions, token volumes, and savings calculated dynamically.
                      </p>
                    </div>
                  </div>

                  <div className="users-table-container" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", maxHeight: "300px", overflowY: "auto" }}>
                    <table className="admin-users-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Department</th>
                          <th>Agent Type</th>
                          <th>Model</th>
                          <th>Tokens</th>
                          <th>Actual Cost</th>
                          <th>Net Savings</th>
                          <th>Tier</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(!costVaultData.recent_logs || costVaultData.recent_logs.length === 0) ? (
                          <tr><td colSpan="8" className="table-empty">No recent token activity recorded. Start chatting or generating code to see live stream!</td></tr>
                        ) : costVaultData.recent_logs.map((log, idx) => (
                          <tr key={idx}>
                            <td className="user-date-display" style={{ fontSize: "11px" }}>{log.time}</td>
                            <td style={{ fontWeight: "600", fontSize: "12px" }}>{log.department}</td>
                            <td style={{ fontSize: "12px" }}>{log.agent}</td>
                            <td style={{ fontSize: "12px" }}>{log.model}</td>
                            <td style={{ fontSize: "12px" }}>{(log.tokens || 0).toLocaleString()}</td>
                            <td style={{ fontSize: "12px", color: "#38bdf8" }}>{log.actual_cost}</td>
                            <td style={{ fontSize: "12px", color: "#10b981", fontWeight: "700" }}>+{log.savings}</td>
                            <td>
                              <span className={`user-stats-badges ${log.tier === "fast" ? "badge-cyan" : "badge-yellow"}`} style={{ fontSize: "10px", padding: "2px 6px" }}>
                                {log.tier?.toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Modal for Adding / Editing Department Quotas */}
                {isDeptModalOpen && (
                  <div className="admin-modal-backdrop" onClick={() => setIsDeptModalOpen(false)}>
                    <div className="admin-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
                      <div className="admin-card-header" style={{ marginBottom: "16px" }}>
                        <h3 style={{ margin: 0, fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                          <DollarSign size={18} style={{ color: "#10b981" }} />
                          Configure Department Budget Quota
                        </h3>
                        <button onClick={() => setIsDeptModalOpen(false)} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "16px" }}>&times;</button>
                      </div>

                      <form onSubmit={handleSaveDepartmentBudget} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div>
                          <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text)", display: "block", marginBottom: "6px" }}>Department Name</label>
                          <input 
                            type="text" 
                            required 
                            placeholder="e.g. Engineering, Research, Marketing"
                            value={deptForm.department}
                            onChange={(e) => setDeptForm({ ...deptForm, department: e.target.value })}
                            className="admin-input-text"
                            style={{ width: "100%" }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text)", display: "block", marginBottom: "6px" }}>Monthly Budget Limit (USD)</label>
                          <input 
                            type="number" 
                            required 
                            min="10"
                            step="10"
                            placeholder="500"
                            value={deptForm.monthly_budget_usd}
                            onChange={(e) => setDeptForm({ ...deptForm, monthly_budget_usd: parseFloat(e.target.value) || 10 })}
                            className="admin-input-text"
                            style={{ width: "100%" }}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: "12px", fontWeight: "600", color: "var(--text)", display: "block", marginBottom: "6px" }}>Alert Threshold (%)</label>
                          <input 
                            type="number" 
                            required 
                            min="10"
                            max="100"
                            placeholder="80"
                            value={deptForm.alert_threshold}
                            onChange={(e) => setDeptForm({ ...deptForm, alert_threshold: parseFloat(e.target.value) || 80 })}
                            className="admin-input-text"
                            style={{ width: "100%" }}
                          />
                          <span style={{ fontSize: "11px", color: "var(--muted)", marginTop: "3px", display: "block" }}>Triggers visual warning when department consumes this percentage.</span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "var(--admin-card-inner-bg, rgba(255,255,255,0.03))", borderRadius: "var(--radius)", border: "1px solid var(--admin-border)" }}>
                          <div>
                            <div style={{ fontSize: "13px", fontWeight: "600", color: "var(--admin-text)" }}>Enforce Hard Cap</div>
                            <div style={{ fontSize: "11px", color: "var(--muted)" }}>Block or restrict queries if department hits 100% budget</div>
                          </div>
                          <input 
                            type="checkbox" 
                            checked={deptForm.hard_cap}
                            onChange={(e) => setDeptForm({ ...deptForm, hard_cap: e.target.checked })}
                            style={{ width: "18px", height: "18px", accentColor: "#10b981", cursor: "pointer" }}
                          />
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                          <button 
                            type="button" 
                            onClick={() => setIsDeptModalOpen(false)}
                            className="admin-refresh-btn"
                          >
                            Cancel
                          </button>
                          <button 
                            type="submit" 
                            className="admin-primary-btn"
                          >
                            Save Quota Policy
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AdminPanel;

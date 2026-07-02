import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  Users, Shield, MessageSquare, Code2, Search, Trash2, CheckCircle, 
  GraduationCap, Play, RefreshCw, AlertTriangle, Building, Database, 
  FileText, UploadCloud, BarChart3, Settings, Plus, Loader2, Link, 
  Trash, ExternalLink, Activity
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import "./AdminPanel.css";

function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Admin access validation
  const ADMIN_EMAILS = ["ydvhimanshu461@gmail.com", "admin.neuroforge@gmail.com", "admin@neuroforge.com", "admin@devpilot.ai"];
  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  // URL-bound Tab State
  const activeTab = searchParams.get("tab") || "dashboard";
  const setActiveTab = (tabName) => setSearchParams({ tab: tabName });

  // Existing Dashboard States
  const [stats, setStats] = useState({
    users: 0,
    conversations: 0,
    education: 0,
    projects: 0,
    research: 0,
    automation: 0
  });
  const [systemInfo, setSystemInfo] = useState({
    os: "N/A",
    python: "N/A",
    db_status: "N/A",
    platform_status: "N/A"
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [updatingLimit, setUpdatingLimit] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

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
        setStats(statsRes.data.stats);
        if (statsRes.data.system_info) setSystemInfo(statsRes.data.system_info);
        if (statsRes.data.recent_activities) setRecentActivities(statsRes.data.recent_activities);
        const usersRes = await api.get("/admin/users");
        setUsersList(usersRes.data);
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

    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load admin panel details.");
    } finally {
      setLoading(false);
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
              <h1>NeuroForge Command Center</h1>
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
          </div>

          {/* Tab Panes */}
          <div className="admin-content-pane">

            {/* TAB 1: Dashboard overview and Registered user accounts */}
            {activeTab === "dashboard" && (
              <>
                <div className="admin-stats-grid">
                  <div className="admin-stat-card">
                    <div className="stat-header">
                      <Users size={15} />
                      <span>Total Accounts</span>
                    </div>
                    <h2>{stats.users}</h2>
                  </div>
                  <div className="admin-stat-card">
                    <div className="stat-header">
                      <MessageSquare size={15} />
                      <span>Conversations</span>
                    </div>
                    <h2>{stats.conversations}</h2>
                  </div>
                  <div className="admin-stat-card">
                    <div className="stat-header">
                      <Code2 size={15} />
                      <span>Projects</span>
                    </div>
                    <h2>{stats.projects}</h2>
                  </div>
                  <div className="admin-stat-card">
                    <div className="stat-header">
                      <Activity size={15} />
                      <span>System Status</span>
                    </div>
                    <h2>Online</h2>
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
                          <th>Workspace Limit</th>
                          <th>Registered</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading && usersList.length === 0 ? (
                          <tr><td colSpan="5" className="table-loading">Querying registry...</td></tr>
                        ) : filteredUsers.length === 0 ? (
                          <tr><td colSpan="5" className="table-empty">No accounts match query.</td></tr>
                        ) : filteredUsers.map((item) => {
                          const isSelf = item.email === user?.email;
                          return (
                            <tr key={item.id}>
                              <td>
                                <div className="user-name-display">{item.username}</div>
                                <div className="user-email-display">{item.email}</div>
                              </td>
                              <td>
                                <select 
                                  className="admin-select"
                                  style={{ padding: "4px 8px", fontSize: "12px", background: "var(--surface-2)", width: "110px" }}
                                  value={item.role || (item.is_admin ? "admin" : "employee")}
                                  onChange={(e) => handleUpdateRole(item.id, e.target.value)}
                                  disabled={isSelf}
                                >
                                  <option value="employee">Employee</option>
                                  <option value="manager">Manager</option>
                                  <option value="admin">Admin</option>
                                </select>
                              </td>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
                              <td className="user-date-display">{item.created_at?.substring(0, 10)}</td>
                              <td>
                                <button 
                                  className="user-delete-btn"
                                  onClick={() => handleDeleteUser(item.id, item.email)}
                                  disabled={isSelf}
                                  title={isSelf ? "Cannot delete your own active session" : "Delete account completely"}
                                >
                                  <Trash2 size={13} />
                                  Remove
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
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
                <h3>Structured Data Ingestion Dock</h3>
                <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "-12px", marginBottom: "24px" }}>
                  vectorize websites, directories, or documents and register them directly to organization memory.
                </p>

                <div className="ingest-grid">
                  <div className="admin-card" style={{ background: "rgba(0, 0, 0, 0.2)" }}>
                    <form onSubmit={handleUploadIngest}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
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

                      <div className="admin-input-group" style={{ marginTop: "16px" }}>
                        <label>Ingestion Source Mode</label>
                        <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                          <button 
                            type="button"
                            className={`admin-btn-secondary ${uploadSource === "file" ? "active" : ""}`}
                            style={{ flex: 1, borderColor: uploadSource === "file" ? "var(--text)" : "var(--border)" }}
                            onClick={() => setUploadSource("file")}
                          >
                            Upload Files (PDF, TXT, DOCX)
                          </button>
                          <button 
                            type="button"
                            className={`admin-btn-secondary ${uploadSource === "url" ? "active" : ""}`}
                            style={{ flex: 1, borderColor: uploadSource === "url" ? "var(--text)" : "var(--border)" }}
                            onClick={() => setUploadSource("url")}
                          >
                            Scrape Website (URL)
                          </button>
                          <button 
                            type="button"
                            className={`admin-btn-secondary ${uploadSource === "github" ? "active" : ""}`}
                            style={{ flex: 1, borderColor: uploadSource === "github" ? "var(--text)" : "var(--border)" }}
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
                            border: "2px dashed var(--border)", 
                            borderRadius: "var(--radius)", 
                            padding: "30px", 
                            textAlign: "center",
                            background: "rgba(255,255,255,0.01)",
                            cursor: "pointer",
                            marginTop: "16px"
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
                          <UploadCloud size={32} style={{ color: "var(--muted)", marginBottom: "8px" }} />
                          <div style={{ fontWeight: "600", fontSize: "14px" }}>Click to select files for ingestion</div>
                          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>Supports PDF, TXT, Markdown and Microsoft Word up to 50MB</div>
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
                        <button type="submit" className="admin-btn" disabled={!activeKbId || uploadingState === "indexing"}>
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
                </div>
              </div>
            )}

            {/* TAB 4: RAG configuration, System health, Clean DB utilities */}
            {activeTab === "system" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                  
                  {/* Settings card */}
                  <div className="admin-card">
                    <h3>Data Chunking & Splitting Configuration</h3>
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
                      <button type="submit" className="admin-btn">
                        Save Configuration
                      </button>
                    </form>
                  </div>

                  {/* System health and stats */}
                  <div className="admin-card">
                    <h3>Environment Health & Statistics</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                        <span style={{ color: "var(--muted)" }}>Platform Host OS</span>
                        <strong style={{ color: "var(--text)" }}>{systemInfo.os}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                        <span style={{ color: "var(--muted)" }}>Python Engine Version</span>
                        <strong style={{ color: "var(--text)" }}>{systemInfo.python}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                        <span style={{ color: "var(--muted)" }}>NoSQL Core (MongoDB)</span>
                        <strong style={{ color: "var(--success)" }}>{systemInfo.db_status}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                        <span style={{ color: "var(--muted)" }}>Vector Core (Chroma DB)</span>
                        <strong style={{ color: "var(--success)" }}>Ready</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
                        <span style={{ color: "var(--muted)" }}>Total Vectorized Chunks</span>
                        <strong style={{ color: "var(--text)" }}>{analytics.total_chunks} segments</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px" }}>
                        <span style={{ color: "var(--muted)" }}>Total Documents Registered</span>
                        <strong style={{ color: "var(--text)" }}>{analytics.total_documents} files ({formatBytes(analytics.total_size_bytes)})</strong>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Security Audit Trail */}
                <div className="admin-card" style={{ marginTop: "24px" }}>
                  <h3>System Security & Activity Audit Trail</h3>
                  <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "-12px", marginBottom: "16px" }}>
                    Chronological tracking of administrative actions, safety operations, and system events.
                  </p>
                  
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

          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}

export default AdminPanel;

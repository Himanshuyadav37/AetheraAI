import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users, Shield, MessageSquare, Code2, Search, Trash2, CheckCircle, 
  GraduationCap, Play, RefreshCw, AlertTriangle, Building, Database, 
  FileText, UploadCloud, BarChart3, Settings, Plus, Loader2, Link 
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import "./AdminPanel.css";

function AdminPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Admin access validation
  const ADMIN_EMAILS = ["ydvhimanshu461@gmail.com", "admin.neuroforge@gmail.com", "admin@neuroforge.com", "admin@devpilot.ai"];
  const isAdmin = user && ADMIN_EMAILS.includes(user.email);

  // Tab State
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, organizations, kbs, documents, uploads, analytics, settings

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
  
  // Job tracker states
  const [indexingJobs, setIndexingJobs] = useState([]);
  
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

  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }
    loadAdminData(true);
    // Poll data for jobs and stats in background
    const interval = setInterval(() => {
      loadAdminData(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [isAdmin, navigate, activeTab, activeOrgId]);

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
      
      else if (activeTab === "organizations") {
        const orgsRes = await api.get("/rag/organizations");
        setOrgs(orgsRes.data || []);
      } 
      
      else if (activeTab === "kbs") {
        const orgsRes = await api.get("/rag/organizations");
        setOrgs(orgsRes.data || []);
        if (orgsRes.data && orgsRes.data.length > 0) {
          const selectedOrg = activeOrgId || orgsRes.data[0]._id;
          if (!activeOrgId) setActiveOrgId(selectedOrg);
          const kbsRes = await api.get(`/rag/kb/${selectedOrg}`);
          setKbs(kbsRes.data || []);
        }
      } 
      
      else if (activeTab === "documents") {
        const orgsRes = await api.get("/rag/organizations");
        setOrgs(orgsRes.data || []);
        if (orgsRes.data && orgsRes.data.length > 0) {
          const selectedOrg = activeOrgId || orgsRes.data[0]._id;
          if (!activeOrgId) setActiveOrgId(selectedOrg);
          
          const kbsRes = await api.get(`/rag/kb/${selectedOrg}`);
          setKbs(kbsRes.data || []);
          
          if (kbsRes.data && kbsRes.data.length > 0) {
            const selectedKb = activeKbId || kbsRes.data[0]._id;
            if (!activeKbId) setActiveKbId(selectedKb);
            
            const docsRes = await api.get(`/rag/documents?kb_id=${selectedKb}`);
            setDocsList(docsRes.data || []);
          } else {
            setDocsList([]);
          }
        }
      } 
      
      else if (activeTab === "uploads") {
        const orgsRes = await api.get("/rag/organizations");
        setOrgs(orgsRes.data || []);
        if (orgsRes.data && orgsRes.data.length > 0) {
          const selectedOrg = activeOrgId || orgsRes.data[0]._id;
          if (!activeOrgId) setActiveOrgId(selectedOrg);
          
          const kbsRes = await api.get(`/rag/kb/${selectedOrg}`);
          setKbs(kbsRes.data || []);
          if (kbsRes.data && kbsRes.data.length > 0 && !activeKbId) {
            setActiveKbId(kbsRes.data[0]._id);
          }
        }
      } 
      
      else if (activeTab === "analytics") {
        const analyticsRes = await api.get("/rag/analytics");
        setAnalytics(analyticsRes.data);
      } 
      
      else if (activeTab === "settings") {
        const settingsRes = await api.get("/rag/settings");
        setRagSettings(settingsRes.data);
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

  async function handleDeleteUser(userId, userEmail) {
    const confirmDelete = window.confirm(`CRITICAL WARNING: Are you sure you want to permanently delete user ${userEmail} and all their associated chats, projects, research logs, and automation workflows? This cannot be undone.`);
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
    const confirmCleanup = window.confirm("EXTREME CRITICAL WARNING: This will permanently delete ALL chats, projects, research runs, and automation history for ALL users in the entire database. User accounts will remain intact but all workspace history will be wiped. Proceed?");
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
    if (!window.confirm(`Warning: Are you sure you want to delete KB "${name}"? This removes all associated document embeddings from vectors.`)) return;
    try {
      await api.delete(`/rag/kb/${kbId}`);
      setActionSuccess("Knowledge base wiped successfully.");
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
      setActionSuccess(`Reindexing job ${res.data.job_id} initiated.`);
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
        // Track the first job's indexing progress
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
          setActionSuccess("Content indexed and saved to organization.");
          setTimeout(() => setActionSuccess(""), 3000);
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
              <h1>NeuroForge Admin & RAG Studio</h1>
              <p>Ecosystem settings, user access, and Multi-Layer Knowledge Bases isolation.</p>
            </div>
          </div>
          <button 
            type="button" 
            className="admin-refresh-btn" 
            onClick={() => loadAdminData(true)}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            Reload Data
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

        {/* Main Columns Wrapper */}
        <div className="admin-layout-wrapper">
          {/* Subnavigation Sidebar */}
          <div className="admin-subtabs-nav">
            <button 
              className={`admin-subtab-btn ${activeTab === "dashboard" ? "active" : ""}`}
              onClick={() => { setActiveTab("dashboard"); loadAdminData(true); }}
            >
              <Users size={16} />
              System Dashboard
            </button>
            <button 
              className={`admin-subtab-btn ${activeTab === "organizations" ? "active" : ""}`}
              onClick={() => { setActiveTab("organizations"); loadAdminData(true); }}
            >
              <Building size={16} />
              Organizations
            </button>
            <button 
              className={`admin-subtab-btn ${activeTab === "kbs" ? "active" : ""}`}
              onClick={() => { setActiveTab("kbs"); loadAdminData(true); }}
            >
              <Database size={16} />
              Knowledge Bases
            </button>
            <button 
              className={`admin-subtab-btn ${activeTab === "documents" ? "active" : ""}`}
              onClick={() => { setActiveTab("documents"); loadAdminData(true); }}
            >
              <FileText size={16} />
              Document Catalog
            </button>
            <button 
              className={`admin-subtab-btn ${activeTab === "uploads" ? "active" : ""}`}
              onClick={() => { setActiveTab("uploads"); loadAdminData(true); }}
            >
              <UploadCloud size={16} />
              Ingestion Suite
            </button>
            <button 
              className={`admin-subtab-btn ${activeTab === "analytics" ? "active" : ""}`}
              onClick={() => { setActiveTab("analytics"); loadAdminData(true); }}
            >
              <BarChart3 size={16} />
              Storage & Analytics
            </button>
            <button 
              className={`admin-subtab-btn ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => { setActiveTab("settings"); loadAdminData(true); }}
            >
              <Settings size={16} />
              System Settings
            </button>
          </div>

          {/* Active Sub-Panel Content */}
          <div className="admin-content-pane">
            
            {/* 1. Dashboard Tab */}
            {activeTab === "dashboard" && (
              <>
                {/* Stats Grid */}
                <div className="admin-stats-grid">
                  <div className="admin-stat-card">
                    <div className="stat-header">
                      <Users size={16} />
                      <span>Total Users</span>
                    </div>
                    <h2>{stats.users}</h2>
                  </div>
                  <div className="admin-stat-card">
                    <div className="stat-header">
                      <MessageSquare size={16} />
                      <span>Conversations</span>
                    </div>
                    <h2>{stats.conversations}</h2>
                  </div>
                  <div className="admin-stat-card">
                    <div className="stat-header">
                      <Code2 size={16} />
                      <span>Projects Generated</span>
                    </div>
                    <h2>{stats.projects}</h2>
                  </div>
                  <div className="admin-stat-card">
                    <div className="stat-header">
                      <GraduationCap size={16} />
                      <span>Education Chats</span>
                    </div>
                    <h2>{stats.education}</h2>
                  </div>
                </div>

                {/* Users List & Controls */}
                <div className="admin-users-section">
                  <div className="section-header-row">
                    <h3>Registered Accounts</h3>
                    <div className="admin-search-box">
                      <Search size={16} style={{ color: "#6b7280" }} />
                      <input 
                        type="text" 
                        placeholder="Search by username or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="users-table-container">
                    <table className="admin-users-table">
                      <thead>
                        <tr>
                          <th>Account</th>
                          <th>Role</th>
                          <th>Access Limit</th>
                          <th>Workspace Usage</th>
                          <th>Joined</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading && usersList.length === 0 ? (
                          <tr><td colSpan="6" className="table-loading">Loading users...</td></tr>
                        ) : filteredUsers.length === 0 ? (
                          <tr><td colSpan="6" className="table-empty">No accounts match search query.</td></tr>
                        ) : filteredUsers.map((item) => {
                          const isSelf = item.email === user?.email;
                          return (
                            <tr key={item.id}>
                              <td>
                                <div className="user-name-display">{item.username}</div>
                                <div className="user-email-display">{item.email}</div>
                              </td>
                              <td>
                                <span className={`user-stats-badges ${item.is_admin ? "badge-purple" : "badge-cyan"}`}>
                                  {item.is_admin ? "Admin" : "Employee"}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <strong>{item.limit}</strong>
                                  <button
                                    className="admin-refresh-btn"
                                    style={{ padding: "4px 8px", fontSize: "11px" }}
                                    disabled={updatingLimit === item.id}
                                    onClick={() => handleUpdateLimit(item.id, item.limit + 1)}
                                  >
                                    +
                                  </button>
                                  <button
                                    className="admin-refresh-btn"
                                    style={{ padding: "4px 8px", fontSize: "11px" }}
                                    disabled={updatingLimit === item.id || item.limit <= 1}
                                    onClick={() => handleUpdateLimit(item.id, item.limit - 1)}
                                  >
                                    -
                                  </button>
                                </div>
                              </td>
                              <td>
                                <div className="user-stats-badges">
                                  <span className="badge-purple" title="Conversations">{item.conversations_count}💬</span>
                                  <span className="badge-green" title="Projects">{item.projects_count}💻</span>
                                  <span className="badge-yellow" title="Research Sessions">{item.research_count}🔬</span>
                                </div>
                              </td>
                              <td className="user-date-display">{item.created_at.substring(0,10)}</td>
                              <td>
                                <button
                                  className="user-delete-btn"
                                  disabled={isSelf}
                                  onClick={() => handleDeleteUser(item.id, item.email)}
                                >
                                  <Trash2 size={13} />
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* System Settings & Metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
                  <div className="admin-actions-section">
                    <h3>Environment & System Metrics</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div>💻 <strong>Operating System:</strong> {systemInfo.os}</div>
                      <div>🐍 <strong>Python Engine:</strong> v{systemInfo.python}</div>
                      <div>🗄️ <strong>Database Status:</strong> {systemInfo.db_status}</div>
                      <div>🛡️ <strong>Ecosystem Status:</strong> {systemInfo.platform_status}</div>
                    </div>
                  </div>

                  <div className="admin-actions-section">
                    <h3>Dangerous Zone</h3>
                    <div className="admin-actions-card">
                      <div className="action-info">
                        <h4>Wipe System Logs</h4>
                        <p>Deletes all user chats, files, versions, and automation history.</p>
                      </div>
                      <button className="cleanup-danger-btn" onClick={handleSystemCleanup}>
                        <Trash2 size={14} />
                        Wipe Database
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* 2. Organizations Tab */}
            {activeTab === "organizations" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "30px" }}>
                {/* Create Org */}
                <div className="admin-card">
                  <h3>Establish New Organization</h3>
                  <form onSubmit={handleCreateOrg}>
                    <div className="admin-input-group">
                      <label>Organization Name</label>
                      <input 
                        type="text" 
                        className="admin-input" 
                        placeholder="e.g. NeuroForge Labs"
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="admin-btn">
                      <Plus size={16} />
                      Create Org
                    </button>
                  </form>
                </div>

                {/* Orgs List */}
                <div className="admin-card">
                  <h3>Organization Directory</h3>
                  {loading && orgs.length === 0 ? (
                    <p className="table-loading">Loading directory...</p>
                  ) : orgs.length === 0 ? (
                    <p className="table-empty">No organizations configured.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {orgs.map((org) => (
                        <div key={org._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#171717", padding: "14px 20px", borderRadius: "10px", border: "1px solid #2d2d2d" }}>
                          <div>
                            <strong style={{ fontSize: "15px" }}>{org.name}</strong>
                            <div style={{ fontSize: "12px", color: "#71717a", marginTop: "4px" }}>
                              Owner ID: {org.owner_id} · Members: {org.user_ids?.length || 0}
                            </div>
                          </div>
                          <button className="user-delete-btn" onClick={() => handleDeleteOrg(org._id, org.name)}>
                            <Trash2 size={13} />
                            Wipe
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. Knowledge Bases Tab */}
            {activeTab === "kbs" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "30px" }}>
                {/* Create KB */}
                <div className="admin-card">
                  <h3>Create Knowledge Base</h3>
                  <form onSubmit={handleCreateKb}>
                    <div className="admin-input-group">
                      <label>Belongs to Organization</label>
                      <select 
                        className="admin-select"
                        value={activeOrgId}
                        onChange={(e) => { setActiveOrgId(e.target.value); }}
                      >
                        {orgs.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
                      </select>
                    </div>
                    <div className="admin-input-group">
                      <label>Knowledge Base Name</label>
                      <input 
                        type="text" 
                        className="admin-input" 
                        placeholder="e.g. Technical Documentation"
                        value={newKbName}
                        onChange={(e) => setNewKbName(e.target.value)}
                      />
                    </div>
                    <div className="admin-input-group">
                      <label>Description</label>
                      <textarea 
                        className="admin-textarea" 
                        placeholder="Describe the scope of this knowledge base..."
                        rows={3}
                        value={newKbDesc}
                        onChange={(e) => setNewKbDesc(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="admin-btn">
                      <Plus size={16} />
                      Assemble Base
                    </button>
                  </form>
                </div>

                {/* KBs List */}
                <div className="admin-card">
                  <h3>Knowledge Bases Catalog</h3>
                  <div className="admin-input-group" style={{ marginBottom: "20px" }}>
                    <label>Filter by Organization</label>
                    <select 
                      className="admin-select"
                      value={activeOrgId}
                      onChange={(e) => { setActiveOrgId(e.target.value); }}
                    >
                      {orgs.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
                    </select>
                  </div>

                  {kbs.length === 0 ? (
                    <p className="table-empty">No Knowledge Bases found for this organization.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {kbs.map((kb) => (
                        <div key={kb._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#171717", padding: "14px 20px", borderRadius: "10px", border: "1px solid #2d2d2d" }}>
                          <div>
                            <strong style={{ fontSize: "15px" }}>{kb.name}</strong>
                            <div style={{ fontSize: "12px", color: "#a1a1aa", marginTop: "4px" }}>{kb.description || "No description set."}</div>
                          </div>
                          <button className="user-delete-btn" onClick={() => handleDeleteKb(kb._id, kb.name)}>
                            <Trash2 size={13} />
                            Wipe
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. Documents Tab */}
            {activeTab === "documents" && (
              <div className="admin-card">
                <div className="section-header-row">
                  <h3>Document Registry Catalog</h3>
                  <div className="admin-search-box">
                    <Search size={16} style={{ color: "#6b7280" }} />
                    <input 
                      type="text" 
                      placeholder="Search docs in active KB..."
                      value={docSearch}
                      onChange={(e) => setDocSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                  <div className="admin-input-group">
                    <label>Select Organization</label>
                    <select 
                      className="admin-select"
                      value={activeOrgId}
                      onChange={(e) => { setActiveOrgId(e.target.value); setActiveKbId(""); }}
                    >
                      {orgs.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
                    </select>
                  </div>
                  <div className="admin-input-group">
                    <label>Select Knowledge Base</label>
                    <select 
                      className="admin-select"
                      value={activeKbId}
                      onChange={(e) => { setActiveKbId(e.target.value); }}
                    >
                      {kbs.map(k => <option key={k._id} value={k._id}>{k.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="users-table-container">
                  <table className="admin-users-table">
                    <thead>
                      <tr>
                        <th>Filename</th>
                        <th>File Size</th>
                        <th>Text Chunks</th>
                        <th>Indexing Status</th>
                        <th>Registered On</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDocs.length === 0 ? (
                        <tr><td colSpan="6" className="table-empty">No documents found inside this Knowledge Base.</td></tr>
                      ) : filteredDocs.map((doc) => (
                        <tr key={doc._id}>
                          <td>
                            <div className="user-name-display">{doc.filename}</div>
                            <div style={{ fontSize: "11px", color: "#71717a", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "200px" }}>Hash: {doc.hash?.substring(0, 16)}...</div>
                          </td>
                          <td>{formatBytes(doc.size_bytes)}</td>
                          <td>{doc.chunk_count} segments</td>
                          <td>
                            <span className={`user-stats-badges ${doc.status === "completed" ? "badge-green" : "badge-yellow"}`}>
                              {doc.status}
                            </span>
                          </td>
                          <td className="user-date-display">{doc.created_at?.substring(0, 10)}</td>
                          <td>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button className="admin-btn-secondary" style={{ padding: "6px 12px", fontSize: "12px" }} onClick={() => handleReindexDoc(doc._id)}>
                                Reindex
                              </button>
                              <button className="user-delete-btn" onClick={() => handleDeleteDoc(doc._id)}>
                                <Trash2 size={12} />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. Ingestion Suite (Upload Center) */}
            {activeTab === "uploads" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
                {/* Upload Form */}
                <div className="admin-card">
                  <h3>Ingest Documents to Base</h3>
                  
                  <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                    <button 
                      className={`admin-btn-secondary ${uploadSource === "file" ? "active" : ""}`}
                      onClick={() => setUploadSource("file")}
                    >
                      <FileText size={14} />
                      Files / Folder
                    </button>
                    <button 
                      className={`admin-btn-secondary ${uploadSource === "url" ? "active" : ""}`}
                      onClick={() => setUploadSource("url")}
                    >
                      <Link size={14} />
                      URL Link
                    </button>
                    <button 
                      className={`admin-btn-secondary ${uploadSource === "github" ? "active" : ""}`}
                      onClick={() => setUploadSource("github")}
                    >
                      <Code2 size={14} />
                      GitHub Repo
                    </button>
                  </div>

                  <form onSubmit={handleUploadIngest}>
                    <div className="admin-input-group">
                      <label>Target Organization</label>
                      <select 
                        className="admin-select"
                        value={activeOrgId}
                        onChange={(e) => { setActiveOrgId(e.target.value); setActiveKbId(""); }}
                      >
                        {orgs.map(o => <option key={o._id} value={o._id}>{o.name}</option>)}
                      </select>
                    </div>
                    <div className="admin-input-group">
                      <label>Target Knowledge Base</label>
                      <select 
                        className="admin-select"
                        value={activeKbId}
                        onChange={(e) => { setActiveKbId(e.target.value); }}
                      >
                        <option value="">-- Choose KB --</option>
                        {kbs.map(k => <option key={k._id} value={k._id}>{k.name}</option>)}
                      </select>
                    </div>

                    {uploadSource === "file" && (
                      <div className="admin-input-group" style={{ border: "2px dashed #2d2d2d", padding: "30px", borderRadius: "10px", textAlign: "center", cursor: "pointer", background: "#171717" }} onClick={() => fileInputRef.current?.click()}>
                        <UploadCloud size={32} style={{ color: "#8b5cf6", margin: "0 auto 10px" }} />
                        <span>Click to Select PDF, DOCX, ZIP, or PPTX Files</span>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          style={{ display: "none" }} 
                          multiple 
                          accept=".pdf,.docx,.zip,.pptx,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.txt,.csv,.md"
                        />
                      </div>
                    )}

                    {uploadSource === "url" && (
                      <div className="admin-input-group">
                        <label>Crawler URL</label>
                        <input 
                          type="url" 
                          className="admin-input" 
                          placeholder="https://docs.example.com/api"
                          value={uploadUrl}
                          onChange={(e) => setUploadUrl(e.target.value)}
                        />
                      </div>
                    )}

                    {uploadSource === "github" && (
                      <div className="admin-input-group">
                        <label>GitHub Repository URL</label>
                        <input 
                          type="url" 
                          className="admin-input" 
                          placeholder="https://github.com/user/repo"
                          value={uploadGit}
                          onChange={(e) => setUploadGit(e.target.value)}
                        />
                      </div>
                    )}

                    <button 
                      type="submit" 
                      className="admin-btn" 
                      style={{ marginTop: "20px" }}
                      disabled={uploadingState === "indexing"}
                    >
                      {uploadingState === "indexing" ? (
                        <>
                          <Loader2 size={16} className="spin" />
                          Indexing...
                        </>
                      ) : (
                        <>
                          <Play size={16} />
                          Ingest Content
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Upload Status Check */}
                <div className="admin-card">
                  <h3>Indexing Progress Tracker</h3>
                  {uploadingState ? (
                    <div style={{ background: "#171717", padding: "20px", borderRadius: "12px", border: "1px solid #2d2d2d" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "8px" }}>
                        <span>Status: <strong>{uploadingState.toUpperCase()}</strong></span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="admin-progress-container">
                        <div className="admin-progress-fill" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                    </div>
                  ) : (
                    <p className="table-empty">No active indexing processes currently queued.</p>
                  )}
                </div>
              </div>
            )}

            {/* 6. Analytics Tab */}
            {activeTab === "analytics" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
                {/* Metric Summary Card */}
                <div className="admin-card">
                  <h3>Knowledge Storage Footprint</h3>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Total Index Documents:</span>
                      <strong>{analytics.total_documents} files</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Aggregated Disk Usage:</span>
                      <strong>{formatBytes(analytics.total_size_bytes)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Embedded Vector Chunks:</span>
                      <strong>{analytics.total_chunks} segments</strong>
                    </div>
                  </div>
                </div>

                {/* Storage usage gauge bar */}
                <div className="admin-card">
                  <h3>Organization Storage Capacity</h3>
                  <div style={{ marginTop: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#a1a1aa", marginBottom: "6px" }}>
                      <span>Active Usage</span>
                      <span>{analytics.storage_usage_percentage?.toFixed(4)}% / 5.0 GB limit</span>
                    </div>
                    <div className="admin-progress-container" style={{ height: "12px" }}>
                      <div className="admin-progress-fill" style={{ width: `${analytics.storage_usage_percentage}%`, background: "#34d399" }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 7. Settings Tab */}
            {activeTab === "settings" && (
              <div className="admin-card">
                <h3>Global RAG Parameters</h3>
                <form onSubmit={handleSaveSettings} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    <div className="admin-input-group">
                      <label>Recursive Split Chunk Size (characters)</label>
                      <input 
                        type="number" 
                        className="admin-input"
                        value={ragSettings.chunk_size}
                        onChange={(e) => setRagSettings({...ragSettings, chunk_size: parseInt(e.target.value)})}
                      />
                    </div>
                    <div className="admin-input-group">
                      <label>Recursive Split Chunk Overlap (characters)</label>
                      <input 
                        type="number" 
                        className="admin-input"
                        value={ragSettings.chunk_overlap}
                        onChange={(e) => setRagSettings({...ragSettings, chunk_overlap: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    <div className="admin-input-group">
                      <label>Split Method</label>
                      <select 
                        className="admin-select"
                        value={ragSettings.chunk_method}
                        onChange={(e) => setRagSettings({...ragSettings, chunk_method: e.target.value})}
                      >
                        <option value="recursive">Recursive Character Splitter</option>
                        <option value="semantic">Semantic Similarity Splitter</option>
                      </select>
                    </div>
                    <div className="admin-input-group">
                      <label>Temporary Session Expiry (minutes)</label>
                      <input 
                        type="number" 
                        className="admin-input"
                        value={ragSettings.session_expiry_minutes}
                        onChange={(e) => setRagSettings({...ragSettings, session_expiry_minutes: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>

                  <button type="submit" className="admin-btn" style={{ width: "fit-content" }}>
                    Save Settings Configuration
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AdminPanel;

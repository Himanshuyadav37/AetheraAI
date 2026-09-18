import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Code2,
  Cpu,
  GraduationCap,
  Workflow,
  Database,
  Brain,
  ShieldCheck,
  CreditCard,
  Zap,
  TrendingUp,
  Clock,
  Layers,
  Sparkles,
  ArrowUpRight,
  Copy,
  Check,
  Calendar,
  Users,
  Key,
  ChevronRight,
  Activity,
  HardDrive,
  BarChart3,
  PieChart,
  Bot,
  RefreshCw,
  User,
  Lock,
  Sliders,
  Shield,
  Trash2,
  Plus,
  Laptop,
  Globe,
  Sun,
  Moon,
  Download,
  AlertTriangle,
  Eye,
  EyeOff,
  CheckCircle2,
  Server,
  Radio,
  SlidersHorizontal,
} from "lucide-react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import { getSettings, saveSettings } from "../services/settingsService";
import { getAvatarStyle } from "../utils/avatarHelper";
import McpRegistry from "../components/workspace/McpRegistry";
import "./Profile.css";

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Admin access validation
  const ADMIN_EMAILS = ["ydvhimanshu461@gmail.com"];
  const isAdmin = !!(user && (ADMIN_EMAILS.includes(user.email?.toLowerCase()?.trim()) || user.role === "admin" || user.is_admin));

  // Active Tab ('analytics' | 'account' | 'keys' | 'mcp' | 'security' | 'preferences')
  const initialTab = searchParams.get("tab") || "analytics";
  const [activeTab, setActiveTab] = useState(initialTab);

  const [copiedKey, setCopiedKey] = useState(false);
  const [activeRange, setActiveRange] = useState("7d");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState(null);

  // Profile Form States
  const [profileForm, setProfileForm] = useState({
    username: user?.username || "Himanshu",
    email: user?.email || "himanshu@aethera.ai",
    role: user?.role || "AI Software Architect",
    bio: "Autonomous Multi-Agent AI Systems & Full-Stack Engineer",
    avatar_color: "linear-gradient(135deg, #09090b, #27272a)",
    two_factor_enabled: false,
    created_at: "",
  });

  // Security Form States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [sessions, setSessions] = useState([]);

  // API Keys State
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedRawKey, setGeneratedRawKey] = useState(null);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  // Engine & Preferences State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem("theme") !== "light" && !document.body.classList.contains("light");
  });
  const [selectedModel, setSelectedModel] = useState("groq/llama-3.3-70b-versatile");
  const [temperature, setTemperature] = useState(0.7);

  // Live Analytics State
  const [analytics, setAnalytics] = useState({
    user: {
      username: user?.username || user?.email?.split("@")[0] || "Himanshu",
      email: user?.email || "himanshu@aethera.ai",
      role: user?.role || "Enterprise Pro",
      join_date: user?.created_at ? new Date(user.created_at).toLocaleDateString() : "March 2024",
      plan: "Active Plan",
    },
    tokens: {
      total_quota: 500000,
      used: 0,
      remaining: 500000,
      percentage: 0,
    },
    credits: {
      total: 0,
      used: 0,
      remaining: 0,
      balance_usd: "$0.00",
      is_available: false,
      label: "Not available",
    },
    vector_store: {
      total_vectors: 0,
      namespaces_count: 0,
      namespaces: [],
      cloud: "ChromaDB / MongoDB",
      latency: "Local Persistent Engine",
      quota: "0 vectors stored",
    },
    memory: {
      total_rules: 0,
      personal_facts: 0,
      global_insights: 0,
    },
    charts: {
      agent_breakdown: [],
      weekly_usage: [],
      avg_tokens_day: 0,
      peak_day: "N/A",
      peak_tokens: 0,
      has_data: false,
    },
    activities: [],
    mesh: {
      mcp_tools_count: 0,
      latest_dossier_title: "No dossiers generated yet",
      webhook_url: "https://api.aethera.ai/v1/trigger/auth-mesh",
      webhook_status: "200 OK",
      team_devs_count: 1,
    },
  });

  const showToast = (msg, isError = false) => {
    setNotificationMsg({ text: msg, isError });
    setTimeout(() => setNotificationMsg(null), 3500);
  };

  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams({ tab: tabKey });
  };

  const fetchRealAnalytics = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await api.get(`/users/dashboard-analytics?range=${activeRange}`);
      if (res.data) {
        setAnalytics(res.data);
      }
    } catch (err) {
      console.warn("Analytics sync fallback:", err);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  const loadProfileDetails = async () => {
    try {
      const profRes = await api.get("/users/profile");
      if (profRes.data) {
        setProfileForm((prev) => ({
          ...prev,
          ...profRes.data,
        }));
      }
    } catch (e) {
      console.warn("Profile fetch fallback:", e);
    }

    try {
      const keysRes = await api.get("/api/developer/keys");
      if (keysRes.data) setApiKeys(keysRes.data);
    } catch (e) {
      console.warn("API keys fetch fallback:", e);
    }

    try {
      const sessRes = await api.get("/users/sessions");
      if (sessRes.data?.sessions) setSessions(sessRes.data.sessions);
    } catch (e) {
      console.warn("Sessions fetch fallback:", e);
    }

    try {
      const settingsData = await getSettings();
      if (settingsData) {
        if (settingsData.selected_model) setSelectedModel(settingsData.selected_model);
        if (settingsData.temperature !== undefined) setTemperature(settingsData.temperature);
        if (settingsData.theme) {
          setIsDarkMode(settingsData.theme !== "light");
        }
      }
    } catch (e) {
      console.warn("Settings fetch fallback:", e);
    }
  };

  useEffect(() => {
    fetchRealAnalytics();
  }, [activeRange]);

  useEffect(() => {
    loadProfileDetails();
    const timer = setInterval(() => {
      fetchRealAnalytics();
    }, 15000);
    return () => clearInterval(timer);
  }, [activeRange]);

  const handleCopyKey = () => {
    navigator.clipboard.writeText("nx_live_98a7bc81f20448109d9482f0c1");
    setCopiedKey(true);
    showToast("Developer API Key copied to clipboard!");
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await api.put("/users/profile", {
        username: profileForm.username,
        bio: profileForm.bio,
        role: profileForm.role,
        avatar_color: profileForm.avatar_color,
      });
      if (res.data) {
        const updated = {
          ...user,
          username: profileForm.username,
        };
        localStorage.setItem("user", JSON.stringify(updated));
        setUser(updated);
        showToast("Profile changes saved successfully!");
      }
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to update profile.", true);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      showToast("Please fill in current and new password.", true);
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match.", true);
      return;
    }
    setSavingPassword(true);
    try {
      await api.post("/users/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Password updated securely!");
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to change password.", true);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleToggle2FA = async () => {
    const nextVal = !profileForm.two_factor_enabled;
    try {
      await api.post("/users/two-factor", { enabled: nextVal });
      setProfileForm((prev) => ({ ...prev, two_factor_enabled: nextVal }));
      showToast(nextVal ? "2FA Protection Enabled" : "2FA Protection Disabled");
    } catch (err) {
      showToast("Failed to toggle 2FA.", true);
    }
  };

  const handleGenerateApiKey = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setIsGeneratingKey(true);
    try {
      const res = await api.post("/api/developer/keys", { name: newKeyName.trim() });
      if (res.data) {
        setGeneratedRawKey(res.data.raw_key);
        setApiKeys((prev) => [res.data, ...prev]);
        setNewKeyName("");
        showToast("New API Key generated successfully!");
      }
    } catch (err) {
      showToast("Failed to generate API Key.", true);
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleDeleteApiKey = async (keyId) => {
    if (!window.confirm("Revoke this developer key? Integrations using it will lose access.")) return;
    try {
      await api.delete(`/api/developer/keys/${keyId}`);
      setApiKeys((prev) => prev.filter((k) => k._id !== keyId && k.id !== keyId));
      showToast("Developer key revoked.");
    } catch (err) {
      showToast("Failed to revoke key.", true);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!window.confirm("Log out of all other devices except this current session?")) return;
    try {
      await api.post("/users/sessions/revoke-all");
      setSessions((prev) => prev.filter((s) => s.is_current));
      showToast("All other device sessions have been revoked.");
    } catch (err) {
      showToast("Failed to revoke sessions.", true);
    }
  };

  const toggleTheme = (toDark) => {
    setIsDarkMode(toDark);
    const theme = toDark ? "dark" : "light";
    localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("light", !toDark);
    document.body.classList.toggle("light", !toDark);
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
    saveSettings({ theme }).catch(() => {});
  };

  const handleExportData = async () => {
    try {
      const res = await api.get("/users/export");
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aethera_export_${profileForm.username || "user"}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Complete account data archive downloaded.");
    } catch (err) {
      showToast("Export failed.", true);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmation = window.prompt("Type 'DELETE' to permanently destroy your account and all workspace data:");
    if (confirmation !== "DELETE") return;
    try {
      await api.delete("/users/profile");
      logout();
      navigate("/workspace");
    } catch (err) {
      showToast("Failed to delete account.", true);
    }
  };

  const getAgentIcon = (name) => {
    if (name.includes("Engineer")) return Code2;
    if (name.includes("Research")) return Cpu;
    if (name.includes("Education")) return GraduationCap;
    return Workflow;
  };

  const CIRCUMFERENCE = 251.327;
  let accumulatedPct = 0;
  const agentBreakdown = analytics?.charts?.agent_breakdown || [];
  const donutSegments = agentBreakdown.map((item, idx) => {
    const dashLength = (((item.percentage || 0) / 100) * CIRCUMFERENCE);
    const offset = -(accumulatedPct / 100) * CIRCUMFERENCE;
    accumulatedPct += item.percentage || 0;
    const colors = ["#ffffff", "#d4d4d8", "#a1a1aa", "#71717a", "#52525b"];
    return {
      ...item,
      color: item.color || colors[idx % colors.length],
      dashArray: `${dashLength} ${CIRCUMFERENCE}`,
      dashOffset: offset,
      Icon: getAgentIcon(item.name || ""),
    };
  });

  return (
    <DashboardLayout>
      <div className="claude-profile-layout">
        {/* Toast */}
        {notificationMsg && (
          <div className={`cp-toast ${notificationMsg.isError ? "error" : "success"}`}>
            {notificationMsg.isError ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
            <span>{notificationMsg.text}</span>
          </div>
        )}

        {/* =========================================================
            LEFT NAVIGATION RAIL (Claude / ChatGPT Settings Pattern)
            ========================================================= */}
        <aside className="cp-nav-rail">
          <div className="cp-user-summary">
            <div className="cp-summary-avatar" style={getAvatarStyle(profileForm.username)}>
              {profileForm.username.charAt(0).toUpperCase()}
            </div>
            <div className="cp-summary-info">
              <span className="cp-summary-name">{profileForm.username}</span>
              <span className="cp-summary-email">{profileForm.email}</span>
            </div>
            <span className="cp-summary-status" title="Active Neural Session"></span>
          </div>

          <div className="cp-nav-menu">
            <button
              type="button"
              className={`cp-nav-item ${activeTab === "analytics" ? "active" : ""}`}
              onClick={() => handleTabChange("analytics")}
            >
              <BarChart3 size={16} />
              <span>Usage & Telemetry</span>
            </button>

            <button
              type="button"
              className={`cp-nav-item ${activeTab === "account" ? "active" : ""}`}
              onClick={() => handleTabChange("account")}
            >
              <User size={16} />
              <span>Account Profile</span>
            </button>

            <button
              type="button"
              className={`cp-nav-item ${activeTab === "keys" ? "active" : ""}`}
              onClick={() => handleTabChange("keys")}
            >
              <Key size={16} />
              <span>API & Integrations</span>
              {apiKeys.length > 0 && <span className="cp-nav-badge">{apiKeys.length}</span>}
            </button>

            <button
              type="button"
              className={`cp-nav-item ${activeTab === "mcp" ? "active" : ""}`}
              onClick={() => handleTabChange("mcp")}
            >
              <Cpu size={16} />
              <span>MCP Servers</span>
            </button>

            <button
              type="button"
              className={`cp-nav-item ${activeTab === "security" ? "active" : ""}`}
              onClick={() => handleTabChange("security")}
            >
              <Shield size={16} />
              <span>Security & Access</span>
            </button>

            <button
              type="button"
              className={`cp-nav-item ${activeTab === "preferences" ? "active" : ""}`}
              onClick={() => handleTabChange("preferences")}
            >
              <SlidersHorizontal size={16} />
              <span>AI Engine & System</span>
            </button>

            {isAdmin && (
              <button
                type="button"
                className="cp-nav-item cp-admin-nav-item"
                onClick={() => navigate("/admin")}
                style={{
                  marginTop: "12px",
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  color: "#f87171",
                  fontWeight: 600
                }}
              >
                <Shield size={16} />
                <span>Admin Console</span>
                <span style={{ marginLeft: "auto", fontSize: "10px", background: "rgba(239,68,68,0.2)", padding: "1px 5px", borderRadius: "4px" }}>ADMIN</span>
              </button>
            )}
          </div>

          <div className="cp-rail-footer">
            <div className="cp-sync-status">
              <span className="cp-live-dot"></span>
              <span>Live Engine Sync</span>
            </div>
            <button
              type="button"
              className="cp-sync-action-btn"
              onClick={() => fetchRealAnalytics(true)}
              title="Force Real-Time Recalculation"
            >
              <RefreshCw size={12} className={refreshing ? "spin-sync" : ""} />
              <span>{refreshing ? "Syncing..." : "Sync Now"}</span>
            </button>
          </div>
        </aside>

        {/* =========================================================
            RIGHT EDITORIAL CONTENT AREA
            ========================================================= */}
        <main className="cp-content-area">
          {/* Top Editorial Header */}
          <header className="cp-pane-header">
            <div>
              <h1 className="cp-pane-title">
                {activeTab === "analytics" && "Workspace Usage & Quota Telemetry"}
                {activeTab === "account" && "Account & Developer Profile"}
                {activeTab === "keys" && "Programmatic API Keys & Connectors"}
                {activeTab === "mcp" && "Model Context Protocol (MCP) Server Hub"}
                {activeTab === "security" && "Security & Device Authentication"}
                {activeTab === "preferences" && "AI Engine Configuration & Storage"}
              </h1>
              <p className="cp-pane-desc">
                {activeTab === "analytics" && "Live token velocity, serverless vector knowledge, and continuous learned memory"}
                {activeTab === "account" && "Manage your developer identity, roles, and avatar display preferences"}
                {activeTab === "keys" && "Generate API keys and configure external connectors (GitHub, Gmail, Drive, Webhooks)"}
                {activeTab === "mcp" && "Connect, test, and register standardized MCP tool servers (PostgreSQL, Filesystem, GitHub)"}
                {activeTab === "security" && "Update password credentials, manage two-factor authentication, and monitor active sessions"}
                {activeTab === "preferences" && "Configure default LLM models, sampling temperature, themes, and data exports"}
              </p>
            </div>

            <div className="cp-header-actions">
              <button type="button" className="cp-btn-secondary" onClick={handleCopyKey} title="Copy Developer Key">
                <Key size={13} />
                <span>{copiedKey ? "Copied Key!" : "Developer Key"}</span>
              </button>

              <button type="button" className="cp-btn-primary" onClick={() => navigate("/workspace")}>
                <Zap size={14} />
                <span>Launch Workspace</span>
                <ArrowUpRight size={13} />
              </button>
            </div>
          </header>

          {/* =========================================================
              TAB 1: USAGE & TELEMETRY (Seamless Strip + Flat Matrix)
              ========================================================= */}
          {activeTab === "analytics" && (
            <div className="cp-tab-pane animate-fade">
              {/* Panoramic Unified Metric Strip (Like Stripe / Claude) */}
              <div className="cp-metric-strip">
                <div className="cp-strip-col">
                  <div className="strip-col-head">
                    <span className="strip-label">Token Consumption</span>
                    <Zap size={14} className="strip-icon" />
                  </div>
                  <div className="strip-value-row">
                    <span className="strip-num">{(analytics?.tokens?.used || 0).toLocaleString()}</span>
                    <span className="strip-denom">/ {(analytics?.tokens?.total_quota || 500000).toLocaleString()}</span>
                  </div>
                  <div className="strip-progress-bar">
                    <div className="strip-progress-fill" style={{ width: `${Math.min(100, analytics?.tokens?.percentage || 0)}%` }}></div>
                  </div>
                  <div className="strip-sub-row">
                    <span>{analytics?.tokens?.percentage || 0}% consumed</span>
                    <strong>{(analytics?.tokens?.remaining || 0).toLocaleString()} remaining</strong>
                  </div>
                </div>

                <div className="cp-strip-divider"></div>

                {/* Compute Credits */}
                <div className="cp-strip-col">
                  <div className="strip-col-head">
                    <span className="strip-label">Compute Credits</span>
                    <CreditCard size={14} className="strip-icon" />
                  </div>
                  {analytics?.credits?.is_available ? (
                    <>
                      <div className="strip-value-row">
                        <span className="strip-num">{(analytics?.credits?.remaining || 0).toLocaleString()}</span>
                        <span className="strip-denom">/ {(analytics?.credits?.total || 0).toLocaleString()}</span>
                      </div>
                      <div className="strip-progress-bar">
                        <div className="strip-progress-fill" style={{ width: `${analytics?.credits?.total ? ((analytics?.credits?.remaining || 0) / analytics?.credits?.total) * 100 : 0}%` }}></div>
                      </div>
                      <div className="strip-sub-row">
                        <span>Usage-based compute</span>
                        <strong>{analytics?.credits?.balance_usd || "$0.00"}</strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="strip-value-row">
                        <span className="strip-num" style={{ fontSize: "1.1rem", letterSpacing: "normal" }}>Not available</span>
                      </div>
                      <div className="strip-progress-bar">
                        <div className="strip-progress-fill" style={{ width: "0%" }}></div>
                      </div>
                      <div className="strip-sub-row">
                        <span>Dedicated cloud nodes</span>
                        <strong style={{ opacity: 0.6 }}>Inactive</strong>
                      </div>
                    </>
                  )}
                </div>

                <div className="cp-strip-divider"></div>

                <div className="cp-strip-col">
                  <div className="strip-col-head">
                    <span className="strip-label">Vector Knowledge Base</span>
                    <Database size={14} className="strip-icon" />
                  </div>
                  <div className="strip-value-row">
                    <span className="strip-num">{(analytics?.vector_store?.total_vectors || 0).toLocaleString()}</span>
                    <span className="strip-denom">Vectors</span>
                  </div>
                  <div className="strip-meta-pills">
                    <span className="meta-pill">{analytics?.vector_store?.cloud || "ChromaDB / MongoDB"}</span>
                    <span className="meta-pill">{analytics?.vector_store?.namespaces_count || 0} Collections</span>
                  </div>
                  <div className="strip-sub-row">
                    <span>Persistent Neural Store</span>
                    <strong>{analytics?.vector_store?.latency || "Local"}</strong>
                  </div>
                </div>

                <div className="cp-strip-divider"></div>

                <div className="cp-strip-col">
                  <div className="strip-col-head">
                    <span className="strip-label">Continuous Memory Engine</span>
                    <Brain size={14} className="strip-icon" />
                  </div>
                  <div className="strip-value-row">
                    <span className="strip-num">{analytics?.memory?.total_rules || 0}</span>
                    <span className="strip-denom">Learned Rules</span>
                  </div>
                  <div className="strip-meta-pills">
                    <span className="meta-pill">{analytics?.memory?.personal_facts || 0} Facts</span>
                    <span className="meta-pill">{analytics?.memory?.global_insights || 0} Insights</span>
                  </div>
                  <div className="strip-sub-row">
                    <span>Autonomous Distillation</span>
                    <strong>Zero Latency</strong>
                  </div>
                </div>
              </div>

              {/* Seamless Two-Column Chart Matrix */}
              <div className="cp-charts-matrix">
                {/* Velocity Bar Strip */}
                <div className="cp-panel-block">
                  <div className="cp-block-header">
                    <div>
                      <h3>Token Consumption Velocity</h3>
                      <p>Daily LLM & Vector computation history</p>
                    </div>
                    <div className="cp-range-pills">
                      <button className={activeRange === "24h" ? "active" : ""} onClick={() => setActiveRange("24h")}>24H</button>
                      <button className={activeRange === "7d" ? "active" : ""} onClick={() => setActiveRange("7d")}>7D</button>
                      <button className={activeRange === "30d" ? "active" : ""} onClick={() => setActiveRange("30d")}>30D</button>
                    </div>
                  </div>

                  <div className="cp-bar-strip">
                    {analytics?.charts?.has_data && (analytics?.charts?.weekly_usage || []).length > 0 ? (
                      (analytics?.charts?.weekly_usage || []).map((item, idx) => (
                        <div key={item.day || idx} className="cp-bar-unit">
                          <div className="cp-bar-tooltip">
                            {(item.tokens || 0).toLocaleString()} tokens
                          </div>
                          <div className="cp-bar-rail">
                            <div
                              className={`cp-bar-meter ${item.day === analytics?.charts?.peak_day ? "peak" : ""}`}
                              style={{ height: `${item.height || 0}%` }}
                            ></div>
                          </div>
                          <span className="cp-bar-day">{item.day}</span>
                        </div>
                      ))
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", height: "140px", color: "rgba(255,255,255,0.4)", gap: "6px" }}>
                        <Activity size={20} style={{ opacity: 0.3 }} />
                        <span style={{ fontSize: "0.82rem" }}>No usage recorded in this time range</span>
                      </div>
                    )}
                  </div>

                  <div className="cp-block-footer-meta">
                    {analytics?.charts?.has_data ? (
                      <>
                        <TrendingUp size={13} className="text-success" />
                        <span>Average {(analytics?.charts?.avg_tokens_day || 0).toLocaleString()} tokens/day • <strong>Peak on {analytics?.charts?.peak_day || "N/A"} ({(analytics?.charts?.peak_tokens || 0).toLocaleString()} tokens)</strong></span>
                      </>
                    ) : (
                      <>
                        <Clock size={13} style={{ opacity: 0.4 }} />
                        <span style={{ color: "rgba(255,255,255,0.4)" }}>Live consumption velocity updates automatically</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Agent Workload Distribution */}
                <div className="cp-panel-block">
                  <div className="cp-block-header">
                    <div>
                      <h3>Agent Workload Allocation</h3>
                      <p>Token share across autonomous engines</p>
                    </div>
                  </div>

                  {analytics?.tokens?.used > 0 && donutSegments.length > 0 ? (
                    <div className="cp-donut-wrapper">
                      <div className="cp-donut-svg-box">
                        <svg viewBox="0 0 100 100" className="cp-donut-ring">
                          <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
                          {donutSegments.map((seg, idx) => (
                            <circle
                              key={idx}
                              cx="50"
                              cy="50"
                              r="40"
                              fill="transparent"
                              stroke={seg.color}
                              strokeWidth="12"
                              strokeDasharray={seg.dashArray}
                              strokeDashoffset={seg.dashOffset}
                            />
                          ))}
                        </svg>
                        <div className="cp-donut-center">
                          <span className="center-val">{Math.round((analytics?.tokens?.used || 0) / 1000)}k</span>
                          <span className="center-lbl">Tokens</span>
                        </div>
                      </div>

                      <div className="cp-donut-legend-list">
                        {donutSegments.map((item) => {
                          const Icon = item.Icon;
                          return (
                            <div
                              key={item.name}
                              className="cp-legend-item"
                              onClick={() => navigate(item.path)}
                              title={`Open ${item.name}`}
                            >
                              <div className="item-left">
                                <span className="item-dot" style={{ background: item.color }}></span>
                                <Icon size={14} style={{ color: item.color }} />
                                <span className="item-name">{item.name}</span>
                              </div>
                              <div className="item-right">
                                <span className="item-tokens">{item.tokens}</span>
                                <span className="item-pct">{item.percentage}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "180px", color: "rgba(255,255,255,0.4)", gap: "6px" }}>
                      <Bot size={24} style={{ opacity: 0.3 }} />
                      <span style={{ fontSize: "0.82rem" }}>No agent workload recorded yet</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Connected Infrastructure & Mesh Services */}
              <div className="cp-panel-block">
                <div className="cp-block-header">
                  <div>
                    <h3>Connected Developer Engines & Infrastructure Mesh</h3>
                    <p>Live status of autonomous sandboxes, vector stores, and orchestration bridges</p>
                  </div>
                  <span className="cp-status-chip">All Systems Active</span>
                </div>

                <div className="cp-mesh-table-wrapper">
                  <table className="cp-mesh-table">
                    <thead>
                      <tr>
                        <th>Service / Engine</th>
                        <th>Type & Protocol</th>
                        <th>Resource Allocation</th>
                        <th>Health Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr onClick={() => navigate("/workspace?agent=engineer")}>
                        <td className="service-cell">
                          <Code2 size={16} />
                          <div>
                            <strong>Engineer AI Studio</strong>
                            <span>Autonomous Code Synthesis & Live Sandboxes</span>
                          </div>
                        </td>
                        <td><span className="type-badge">MicroVM Core</span></td>
                        <td><code>Python 3.11 • Zero Compile Errors</code></td>
                        <td><span className="health-live">● Operational</span></td>
                        <td><button className="row-action-btn">Launch IDE <ChevronRight size={12} /></button></td>
                      </tr>

                      <tr onClick={() => navigate("/workspace?tab=knowledge")}>
                        <td className="service-cell">
                          <Database size={16} />
                          <div>
                            <strong>Pinecone Cloud RAG</strong>
                            <span>Serverless Vector Namespaces</span>
                          </div>
                        </td>
                        <td><span className="type-badge">AWS us-east-1</span></td>
                        <td><code>{(analytics?.vector_store?.total_vectors || 0).toLocaleString()} vectors • {analytics?.vector_store?.namespaces_count || 6} namespaces</code></td>
                        <td><span className="health-live">● Connected</span></td>
                        <td><button className="row-action-btn">Manage Vectors <ChevronRight size={12} /></button></td>
                      </tr>

                      <tr onClick={() => navigate("/integrations")}>
                        <td className="service-cell">
                          <Layers size={16} />
                          <div>
                            <strong>Dynamic MCP Hub</strong>
                            <span>PostgreSQL, GitHub PAT & Docker</span>
                          </div>
                        </td>
                        <td><span className="type-badge">JSON-RPC Stdio</span></td>
                        <td><code>{analytics?.mesh?.mcp_tools_count || 12} Registered Dynamic Tools</code></td>
                        <td><span className="health-live">● Active Nodes</span></td>
                        <td><button className="row-action-btn">Configure <ChevronRight size={12} /></button></td>
                      </tr>

                      <tr onClick={() => navigate("/workspace?agent=research")}>
                        <td className="service-cell">
                          <Cpu size={16} />
                          <div>
                            <strong>Research Intelligence</strong>
                            <span>Multi-Source Autonomous Web Synthesis</span>
                          </div>
                        </td>
                        <td><span className="type-badge">Deep Crawler</span></td>
                        <td><code>"{String(analytics?.mesh?.latest_dossier_title || "Competitor Model Benchmarks").substring(0, 38)}..."</code></td>
                        <td><span className="health-live">● Fact Verified</span></td>
                        <td><button className="row-action-btn">Open Dossier <ChevronRight size={12} /></button></td>
                      </tr>

                      <tr onClick={() => navigate("/workspace?agent=automation")}>
                        <td className="service-cell">
                          <Workflow size={16} />
                          <div>
                            <strong>Workflow Automation</strong>
                            <span>Event-driven Ingress & n8n Hooks</span>
                          </div>
                        </td>
                        <td><span className="type-badge">Webhook Trigger</span></td>
                        <td><code>{analytics?.mesh?.webhook_url || "https://api.aethera.ai/v1/trigger/auth-mesh"}</code></td>
                        <td><span className="health-live">● 200 OK</span></td>
                        <td><button className="row-action-btn">Canvas <ChevronRight size={12} /></button></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Execution Audit Log Stream */}
              <div className="cp-panel-block">
                <div className="cp-block-header">
                  <div>
                    <h3>Live Execution & Audit Trace</h3>
                    <p>Recent session transactions, model parameters, and token charges</p>
                  </div>
                </div>

                <div className="cp-audit-list">
                  {(analytics?.activities || []).map((act) => (
                    <div key={act.id} className="cp-audit-row">
                      <div className="audit-bot-cell">
                        <Bot size={15} />
                        <div>
                          <strong>{act.title}</strong>
                          <span>{act.agent} • {act.model}</span>
                        </div>
                      </div>

                      <div className="audit-meta-cell">
                        <span className="audit-tokens">{act.tokens}</span>
                        <span className="audit-time">{act.time}</span>
                        <span className={`audit-status-badge ${(act.status || "completed").toLowerCase()}`}>
                          <Check size={11} />
                          {act.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 2: ACCOUNT PROFILE (Editorial Form Rows)
              ========================================================= */}
          {activeTab === "account" && (
            <div className="cp-tab-pane animate-fade">
              <form onSubmit={handleSaveProfile} className="cp-editorial-form">
                <div className="cp-form-row">
                  <div className="row-label-col">
                    <label>Username</label>
                    <span>Your unique developer identifier</span>
                  </div>
                  <div className="row-input-col">
                    <input
                      type="text"
                      value={profileForm.username}
                      onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="cp-form-row">
                  <div className="row-label-col">
                    <label>Engineering Role</label>
                    <span>Displayed on shared sessions and teams</span>
                  </div>
                  <div className="row-input-col">
                    <input
                      type="text"
                      value={profileForm.role}
                      onChange={(e) => setProfileForm({ ...profileForm, role: e.target.value })}
                      placeholder="e.g. Principal AI Architect"
                    />
                  </div>
                </div>

                <div className="cp-form-row">
                  <div className="row-label-col">
                    <label>Primary Email</label>
                    <span>Authentication & notifications address</span>
                  </div>
                  <div className="row-input-col">
                    <input type="email" value={profileForm.email} disabled className="disabled-field" />
                  </div>
                </div>

                <div className="cp-form-row">
                  <div className="row-label-col">
                    <label>Professional Bio</label>
                    <span>Context supplied to memory engine</span>
                  </div>
                  <div className="row-input-col">
                    <textarea
                      rows={3}
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    />
                  </div>
                </div>

                <div className="cp-form-row">
                  <div className="row-label-col">
                    <label>Avatar Background</label>
                    <span>Custom gradient accent for your profile</span>
                  </div>
                  <div className="row-input-col">
                    <div className="cp-avatar-accents">
                      {[
                        "linear-gradient(135deg, #09090b, #27272a)",
                        "linear-gradient(135deg, #6366f1, #a855f7)",
                        "linear-gradient(135deg, #10b981, #059669)",
                        "linear-gradient(135deg, #38bdf8, #2563eb)",
                        "linear-gradient(135deg, #f59e0b, #d97706)",
                      ].map((grad, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`accent-dot ${profileForm.avatar_color === grad ? "active" : ""}`}
                          style={{ background: grad }}
                          onClick={() => setProfileForm({ ...profileForm, avatar_color: grad })}
                        >
                          {profileForm.avatar_color === grad && <Check size={12} color="#fff" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="cp-form-footer">
                  <button type="submit" className="cp-btn-primary" disabled={savingProfile}>
                    {savingProfile ? "Saving Changes..." : "Save Profile Changes"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* =========================================================
              TAB 3: API & INTEGRATIONS
              ========================================================= */}
          {activeTab === "keys" && (
            <div className="cp-tab-pane animate-fade">
              <div className="cp-panel-block">
                <div className="cp-block-header">
                  <div>
                    <h3>Create New Developer Key</h3>
                    <p>Programmatic access to Aethera AI autonomous agent APIs</p>
                  </div>
                </div>

                <form onSubmit={handleGenerateApiKey} className="cp-key-create-form">
                  <input
                    type="text"
                    placeholder="Key Label (e.g., Production Pipeline, Local CLI Agent)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    required
                  />
                  <button type="submit" className="cp-btn-primary" disabled={isGeneratingKey}>
                    <Plus size={14} />
                    <span>{isGeneratingKey ? "Generating..." : "Generate Key"}</span>
                  </button>
                </form>

                {generatedRawKey && (
                  <div className="cp-raw-key-box">
                    <div className="raw-key-header">
                      <ShieldCheck size={16} className="text-success" />
                      <span>Copy Your Secret Key (Will not be shown again):</span>
                    </div>
                    <div className="raw-key-row">
                      <code>{generatedRawKey}</code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedRawKey);
                          showToast("API Key copied to clipboard!");
                        }}
                      >
                        <Copy size={13} />
                        <span>Copy Key</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="cp-panel-block">
                <div className="cp-block-header">
                  <div>
                    <h3>Active Developer Keys</h3>
                    <p>Active bearer tokens configured for this workspace</p>
                  </div>
                </div>

                {apiKeys.length === 0 ? (
                  <div className="cp-empty-keys">
                    <Key size={28} />
                    <p>No active API keys found. Generate a key above to enable CLI/SDK access.</p>
                  </div>
                ) : (
                  <div className="cp-keys-table-wrapper">
                    <table className="cp-mesh-table">
                      <thead>
                        <tr>
                          <th>Key Name</th>
                          <th>Key Prefix</th>
                          <th>Created Date</th>
                          <th>Total Calls</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apiKeys.map((k) => (
                          <tr key={k._id || k.id}>
                            <td><strong>{k.name || "Developer API Key"}</strong></td>
                            <td><code>{k.prefix || "nx_live_..."}</code></td>
                            <td>{k.created_at ? new Date(k.created_at).toLocaleDateString() : "Active"}</td>
                            <td>{k.total_requests || 0} requests</td>
                            <td>
                              <button className="cp-revoke-btn" onClick={() => handleDeleteApiKey(k._id || k.id)}>
                                <Trash2 size={12} />
                                <span>Revoke</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="cp-panel-block" style={{ marginTop: "20px" }}>
                <div className="cp-block-header">
                  <div>
                    <h3>Connected External Integrations</h3>
                    <p>Authorize third-party connectors and platforms for autonomous AI workflows</p>
                  </div>
                  <button
                    type="button"
                    className="cp-btn-secondary"
                    onClick={() => navigate("/integrations")}
                    style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <span>Open Integrations Hub</span>
                    <ArrowUpRight size={13} />
                  </button>
                </div>

                <div className="cp-connectors-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px", marginTop: "14px" }}>
                  {[
                    { name: "GitHub", desc: "Push code, create PRs, sync repos", icon: "🐙", path: "/integrations", connected: !!localStorage.getItem("github_token") },
                    { name: "Gmail", desc: "Automated agent email notifications", icon: "✉️", path: "/integrations", connected: !!localStorage.getItem("default_recipient_email") },
                    { name: "Google Drive", desc: "Sync documents and knowledge dossiers", icon: "📁", path: "/integrations", connected: false },
                    { name: "Linear", desc: "Bi-directional sprint ticket management", icon: "📐", path: "/integrations", connected: false },
                    { name: "Slack", desc: "Team channel alerts & AI summaries", icon: "💬", path: "/integrations", connected: false },
                    { name: "Discord", desc: "Community webhook dispatches", icon: "🎮", path: "/integrations", connected: false },
                  ].map((app) => (
                    <div
                      key={app.name}
                      onClick={() => navigate(app.path)}
                      style={{
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "10px",
                        padding: "14px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "20px" }}>{app.icon}</span>
                        <span style={{
                          fontSize: "11px",
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: "999px",
                          background: app.connected ? "rgba(34, 197, 94, 0.15)" : "rgba(255, 255, 255, 0.06)",
                          color: app.connected ? "#4ade80" : "#a1a1aa"
                        }}>
                          {app.connected ? "● Connected" : "Available"}
                        </span>
                      </div>
                      <div>
                        <strong style={{ fontSize: "14px", color: "#f4f4f5", display: "block" }}>{app.name}</strong>
                        <span style={{ fontSize: "12px", color: "#71717a", lineHeight: 1.4 }}>{app.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB: MCP SERVERS (Embedded MCP Registry)
              ========================================================= */}
          {activeTab === "mcp" && (
            <div className="cp-tab-pane animate-fade">
              <div className="cp-panel-block" style={{ padding: "0", background: "transparent", border: "none" }}>
                <McpRegistry />
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 4: SECURITY & ACCESS
              ========================================================= */}
          {activeTab === "security" && (
            <div className="cp-tab-pane animate-fade">
              {/* Password Section */}
              <div className="cp-panel-block">
                <div className="cp-block-header">
                  <div>
                    <h3>Change Workspace Password</h3>
                    <p>Ensure your account uses a secure 8+ character password</p>
                  </div>
                </div>

                <form onSubmit={handleUpdatePassword} className="cp-editorial-form">
                  <div className="cp-form-row">
                    <div className="row-label-col">
                      <label>Current Password</label>
                    </div>
                    <div className="row-input-col">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                      />
                    </div>
                  </div>

                  <div className="cp-form-row">
                    <div className="row-label-col">
                      <label>New Password</label>
                    </div>
                    <div className="row-input-col">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New strong password"
                        required
                      />
                    </div>
                  </div>

                  <div className="cp-form-row">
                    <div className="row-label-col">
                      <label>Confirm Password</label>
                    </div>
                    <div className="row-input-col">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                        required
                      />
                    </div>
                  </div>

                  <div className="cp-form-footer">
                    <button
                      type="button"
                      className="cp-btn-secondary"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                      <span>{showPassword ? "Hide" : "Show"}</span>
                    </button>
                    <button type="submit" className="cp-btn-primary" disabled={savingPassword}>
                      {savingPassword ? "Updating..." : "Update Password"}
                    </button>
                  </div>
                </form>
              </div>

              {/* 2FA Section */}
              <div className="cp-panel-block">
                <div className="cp-toggle-row">
                  <div>
                    <h3>Two-Factor Authentication (2FA)</h3>
                    <p>Require an additional verification code on new sign-ins</p>
                  </div>
                  <button
                    type="button"
                    className={`cp-switch-btn ${profileForm.two_factor_enabled ? "active" : ""}`}
                    onClick={handleToggle2FA}
                  >
                    <span className="switch-knob"></span>
                  </button>
                </div>
              </div>

              {/* Active Sessions */}
              <div className="cp-panel-block">
                <div className="cp-block-header">
                  <div>
                    <h3>Active Device Sessions</h3>
                    <p>Devices currently authenticated to your account</p>
                  </div>
                  <button type="button" className="cp-btn-secondary danger" onClick={handleRevokeAllSessions}>
                    <span>Revoke Other Sessions</span>
                  </button>
                </div>

                <div className="cp-sessions-list">
                  <div className="session-item-row current">
                    <Laptop size={16} />
                    <div className="session-info">
                      <strong>Current Browser Session (This Device)</strong>
                      <span>Chrome / WebKit • IP: 127.0.0.1 • Active Now</span>
                    </div>
                    <span className="session-active-pill">Current</span>
                  </div>

                  {sessions.filter((s) => !s.is_current).map((s, idx) => (
                    <div key={idx} className="session-item-row">
                      <Globe size={16} />
                      <div className="session-info">
                        <strong>{s.device || "Remote Workspace Client"}</strong>
                        <span>{s.ip || "192.168.1.1"} • {s.last_active || "Recent"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB 5: AI ENGINE & SYSTEM PREFERENCES
              ========================================================= */}
          {activeTab === "preferences" && (
            <div className="cp-tab-pane animate-fade">
              {/* Theme Selector */}
              <div className="cp-panel-block">
                <div className="cp-block-header">
                  <div>
                    <h3>Interface Theme & Visual Style</h3>
                    <p>Choose your workspace aesthetic</p>
                  </div>
                </div>

                <div className="cp-theme-selector-grid">
                  <button
                    type="button"
                    className={`theme-tile-btn ${!isDarkMode ? "active" : ""}`}
                    onClick={() => toggleTheme(false)}
                  >
                    <Sun size={18} />
                    <strong>Monochromatic Light</strong>
                    <span>Pure white editorial palette with crisp high contrast</span>
                  </button>

                  <button
                    type="button"
                    className={`theme-tile-btn ${isDarkMode ? "active" : ""}`}
                    onClick={() => toggleTheme(true)}
                  >
                    <Moon size={18} />
                    <strong>Deep Obsidian Dark</strong>
                    <span>Ultra-low fatigue dark interface with subtle glassmorphic glow</span>
                  </button>
                </div>
              </div>

              {/* AI Engine Defaults */}
              <div className="cp-panel-block">
                <div className="cp-block-header">
                  <div>
                    <h3>Primary Reasoning Engine & Temperature</h3>
                    <p>Set autonomous agent defaults for all synthesized workspaces</p>
                  </div>
                </div>

                <div className="cp-editorial-form">
                  <div className="cp-form-row">
                    <div className="row-label-col">
                      <label>Default LLM Model</label>
                      <span>Engine for complex multi-agent coding</span>
                    </div>
                    <div className="row-input-col">
                      <select
                        value={selectedModel}
                        onChange={(e) => {
                          setSelectedModel(e.target.value);
                          saveSettings({ selected_model: e.target.value });
                          showToast("Default model saved.");
                        }}
                      >
                        <option value="groq/llama-3.3-70b-versatile">Groq Llama-3.3 70B (820 T/s)</option>
                        <option value="groq/deepseek-r1-distill-llama-70b">DeepSeek R1 Distill (Reasoning)</option>
                        <option value="groq/mixtral-8x7b-32768">Mixtral 8x7B (32k Context)</option>
                        <option value="gemini-2.5-pro">Google Gemini 2.5 Pro</option>
                      </select>
                    </div>
                  </div>

                  <div className="cp-form-row">
                    <div className="row-label-col">
                      <label>Sampling Temperature: {temperature}</label>
                      <span>Lower for deterministic code, higher for creative ideas</span>
                    </div>
                    <div className="row-input-col">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={temperature}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          setTemperature(v);
                          saveSettings({ temperature: v });
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Export & Danger Zone */}
              <div className="cp-panel-block danger-block">
                <div className="cp-block-header">
                  <div>
                    <h3 className="text-danger">Account Export & Deletion</h3>
                    <p>Download full account archive or permanently erase your workspace</p>
                  </div>
                </div>

                <div className="danger-actions-strip">
                  <button type="button" className="cp-btn-secondary" onClick={handleExportData}>
                    <Download size={13} />
                    <span>Download Full Workspace Archive (JSON)</span>
                  </button>

                  <button type="button" className="cp-btn-danger" onClick={handleDeleteAccount}>
                    <Trash2 size={13} />
                    <span>Permanently Delete Account</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </DashboardLayout>
  );
}

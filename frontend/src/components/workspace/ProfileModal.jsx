import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  X,
  Shield,
  User,
  Sliders,
  Database,
  Cpu,
  Key,
  Lock,
  Check,
  Copy,
  Trash2,
  Plus,
  RefreshCw,
  Laptop,
  Globe,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Sparkles,
  Download,
  Flame,
  Layers,
  Sun,
  Moon,
} from "lucide-react";
import { getSettings, saveSettings } from "../../services/settingsService";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import "./ProfileModal.css";
import { getAvatarStyle } from "../../utils/avatarHelper";

function ProfileModal({ isOpen, onClose }) {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();

  // Tab Navigation: 'profile' | 'security' | 'keys' | 'engine' | 'appearance' | 'data'
  const [activeTab, setActiveTab] = useState("profile");
  const [saving, setSaving] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState(null);

  // Profile Form States
  const [profileData, setProfileData] = useState(() => {
    const loginEmail = user?.email || "";
    const defaultUsername = user?.username || (loginEmail ? loginEmail.split("@")[0] : "Developer");
    return {
      username: defaultUsername,
      email: loginEmail,
      role: "AI Software Architect",
      bio: "",
      avatar_color: "linear-gradient(135deg, #6366f1, #a855f7)",
      plan: "Enterprise PRO",
      two_factor_enabled: false,
      created_at: "",
    };
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
  const [tempDarkMode, setTempDarkMode] = useState(() => {
    return localStorage.getItem("theme") !== "light" && !document.body.classList.contains("light");
  });
  const [selectedModel, setSelectedModel] = useState("groq/llama-3.3-70b-versatile");
  const [temperature, setTemperature] = useState(0.7);
  const [maxIterations, setMaxIterations] = useState(3);
  const [autoDebug, setAutoDebug] = useState(true);
  const [autoDeploy, setAutoDeploy] = useState(false);
  const [autoFix, setAutoFix] = useState(true);
  const [saveLogs, setSaveLogs] = useState(true);
  const [notifications, setNotifications] = useState(true);

  // Personalization State
  const [accent, setAccent] = useState(localStorage.getItem("nexusai_accent") || "neutral");
  const [fontSize, setFontSize] = useState(localStorage.getItem("nexusai_font_size") || "medium");
  const [systemMemory, setSystemMemory] = useState(localStorage.getItem("nexusai_personalized_memory") || "");

  // Real Usage Metrics State
  const [usageStats, setUsageStats] = useState({
    total_sessions: 0,
    chat_conversations: 0,
    projects_built: 0,
    research_reports: 0,
    automations_deployed: 0,
    developer_api_calls: 0,
    plan_limit_tokens: "Unlimited (Enterprise Tier)",
    rate_limit: "820 tokens / sec (Groq LPU)",
  });

  // Universal Theme Applicator for entire website
  const updateGlobalTheme = (isDark) => {
    setTempDarkMode(isDark);
    const theme = isDark ? "dark" : "light";
    const isLight = !isDark;

    localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("light", isLight);
    document.body.classList.toggle("light", isLight);
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;

    // Trigger updates in all active components
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));

    // Persist to backend
    saveSettings({ theme }).catch((err) => console.error("Theme background save error:", err));
  };

  // Load All Real Data when Modal Opens
  useEffect(() => {
    if (!isOpen) return;

    const activeIsDark = localStorage.getItem("theme") !== "light" && !document.body.classList.contains("light");
    setTempDarkMode(activeIsDark);

    async function loadAllUserData() {
      try {
        // 1. Load Profile
        const profRes = await api.get("/users/profile");
        if (profRes.data) {
          const effectiveEmail = profRes.data.email || user?.email || "";
          const effectiveUsername = profRes.data.username || user?.username || (effectiveEmail ? effectiveEmail.split("@")[0] : "Developer");
          setProfileData((prev) => ({
            ...prev,
            ...profRes.data,
            email: effectiveEmail,
            username: effectiveUsername,
          }));
        }
      } catch (e) {
        console.error("Profile load error", e);
      }

      try {
        // 2. Load Usage Stats
        const usageRes = await api.get("/users/usage");
        if (usageRes.data) {
          setUsageStats(usageRes.data);
        }
      } catch (e) {
        console.error("Usage load error", e);
      }

      try {
        // 3. Load Active Sessions
        const sessRes = await api.get("/users/sessions");
        if (sessRes.data?.sessions) {
          setSessions(sessRes.data.sessions);
        }
      } catch (e) {
        console.error("Sessions load error", e);
      }

      try {
        // 4. Load Developer API Keys
        const keysRes = await api.get("/api/developer/keys");
        if (keysRes.data) {
          setApiKeys(keysRes.data);
        }
      } catch (e) {
        console.error("Keys load error", e);
      }

      try {
        // 5. Load Settings
        const settingsData = await getSettings();
        if (settingsData) {
          setAutoDebug(settingsData.auto_debug ?? true);
          setAutoDeploy(settingsData.auto_deploy ?? false);
          setAutoFix(settingsData.auto_fix ?? true);
          setSaveLogs(settingsData.save_logs ?? true);
          setMaxIterations(settingsData.max_iterations ?? 3);
          setSelectedModel(settingsData.selected_model || "groq/llama-3.3-70b-versatile");
          setTemperature(settingsData.temperature ?? 0.7);
          if (settingsData.theme) {
            const isDark = settingsData.theme !== "light";
            setTempDarkMode(isDark);
          }
        }
      } catch (e) {
        console.error("Settings load error", e);
      }
    }

    loadAllUserData();
  }, [isOpen, user]);

  if (!isOpen) return null;

  // Save Profile Handler
  async function handleSaveProfile() {
    setSaving(true);
    try {
      const res = await api.put("/users/profile", {
        username: profileData.username,
        bio: profileData.bio,
        role: profileData.role,
        avatar_color: profileData.avatar_color,
      });

      if (res.data?.success) {
        const updated = {
          ...user,
          username: res.data.user.username,
          email: user?.email || res.data.user.email,
        };
        localStorage.setItem("user", JSON.stringify(updated));
        setUser(updated);
        setProfileData((prev) => ({
          ...prev,
          username: res.data.user.username,
          bio: res.data.user.bio,
          role: res.data.user.role,
          avatar_color: res.data.user.avatar_color,
        }));
        alert("Profile updated successfully!");
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  // Password Change Handler
  async function handleUpdatePassword() {
    if (!currentPassword || !newPassword) {
      alert("Please fill in current and new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters long.");
      return;
    }

    setSaving(true);
    try {
      const res = await api.post("/users/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      if (res.data?.success) {
        alert("Password updated successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update password.");
    } finally {
      setSaving(false);
    }
  }

  // 2FA Toggle Handler
  async function handleToggle2FA() {
    const nextState = !profileData.two_factor_enabled;
    setSaving(true);
    try {
      const res = await api.post("/users/2fa/toggle", { enabled: nextState });
      if (res.data?.success) {
        setProfileData((prev) => ({ ...prev, two_factor_enabled: nextState }));
        alert(res.data.message);
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to toggle 2FA.");
    } finally {
      setSaving(false);
    }
  }

  // Revoke Other Sessions
  async function handleRevokeSessions() {
    setSaving(true);
    try {
      const res = await api.post("/users/sessions/revoke-all");
      if (res.data?.success) {
        setSessions((prev) => prev.filter((s) => s.is_current));
        alert("All other device sessions have been successfully revoked.");
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to revoke sessions.");
    } finally {
      setSaving(false);
    }
  }

  // Generate API Key
  async function handleGenerateKey() {
    if (!newKeyName.trim()) {
      alert("Please enter a name for the API key.");
      return;
    }

    setIsGeneratingKey(true);
    try {
      const res = await api.post("/api/developer/keys", {
        name: newKeyName.trim(),
        expires_in_days: 365,
      });

      if (res.data?.api_key) {
        setGeneratedRawKey(res.data.api_key);
        setNewKeyName("");
        // Reload keys
        const updatedKeys = await api.get("/api/developer/keys");
        setApiKeys(updatedKeys.data || []);
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to generate API Key.");
    } finally {
      setIsGeneratingKey(false);
    }
  }

  // Delete API Key
  async function handleDeleteKey(keyId) {
    if (!window.confirm("Are you sure you want to revoke this API key?")) return;
    try {
      await api.delete(`/api/developer/keys/${keyId}`);
      setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch (err) {
      alert("Failed to delete API Key: " + err.message);
    }
  }

  // Copy to clipboard helper
  function handleCopy(text, id) {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  }

  // Save AI Engine & Appearance Settings
  async function handleSaveSettings() {
    setSaving(true);
    try {
      await saveSettings({
        theme: tempDarkMode ? "dark" : "light",
        auto_debug: autoDebug,
        auto_deploy: autoDeploy,
        notifications,
        auto_fix: autoFix,
        save_logs: saveLogs,
        max_iterations: maxIterations,
        selected_model: selectedModel,
        temperature: parseFloat(temperature),
      });

      updateGlobalTheme(tempDarkMode);
      localStorage.setItem("nexusai_accent", accent);
      localStorage.setItem("nexusai_font_size", fontSize);
      localStorage.setItem("nexusai_personalized_memory", systemMemory);

      alert("Settings saved successfully!");
      onClose();
    } catch (err) {
      alert("Failed to save settings: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Export Data Archive
  async function handleExportData() {
    setSaving(true);
    try {
      const res = await api.get("/users/export");
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `nexusai_enterprise_backup_${user?.username || "user"}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      alert("Failed to export data: " + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  }

  // Delete Account Handler
  async function handleDeleteAccount() {
    const confirmDelete = window.confirm(
      "EXTREME WARNING: Are you absolutely sure you want to permanently delete your account? This will purge all your code projects, RAG embeddings, and history. This cannot be undone."
    );
    if (!confirmDelete) return;

    setSaving(true);
    try {
      const res = await api.delete("/users/profile");
      if (res.data.success) {
        alert("Your account has been deleted.");
        logout();
        onClose();
        navigate("/workspace");
      }
    } catch (err) {
      alert("Failed to delete account: " + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="profile-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="profile-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="pm-header">
          <div className="pm-header-title-area">
            <span className="pm-header-title">Enterprise Control Hub</span>
            <span className="pm-header-plan-tag">{profileData.plan}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              className="pm-close-btn"
              onClick={() => updateGlobalTheme(!tempDarkMode)}
              title={tempDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle Theme"
              type="button"
            >
              {tempDarkMode ? <Sun size={15} color="#f59e0b" /> : <Moon size={15} color="#6366f1" />}
            </button>
            <button className="pm-close-btn" onClick={onClose} aria-label="Close modal" type="button">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="pm-tabs-bar">
          <button
            className={`pm-tab-btn ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <User size={14} /> Profile
          </button>
          <button
            className={`pm-tab-btn ${activeTab === "security" ? "active" : ""}`}
            onClick={() => setActiveTab("security")}
          >
            <Shield size={14} /> Security & 2FA
          </button>
          <button
            className={`pm-tab-btn ${activeTab === "keys" ? "active" : ""}`}
            onClick={() => setActiveTab("keys")}
          >
            <Key size={14} /> API Keys ({apiKeys.length})
          </button>
          <button
            className={`pm-tab-btn ${activeTab === "engine" ? "active" : ""}`}
            onClick={() => setActiveTab("engine")}
          >
            <Cpu size={14} /> AI Engine
          </button>
          <button
            className={`pm-tab-btn ${activeTab === "appearance" ? "active" : ""}`}
            onClick={() => setActiveTab("appearance")}
          >
            <Sliders size={14} /> Personalize
          </button>
          <button
            className={`pm-tab-btn ${activeTab === "data" ? "active" : ""}`}
            onClick={() => setActiveTab("data")}
          >
            <Activity size={14} /> Usage & Data
          </button>
        </div>

        {/* Body Content */}
        <div className="pm-body">
          {/* TAB 1: PROFILE & ACCOUNT */}
          {activeTab === "profile" && (
            <div className="pm-section-card">
              <div className="pm-avatar-row">
                <div className="pm-avatar-big" style={getAvatarStyle(profileData.username)}>
                  {profileData.username?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="pm-avatar-meta">
                  <span className="pm-avatar-name">{profileData.username || "Developer"}</span>
                  <span className="pm-avatar-sub">{profileData.email}</span>
                </div>
              </div>

              <div className="pm-grid-2">
                <div className="pm-form-group">
                  <div className="pm-form-label-row">
                    <label className="pm-form-label">Username</label>
                    <span className="pm-label-tag editable">Editable</span>
                  </div>
                  <input
                    type="text"
                    className="pm-input"
                    value={profileData.username}
                    onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                    placeholder="Enter your username"
                  />
                  <span className="pm-input-hint">Defaulted from email. You can customize this anytime.</span>
                </div>
                <div className="pm-form-group">
                  <div className="pm-form-label-row">
                    <label className="pm-form-label">Email Address</label>
                    <span className="pm-label-tag locked">
                      <Lock size={10} /> Read-only
                    </span>
                  </div>
                  <input
                    type="email"
                    className="pm-input pm-input-readonly"
                    value={user?.email || profileData.email}
                    disabled
                    readOnly
                    title="Email address is tied to your account login and cannot be modified."
                  />
                  <span className="pm-input-hint">Your primary login email address (cannot be edited).</span>
                </div>
              </div>

              <div className="pm-form-group">
                <label className="pm-form-label">Professional Role / Title</label>
                <input
                  type="text"
                  className="pm-input"
                  value={profileData.role}
                  onChange={(e) => setProfileData({ ...profileData, role: e.target.value })}
                  placeholder="e.g. Lead AI Architect, Staff Engineer"
                />
              </div>

              <div className="pm-form-group">
                <label className="pm-form-label">Bio & Engineering Focus</label>
                <textarea
                  className="pm-textarea"
                  value={profileData.bio}
                  onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                  placeholder="Tell your team about your stack specialties..."
                />
              </div>

              <button
                className="pm-btn-primary"
                style={{ alignSelf: "flex-start", marginTop: "6px" }}
                disabled={saving}
                onClick={handleSaveProfile}
              >
                {saving ? "Saving..." : "Update Profile"}
              </button>
            </div>
          )}

          {/* TAB 2: SECURITY & 2FA */}
          {activeTab === "security" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Change Password Card */}
              <div className="pm-section-card">
                <h4 className="pm-section-title">
                  <Lock size={15} /> Authentication & Password
                </h4>
                <div className="pm-form-group">
                  <label className="pm-form-label">Current Password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      className="pm-input"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        color: "#71717a",
                        cursor: "pointer",
                      }}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="pm-grid-2">
                  <div className="pm-form-group">
                    <label className="pm-form-label">New Password</label>
                    <input
                      type="password"
                      className="pm-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                  <div className="pm-form-group">
                    <label className="pm-form-label">Confirm New Password</label>
                    <input
                      type="password"
                      className="pm-input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                    />
                  </div>
                </div>

                <button
                  className="pm-btn-primary"
                  style={{ alignSelf: "flex-start", marginTop: "4px" }}
                  disabled={saving || !currentPassword || !newPassword}
                  onClick={handleUpdatePassword}
                >
                  {saving ? "Updating..." : "Update Password"}
                </button>
              </div>

              {/* Two-Factor Authentication */}
              <div className="pm-setting-row">
                <div className="pm-setting-info">
                  <span className="pm-setting-title">Two-Factor Authentication (2FA)</span>
                  <span className="pm-setting-desc">
                    Require OTP verification code on every login attempt for enhanced enterprise security.
                  </span>
                </div>
                <label className="pm-switch">
                  <input
                    type="checkbox"
                    checked={profileData.two_factor_enabled}
                    onChange={handleToggle2FA}
                  />
                  <span className="pm-slider" />
                </label>
              </div>

              {/* Active Sessions List */}
              <div className="pm-section-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 className="pm-section-title" style={{ margin: 0 }}>
                    <Laptop size={15} /> Active Sessions ({sessions.length})
                  </h4>
                  {sessions.length > 1 && (
                    <button
                      className="pm-btn-danger"
                      style={{ height: "28px", fontSize: "11px", padding: "0 10px" }}
                      onClick={handleRevokeSessions}
                    >
                      Revoke Other Sessions
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {sessions.map((sess) => (
                    <div key={sess.id} className="pm-session-card">
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Globe size={16} style={{ color: "#a1a1aa" }} />
                        <div>
                          <div style={{ fontSize: "12.5px", fontWeight: "600", color: "#ffffff" }}>
                            {sess.device}
                          </div>
                          <div style={{ fontSize: "11px", color: "#71717a" }}>
                            IP: {sess.ip} · {sess.browser}
                          </div>
                        </div>
                      </div>
                      {sess.is_current ? (
                        <span className="pm-session-current-badge">CURRENT SESSION</span>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#71717a" }}>Active</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DEVELOPER API KEYS */}
          {activeTab === "keys" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Generate Key Input */}
              <div className="pm-section-card">
                <h4 className="pm-section-title">
                  <Key size={15} /> Generate Developer API Key
                </h4>
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    type="text"
                    className="pm-input"
                    placeholder="Key description (e.g. CI/CD Pipeline, Production Gateway)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                  <button
                    className="pm-btn-primary"
                    onClick={handleGenerateKey}
                    disabled={isGeneratingKey || !newKeyName.trim()}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    <Plus size={14} style={{ marginRight: "4px" }} />
                    {isGeneratingKey ? "Generating..." : "Generate Key"}
                  </button>
                </div>

                {generatedRawKey && (
                  <div
                    style={{
                      background: "rgba(34, 197, 94, 0.1)",
                      border: "1px solid rgba(34, 197, 94, 0.25)",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <span style={{ fontSize: "11.5px", color: "#22c55e", fontWeight: "700" }}>
                      ⚡ API Key Generated! Copy this secret now (it won't be shown again):
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <code style={{ flex: 1, color: "#ffffff", fontSize: "12px", wordBreak: "break-all" }}>
                        {generatedRawKey}
                      </code>
                      <button
                        className="pm-btn-primary"
                        style={{ height: "30px", fontSize: "11px" }}
                        onClick={() => handleCopy(generatedRawKey, "new_raw")}
                      >
                        {copiedKeyId === "new_raw" ? <Check size={12} /> : <Copy size={12} />}
                        {copiedKeyId === "new_raw" ? "Copied!" : "Copy Secret"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Existing API Keys List */}
              <div className="pm-section-card">
                <h4 className="pm-section-title">
                  <Layers size={15} /> Active API Keys ({apiKeys.length})
                </h4>
                {apiKeys.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "#71717a", fontStyle: "italic" }}>
                    No developer API keys created yet. Generate one above to access NexusAI endpoints programmatically.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {apiKeys.map((k) => (
                      <div key={k.id} className="pm-key-card">
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: "600", color: "#ffffff" }}>
                            {k.name}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                            <span className="pm-key-code">{k.prefix}</span>
                            <span style={{ fontSize: "11px", color: "#71717a" }}>
                              {k.total_requests} requests
                            </span>
                          </div>
                        </div>
                        <div className="pm-key-actions">
                          <button
                            className="pm-btn-cancel"
                            style={{ height: "30px", padding: "0 10px" }}
                            onClick={() => handleCopy(k.prefix, k.id)}
                            title="Copy prefix"
                          >
                            {copiedKeyId === k.id ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                          <button
                            className="pm-btn-danger"
                            style={{ height: "30px", padding: "0 10px" }}
                            onClick={() => handleDeleteKey(k.id)}
                            title="Revoke Key"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: AI ENGINE & INFERENCE */}
          {activeTab === "engine" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="pm-section-card">
                <div className="pm-form-group">
                  <label className="pm-form-label">Primary AI Inference Model</label>
                  <select
                    className="pm-input"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                  >
                    <option value="groq/llama-3.3-70b-versatile">
                      ⚡ Groq Llama 3.3 70B (820 tokens/s - Default)
                    </option>
                    <option value="deepseek-r1">🧠 DeepSeek R1 (Advanced Reasoning)</option>
                    <option value="openai/gpt-4o">🎨 GPT-4o Multimodal</option>
                    <option value="anthropic/claude-3-5-sonnet">💻 Claude 3.5 Sonnet (Coding)</option>
                    <option value="bedrock/titan">☁️ AWS Bedrock Titan</option>
                  </select>
                </div>

                <div className="pm-form-group">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <label className="pm-form-label">Creativity Temperature</label>
                    <span style={{ fontSize: "12px", color: "#a1a1aa", fontWeight: "700" }}>
                      {temperature}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.1"
                    className="pm-input"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    style={{ padding: 0, cursor: "pointer", height: "auto" }}
                  />
                </div>

                <div className="pm-form-group">
                  <label className="pm-form-label">Max Agentic Loop Iterations</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="pm-input"
                    value={maxIterations}
                    onChange={(e) => setMaxIterations(parseInt(e.target.value) || 3)}
                  />
                </div>
              </div>

              <div className="pm-setting-row">
                <div className="pm-setting-info">
                  <span className="pm-setting-title">Auto-Fix Compilation Errors</span>
                  <span className="pm-setting-desc">
                    Autonomous self-healing loop that fixes syntax and lint issues during code builds.
                  </span>
                </div>
                <label className="pm-switch">
                  <input
                    type="checkbox"
                    checked={autoFix}
                    onChange={(e) => setAutoFix(e.target.checked)}
                  />
                  <span className="pm-slider" />
                </label>
              </div>

              <div className="pm-setting-row">
                <div className="pm-setting-info">
                  <span className="pm-setting-title">Automated Sandbox Deploy</span>
                  <span className="pm-setting-desc">
                    Instantly spin up hot-reloading iframe containers for newly generated full-stack apps.
                  </span>
                </div>
                <label className="pm-switch">
                  <input
                    type="checkbox"
                    checked={autoDeploy}
                    onChange={(e) => setAutoDeploy(e.target.checked)}
                  />
                  <span className="pm-slider" />
                </label>
              </div>

              <button
                className="pm-btn-primary"
                style={{ alignSelf: "flex-start" }}
                disabled={saving}
                onClick={handleSaveSettings}
              >
                {saving ? "Saving..." : "Save Engine Preferences"}
              </button>
            </div>
          )}

          {/* TAB 5: APPEARANCE & PERSONALIZATION */}
          {activeTab === "appearance" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Theme Mode Selector Card */}
              <div className="pm-section-card" style={{ padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <div>
                    <span className="pm-setting-title" style={{ fontSize: "14px", fontWeight: "700" }}>Appearance & Theme</span>
                    <span className="pm-setting-desc" style={{ display: "block", marginTop: "2px" }}>
                      Switch between Obsidian Dark and Clean Light themes across the entire platform.
                    </span>
                  </div>
                  <label className="pm-switch">
                    <input
                      type="checkbox"
                      checked={tempDarkMode}
                      onChange={(e) => updateGlobalTheme(e.target.checked)}
                    />
                    <span className="pm-slider" />
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {/* Dark Mode Card */}
                  <div
                    onClick={() => updateGlobalTheme(true)}
                    style={{
                      padding: "14px",
                      borderRadius: "12px",
                      background: "#18181b",
                      border: tempDarkMode ? "2px solid #6366f1" : "1px solid rgba(255, 255, 255, 0.08)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      transition: "all 0.2s ease",
                      boxShadow: tempDarkMode ? "0 0 16px rgba(99, 102, 241, 0.25)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#f4f4f5", fontWeight: "600", fontSize: "13px" }}>
                        <Moon size={16} color="#818cf8" /> Obsidian Dark
                      </div>
                      {tempDarkMode && <Check size={14} color="#6366f1" />}
                    </div>
                    <span style={{ fontSize: "11px", color: "#a1a1aa", lineHeight: "1.4" }}>
                      Industrial monochromatic dark mode for low-light coding.
                    </span>
                  </div>

                  {/* Light Mode Card */}
                  <div
                    onClick={() => updateGlobalTheme(false)}
                    style={{
                      padding: "14px",
                      borderRadius: "12px",
                      background: "#f8fafc",
                      border: !tempDarkMode ? "2px solid #6366f1" : "1px solid rgba(255, 255, 255, 0.08)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      transition: "all 0.2s ease",
                      boxShadow: !tempDarkMode ? "0 0 16px rgba(99, 102, 241, 0.25)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0f172a", fontWeight: "600", fontSize: "13px" }}>
                        <Sun size={16} color="#f59e0b" /> Clean Light
                      </div>
                      {!tempDarkMode && <Check size={14} color="#6366f1" />}
                    </div>
                    <span style={{ fontSize: "11px", color: "#64748b", lineHeight: "1.4" }}>
                      High-contrast daylight theme with crisp slate typography.
                    </span>
                  </div>
                </div>
              </div>

              <div className="pm-section-card">
                <div className="pm-form-group">
                  <label className="pm-form-label">Theme Accent Tint</label>
                  <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                    {[
                      { key: "neutral", label: "Obsidian Silver", color: "#a1a1aa" },
                      { key: "indigo", label: "Electric Indigo", color: "#6366f1" },
                      { key: "emerald", label: "Emerald Green", color: "#10b981" },
                      { key: "amber", label: "Amber Gold", color: "#f59e0b" },
                      { key: "crimson", label: "Crimson Red", color: "#ef4444" },
                    ].map((item) => (
                      <div
                        key={item.key}
                        onClick={() => setAccent(item.key)}
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "8px",
                          background: item.color,
                          cursor: "pointer",
                          border: accent === item.key ? "2px solid #ffffff" : "2px solid transparent",
                          boxShadow: accent === item.key ? "0 0 10px " + item.color : "none",
                          transition: "all 0.2s ease",
                        }}
                        title={item.label}
                      />
                    ))}
                  </div>
                </div>

                <div className="pm-form-group">
                  <label className="pm-form-label">Interface Typography Scaling</label>
                  <select
                    className="pm-input"
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value)}
                  >
                    <option value="compact">Compact (13px)</option>
                    <option value="medium">Default (14px)</option>
                    <option value="large">Spacious (16px)</option>
                  </select>
                </div>

                <div className="pm-form-group">
                  <label className="pm-form-label">Global AI Memory & System Instructions</label>
                  <textarea
                    className="pm-textarea"
                    rows={3}
                    placeholder="e.g. Always generate TypeScript with strict type annotations. Prefer FastAPI and Tailwind CSS."
                    value={systemMemory}
                    onChange={(e) => setSystemMemory(e.target.value)}
                  />
                </div>
              </div>

              <button
                className="pm-btn-primary"
                style={{ alignSelf: "flex-start" }}
                disabled={saving}
                onClick={handleSaveSettings}
              >
                {saving ? "Saving..." : "Save Appearance"}
              </button>
            </div>
          )}

          {/* TAB 6: USAGE & DATA ARCHIVE */}
          {activeTab === "data" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Real Metrics Grid */}
              <div className="pm-metrics-grid">
                <div className="pm-metric-box">
                  <span className="pm-metric-val">{usageStats.total_sessions}</span>
                  <span className="pm-metric-lbl">Total Sessions</span>
                </div>
                <div className="pm-metric-box">
                  <span className="pm-metric-val">{usageStats.projects_built}</span>
                  <span className="pm-metric-lbl">Projects Built</span>
                </div>
                <div className="pm-metric-box">
                  <span className="pm-metric-val">{usageStats.developer_api_calls}</span>
                  <span className="pm-metric-lbl">API Gateway Calls</span>
                </div>
              </div>

              {/* Data Archive Download Card */}
              <div className="pm-section-card">
                <h4 className="pm-section-title">
                  <Download size={15} /> 1-Click Complete Workspace Export
                </h4>
                <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa", lineHeight: "1.5" }}>
                  Download a full JSON archive of all your chats, engineering repositories, research analyses, automation flows, and developer keys.
                </p>
                <button
                  className="pm-btn-primary"
                  style={{ alignSelf: "flex-start", marginTop: "4px" }}
                  onClick={handleExportData}
                  disabled={saving}
                >
                  <Download size={14} style={{ marginRight: "4px" }} />
                  {saving ? "Exporting..." : "Download JSON Archive"}
                </button>
              </div>

              {/* Danger Zone */}
              <div
                className="pm-section-card"
                style={{ borderColor: "rgba(239, 68, 68, 0.3)", background: "rgba(239, 68, 68, 0.04)" }}
              >
                <h4 className="pm-section-title" style={{ color: "#f87171" }}>
                  <AlertTriangle size={15} /> Danger Zone: Permanently Delete Account
                </h4>
                <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa", lineHeight: "1.5" }}>
                  Permanently delete your profile, credentials, and cascade wipe all database collections associated with your account.
                </p>
                <button
                  className="pm-btn-danger"
                  style={{ alignSelf: "flex-start", marginTop: "4px" }}
                  onClick={handleDeleteAccount}
                  disabled={saving}
                >
                  <Trash2 size={14} style={{ marginRight: "4px" }} />
                  {saving ? "Deleting..." : "Permanently Delete Account"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pm-footer">
          <button className="pm-btn-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ProfileModal;

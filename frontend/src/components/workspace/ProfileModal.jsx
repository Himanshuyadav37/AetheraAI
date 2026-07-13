import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { X, Shield, User, Sliders, Database, Cpu, HelpCircle } from "lucide-react";
import { getSettings, saveSettings } from "../../services/settingsService";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";

function ProfileModal({ isOpen, onClose }) {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();

  // Tab State
  const [activeTab, setActiveTab] = useState("settings");

  // Settings State
  const [tempDarkMode, setTempDarkMode] = useState(localStorage.getItem("theme") !== "light");
  const [autoDebug, setAutoDebug] = useState(true);
  const [autoDeploy, setAutoDeploy] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [saving, setSaving] = useState(false);

  // New Rich Engine & Adv. Developer Settings
  const [autoFix, setAutoFix] = useState(true);
  const [saveLogs, setSaveLogs] = useState(true);
  const [maxIterations, setMaxIterations] = useState(3);
  const [selectedModel, setSelectedModel] = useState("llama-3.3-70b-versatile");
  const [temperature, setTemperature] = useState(0.7);

  // Profile Form State
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");

  // Personalization Accent, Font Size & Consent
  const [accent, setAccent] = useState(localStorage.getItem("nexusai_accent") || "neutral");
  const [fontSize, setFontSize] = useState(localStorage.getItem("nexusai_font_size") || "medium");
  const [telemetry, setTelemetry] = useState(localStorage.getItem("nexusai_telemetry") !== "false");

  useEffect(() => {
    if (!isOpen) return;

    // Load actual settings from Backend
    async function load() {
      try {
        const data = await getSettings();
        const theme = data.theme || localStorage.getItem("theme") || "dark";
        setTempDarkMode(theme !== "light");
        setAutoDebug(data.auto_debug ?? true);
        setAutoDeploy(data.auto_deploy ?? false);
        setNotifications(data.notifications ?? true);
        setAutoFix(data.auto_fix ?? true);
        setSaveLogs(data.save_logs ?? true);
        setMaxIterations(data.max_iterations ?? 3);
        setSelectedModel(data.selected_model || "llama-3.3-70b-versatile");
        setTemperature(data.temperature ?? 0.7);
      } catch {
        // Fallback silently
      }
    }
    load();
    
    // Update local variables when modal opens
    setUsername(user?.username || "");
    setEmail(user?.email || "");
    setPassword("");
  }, [isOpen, user]);

  if (!isOpen) return null;

  async function handleSaveSettings() {
    setSaving(true);
    try {
      const theme = tempDarkMode ? "dark" : "light";
      await saveSettings({
        theme,
        auto_debug: autoDebug,
        auto_deploy: autoDeploy,
        notifications,
        auto_fix: autoFix,
        save_logs: saveLogs,
        max_iterations: maxIterations,
        selected_model: selectedModel,
        temperature: parseFloat(temperature)
      });
      
      // Save local properties
      localStorage.setItem("theme", theme);
      document.documentElement.classList.toggle("light", theme === "light");
      document.body.classList.toggle("light", theme === "light");
      localStorage.setItem("nexusai_accent", accent);
      localStorage.setItem("nexusai_font_size", fontSize);
      localStorage.setItem("nexusai_telemetry", telemetry ? "true" : "false");
      
      alert("Settings saved successfully!");
      onClose();
    } catch (err) {
      alert("Failed to save settings: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile() {
    setSaving(true);
    try {
      const payload = {};
      if (username !== user?.username) payload.username = username;
      if (email !== user?.email) payload.email = email;
      if (password) payload.password = password;

      if (Object.keys(payload).length === 0) {
        onClose();
        return;
      }

      const res = await api.put("/users/profile", payload);
      if (res.data.success) {
        const updatedUser = { 
          ...user, 
          username: res.data.user.username, 
          email: res.data.user.email 
        };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setUser(updatedUser);
        alert("Profile details updated successfully!");
        onClose();
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update profile details.");
    } finally {
      setSaving(false);
    }
  }

  async function handleExportData() {
    setSaving(true);
    try {
      const res = await api.get("/users/export");
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `nexusai_export_${user?.username || "user"}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      alert("Failed to export your data: " + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    const confirmDelete = window.confirm("EXTREME WARNING: Are you absolutely sure you want to permanently delete your account? This will wipe your profile and purge all your chat history, AI projects, research logs, and automation blueprints from the server. This cannot be undone.");
    if (!confirmDelete) return;

    setSaving(true);
    try {
      const res = await api.delete("/users/profile");
      if (res.data.success) {
        alert("Your account has been successfully deleted.");
        logout();
        onClose();
        navigate("/login");
      }
    } catch (err) {
      alert("Failed to delete account: " + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  }

  async function handleResetToDefaults() {
    const confirmReset = window.confirm("Reset all engine configuration options and UI preferences back to system defaults?");
    if (!confirmReset) return;
    
    setSaving(true);
    try {
      await saveSettings({
        theme: "dark",
        auto_debug: true,
        auto_deploy: false,
        notifications: true,
        auto_fix: true,
        save_logs: true,
        max_iterations: 3,
        selected_model: "llama-3.3-70b-versatile",
        temperature: 0.7
      });
      localStorage.setItem("theme", "dark");
      document.documentElement.classList.remove("light");
      document.body.classList.remove("light");
      localStorage.setItem("nexusai_accent", "neutral");
      localStorage.setItem("nexusai_font_size", "medium");
      localStorage.setItem("nexusai_telemetry", "true");
      alert("Settings reset to defaults successfully!");
      onClose();
    } catch (err) {
      alert("Failed to reset settings: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h3>Preferences & Account</h3>
          <button className="modal-close-btn" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="modal-tabs" style={{ display: "flex", flexWrap: "wrap" }}>
          <button
            className={`modal-tab-btn ${activeTab === "settings" ? "active" : ""}`}
            onClick={(e) => { e.stopPropagation(); setActiveTab("settings"); }}
          >
            <Sliders size={14} style={{ marginRight: 6 }} />
            Settings
          </button>
          <button
            className={`modal-tab-btn ${activeTab === "profile" ? "active" : ""}`}
            onClick={(e) => { e.stopPropagation(); setActiveTab("profile"); }}
          >
            <User size={14} style={{ marginRight: 6 }} />
            Profile
          </button>
          <button
            className={`modal-tab-btn ${activeTab === "personalize" ? "active" : ""}`}
            onClick={(e) => { e.stopPropagation(); setActiveTab("personalize"); }}
          >
            <Shield size={14} style={{ marginRight: 6 }} />
            Personalize
          </button>
          <button
            className={`modal-tab-btn ${activeTab === "engine" ? "active" : ""}`}
            onClick={(e) => { e.stopPropagation(); setActiveTab("engine"); }}
          >
            <Cpu size={14} style={{ marginRight: 6 }} />
            AI Engine
          </button>
          <button
            className={`modal-tab-btn ${activeTab === "data" ? "active" : ""}`}
            onClick={(e) => { e.stopPropagation(); setActiveTab("data"); }}
          >
            <Database size={14} style={{ marginRight: 6 }} />
            Data & System
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ minHeight: "260px" }}>
          {activeTab === "settings" && (
            <div className="settings-panel">
              {/* Dark mode */}
              <div className="setting-item">
                <div>
                  <h4>Dark Mode</h4>
                  <p>Use modern frosted dark theme</p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={tempDarkMode}
                    onChange={(e) => setTempDarkMode(e.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>

              {/* Auto Debug */}
              <div className="setting-item">
                <div>
                  <h4>Auto Debug</h4>
                  <p>Automatically run debugger on failed tests</p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={autoDebug}
                    onChange={(e) => setAutoDebug(e.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>

              {/* Auto Deploy */}
              <div className="setting-item">
                <div>
                  <h4>Auto Deploy</h4>
                  <p>Deploy project after successful generation</p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={autoDeploy}
                    onChange={(e) => setAutoDeploy(e.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>

              {/* System notifications */}
              <div className="setting-item">
                <div>
                  <h4>Enable System Notifications</h4>
                  <p>Get push updates regarding active build outputs</p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={notifications}
                    onChange={(e) => setNotifications(e.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>

              {/* Telemetry settings */}
              <div className="setting-item">
                <div>
                  <h4>Telemetry & Analytics</h4>
                  <p>Help optimize agent tools with anonymous diagnostic data</p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={telemetry}
                    onChange={(e) => setTelemetry(e.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>
            </div>
          )}

          {activeTab === "profile" && (
            <div className="profile-panel">
              <div className="modal-form-group">
                <label htmlFor="pf-username">Username</label>
                <input
                  type="text"
                  id="pf-username"
                  className="modal-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="modal-form-group">
                <label htmlFor="pf-email">Email Address</label>
                <input
                  type="email"
                  id="pf-email"
                  className="modal-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="modal-form-group">
                <label htmlFor="pf-password">New Password</label>
                <input
                  type="password"
                  id="pf-password"
                  className="modal-input"
                  value={password}
                  placeholder="Leave blank to keep current"
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          {activeTab === "personalize" && (
            <div className="personalization-panel">
              <div className="modal-form-group">
                <label>Theme Accent Color</label>
                <div className="accent-color-picker">
                  {[
                    { key: "neutral", color: "#a3a3a3" },
                    { key: "blue", color: "#3b82f6" },
                    { key: "green", color: "#10b981" },
                    { key: "red", color: "#ef4444" },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className={`accent-circle ${accent === item.key ? "active" : ""}`}
                      style={{ background: item.color }}
                      onClick={() => setAccent(item.key)}
                      title={`${item.key} accent`}
                    />
                  ))}
                </div>
              </div>

              <div className="modal-form-group">
                <label htmlFor="pf-font-size">Interface Font Size</label>
                <select
                  id="pf-font-size"
                  className="modal-input"
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value)}
                  style={{ width: "100%", background: "#212121" }}
                >
                  <option value="small">Small (13px)</option>
                  <option value="medium">Medium (14px)</option>
                  <option value="large">Large (16px)</option>
                </select>
              </div>

              <div className="modal-form-group">
                <label>Personal Instructions (AI Memory)</label>
                <textarea
                  className="modal-input"
                  rows={3}
                  placeholder="Provide details about your project stack, language preferences, coding rules..."
                  defaultValue={localStorage.getItem("nexusai_personalized_memory") || ""}
                  onChange={(e) => localStorage.setItem("nexusai_personalized_memory", e.target.value)}
                />
              </div>
            </div>
          )}

          {activeTab === "engine" && (
            <div className="settings-panel">
              {/* Selected Model */}
              <div className="modal-form-group">
                <label htmlFor="pf-model">Default LLM Model</label>
                <select
                  id="pf-model"
                  className="modal-input"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  style={{ width: "100%", background: "#212121" }}
                >
                  <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Default)</option>
                  <option value="deepseek-r1">DeepSeek R1 (Reasoning)</option>
                  <option value="gpt-4o">GPT-4o (Multimodal)</option>
                  <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Coding)</option>
                </select>
              </div>

              {/* Temperature Slider */}
              <div className="modal-form-group">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <label>Creativity (Temperature)</label>
                  <span style={{ fontSize: "12px", color: "#a1a1aa" }}>{temperature}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.1"
                  className="modal-input"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  style={{ padding: "0", cursor: "pointer" }}
                />
              </div>

              {/* Max reasoning loops */}
              <div className="modal-form-group">
                <label htmlFor="pf-iterations">Max Agent Iterations</label>
                <input
                  type="number"
                  id="pf-iterations"
                  min="1"
                  max="10"
                  className="modal-input"
                  value={maxIterations}
                  onChange={(e) => setMaxIterations(parseInt(e.target.value) || 3)}
                />
              </div>

              {/* Auto Fix checkbox */}
              <div className="setting-item">
                <div>
                  <h4>Auto-Fix Errors</h4>
                  <p>Automatically fix code compiling and linter errors</p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={autoFix}
                    onChange={(e) => setAutoFix(e.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>

              {/* Save session logs checkbox */}
              <div className="setting-item">
                <div>
                  <h4>Persist Workspace Logs</h4>
                  <p>Write agent step logs to workspace data history</p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={saveLogs}
                    onChange={(e) => setSaveLogs(e.target.checked)}
                  />
                  <span className="slider" />
                </label>
              </div>
            </div>
          )}

          {activeTab === "data" && (
            <div className="settings-panel">
              <div className="setting-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                <div>
                  <h4 style={{ color: "#f1f5f9", margin: "0 0 2px 0" }}>Export Personal Workspace Data</h4>
                  <p style={{ fontSize: "12px", color: "#a3a3a3", margin: 0 }}>Download all conversations, project plans, education history, and automation maps as a JSON file.</p>
                </div>
                <button
                  className="modal-btn-save"
                  onClick={handleExportData}
                  disabled={saving}
                  style={{ background: "#3b82f6", width: "auto", alignSelf: "flex-start", marginTop: "4px" }}
                >
                  {saving ? "Exporting..." : "Export Data"}
                </button>
              </div>

              <hr style={{ border: 0, borderTop: "1px solid rgba(255,255,255,0.06)", margin: "16px 0", width: "100%" }} />

              <div className="setting-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                <div>
                  <h4 style={{ color: "#ffffff", margin: "0 0 2px 0" }}>Restore Factory Defaults</h4>
                  <p style={{ fontSize: "12px", color: "#a3a3a3", margin: 0 }}>Reset all workspace UI accents, LLM model settings, and debugger triggers back to standard.</p>
                </div>
                <button
                  className="modal-btn-save"
                  onClick={handleResetToDefaults}
                  disabled={saving}
                  style={{ background: "rgba(255,255,255,0.08)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.15)", width: "auto", alignSelf: "flex-start", marginTop: "4px" }}
                >
                  Reset Defaults
                </button>
              </div>

              <hr style={{ border: 0, borderTop: "1px solid rgba(255,255,255,0.06)", margin: "16px 0", width: "100%" }} />

              <div className="setting-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                <div>
                  <h4 style={{ color: "#ef4444", margin: "0 0 2px 0" }}>Delete Account</h4>
                  <p style={{ fontSize: "12px", color: "#a3a3a3", margin: 0 }}>Permanently purge your profile, workspaces, code repositories, and chat histories. This cannot be undone.</p>
                </div>
                <button
                  className="modal-btn-save"
                  onClick={handleDeleteAccount}
                  disabled={saving}
                  style={{ background: "#ef4444", width: "auto", alignSelf: "flex-start", marginTop: "4px" }}
                >
                  {saving ? "Deleting..." : "Delete Account"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="modal-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          {activeTab !== "data" && (
            <button
              className="modal-btn-save"
              disabled={saving}
              onClick={
                activeTab === "settings" || activeTab === "engine" || activeTab === "personalize"
                  ? handleSaveSettings
                  : activeTab === "profile"
                  ? handleSaveProfile
                  : handleSaveSettings
              }
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ProfileModal;

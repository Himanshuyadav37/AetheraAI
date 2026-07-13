import { useEffect, useState } from "react";

import DashboardLayout from "../layouts/DashboardLayout";
import { getSettings, saveSettings } from "../services/settingsService";
import "./Settings.css";

function Settings() {
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("theme") !== "light"
  );
  const [autoDebug, setAutoDebug] = useState(true);
  const [autoDeploy, setAutoDeploy] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await getSettings();
        const theme = data.theme || localStorage.getItem("theme") || "dark";

        setDarkMode(theme !== "light");
        setAutoDebug(data.auto_debug ?? true);
        setAutoDeploy(data.auto_deploy ?? false);
        setNotifications(data.notifications ?? data.save_logs ?? true);
      } catch (error) {
        console.error("Failed to load settings", error);
      }
    }

    loadSettings();
  }, []);

  useEffect(() => {
    const theme = darkMode ? "dark" : "light";
    const isLight = theme === "light";

    document.documentElement.classList.toggle("light", isLight);
    document.body.classList.toggle("light", isLight);
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [darkMode]);

  async function persistSettings(nextSettings) {
    try {
      setSaving(true);
      await saveSettings(nextSettings);
    } catch (error) {
      console.error("Failed to save settings", error);
    } finally {
      setSaving(false);
    }
  }

  function updateDarkMode(value) {
    setDarkMode(value);
    persistSettings({ theme: value ? "dark" : "light" });
  }

  function updateAutoDebug(value) {
    setAutoDebug(value);
    persistSettings({ auto_debug: value });
  }

  function updateAutoDeploy(value) {
    setAutoDeploy(value);
    persistSettings({ auto_deploy: value });
  }

  function updateNotifications(value) {
    setNotifications(value);
    persistSettings({ notifications: value });
  }

  return (
    <DashboardLayout>
      <div className="settings-page">
        <div className="settings-header">
          <div>
            <h1>Settings</h1>
            <p>Manage your NexusAI preferences and AI workflow configuration.</p>
          </div>
          <span className="settings-save-state">{saving ? "Saving..." : "Saved"}</span>
        </div>

        <div className="settings-grid">
          <div className="settings-card">
            <h2>Appearance</h2>

            <div className="setting-item">
              <div>
                <h4>Dark Mode</h4>
                <p>Use NexusAI dark theme</p>
              </div>

              <label className="switch">
                <input
                  type="checkbox"
                  checked={darkMode}
                  onChange={event => updateDarkMode(event.target.checked)}
                />
                <span className="slider" />
              </label>
            </div>
          </div>

          <div className="settings-card">
            <h2>AI Agents</h2>

            <div className="setting-item">
              <div>
                <h4>Auto Debug</h4>
                <p>Automatically run debugger on failed tests</p>
              </div>

              <label className="switch">
                <input
                  type="checkbox"
                  checked={autoDebug}
                  onChange={event => updateAutoDebug(event.target.checked)}
                />
                <span className="slider" />
              </label>
            </div>

            <div className="setting-item">
              <div>
                <h4>Auto Deploy</h4>
                <p>Deploy project after successful generation</p>
              </div>

              <label className="switch">
                <input
                  type="checkbox"
                  checked={autoDeploy}
                  onChange={event => updateAutoDeploy(event.target.checked)}
                />
                <span className="slider" />
              </label>
            </div>
          </div>

          <div className="settings-card">
            <h2>Notifications</h2>

            <div className="setting-item">
              <div>
                <h4>Execution Alerts</h4>
                <p>Receive notifications when execution completes</p>
              </div>

              <label className="switch">
                <input
                  type="checkbox"
                  checked={notifications}
                  onChange={event => updateNotifications(event.target.checked)}
                />
                <span className="slider" />
              </label>
            </div>
          </div>

          <div className="settings-card">
            <h2>System Information</h2>

            <div className="info-row">
              <span>Version</span>
              <strong>NexusAI v1.0</strong>
            </div>

            <div className="info-row">
              <span>AI Engine</span>
              <strong>LangGraph</strong>
            </div>

            <div className="info-row">
              <span>Model</span>
              <strong>Llama 3.3 70B</strong>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Settings;
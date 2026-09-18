import React, { useState, useEffect, useRef } from "react";
import {
  Compass,
  Play,
  Square,
  Globe,
  ArrowRight,
  ExternalLink,
  Clock,
  Layers,
  Database,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  Minimize2,
  Copy,
  Download,
  Search,
  Sparkles,
  MousePointer,
  RotateCw
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import api, { getBaseURL } from "../services/api";
import "./NavixWorkspace.css";

export default function NavixWorkspace() {
  // Mission Configuration
  const [goal, setGoal] = useState("");
  const [startUrl, setStartUrl] = useState("");
  const [maxSteps, setMaxSteps] = useState(10);
  const [status, setStatus] = useState("IDLE"); // IDLE, OPERATING, COMPLETED, ABORTED, ERROR
  
  // Execution State
  const [activeTab, setActiveTab] = useState("timeline"); // timeline, data, summary
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [currentUrl, setCurrentUrl] = useState("about:blank");
  const [currentScreenshot, setCurrentScreenshot] = useState(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [steps, setSteps] = useState([]);
  const [extractedData, setExtractedData] = useState([]);
  const [finalSummary, setFinalSummary] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [presets, setPresets] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // References
  const timerRef = useRef(null);
  const abortControllerRef = useRef(null);
  const timelineEndRef = useRef(null);
  const sessionIdRef = useRef(`navix_${Date.now()}`);

  // Fetch presets on mount
  useEffect(() => {
    async function loadPresets() {
      try {
        const res = await api.get("/api/navix/presets");
        if (res.data?.presets) {
          setPresets(res.data.presets);
        }
      } catch (err) {
        console.warn("[Navix] Could not load presets:", err);
      }
    }
    loadPresets();
  }, []);

  // Timer effect
  useEffect(() => {
    if (status === "OPERATING") {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  // Auto-scroll timeline
  useEffect(() => {
    if (timelineEndRef.current && activeTab === "timeline") {
      timelineEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [steps, activeTab]);

  // Handle Preset Select
  const handleSelectPreset = (preset) => {
    setGoal(preset.goal);
    setStartUrl(preset.url || "");
  };

  // Start Autonomous Mission
  const handleStartMission = async () => {
    if (!goal.trim() || status === "OPERATING") return;

    setStatus("OPERATING");
    setSteps([]);
    setExtractedData([]);
    setFinalSummary("");
    setErrorMessage("");
    setCurrentStep(0);
    setElapsedSeconds(0);
    setCurrentUrl(startUrl.trim() || "Initializing...");
    setCurrentScreenshot(null);

    const sessionId = `navix_${Date.now()}`;
    sessionIdRef.current = sessionId;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Detect API Base URL
    const baseUrl = api.defaults.baseURL || getBaseURL();
    const endpoint = `${baseUrl}/api/navix/stream`;

    const token = localStorage.getItem("token");
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          goal: goal.trim(),
          start_url: startUrl.trim() || null,
          max_steps: Number(maxSteps),
          headless: true,
          session_id: sessionId
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const line = part.trim();
          if (line.startsWith("data: ")) {
            const jsonStr = line.replace("data: ", "").trim();
            try {
              const event = JSON.parse(jsonStr);
              handleNavixEvent(event);
            } catch (jsonErr) {
              console.warn("[Navix] Stream JSON parse error:", jsonErr, jsonStr);
            }
          }
        }
      }

      setStatus((prev) => (prev === "OPERATING" ? "COMPLETED" : prev));
    } catch (err) {
      if (err.name === "AbortError") {
        setStatus("ABORTED");
      } else {
        console.error("[Navix] Mission execution error:", err);
        setStatus("ERROR");
        setErrorMessage(err.message || "Failed to execute autonomous session");
      }
    }
  };

  // Process incoming SSE events from backend
  const handleNavixEvent = (event) => {
    if (event.url) setCurrentUrl(event.url);
    if (event.screenshot) setCurrentScreenshot(event.screenshot);
    if (event.cursor) setCursorPos(event.cursor);
    if (event.step !== undefined) setCurrentStep(event.step);

    if (event.extracted_data && Array.isArray(event.extracted_data)) {
      setExtractedData(event.extracted_data);
    }

    if (event.summary) {
      setFinalSummary(event.summary);
      setActiveTab("summary");
    }

    if (event.type === "step") {
      setSteps((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          step: event.step,
          phase: event.phase || "EXECUTED",
          action: event.action || "action",
          thought: event.thought || "",
          action_detail: event.action_detail,
          url: event.url,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } else if (event.type === "error") {
      setStatus("ERROR");
      setErrorMessage(event.message || event.error || "Unknown agent error");
    }
  };

  // Abort running mission
  const handleAbort = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    try {
      await api.post("/api/navix/abort", { session_id: sessionIdRef.current });
    } catch (err) {
      console.warn("[Navix] Abort signal notification error:", err);
    }
    setStatus("ABORTED");
  };

  // Format seconds to mm:ss
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remSecs.toString().padStart(2, "0")}`;
  };

  // Download Extracted JSON
  const handleDownloadJSON = () => {
    const blob = new Blob([JSON.stringify(extractedData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `navix_extracted_${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="navix-layout-root">
      <Sidebar />

      <main className="navix-main-container">
        {/* Top Operational Header */}
        <header className="navix-header-bar">
          <div className="navix-brand-title">
            <div className="navix-logo-badge">
              <Compass size={18} className={status === "OPERATING" ? "spin-icon" : ""} />
            </div>
            <div>
              <div className="navix-title-text">
                AETHERA <strong>NAVIX</strong>
                <span className="navix-version-tag">AUTONOMOUS OPERATOR</span>
              </div>
              <p className="navix-subtitle-text">Autonomous Browser Intelligence & Dynamic Web Agent</p>
            </div>
          </div>

          <div className="navix-telemetry-strip">
            <div className="telemetry-pill">
              <span className={`status-indicator-dot dot-${status.toLowerCase()}`} />
              <span className="telemetry-label">STATUS</span>
              <span className="telemetry-val">{status}</span>
            </div>

            <div className="telemetry-pill">
              <Layers size={13} className="text-zinc-400" />
              <span className="telemetry-label">STEP</span>
              <span className="telemetry-val">{currentStep} / {maxSteps}</span>
            </div>

            <div className="telemetry-pill">
              <Clock size={13} className="text-zinc-400" />
              <span className="telemetry-label">TIME</span>
              <span className="telemetry-val">{formatTime(elapsedSeconds)}</span>
            </div>

            <div className="telemetry-pill">
              <Database size={13} className="text-zinc-400" />
              <span className="telemetry-label">DATA</span>
              <span className="telemetry-val">{extractedData.length} items</span>
            </div>

            {status === "OPERATING" ? (
              <button className="navix-abort-btn" onClick={handleAbort}>
                <Square size={14} /> Abort
              </button>
            ) : null}
          </div>
        </header>

        {/* Dual Command Workspace */}
        <div className="navix-workspace-grid">
          {/* Left Column: Mission Control & Data Stream */}
          <div className="navix-control-panel">
            {/* Mission Setup Box */}
            <div className="mission-input-card">
              <div className="card-top-label">
                <Sparkles size={13} />
                <span>MISSION DIRECTIVE</span>
              </div>

              <textarea
                className="mission-goal-textarea"
                rows={3}
                placeholder="What web task should Aethera NAVIX execute? (e.g. 'Search ArXiv for GRPO papers and extract titles and abstracts')..."
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                disabled={status === "OPERATING"}
              />

              <div className="mission-config-row">
                <div className="url-input-wrap">
                  <Globe size={14} className="url-icon" />
                  <input
                    type="text"
                    className="mission-url-input"
                    placeholder="Start URL (optional, e.g. https://arxiv.org)"
                    value={startUrl}
                    onChange={(e) => setStartUrl(e.target.value)}
                    disabled={status === "OPERATING"}
                  />
                </div>

                <div className="steps-selector-wrap">
                  <span className="steps-label">Steps:</span>
                  <select
                    className="steps-select"
                    value={maxSteps}
                    onChange={(e) => setMaxSteps(Number(e.target.value))}
                    disabled={status === "OPERATING"}
                  >
                    <option value={5}>5 Steps</option>
                    <option value={10}>10 Steps</option>
                    <option value={15}>15 Steps</option>
                    <option value={20}>20 Steps</option>
                  </select>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="presets-row">
                <span className="presets-label">Presets:</span>
                <div className="preset-chips-scroll">
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      className="preset-chip"
                      onClick={() => handleSelectPreset(p)}
                      disabled={status === "OPERATING"}
                    >
                      {p.title}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mission-actions-row">
                <button
                  className="navix-launch-btn"
                  onClick={handleStartMission}
                  disabled={status === "OPERATING" || !goal.trim()}
                >
                  {status === "OPERATING" ? (
                    <>
                      <RotateCw size={15} className="spin-icon" />
                      Autonomous Operator Active...
                    </>
                  ) : (
                    <>
                      <Play size={15} />
                      Launch Autonomous Mission
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="navix-mode-tabs">
              <button
                className={`mode-tab-btn ${activeTab === "timeline" ? "active" : ""}`}
                onClick={() => setActiveTab("timeline")}
              >
                <Terminal size={14} />
                <span>Action Timeline ({steps.length})</span>
              </button>
              <button
                className={`mode-tab-btn ${activeTab === "data" ? "active" : ""}`}
                onClick={() => setActiveTab("data")}
              >
                <Database size={14} />
                <span>Extracted Data ({extractedData.length})</span>
              </button>
              <button
                className={`mode-tab-btn ${activeTab === "summary" ? "active" : ""}`}
                onClick={() => setActiveTab("summary")}
              >
                <CheckCircle2 size={14} />
                <span>Findings Report</span>
              </button>
            </div>

            {/* Tab 1: Action Timeline */}
            {activeTab === "timeline" && (
              <div className="navix-timeline-feed">
                {steps.length === 0 ? (
                  <div className="empty-timeline-state">
                    <Compass size={32} className="text-zinc-600" />
                    <h4>Awaiting Mission Directives</h4>
                    <p>Enter a task prompt above and click Launch to observe real-time autonomous reasoning.</p>
                  </div>
                ) : (
                  <div className="timeline-items-list">
                    {steps.map((s, idx) => (
                      <div key={idx} className="timeline-step-card">
                        <div className="step-card-header">
                          <div className="step-num-badge">STEP {s.step}</div>
                          <span className={`step-action-tag action-${s.action}`}>
                            {s.action.toUpperCase()}
                          </span>
                          <span className="step-time">{s.timestamp}</span>
                        </div>

                        <div className="step-thought-text">
                          "{s.thought}"
                        </div>

                        {s.action_detail && (
                          <div className="step-detail-box">
                            {s.action === "type" && (
                              <span>Typed: <strong>"{s.action_detail.value}"</strong> into {s.action_detail.selector}</span>
                            )}
                            {s.action === "click" && (
                              <span>Clicked: <code>{s.action_detail.selector || s.action_detail.text}</code></span>
                            )}
                            {s.action === "scroll" && (
                              <span>Scrolled {s.action_detail.direction} by {s.action_detail.amount}px</span>
                            )}
                            {s.action === "navigate" && (
                              <span>Navigated to: {s.action_detail.url}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={timelineEndRef} />
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Extracted Data Table */}
            {activeTab === "data" && (
              <div className="navix-data-feed">
                <div className="data-feed-header">
                  <span>Structured Artifacts ({extractedData.length} records)</span>
                  {extractedData.length > 0 && (
                    <button className="export-btn" onClick={handleDownloadJSON}>
                      <Download size={13} /> Export JSON
                    </button>
                  )}
                </div>

                {extractedData.length === 0 ? (
                  <div className="empty-timeline-state">
                    <Database size={32} className="text-zinc-600" />
                    <p>No structured data items extracted yet.</p>
                  </div>
                ) : (
                  <div className="data-cards-grid">
                    {extractedData.map((item, i) => (
                      <div key={i} className="extracted-data-card">
                        <pre className="data-card-code">{JSON.stringify(item, null, 2)}</pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Executive Findings Summary */}
            {activeTab === "summary" && (
              <div className="navix-summary-feed">
                {finalSummary ? (
                  <div className="summary-markdown-card">
                    <div className="summary-title-badge">
                      <CheckCircle2 size={16} className="text-emerald-400" />
                      <span>EXECUTIVE MISSION REPORT</span>
                    </div>
                    <div className="summary-body-text">
                      {finalSummary.split("\n").map((line, lidx) => (
                        <p key={lidx}>{line}</p>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="empty-timeline-state">
                    <CheckCircle2 size={32} className="text-zinc-600" />
                    <p>Executive report will compile once the autonomous mission concludes.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Simulated Live Virtual Browser */}
          <div className={`navix-browser-viewport-wrapper ${isFullscreen ? "is-fullscreen" : ""}`}>
            <div className="simulated-browser-chrome">
              {/* Window Controls */}
              <div className="chrome-window-dots">
                <span className="dot dot-red" />
                <span className="dot dot-yellow" />
                <span className="dot dot-green" />
              </div>

              {/* Address Bar */}
              <div className="chrome-address-bar">
                <Globe size={13} className="chrome-lock-icon" />
                <span className="chrome-url-text">{currentUrl}</span>
                {currentUrl && currentUrl.startsWith("http") && (
                  <a
                    href={currentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="chrome-ext-link"
                    title="Open in new tab"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>

              {/* Actions */}
              <div className="chrome-actions">
                <span className="chrome-resolution-tag">1280 × 800</span>
                <button
                  className="chrome-btn"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              </div>
            </div>

            {/* Viewport Canvas Screen */}
            <div className="simulated-viewport-screen">
              {currentScreenshot ? (
                <div className="viewport-image-container">
                  <img
                    src={currentScreenshot}
                    alt="Live Browser Frame"
                    className="live-viewport-frame"
                  />
                  {/* Simulated Glowing Red Agent Cursor */}
                  {cursorPos.x > 0 && cursorPos.y > 0 && (
                    <div
                      className="simulated-agent-cursor"
                      style={{
                        left: `${(cursorPos.x / 1280) * 100}%`,
                        top: `${(cursorPos.y / 800) * 100}%`
                      }}
                    >
                      <span className="cursor-ring" />
                      <MousePointer size={14} className="cursor-icon" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="viewport-standby-state">
                  <div className="standby-radar-circle">
                    <Compass size={48} className="radar-icon" />
                  </div>
                  <h3>AETHERA NAVIX ENGINE PRIMED</h3>
                  <p>Playwright Chromium v126 Sandbox is Online & Ready.</p>
                  <div className="standby-specs-row">
                    <span>Engine: Async Chromium</span>
                    <span>•</span>
                    <span>Viewport: 1280x800</span>
                    <span>•</span>
                    <span>Mode: Autonomous Reactive</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

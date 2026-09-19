import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Monitor,
  Terminal,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Cpu,
  HardDrive,
  Activity,
  FolderCode,
  Globe,
  SendHorizonal,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Square
} from "lucide-react";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  runComputerTask,
  approveComputerAction,
  resetComputerSession,
  getComputerScreenshot,
  getSystemTelemetry,
  getComputerWebSocketUrl,
  transcribeVoiceAudio
} from "../../services/ComputerApi";
import ExpandableMarkdown from "./ExpandableMarkdown";
import ExpandableCode from "./ExpandableCode";
import TypewriterHeading from "./TypewriterHeading";
import "./ComputerChat.css";
import "../../styles/workspace.css";

const ASTRA_TITLES = [
  "Astra — Autonomous AI Computer & Browser Agent",
  "Operate persistent browser, navigate websites, & search interactively",
  "Multi-turn contextual reasoning: 'Open YouTube' → 'Search Python' → 'Play first video'",
  "Live screen viewport, two-way voice loop, & real-time tool verification"
];

const STARTER_PRESETS = [
  {
    icon: <Globe size={15} className="text-red-400" />,
    title: "1. Open YouTube",
    prompt: "Open YouTube"
  },
  {
    icon: <Terminal size={15} className="text-blue-400" />,
    title: "2. Search Python tutorials",
    prompt: "Search Python tutorials on YouTube"
  },
  {
    icon: <Play size={15} className="text-emerald-400" />,
    title: "3. Play first video",
    prompt: "Play the first video"
  },
  {
    icon: <Activity size={15} className="text-purple-400" />,
    title: "4. System Diagnostics",
    prompt: "Inspect system hardware telemetry, active CPU load, and RAM usage."
  }
];

function ComputerChat() {
  const { user, requireAuth, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const {
    moduleState,
    setMessages,
    setResult,
    setActiveId,
    setLoading,
    refreshHistory,
    switchModule
  } = useWorkspace();

  const computerState = moduleState.computer || { messages: [], result: null, loading: false, activeId: null };
  const { messages = [], result = null, loading = false, activeId = null } = computerState;

  const [prompt, setPrompt] = useState("");
  const [telemetry, setTelemetry] = useState(null);
  const [screenshot, setScreenshot] = useState(null);
  const [currentUrl, setCurrentUrl] = useState("about:blank");
  const [currentTitle, setCurrentTitle] = useState("Astra Browser Engine");
  const [cursorPos, setCursorPos] = useState([640, 360]);

  // Voice States
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const shouldKeepListeningRef = useRef(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Approval Gate & Expanded steps
  const [approvalFeedback, setApprovalFeedback] = useState("");
  const [approving, setApproving] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState({});

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const wsRef = useRef(null);

  const sessionId = activeId || "astra_active_session";

  useEffect(() => {
    if (!isAdmin) return;
    fetchTelemetry();
    setupWebSocket();
    setupSpeechRecognition();

    return () => {
      shouldKeepListeningRef.current = false;
      if (wsRef.current) wsRef.current.close();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      window.speechSynthesis?.cancel();
    };
  }, [sessionId, isAdmin]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function fetchTelemetry() {
    try {
      const data = await getSystemTelemetry();
      setTelemetry(data);
    } catch (err) {
      console.warn("Failed to fetch telemetry:", err);
    }
  }

  function setupWebSocket() {
    try {
      const wsUrl = getComputerWebSocketUrl(sessionId);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.screenshot) {
            setScreenshot(data.screenshot);
          }
          if (data.url) setCurrentUrl(data.url);
          if (data.title) setCurrentTitle(data.title);
          if (data.cursor_position) setCursorPos(data.cursor_position);
        } catch (e) {
          console.warn("WebSocket parse error:", e);
        }
      };
    } catch (e) {
      console.warn("WebSocket setup error:", e);
    }
  }

  function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognizer = new SpeechRecognition();
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.lang = "en-IN"; // Supports English, Indian accents, & Hindi command phrases

      recognizer.onstart = () => {
        setIsListening(true);
        setInterimTranscript("");
      };

      recognizer.onend = () => {
        if (shouldKeepListeningRef.current) {
          setTimeout(() => {
            try {
              if (shouldKeepListeningRef.current) recognizer.start();
            } catch (e) {}
          }, 150);
        } else {
          setIsListening(false);
        }
      };

      recognizer.onerror = (event) => {
        console.warn("Speech recognition event:", event.error);
        if (event.error !== "no-speech" && event.error !== "network") {
          setIsListening(false);
          shouldKeepListeningRef.current = false;
        }
      };

      recognizer.onresult = (event) => {
        let interim = "";
        let finalStr = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalStr += trans;
          } else {
            interim += trans;
          }
        }

        const currentText = finalStr || interim;
        if (currentText && currentText.trim()) {
          setInterimTranscript(currentText.trim());
          setPrompt(currentText.trim());

          // Clear previous silence timer
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

          // Auto-send after brief silence
          if (finalStr && finalStr.trim().length > 2) {
            silenceTimerRef.current = setTimeout(() => {
              handleSend(finalStr.trim());
              setInterimTranscript("");
            }, 800);
          } else if (interim && interim.trim().length > 2) {
            silenceTimerRef.current = setTimeout(() => {
              handleSend(interim.trim());
              setInterimTranscript("");
            }, 1800);
          }
        }
      };

      recognitionRef.current = recognizer;
    }
  }

  async function startAudioRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.start(250);
      mediaRecorderRef.current = mediaRecorder;
    } catch (err) {
      console.warn("MediaRecorder mic access error:", err);
    }
  }

  async function stopAudioRecordingAndTranscribe() {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return "";
    return new Promise((resolve) => {
      mediaRecorderRef.current.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          if (audioBlob.size > 1000) {
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64 = reader.result;
              try {
                const res = await transcribeVoiceAudio(base64);
                resolve(res.transcript || "");
              } catch (e) {
                resolve("");
              }
            };
            reader.readAsDataURL(audioBlob);
          } else {
            resolve("");
          }
        } catch (e) {
          resolve("");
        }
      };
      mediaRecorderRef.current.stop();
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
    });
  }

  async function toggleListening() {
    if (isListening) {
      shouldKeepListeningRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsListening(false);

      // If we have recognized text, send it
      const pendingText = interimTranscript.trim() || prompt.trim();
      if (pendingText) {
        handleSend(pendingText);
        setInterimTranscript("");
      } else {
        // Fallback to Whisper audio transcription
        const whisperText = await stopAudioRecordingAndTranscribe();
        if (whisperText && whisperText.trim()) {
          setPrompt(whisperText.trim());
          handleSend(whisperText.trim());
        }
      }
    } else {
      // Cancel speech synthesis so AI doesn't talk over user
      window.speechSynthesis?.cancel();
      setInterimTranscript("");
      shouldKeepListeningRef.current = true;
      setIsListening(true);

      // Start hardware audio recorder for Whisper backup
      startAudioRecording();

      // Start Web Speech recognizer
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.warn("Speech recognition start warning:", e);
        }
      }
    }
  }

  function speakVoiceResponse(text) {
    if (!isVoiceEnabled || !window.speechSynthesis || !text) return;
    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*_#`]/g, "").trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
    }
  }

  async function handleSend(customPrompt = null) {
    const textToSend = (customPrompt || prompt).trim();
    if (!textToSend || loading) return;

    // Clear interim voice display
    setInterimTranscript("");
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    const userMsg = {
      id: `user_${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toISOString()
    };

    setMessages("computer", (prev = []) => [...prev, userMsg]);
    setPrompt("");
    setLoading("computer", true);

    const historyPayload = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content
    }));

    try {
      const response = await runComputerTask({
        prompt: textToSend,
        session_id: sessionId,
        history: historyPayload
      });

      const voiceText = response.voice_response || response.final_output || "Action completed.";
      const assistantMsg = {
        id: `asst_${Date.now()}`,
        role: "assistant",
        content: voiceText,
        result: response,
        timestamp: new Date().toISOString()
      };

      setMessages("computer", (prev = []) => [...prev, assistantMsg]);
      setResult("computer", response);
      if (response.session_id) setActiveId("computer", response.session_id);
      if (response.screenshot) setScreenshot(response.screenshot);
      if (response.current_url) setCurrentUrl(response.current_url);
      if (response.current_title) setCurrentTitle(response.current_title);
      if (response.cursor_position) setCursorPos(response.cursor_position);

      // Speak aloud natural response
      speakVoiceResponse(voiceText);
      refreshHistory("computer");
    } catch (err) {
      const errorMsg = {
        id: `err_${Date.now()}`,
        role: "assistant",
        content: `⚠️ Error executing Astra action: ${err.response?.data?.detail || err.message}`,
        timestamp: new Date().toISOString()
      };
      setMessages("computer", (prev = []) => [...prev, errorMsg]);
    } finally {
      setLoading("computer", false);
    }
  }

  async function handleResetSession() {
    if (!window.confirm("Reset active Astra browser session & conversation context?")) return;
    try {
      await resetComputerSession(sessionId);
      setScreenshot(null);
      setCurrentUrl("about:blank");
      setCurrentTitle("Astra Browser Engine");
      setMessages("computer", []);
      setResult("computer", null);
      speakVoiceResponse("Session reset. Ready for new commands.");
    } catch (err) {
      alert("Failed to reset session: " + err.message);
    }
  }

  async function handleApproval(approved) {
    if (!result?.pending_approval || approving) return;
    setApproving(true);
    try {
      const updated = await approveComputerAction({
        session_id: sessionId,
        approved,
        feedback: approvalFeedback
      });

      const voiceText = updated.voice_response || updated.final_output || (approved ? "Action approved." : "Action cancelled.");
      const updatedMsg = {
        id: `appr_${Date.now()}`,
        role: "assistant",
        content: voiceText,
        result: updated,
        timestamp: new Date().toISOString()
      };

      setMessages("computer", (prev = []) => [...prev, updatedMsg]);
      setResult("computer", updated);
      if (updated.screenshot) setScreenshot(updated.screenshot);
      if (updated.current_url) setCurrentUrl(updated.current_url);
      speakVoiceResponse(voiceText);
      refreshHistory("computer");
    } catch (err) {
      alert("Approval error: " + (err.response?.data?.detail || err.message));
    } finally {
      setApproving(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="astra-restricted-wrapper" style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "440px",
        height: "100%",
        padding: "2.5rem 1.5rem",
        textAlign: "center"
      }}>
        <div style={{
          width: "60px",
          height: "60px",
          borderRadius: "16px",
          background: "rgba(239, 68, 68, 0.12)",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ef4444",
          marginBottom: "1.25rem",
          boxShadow: "0 0 20px rgba(239, 68, 68, 0.15)"
        }}>
          <ShieldAlert size={30} />
        </div>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.5rem" }}>
          Astra OS Access Restricted
        </h2>
        <p style={{ maxWidth: "460px", color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
          Autonomous browser execution, OS automation, and system viewport control are restricted strictly to Administrators.
        </p>
        <button
          type="button"
          className="primary-btn"
          onClick={() => switchModule("engineer")}
          style={{ padding: "0.65rem 1.5rem", borderRadius: "10px", fontSize: "0.9rem", fontWeight: 600 }}
        >
          Return to Craft Workspace
        </button>
      </div>
    );
  }

  const activeResult = result || messages.slice().reverse().find((m) => m.role === "assistant" && m.result)?.result;
  const pendingApproval = activeResult?.pending_approval;

  return (
    <div className="astra-root">
      {/* 1. Top Enterprise Control Bar */}
      <header className="astra-topbar">
        <div className="astra-topbar-left">
          <div className="astra-brand-badge">
            <span className="astra-pulse-indicator" />
            <span>ASTRA ● PERSISTENT OS</span>
          </div>

          {telemetry && (
            <>
              <div className="astra-telemetry-chip">
                <Monitor size={12} className="text-blue-400" />
                <span>{telemetry.platform} {telemetry.os_release}</span>
              </div>
              <div className="astra-telemetry-chip">
                <Cpu size={12} className="text-amber-400" />
                <span>CPU {telemetry.cpu_usage_pct}%</span>
              </div>
            </>
          )}
        </div>

        <div className="astra-topbar-right">
          {/* Voice Speaking Indicator */}
          {isSpeaking && (
            <div className="astra-voice-speaking-indicator">
              <div className="astra-voice-wave-bars">
                <div className="astra-wave-bar" />
                <div className="astra-wave-bar" />
                <div className="astra-wave-bar" />
                <div className="astra-wave-bar" />
              </div>
              <span>Speaking</span>
            </div>
          )}

          {/* Voice Output Mute Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsVoiceEnabled(!isVoiceEnabled);
              if (isVoiceEnabled) window.speechSynthesis?.cancel();
            }}
            className="astra-icon-btn"
            title={isVoiceEnabled ? "Mute Voice Feedback" : "Enable Voice Feedback"}
          >
            {isVoiceEnabled ? <Volume2 size={14} className="text-emerald-400" /> : <VolumeX size={14} className="text-zinc-500" />}
          </button>

          {/* Reset Session */}
          <button
            type="button"
            onClick={handleResetSession}
            className="astra-reset-btn"
            title="Reset Browser & Agent Session Context"
          >
            <RotateCcw size={12} />
            <span>Reset Context</span>
          </button>
        </div>
      </header>

      {/* 2. Main 2-Column Split Layout */}
      <div className="astra-body-grid">
        {/* Left Column: Two-Way Conversation & Action Feed */}
        <div className="astra-chat-pane">
          <div className="astra-messages-scroll">
            {messages.length === 0 ? (
              <div className="astra-hero-box">
                <div className="astra-hero-icon-wrapper">
                  <Monitor size={26} />
                </div>
                <div className="astra-hero-title">
                  <TypewriterHeading titles={ASTRA_TITLES} />
                </div>
                <p className="astra-hero-desc">
                  Astra understands natural follow-up commands, operates persistent Chromium, observes visual DOM changes, and speaks back naturally.
                </p>

                {/* 2x2 Starter Presets Grid */}
                <div className="astra-presets-grid">
                  {STARTER_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSend(preset.prompt)}
                      className="astra-preset-card"
                    >
                      <div className="astra-preset-icon-box">{preset.icon}</div>
                      <div>
                        <div className="astra-preset-title">{preset.title}</div>
                        <div className="astra-preset-subtitle">Click to execute command</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, mIdx) => (
                <div key={msg.id || mIdx}>
                  {msg.role === "user" ? (
                    <div className="astra-msg-user">
                      <div className="astra-user-bubble">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div className="astra-msg-assistant">
                      {/* Execution Action Step Card */}
                      {msg.result?.steps && msg.result.steps.length > 0 && (
                        <div className="astra-action-card">
                          <div className="astra-action-card-header">
                            <div className="flex items-center gap-2">
                              <Terminal size={13} className="text-blue-400" />
                              <span>Action Execution Timeline</span>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                              {msg.result.tool || "VERIFIED"}
                            </span>
                          </div>

                          <div>
                            {msg.result.steps.map((step, sIdx) => (
                              <div key={sIdx} className="astra-action-step-item">
                                <div className="astra-step-thought">
                                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                                  <span>{step.thought}</span>
                                </div>
                                {step.observation && (
                                  <div className="astra-observation-box">
                                    <ExpandableCode value={step.observation} />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sensitive Gating Banner */}
                      {pendingApproval && mIdx === messages.length - 1 && (
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-3">
                          <div className="flex items-start gap-2.5">
                            <ShieldAlert size={18} className="text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <div className="font-semibold text-xs text-amber-300">Authorization Required</div>
                              <p className="text-[11px] text-amber-200/80 mt-0.5">
                                {pendingApproval.reason || "Astra requires your confirmation before proceeding."}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleApproval(true)}
                              disabled={approving}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition flex items-center gap-1.5 shadow"
                            >
                              <Check size={12} />
                              <span>Approve & Execute</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproval(false)}
                              disabled={approving}
                              className="px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white font-semibold text-xs transition flex items-center gap-1.5"
                            >
                              <XCircle size={12} />
                              <span>Cancel</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Astra Spoken / Synthesis Box */}
                      <div className="astra-response-box">
                        <div className="astra-response-avatar">
                          <Monitor size={15} />
                        </div>
                        <div className="flex-1 overflow-x-auto text-xs leading-relaxed">
                          <ExpandableMarkdown content={msg.content} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {loading && (
              <div className="astra-loading-row">
                <Loader2 size={14} className="animate-spin" />
                <span>Astra operating computer & observing real-time state...</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Prompt Deck on Left Pane Bottom */}
          <div className="astra-prompt-deck">
            {/* Live Listening Waveform Banner */}
            {isListening && (
              <div className="astra-listening-banner">
                <div className="astra-voice-wave-bars">
                  <div className="astra-wave-bar" />
                  <div className="astra-wave-bar" />
                  <div className="astra-wave-bar" />
                  <div className="astra-wave-bar" />
                </div>
                <span className="text-xs text-sky-400 font-medium">
                  {interimTranscript ? `Listening: "${interimTranscript}"` : "Listening... Speak your command (e.g. 'Open YouTube')"}
                </span>
              </div>
            )}

            <div className="astra-quick-chips">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mr-1">Quick:</span>
              <button type="button" onClick={() => handleSend("Open YouTube")} className="astra-chip">Open YouTube</button>
              <button type="button" onClick={() => handleSend("Search Python tutorials")} className="astra-chip">Search Python</button>
              <button type="button" onClick={() => handleSend("Play the first video")} className="astra-chip">Play 1st Video</button>
              <button type="button" onClick={() => handleSend("Search Google for AI trends 2026")} className="astra-chip">Google AI</button>
            </div>

            <div className={`astra-input-bar ${isListening ? "listening-active" : ""}`}>
              <button
                type="button"
                onClick={toggleListening}
                className={`astra-voice-mic-btn ${isListening ? "active" : ""}`}
                title={isListening ? "Listening... (Click to stop)" : "Speak to Astra (Continuous Voice Mode)"}
              >
                <Mic size={16} />
              </button>

              <input
                ref={textareaRef}
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={isListening ? "Listening to your voice..." : "Tell Astra what to do (e.g. 'Open YouTube', 'Search Python', 'Play first video')..."}
                className="astra-prompt-input"
                disabled={loading}
              />

              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!prompt.trim() || loading}
                className="astra-send-btn"
                title="Send Command"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <SendHorizonal size={15} />}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Real-Time Live Browser Viewport */}
        <div className="astra-viewport-pane">
          {/* macOS / Chrome Window Frame Header */}
          <div className="astra-window-frame-header">
            <div className="astra-window-dots">
              <div className="astra-window-dot red" />
              <div className="astra-window-dot yellow" />
              <div className="astra-window-dot green" />
            </div>

            <div className="astra-window-nav-btns">
              <button
                type="button"
                onClick={() => handleSend("Go back")}
                className="astra-nav-btn"
                title="Go Back"
              >
                <ArrowLeft size={13} />
              </button>
              <button
                type="button"
                onClick={() => handleSend("Go forward")}
                className="astra-nav-btn"
                title="Go Forward"
              >
                <ArrowRight size={13} />
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const data = await getComputerScreenshot(sessionId);
                    if (data.screenshot) setScreenshot(data.screenshot);
                    if (data.url) setCurrentUrl(data.url);
                    if (data.title) setCurrentTitle(data.title);
                  } catch (e) {}
                }}
                className="astra-nav-btn"
                title="Capture Real Desktop Screen"
              >
                <RefreshCw size={13} />
              </button>
            </div>

            <div className="astra-address-bar">
              <Monitor size={12} className="text-emerald-400 shrink-0" />
              <span className="url-text">{currentUrl}</span>
            </div>

            {currentUrl.startsWith("http") && (
              <a
                href={currentUrl}
                target="_blank"
                rel="noreferrer"
                className="astra-nav-btn"
                title="Open in External Tab"
              >
                <ExternalLink size={13} />
              </a>
            )}
          </div>

          {/* Screen Canvas Viewport */}
          <div className="astra-viewport-canvas">
            {screenshot ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img
                  src={screenshot}
                  alt="Live Real Desktop Viewport"
                  className="astra-screenshot-img"
                />
                {/* Real Device Host Mode Chip */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md border border-emerald-500/30 text-[10px] font-mono text-emerald-400 flex items-center gap-1.5 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>LIVE HOST DESKTOP FEED</span>
                </div>

                {/* Live Simulated Cursor Overlay */}
                <div
                  className="astra-cursor-overlay"
                  style={{
                    left: `${(cursorPos[0] / 1280) * 100}%`,
                    top: `${(cursorPos[1] / 720) * 100}%`
                  }}
                >
                  <div className="astra-cursor-laser" />
                </div>
              </div>
            ) : (
              <div className="astra-empty-viewport">
                <div className="astra-radar-box">
                  <Monitor size={30} />
                </div>
                <div className="astra-empty-title">Native Computer Agent Ready</div>
                <div className="astra-empty-subtitle">
                  Say or type <span className="text-sky-400 font-mono">"Open YouTube"</span>, <span className="text-sky-400 font-mono">"Search Python"</span>, or <span className="text-sky-400 font-mono">"Open Notepad"</span> to operate your physical PC.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ComputerChat;

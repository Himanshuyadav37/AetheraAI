import React, { useState, useRef, useEffect } from "react";
import { 
  Briefcase, FileText, CheckCircle2, AlertTriangle, Sparkles, Send, 
  Copy, Check, ChevronRight, ChevronDown, Award, RefreshCw, MessageSquare, 
  Target, UserCheck, ArrowRight, Loader2, ShieldCheck, Zap, 
  Terminal, BarChart2, HelpCircle, Upload, Code2, Trash2, Edit3, 
  Info, ExternalLink, FileCheck, CheckCircle, Mic, MicOff, Video, VideoOff,
  Monitor, Maximize, Volume2, Lock, ShieldAlert, Clock, Radio, Play, Square, AlertOctagon
} from "lucide-react";
import Editor from "@monaco-editor/react";
import DashboardLayout from "../layouts/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import "./CareerStudio.css";

const PRESET_ROLES = [
  "Full-Stack Software Engineer",
  "Backend Engineer",
  "Frontend React / Next.js Engineer",
  "AI / Machine Learning Engineer",
  "Generative AI Engineer",
  "DevOps & Platform Cloud Engineer",
  "Data Scientist & Analyst",
  "Technical Product Manager",
  "Engineering Manager / Tech Lead",
  "Custom Role"
];

const SAMPLE_TEXT_RESUME = `SENIOR FULL-STACK SOFTWARE ENGINEER
Summary: Product-focused engineer with 4+ years architecting scalable cloud services, web applications, and distributed systems in Python, React, and PostgreSQL.

Professional Experience:
Software Engineer | Stripe & CloudTech Ecosystem (2022 - Present)
- Architected RESTful and GraphQL backend microservices handling 40,000+ daily transactions with 99.98% uptime.
- Optimized PostgreSQL indexing and query execution paths, reducing average API response latency by 38%.
- Collaborated with product, design, and security leads to deploy real-time websocket monitoring dashboards.
- Refactored legacy monolithic services into containerized Docker services running on Kubernetes.

Full-Stack Developer | InnovateX Labs (2020 - 2022)
- Built interactive client-facing dashboards in React, TypeScript, and Tailwind CSS.
- Automated CI/CD deployment pipelines using GitHub Actions, decreasing release cycle times from 2 days to 15 minutes.
- Authored comprehensive integration test suites using PyTest and Jest, boosting test coverage to 86%.

Core Competencies: Python, FastAPI, Node.js, React, TypeScript, PostgreSQL, Redis, Docker, Kubernetes, AWS, System Design.`;

const SAMPLE_LATEX_RESUME = `\\documentclass[letterpaper,11pt]{article}
\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}

\\begin{document}
\\section{SUMMARY}
Senior Backend \\& AI Engineer with 4+ years building high-throughput distributed systems, microservices in Python/FastAPI, and production LLM RAG pipelines.

\\section{EXPERIENCE}
\\textbf{Senior Software Engineer} | \\textit{Apex Cloud Infrastructure} \\hfill 2022 -- Present
\\begin{itemize}
  \\item Architected event-driven microservices processing 50M+ daily events with 99.99\\% reliability using FastAPI, Kafka, and Redis.
  \\item Lowered database query execution latency by 45\\% through PostgreSQL partition pruning and connection pooling.
  \\item Spearheaded migration of containerized services to Amazon EKS (Kubernetes) with automated ArgoCD GitOps pipelines.
\\end{itemize}

\\textbf{Full-Stack Engineer} | \\textit{Nova Digital} \\hfill 2020 -- 2022
\\begin{itemize}
  \\item Developed real-time telemetry dashboards using React, Next.js, and WebSockets.
  \\item Implemented OAuth2 and JWT authentication mechanisms across 8 internal microservices.
\\end{itemize}

\\section{TECHNICAL SKILLS}
\\textbf{Languages}: Python, TypeScript, Go, SQL, Bash \\\\
\\textbf{Frameworks}: FastAPI, React, Next.js, PyTorch, LangChain \\\\
\\textbf{Databases \\& Tools}: PostgreSQL, Redis, Docker, Kubernetes, AWS, Kafka, CI/CD
\\end{document}`;

const LOADING_STAGES = [
  "Parsing Resume Structure & Sections",
  "Extracting Skills, Tools & Technical Entities",
  "Analyzing ATS Algorithm Compatibility",
  "Cross-Referencing Target Job Description",
  "Evaluating Bullet Impact & Measurable Metrics",
  "Synthesizing Actionable Priority Recommendations"
];

export default function CareerStudioPage() {
  const [activeTab, setActiveTab] = useState("resume"); // "resume" | "interview" | "outreach"

  // -------------------------------------------------------------
  // TAB 1: RESUME ATS SCANNER STATE
  // -------------------------------------------------------------
  const [inputMode, setInputMode] = useState("text"); // "text" | "latex" | "upload"
  const [resumeText, setResumeText] = useState("");
  const [selectedRole, setSelectedRole] = useState("Full-Stack Software Engineer");
  const [customRole, setCustomRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  
  const [isScanningResume, setIsScanningResume] = useState(false);
  const [currentStageIdx, setCurrentStageIdx] = useState(0);
  const [resumeAnalysis, setResumeAnalysis] = useState(null);
  
  const [copiedBulletIdx, setCopiedBulletIdx] = useState(null);
  const [copiedReport, setCopiedReport] = useState(false);
  const [keywordFilter, setKeywordFilter] = useState("all"); // "all" | "matched" | "missing" | "partial"
  const [expandedSections, setExpandedSections] = useState({});
  const [validationError, setValidationError] = useState("");

  // File upload state
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const fileInputRef = useRef(null);
  const resumeEditorRef = useRef(null);

  // Auto-detect format on paste
  useEffect(() => {
    if (resumeText.includes("\\documentclass") || resumeText.includes("\\begin{document}")) {
      if (inputMode === "text") {
        setInputMode("latex");
      }
    }
  }, [resumeText, inputMode]);

  // Loading stepper animation
  useEffect(() => {
    let interval;
    if (isScanningResume) {
      setCurrentStageIdx(0);
      interval = setInterval(() => {
        setCurrentStageIdx((prev) => (prev < LOADING_STAGES.length - 1 ? prev + 1 : prev));
      }, 700);
    }
    return () => clearInterval(interval);
  }, [isScanningResume]);

  const effectiveRole = selectedRole === "Custom Role" ? customRole.trim() : selectedRole;

  // Handle File Upload
  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsUploadingFile(true);
    setValidationError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/career/parse-file", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      if (res.data?.success) {
        setResumeText(res.data.text);
        setUploadedFileName(res.data.filename);
        if (res.data.filename.endsWith(".tex")) {
          setInputMode("latex");
        }
      }
    } catch (err) {
      console.error("File parse error:", err);
      setValidationError(err.response?.data?.detail || "Could not parse file. You can paste the text directly.");
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleScanResume = async () => {
    setValidationError("");
    if (!resumeText.trim() || resumeText.trim().length < 40) {
      setValidationError("Please provide your resume content (at least 40 characters required for analysis).");
      return;
    }
    if (!effectiveRole && !jobDescription.trim()) {
      setValidationError("Please select or define a Target Role, or paste the Job Description.");
      return;
    }

    setIsScanningResume(true);
    try {
      const res = await api.post("/career/resume-analyze", {
        resume_text: resumeText,
        resume_format: inputMode,
        target_role: effectiveRole || "Software Engineer",
        job_description: jobDescription
      });
      if (res.data?.success) {
        setResumeAnalysis(res.data.data);
      }
    } catch (err) {
      console.error("Resume analysis error:", err);
      setValidationError(err.response?.data?.detail || "Failed to analyze resume. Please try again.");
    } finally {
      setIsScanningResume(false);
    }
  };

  const handleCopyBullet = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedBulletIdx(idx);
    setTimeout(() => setCopiedBulletIdx(null), 2000);
  };

  const handleCopyFullReport = () => {
    if (!resumeAnalysis) return;
    const reportText = `ATS COMPATIBILITY REPORT: ${resumeAnalysis.ats_score}/100 (${resumeAnalysis.match_strength})
Target Role: ${effectiveRole}
Summary: ${resumeAnalysis.summary}

TOP PROBLEMS:
${resumeAnalysis.top_problems?.map((p, i) => `${i + 1}. ${p}`).join("\n")}

TOP IMPROVEMENTS:
${resumeAnalysis.top_improvements?.map((im, i) => `${i + 1}. ${im}`).join("\n")}

MATCHED KEYWORDS:
${resumeAnalysis.jd_keywords?.matched?.join(", ")}

MISSING KEYWORDS:
${resumeAnalysis.jd_keywords?.missing?.join(", ")}

RECRUITER VERDICT:
${resumeAnalysis.recruiter_verdict?.assessment}
`;
    navigator.clipboard.writeText(reportText);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  };

  const toggleSectionExpand = (sectionIdx) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionIdx]: !prev[sectionIdx]
    }));
  };

  // -------------------------------------------------------------
  // TAB 2: NORA VOICE-FIRST AI TECHNICAL INTERVIEW PLATFORM
  // -------------------------------------------------------------
  const { user } = useAuth();
  const [candidateName, setCandidateName] = useState("Candidate");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [interviewRole, setInterviewRole] = useState("Full-Stack Software Engineer");
  const [experienceLevel, setExperienceLevel] = useState("Mid-Level (3-5 yrs)");
  const [interviewDifficulty, setInterviewDifficulty] = useState("Medium");
  const [interviewStage, setInterviewStage] = useState("WIZARD"); // "WIZARD" | "ROOM" | "CODING" | "REPORT"

  useEffect(() => {
    if (user?.email && !candidateEmail) {
      setCandidateEmail(user.email);
    }
  }, [user]);

  const isUnlimitedUser = (user?.email?.trim().toLowerCase() === "ydvhimanshu461@gmail.com") || 
                          (candidateEmail?.trim().toLowerCase() === "ydvhimanshu461@gmail.com");
  
  // Hardware Verification State
  const [camVerified, setCamVerified] = useState(false);
  const [micVerified, setMicVerified] = useState(false);
  const [screenVerified, setScreenVerified] = useState(false);
  const [fullscreenVerified, setFullscreenVerified] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [hardwareError, setHardwareError] = useState("");

  // Refs for media & audio analysis
  const wizardVideoRef = useRef(null);
  const chamberVideoRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Stream attacher helper: isolates video track into video-only MediaStream to avoid audio echo & bypass browser autoplay restrictions
  const attachStreamToVideoEl = (videoEl, fullStream) => {
    if (!videoEl || !fullStream) return;
    const videoTracks = fullStream.getVideoTracks();
    if (!videoTracks || videoTracks.length === 0) return;

    try {
      const videoOnlyStream = new MediaStream([videoTracks[0]]);
      videoEl.srcObject = videoOnlyStream;
      videoEl.muted = true;
      videoEl.defaultMuted = true;
      videoEl.playsInline = true;
      videoEl.setAttribute("playsinline", "true");
      videoEl.setAttribute("muted", "true");
      videoEl.setAttribute("autoplay", "true");

      const playVideo = () => {
        const p = videoEl.play();
        if (p !== undefined) {
          p.catch(e => {
            console.warn("Handled video play warning:", e);
            setTimeout(() => {
              if (videoEl) videoEl.play().catch(() => {});
            }, 300);
          });
        }
      };

      videoEl.onloadedmetadata = playVideo;
      playVideo();
    } catch (err) {
      console.warn("attachStreamToVideoEl error:", err);
    }
  };

  const setWizardVideoRef = (el) => {
    wizardVideoRef.current = el;
    if (el && mediaStreamRef.current) {
      attachStreamToVideoEl(el, mediaStreamRef.current);
    }
  };

  const setChamberVideoRef = (el) => {
    chamberVideoRef.current = el;
    if (el && mediaStreamRef.current) {
      attachStreamToVideoEl(el, mediaStreamRef.current);
    }
  };

  // Keep live camera stream attached and playing on active video elements
  useEffect(() => {
    if (mediaStreamRef.current) {
      if (wizardVideoRef.current) attachStreamToVideoEl(wizardVideoRef.current, mediaStreamRef.current);
      if (chamberVideoRef.current) attachStreamToVideoEl(chamberVideoRef.current, mediaStreamRef.current);
    }
  }, [camVerified, interviewStage]);

  // Nora Live Dialogue State
  const [interviewSession, setInterviewSession] = useState(null);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [noraSpeaking, setNoraSpeaking] = useState(false);
  const [candidateSpeaking, setCandidateSpeaking] = useState(false);
  const [noraThinking, setNoraThinking] = useState(false);
  const [interimSpeechText, setInterimSpeechText] = useState("");
  const [transcriptFeed, setTranscriptFeed] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);

  // Coding Challenge State
  const [codingChallenge, setCodingChallenge] = useState(null);
  const [codeContent, setCodeContent] = useState("");
  const [codingLang, setCodingLang] = useState("python");
  const [codingTimeLeft, setCodingTimeLeft] = useState(1200); // 20 mins
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [intercomInput, setIntercomInput] = useState("");
  const [isIntercomActive, setIsIntercomActive] = useState(false);

  // Security & Integrity State
  const [isTerminated, setIsTerminated] = useState(false);
  const [terminationReason, setTerminationReason] = useState("");
  const [singleAttemptLocked, setSingleAttemptLocked] = useState(false);
  const [evaluationReport, setEvaluationReport] = useState(null);
  const [isAnalyzingReport, setIsAnalyzingReport] = useState(false);

  // STT / Recognition & Silence Refs
  const [speechLang, setSpeechLang] = useState("en-IN");
  const [sttFallbackMode, setSttFallbackMode] = useState(false); // true when STT fails repeatedly
  const [usingCloudStt, setUsingCloudStt] = useState(false);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const restartTimeoutRef = useRef(null);
  const transcriptBottomRef = useRef(null);
  const sessionPrefixRef = useRef("");
  const currentSessionFinalRef = useRef("");
  const interimSpeechTextRef = useRef("");
  const isCandidateListeningRef = useRef(false);
  const isStartingRecRef = useRef(false);
  const isSubmittingTurnRef = useRef(false);
  const networkErrorCountRef = useRef(0); // counts consecutive network errors
  const micLevelRef = useRef(0);
  const speechLangRef = useRef("en-IN");
  const backendSttModeRef = useRef(false);
  const backendSttActiveRef = useRef(false);
  const backendSttRecorderRef = useRef(null);
  const backendSttChunkTimerRef = useRef(null);
  const sttWatchdogRef = useRef(null);
  const lastBrowserSttAtRef = useRef(0);

  useEffect(() => {
    speechLangRef.current = speechLang;
  }, [speechLang]);

  // Default to backend (Groq Whisper) STT — skip Chrome's network-dependent STT
  useEffect(() => {
    backendSttModeRef.current = true;
  }, []);

  // Scroll transcript to bottom
  useEffect(() => {
    if (transcriptBottomRef.current) {
      transcriptBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcriptFeed, interimSpeechText]);

  // Clean up media streams on unmount
  useEffect(() => {
    return () => {
      stopAllMedia();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const startMediaRecording = (stream) => {
    if (!window.MediaRecorder || !stream) return;
    try {
      recordedChunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : (MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "");
      const options = mime ? { mimeType: mime } : undefined;
      const recorder = new MediaRecorder(stream, options);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
    } catch (err) {
      console.warn("MediaRecorder start error:", err);
    }
  };

  const stopMediaRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
  };

  const pauseMainRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      try { mediaRecorderRef.current.pause(); } catch (e) {}
    }
  };

  const resumeMainRecording = () => {
    if (mediaRecorderRef.current?.state === "paused") {
      try { mediaRecorderRef.current.resume(); } catch (e) {}
    }
  };

  const setupAudioAnalyser = (stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current || audioContextRef.current.state === "closed") {
        audioContextRef.current = new AudioCtx();
      }
      const audioCtx = audioContextRef.current;
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        micLevelRef.current = normalized;
        setMicLevel(normalized);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      updateLevel();
    } catch (audioErr) {
      console.warn("Audio analyser setup error:", audioErr);
    }
  };

  const ensureMicReady = () => {
    if (audioContextRef.current?.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
    }
  };

  const stopAllMedia = () => {
    stopMediaRecording();
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try { audioContextRef.current.close(); } catch (e) {}
    }
  };

  // Hardware Check 1: Camera & Microphone
  const startCameraAndMicCheck = async () => {
    setHardwareError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, 
        audio: true 
      });
      mediaStreamRef.current = stream;
      setCamVerified(true);
      setMicVerified(true);

      if (wizardVideoRef.current) {
        attachStreamToVideoEl(wizardVideoRef.current, stream);
      }

      setupAudioAnalyser(stream);
    } catch (err) {
      console.error("Camera/Mic access error:", err);
      setHardwareError("Camera or Microphone permission was denied. Please allow access in your browser.");
    }
  };

  // Hardware Check 2: Screen Sharing
  const startScreenShareCheck = async () => {
    setHardwareError("");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStreamRef.current = stream;
      setScreenVerified(true);

      // If candidate stops screen share during session, trigger alert
      stream.getVideoTracks()[0].onended = () => {
        setScreenVerified(false);
        if (interviewSession && interviewStage !== "REPORT") {
          logIntegrityEvent("SCREEN_SHARE_STOPPED");
        }
      };
    } catch (err) {
      console.error("Screen share access error:", err);
      setHardwareError("Screen sharing permission is required for the proctored interview.");
    }
  };

  // Fullscreen state & lockdown enforcement
  const [isInFullscreen, setIsInFullscreen] = useState(false);
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);
  const [sttError, setSttError] = useState("");

  // Hardware Check 3: Fullscreen Request
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setFullscreenVerified(true);
        setIsInFullscreen(true);
      } else {
        await document.exitFullscreen();
        setFullscreenVerified(false);
        setIsInFullscreen(false);
      }
    } catch (err) {
      console.warn("Fullscreen toggle failed:", err);
      setFullscreenVerified(true);
    }
  };

  const reEnterFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      setShowFullscreenWarning(false);
      setIsInFullscreen(true);
    } catch (err) {
      console.warn("Fullscreen re-enter error:", err);
    }
  };

  // Fullscreen lockdown listener: interview MUST be full screen
  useEffect(() => {
    const onFsChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsInFullscreen(isFull);
      if (!isFull && (interviewStage === "ROOM" || interviewStage === "CODING") && !isTerminated) {
        setShowFullscreenWarning(true);
        logIntegrityEvent("FULLSCREEN_EXITED");
      } else {
        setShowFullscreenWarning(false);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [interviewStage, isTerminated]);

  // Stage change immediate fullscreen enforcement check
  useEffect(() => {
    if ((interviewStage === "ROOM" || interviewStage === "CODING") && !isTerminated) {
      if (!document.fullscreenElement) {
        setShowFullscreenWarning(true);
      }
    }
  }, [interviewStage, isTerminated]);

  // Strict Tab-Switch Violation Detection: Terminates and immediately shows Full Report!
  useEffect(() => {
    if ((interviewStage === "ROOM" || interviewStage === "CODING") && interviewSession && !isTerminated) {
      const handleVisibility = () => {
        if (document.visibilityState === "hidden") {
          handleTabSwitchViolation();
        }
      };
      document.addEventListener("visibilitychange", handleVisibility);
      return () => document.removeEventListener("visibilitychange", handleVisibility);
    }
  }, [interviewStage, interviewSession, isTerminated]);

  const handleTabSwitchViolation = async () => {
    if (isTerminated) return;
    setIsTerminated(true);
    setTerminationReason("Browser Tab Switch Violation Detected. Single attempt locked.");
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    stopListeningCandidate();

    const sessId = interviewSession?.session_id;
    if (sessId) {
      try {
        await api.post(`/career/interview/session/${sessId}/event`, {
          event_type: "TAB_SWITCH_DETECTED",
          metadata: { timestamp: new Date().toISOString() }
        });
      } catch (err) {
        console.error("Failed to log tab switch event:", err);
      }
      // Immediately fetch and display full Executive Report
      fetchEvaluationReport(sessId);
    } else {
      setInterviewStage("REPORT");
    }
  };

  const handleEarlyConcludeInterview = async () => {
    if (!window.confirm("Conclude interview now and generate your Bar-Raiser Executive Scorecard?")) {
      return;
    }
    stopListeningCandidate();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    const sessId = interviewSession?.session_id;
    fetchEvaluationReport(sessId);
  };

  const logIntegrityEvent = async (eventType, metadata = {}) => {
    if (!interviewSession?.session_id) return;
    try {
      await api.post(`/career/interview/session/${interviewSession.session_id}/event`, {
        event_type: eventType,
        metadata
      });
    } catch (err) {
      console.error("Event log error:", err);
    }
  };

  // Nora Voice TTS Speaker with GC Protection & Safety Timeout
  const speakNora = (text, onEnd) => {
    stopListeningCandidate();
    if (!("speechSynthesis" in window)) {
      if (onEnd) onEnd();
      return;
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    window._activeNoraUtterance = utterance; // Prevent garbage collection mid-speech
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => 
      (v.name.includes("Google") && v.name.includes("UK English Female")) ||
      v.name.includes("Samantha") ||
      v.name.includes("Zira") ||
      (v.lang.startsWith("en") && v.name.toLowerCase().includes("female"))
    ) || voices.find(v => v.lang.startsWith("en"));
    if (naturalVoice) utterance.voice = naturalVoice;

    setNoraSpeaking(true);

    let hasEnded = false;
    const finishSpeech = () => {
      if (hasEnded) return;
      hasEnded = true;
      setNoraSpeaking(false);
      if (onEnd) {
        // 350ms buffer so audio playback finishes completely before mic activates
        setTimeout(() => {
          onEnd();
        }, 350);
      }
    };

    // Safety timeout in case utterance.onend doesn't fire in browser
    const wordCount = (text || "").split(" ").length;
    const timeoutMs = Math.max(3500, (wordCount / 2.0) * 1000 + 3500);
    const safetyTimer = setTimeout(finishSpeech, timeoutMs);

    utterance.onend = () => {
      clearTimeout(safetyTimer);
      finishSpeech();
    };
    utterance.onerror = () => {
      clearTimeout(safetyTimer);
      finishSpeech();
    };
    window.speechSynthesis.speak(utterance);
  };

  const cleanupRecognizer = () => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (sttWatchdogRef.current) {
      clearTimeout(sttWatchdogRef.current);
      sttWatchdogRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }
    isStartingRecRef.current = false;
  };

  const scheduleSilenceSubmit = (fullText, isIntercom = false) => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (!isIntercom && fullText.length > 25) {
      silenceTimerRef.current = setTimeout(() => {
        if (isCandidateListeningRef.current && !isSubmittingTurnRef.current) {
          finalizeCandidateAnswer(fullText);
        }
      }, 6000);
    }
  };

  const mergeSttTranscript = (newText, isIntercom = false) => {
    const incoming = newText.trim();
    if (!incoming) return;

    const existing = interimSpeechTextRef.current.trim();
    if (!existing) {
      setInterimSpeechText(incoming);
      interimSpeechTextRef.current = incoming;
      scheduleSilenceSubmit(incoming, isIntercom);
      return;
    }

    if (existing.includes(incoming)) return;

    const existingWords = existing.split(/\s+/);
    const incomingWords = incoming.split(/\s+/);
    let overlap = 0;
    for (let i = Math.min(6, existingWords.length); i >= 1; i--) {
      const tail = existingWords.slice(-i).join(" ").toLowerCase();
      const head = incomingWords.slice(0, i).join(" ").toLowerCase();
      if (tail === head) {
        overlap = i;
        break;
      }
    }

    const newWords = overlap > 0 ? incomingWords.slice(overlap).join(" ") : incoming;
    if (!newWords.trim()) return;

    const merged = `${existing} ${newWords}`.replace(/\s+/g, " ").trim();
    setInterimSpeechText(merged);
    interimSpeechTextRef.current = merged;
    scheduleSilenceSubmit(merged, isIntercom);
  };

  const transcribeAudioBlob = async (blob, isIntercom = false) => {
    try {
      const formData = new FormData();
      formData.append("file", blob, "speech.webm");
      formData.append("language", speechLangRef.current || "en-IN");

      const res = await api.post("/career/interview/stt", formData);
      if (res.data?.success && res.data.text) {
        mergeSttTranscript(res.data.text, isIntercom);
        lastBrowserSttAtRef.current = Date.now();
      }
    } catch (err) {
      console.warn("Backend STT error:", err);
    }
  };

  const stopBackendSttCapture = () => {
    backendSttActiveRef.current = false;
    if (backendSttChunkTimerRef.current) {
      clearTimeout(backendSttChunkTimerRef.current);
      backendSttChunkTimerRef.current = null;
    }
    if (backendSttRecorderRef.current && backendSttRecorderRef.current.state !== "inactive") {
      try { backendSttRecorderRef.current.stop(); } catch (e) {}
    }
    backendSttRecorderRef.current = null;
    resumeMainRecording();
    setUsingCloudStt(false);
  };

  const startBackendSttCapture = (isIntercom = false) => {
    stopBackendSttCapture();
    if (!isCandidateListeningRef.current) return;

    backendSttActiveRef.current = true;
    backendSttModeRef.current = true;
    setCandidateSpeaking(true);
    setUsingCloudStt(true);
    setSttError("");
    setSttFallbackMode(false);
    pauseMainRecording();

    const recordChunk = () => {
      if (!isCandidateListeningRef.current || !backendSttActiveRef.current) return;

      const audioTracks = mediaStreamRef.current?.getAudioTracks();
      if (!audioTracks?.length) {
        setSttError("Microphone stream not available. Type your answer directly or click 'Click to Speak'.");
        return;
      }

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : (MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg");

      try {
        const audioStream = new MediaStream([audioTracks[0]]);
        const recorder = new MediaRecorder(audioStream, mime ? { mimeType: mime } : undefined);
        backendSttRecorderRef.current = recorder;
        const chunks = [];

        recorder.ondataavailable = (e) => {
          if (e.data?.size > 0) chunks.push(e.data);
        };

        recorder.onstop = async () => {
          backendSttRecorderRef.current = null;
          if (chunks.length > 0 && isCandidateListeningRef.current) {
            const blob = new Blob(chunks, { type: mime || "audio/webm" });
            if (blob.size > 800) {
              await transcribeAudioBlob(blob, isIntercom);
            }
          }
          if (backendSttActiveRef.current && isCandidateListeningRef.current) {
            backendSttChunkTimerRef.current = setTimeout(recordChunk, 300);
          }
        };

        recorder.start();
        backendSttChunkTimerRef.current = setTimeout(() => {
          if (recorder.state === "recording") {
            try { recorder.stop(); } catch (e) {}
          }
        }, 3500);
      } catch (err) {
        console.error("Backend STT recorder error:", err);
        setSttError("Voice capture failed. Type your answer directly in the box below.");
      }
    };

    recordChunk();
  };

  const switchToBackendStt = (isIntercom = false) => {
    cleanupRecognizer();
    backendSttModeRef.current = true;
    setSttFallbackMode(false);
    startBackendSttCapture(isIntercom);
  };

  const scheduleSttWatchdog = (isIntercom = false) => {
    if (sttWatchdogRef.current) clearTimeout(sttWatchdogRef.current);
    sttWatchdogRef.current = setTimeout(() => {
      if (!isCandidateListeningRef.current || backendSttModeRef.current) return;
      const hasTranscript = interimSpeechTextRef.current.trim().length > 0;
      const micActive = micLevelRef.current > 8;
      const browserStale = !lastBrowserSttAtRef.current || (Date.now() - lastBrowserSttAtRef.current > 3500);
      if (micActive && !hasTranscript && browserStale) {
        console.warn("Browser STT silent — switching to cloud transcription.");
        switchToBackendStt(isIntercom);
      }
    }, 3000);
  };

  // Candidate Voice STT Listener with Clean Re-instantiation & Glitch Prevention
  const startListeningCandidate = (isIntercom = false) => {
    setSttError("");
    isCandidateListeningRef.current = true;
    isSubmittingTurnRef.current = false;
    setCandidateSpeaking(true);
    lastBrowserSttAtRef.current = 0;
    ensureMicReady();

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (backendSttModeRef.current) {
      startBackendSttCapture(isIntercom);
      return;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      switchToBackendStt(isIntercom);
      return;
    }

    if (isStartingRecRef.current) return;

    cleanupRecognizer();

    try {
      isStartingRecRef.current = true;
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = speechLangRef.current || speechLang || "en-IN";

      rec.onstart = () => {
        isStartingRecRef.current = false;
        networkErrorCountRef.current = 0;
        setCandidateSpeaking(true);
        setSttError("");
        setSttFallbackMode(false);
        scheduleSttWatchdog(isIntercom);
      };

      rec.onresult = (event) => {
        let interimSlice = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          if (result.isFinal) {
            currentSessionFinalRef.current = `${currentSessionFinalRef.current} ${transcript}`.trim();
          } else {
            interimSlice += transcript;
          }
        }

        const prefix = sessionPrefixRef.current ? sessionPrefixRef.current.trim() : "";
        const currentFinal = currentSessionFinalRef.current;
        const combinedFinal = prefix
          ? (currentFinal ? `${prefix} ${currentFinal}` : prefix)
          : currentFinal;
        const fullText = (interimSlice
          ? (combinedFinal ? `${combinedFinal} ${interimSlice.trim()}` : interimSlice.trim())
          : combinedFinal).trim();

        if (fullText) {
          setInterimSpeechText(fullText);
          interimSpeechTextRef.current = fullText;
          lastBrowserSttAtRef.current = Date.now();
        }

        scheduleSilenceSubmit(fullText, isIntercom);
      };

      rec.onerror = (event) => {
        isStartingRecRef.current = false;
        console.warn("SpeechRecognition error:", event.error);

        const networkErrors = ["network", "service-not-allowed", "audio-capture"];
        if (networkErrors.includes(event.error)) {
          networkErrorCountRef.current += 1;
          if (networkErrorCountRef.current >= 2) {
            switchToBackendStt(isIntercom);
            return;
          }
          return;
        }

        const silentErrors = ["no-speech", "aborted"];
        if (silentErrors.includes(event.error)) {
          return;
        }

        if (event.error === "not-allowed") {
          setSttError("Microphone access denied. Allow microphone in the browser URL bar and click 'Click to Speak'.");
          isCandidateListeningRef.current = false;
          setCandidateSpeaking(false);
        } else {
          console.error("Unhandled SpeechRecognition error:", event.error);
        }
      };

      rec.onend = () => {
        isStartingRecRef.current = false;
        if (currentSessionFinalRef.current) {
          sessionPrefixRef.current = (sessionPrefixRef.current ? `${sessionPrefixRef.current.trim()} ` : "") + currentSessionFinalRef.current;
          currentSessionFinalRef.current = "";
        }

        if (backendSttModeRef.current) {
          setCandidateSpeaking(false);
          return;
        }

        if (isCandidateListeningRef.current && !isSubmittingTurnRef.current) {
          restartTimeoutRef.current = setTimeout(() => {
            if (isCandidateListeningRef.current && !isSubmittingTurnRef.current && !backendSttModeRef.current) {
              startListeningCandidate(isIntercom);
            }
          }, 600);
        } else {
          setCandidateSpeaking(false);
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      isStartingRecRef.current = false;
      console.warn("Initial rec.start() error:", e);
      switchToBackendStt(isIntercom);
    }
  };

  const stopListeningCandidate = () => {
    isCandidateListeningRef.current = false;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    cleanupRecognizer();
    stopBackendSttCapture();
    setCandidateSpeaking(false);
  };

  // Toggle Mic Manually on direct user click
  const handleToggleMic = () => {
    if (isCandidateListeningRef.current) {
      stopListeningCandidate();
    } else {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setNoraSpeaking(false);
      // Seed the STT prefix with any text the user already typed in the box
      const alreadyTyped = interimSpeechTextRef.current.trim();
      if (alreadyTyped) {
        sessionPrefixRef.current = alreadyTyped;
        currentSessionFinalRef.current = "";
      }
      // Always use backend Groq Whisper STT (bypasses Chrome's network requirement)
      backendSttModeRef.current = true;
      startListeningCandidate();
    }
  };

  const handleInterruptNora = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setNoraSpeaking(false);
    startListeningCandidate();
  };

  // Start Nora Interview Session with Mandatory Fullscreen & Live Stream Recording
  const handleLaunchNoraSession = async () => {
    if (!resumeText.trim() || resumeText.trim().length < 40) {
      alert("Please ensure your resume is provided in Tab 1 or pasted before starting.");
      return;
    }

    // Auto-acquire camera & mic if not active
    if (!mediaStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, 
          audio: true 
        });
        mediaStreamRef.current = stream;
        setCamVerified(true);
        setMicVerified(true);
        setupAudioAnalyser(stream);
      } catch (camErr) {
        console.warn("Auto-acquire camera error:", camErr);
      }
    }

    // Enforce Fullscreen immediately
    if (document.documentElement.requestFullscreen) {
      try {
        await document.documentElement.requestFullscreen();
        setFullscreenVerified(true);
        setIsInFullscreen(true);
      } catch (fsErr) {
        console.warn("Fullscreen request error:", fsErr);
      }
    }

    setIsStartingSession(true);
    setHardwareError("");
    try {
      const res = await api.post("/career/interview/session/create", {
        candidate_name: candidateName || "Candidate",
        candidate_email: candidateEmail || user?.email || "",
        resume_text: resumeText,
        resume_format: inputMode,
        target_role: effectiveRole || interviewRole,
        job_description: jobDescription,
        experience_level: experienceLevel,
        difficulty: interviewDifficulty,
        coding_duration_minutes: 20
      });

      if (res.data?.success) {
        const data = res.data;
        setInterviewSession(data);
        setCurrentQuestion({
          question_number: data.question_number,
          question: data.question,
          topic: data.topic,
          difficulty: data.difficulty,
          total_voice_questions: data.total_voice_questions
        });

        // Initialize transcript feed
        const initFeed = [
          { speaker: "NORA", text: data.nora_intro, type: "INTRO", time: new Date().toLocaleTimeString() },
          { speaker: "NORA", text: data.question, type: "QUESTION", qNum: 1, time: new Date().toLocaleTimeString() }
        ];
        setTranscriptFeed(initFeed);
        setInterviewStage("ROOM");

        // Start live recording
        if (mediaStreamRef.current) {
          startMediaRecording(mediaStreamRef.current);
        }

        // Nora speaks Introduction followed by Question 1
        const spokenIntroAndQ1 = `${data.nora_intro} Here is your first question: ${data.question}`;
        speakNora(spokenIntroAndQ1, () => {
          startListeningCandidate();
        });
      } else if (res.data?.error === "SINGLE_ATTEMPT_LOCKED") {
        if (!isUnlimitedUser) {
          setSingleAttemptLocked(true);
          alert("You have already consumed your single allowed attempt for this role track.");
        }
      }
    } catch (err) {
      console.error("Session creation error:", err);
      alert(err.response?.data?.detail || "Failed to initialize interview session.");
    } finally {
      setIsStartingSession(false);
    }
  };

  // Finalize candidate answer and trigger next turn or transition
  const finalizeCandidateAnswer = async (spokenText) => {
    isSubmittingTurnRef.current = true;
    stopListeningCandidate();
    sessionPrefixRef.current = "";
    currentSessionFinalRef.current = "";
    backendSttModeRef.current = false;
    networkErrorCountRef.current = 0;
    lastBrowserSttAtRef.current = 0;
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    const answer = (spokenText || interimSpeechText || interimSpeechTextRef.current).trim();
    if (!answer) {
      isSubmittingTurnRef.current = false;
      return;
    }

    setInterimSpeechText("");
    interimSpeechTextRef.current = "";
    const nowTime = new Date().toLocaleTimeString();
    setTranscriptFeed(prev => [
      ...prev,
      { speaker: "CANDIDATE", text: answer, type: "ANSWER", qNum: currentQuestion?.question_number, time: nowTime }
    ]);

    setNoraThinking(true);
    try {
      const res = await api.post(`/career/interview/session/${interviewSession.session_id}/turn`, {
        sequence_number: currentQuestion.question_number,
        candidate_answer: answer
      });

      setNoraThinking(false);
      isSubmittingTurnRef.current = false;

      if (res.data?.success) {
        if (res.data.transition_to_coding) {
          // Transition to Coding Challenge!
          const challenge = res.data.coding_challenge;
          setCodingChallenge(challenge);
          setCodeContent(challenge.starter_code || "# Write your solution here\n");
          setCodingTimeLeft(challenge.time_limit_minutes * 60 || 1200);
          setInterviewStage("CODING");

          setTranscriptFeed(prev => [
            ...prev,
            { speaker: "NORA", text: res.data.nora_speech, type: "CODING_TRANSITION", time: new Date().toLocaleTimeString() }
          ]);

          speakNora(res.data.nora_speech);
        } else {
          // Next Voice Question
          const nextQ = {
            question_number: res.data.question_number,
            question: res.data.question,
            topic: res.data.topic,
            difficulty: res.data.difficulty,
            total_voice_questions: res.data.total_voice_questions
          };
          setCurrentQuestion(nextQ);

          setTranscriptFeed(prev => [
            ...prev,
            { speaker: "NORA", text: nextQ.question, type: "QUESTION", qNum: nextQ.question_number, time: new Date().toLocaleTimeString() }
          ]);

          speakNora(nextQ.question, () => {
            startListeningCandidate();
          });
        }
      }
    } catch (err) {
      setNoraThinking(false);
      isSubmittingTurnRef.current = false;
      console.error("Turn submission error:", err);
    }
  };

  // Coding Challenge Timer
  useEffect(() => {
    let timer;
    if (interviewStage === "CODING" && codingTimeLeft > 0 && !isTerminated) {
      timer = setInterval(() => {
        setCodingTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleAutoSubmitCode();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [interviewStage, codingTimeLeft, isTerminated]);

  // Candidate talks to Nora during coding
  const handleAskNoraWhileCoding = async (queryText) => {
    const q = (queryText || intercomInput).trim();
    if (!q) return;

    setIntercomInput("");
    setIsIntercomActive(false);

    setTranscriptFeed(prev => [
      ...prev,
      { speaker: "CANDIDATE", text: q, type: "CODE_DISCUSSION_QUERY", time: new Date().toLocaleTimeString() }
    ]);

    try {
      const res = await api.post(`/career/interview/session/${interviewSession.session_id}/code-discussion`, {
        candidate_question: q,
        current_code: codeContent,
        language: codingLang
      });

      if (res.data?.success && res.data.nora_response) {
        const reply = res.data.nora_response;
        setTranscriptFeed(prev => [
          ...prev,
          { speaker: "NORA", text: reply, type: "CODE_DISCUSSION_REPLY", time: new Date().toLocaleTimeString() }
        ]);
        speakNora(reply);
      }
    } catch (err) {
      console.error("Code discussion query error:", err);
    }
  };

  // Submit Code Challenge
  const handleSubmitCodeChallenge = async () => {
    if (!codeContent.trim()) {
      alert("Please write your code solution before submitting.");
      return;
    }
    setIsSubmittingCode(true);
    try {
      const res = await api.post(`/career/interview/session/${interviewSession.session_id}/code-submit`, {
        code: codeContent,
        language: codingLang,
        time_taken_seconds: (codingChallenge?.time_limit_minutes * 60 || 1200) - codingTimeLeft
      });

      if (res.data?.success) {
        speakNora(res.data.nora_concluding_speech);
        fetchEvaluationReport();
      }
    } catch (err) {
      console.error("Code submit error:", err);
      alert("Failed to submit code challenge. Please try again.");
    } finally {
      setIsSubmittingCode(false);
    }
  };

  const handleAutoSubmitCode = () => {
    handleSubmitCodeChallenge();
  };

  // Fetch Decoupled Post-Interview Evaluation Report
  const fetchEvaluationReport = async (sessionIdOverride = null) => {
    setInterviewStage("REPORT");
    setIsAnalyzingReport(true);
    stopAllMedia();
    const targetSessionId = sessionIdOverride || interviewSession?.session_id;
    if (!targetSessionId) {
      setIsAnalyzingReport(false);
      return;
    }
    try {
      const res = await api.post(`/career/interview/session/${targetSessionId}/analyze`);
      if (res.data?.success) {
        setEvaluationReport(res.data.data);
      }
    } catch (err) {
      console.error("Report generation error:", err);
    } finally {
      setIsAnalyzingReport(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 3: COLD OUTREACH & COVER LETTER STATE
  // -------------------------------------------------------------
  const [companyName, setCompanyName] = useState("");
  const [outreachRole, setOutreachRole] = useState("Full-Stack Software Engineer");
  const [recipientName, setRecipientName] = useState("Hiring Team");
  const [userHighlights, setUserHighlights] = useState("");
  const [tone, setTone] = useState("Direct & Metric-Oriented");
  const [isGeneratingOutreach, setIsGeneratingOutreach] = useState(false);
  const [outreachResult, setOutreachResult] = useState(null);
  const [copiedOutreach, setCopiedOutreach] = useState(null);

  const handleGenerateOutreach = async () => {
    if (!companyName.trim() || !outreachRole.trim()) {
      alert("Please provide both Target Company and Target Role.");
      return;
    }
    setIsGeneratingOutreach(true);
    try {
      const res = await api.post("/career/cover-letter", {
        company_name: companyName,
        target_role: outreachRole,
        recipient_name: recipientName,
        user_highlights: userHighlights,
        tone: tone
      });
      if (res.data?.success) {
        setOutreachResult(res.data.data);
      }
    } catch (err) {
      console.error("Outreach generation error:", err);
      alert(err.response?.data?.detail || "Failed to generate outreach.");
    } finally {
      setIsGeneratingOutreach(false);
    }
  };

  const copyOutreachCard = (key, text) => {
    navigator.clipboard.writeText(text);
    setCopiedOutreach(key);
    setTimeout(() => setCopiedOutreach(null), 2000);
  };

  return (
    <DashboardLayout>
      <div className="career-page">
        {/* Enterprise Header */}
        <div className="cs-header-wrap">
          <div className="cs-header-left">
            <div className="cs-header-icon-box">
              <Briefcase size={22} />
            </div>
            <div className="cs-header-titles">
              <h1>Career & Interview Studio</h1>
              <p>Autonomous ATS algorithm parsing, progressive Bar-Raiser mock interviews, and executive recruiter outreach.</p>
            </div>
          </div>

          <div className="cs-header-stats-strip">
            <div className="cs-stat-pill">
              <Zap size={13} />
              <span>ATS Parser: <strong>v4.2 Enterprise</strong></span>
            </div>
            <div className="cs-stat-pill">
              <ShieldCheck size={13} />
              <span>Standard: <strong>Silicon Valley L4-L7</strong></span>
            </div>
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <div className="cs-nav-tabs">
          <button 
            type="button"
            className={`cs-nav-tab-btn ${activeTab === "resume" ? "active" : ""}`}
            onClick={() => setActiveTab("resume")}
          >
            <FileText size={14} /> Resume Analyzer & ATS Scorecard
          </button>
          <button 
            type="button"
            className={`cs-nav-tab-btn ${activeTab === "interview" ? "active" : ""}`}
            onClick={() => setActiveTab("interview")}
          >
            <MessageSquare size={14} /> Live Bar-Raiser Mock Interview
          </button>
          <button 
            type="button"
            className={`cs-nav-tab-btn ${activeTab === "outreach" ? "active" : ""}`}
            onClick={() => setActiveTab("outreach")}
          >
            <Send size={14} /> Executive Outreach & Cover Letters
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: RESUME ANALYZER / ATS COMPLIANCE SCORECARD              */}
        {/* ============================================================== */}
        {activeTab === "resume" && (
          <div className="cs-grid-split">
            {/* Input Column */}
            <div className="cs-panel" ref={resumeEditorRef}>
              <div className="cs-panel-header">
                <h3 className="cs-panel-title">
                  <FileText size={16} /> Resume Input
                </h3>

                {/* Segmented Input Modes [ Paste Text ] [ LaTeX ] [ Upload Resume ] */}
                <div className="cs-input-modes">
                  <button 
                    type="button"
                    className={`cs-input-mode-btn ${inputMode === "text" ? "active" : ""}`}
                    onClick={() => setInputMode("text")}
                  >
                    <FileText size={12} /> Plain Text
                  </button>
                  <button 
                    type="button"
                    className={`cs-input-mode-btn ${inputMode === "latex" ? "active" : ""}`}
                    onClick={() => setInputMode("latex")}
                  >
                    <Code2 size={12} /> LaTeX Source
                  </button>
                  <button 
                    type="button"
                    className={`cs-input-mode-btn ${inputMode === "upload" ? "active" : ""}`}
                    onClick={() => setInputMode("upload")}
                  >
                    <Upload size={12} /> Upload File
                  </button>
                </div>
              </div>

              {/* Upload Dropzone when in upload mode */}
              {inputMode === "upload" && (
                <div style={{ marginBottom: "16px" }}>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: "none" }} 
                    accept=".pdf,.txt,.tex,.md"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <div 
                    className="cs-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={22} color="var(--cs-text-muted)" />
                    <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--cs-text)" }}>
                      {isUploadingFile ? "Parsing document..." : "Click or drag resume here"}
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--cs-text-subtle)" }}>
                      Supports PDF, TXT, or LaTeX (.tex)
                    </span>
                    {uploadedFileName && (
                      <span className="cs-stat-pill" style={{ marginTop: "4px" }}>
                        <FileCheck size={12} color="var(--cs-green)" /> {uploadedFileName}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Editor Header Toolbar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--cs-text-muted)", textTransform: "uppercase" }}>
                    {inputMode === "latex" ? "LaTeX Source Editor" : "Resume Content"}
                  </span>
                  {inputMode === "latex" && (
                    <span className="cs-badge-status info">LaTeX Detected</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button 
                    type="button" 
                    className="cs-btn-ghost"
                    onClick={() => {
                      if (inputMode === "latex") {
                        setResumeText(SAMPLE_LATEX_RESUME);
                      } else {
                        setResumeText(SAMPLE_TEXT_RESUME);
                      }
                    }}
                  >
                    Load Sample
                  </button>
                  {resumeText && (
                    <button 
                      type="button" 
                      className="cs-btn-ghost"
                      onClick={() => { setResumeText(""); setUploadedFileName(""); }}
                      title="Clear editor"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Resume Textarea */}
              <div className="cs-form-group">
                <textarea 
                  className="cs-textarea-input" 
                  placeholder={inputMode === "latex" 
                    ? "Paste your raw LaTeX source code (Overleaf, Jake's Resume, etc.). Commands will be stripped for clean ATS metrics..." 
                    : "Paste your resume plain text or markdown here..."}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  style={{ minHeight: "220px" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontSize: "11px", color: "var(--cs-text-subtle)" }}>
                  <span>{resumeText.trim() ? resumeText.trim().split(/\s+/).length : 0} words</span>
                  <span>{resumeText.length} characters</span>
                </div>
              </div>

              {/* Target Role Field */}
              <div className="cs-form-group">
                <label className="cs-form-label">
                  <span>Target Role</span>
                  <span style={{ fontSize: "11px", color: "var(--cs-text-subtle)" }}>Industry Benchmark</span>
                </label>
                <select 
                  className="cs-select-input"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                >
                  {PRESET_ROLES.map((r, i) => (
                    <option key={i} value={r}>{r}</option>
                  ))}
                </select>
                {selectedRole === "Custom Role" && (
                  <input 
                    type="text" 
                    className="cs-text-input" 
                    style={{ marginTop: "8px" }}
                    placeholder="Enter custom role title, e.g. Staff Distributed Systems Architect"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                  />
                )}
              </div>

              {/* Job Description Field with Hierarchy Helper */}
              <div className="cs-form-group">
                <label className="cs-form-label">
                  <span>Complete Job Description (Optional)</span>
                  <span style={{ fontSize: "11px", color: "var(--cs-text-subtle)" }}>Highest Precision</span>
                </label>
                <textarea 
                  className="cs-textarea-input" 
                  placeholder="Paste the full job posting description here to prioritize exact ATS keywords, qualifications, and toolsets..."
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  style={{ minHeight: "100px" }}
                />
                <span className="cs-helper-text">
                  <Info size={11} /> Paste the full JD for the most accurate ATS and keyword analysis.
                </span>
              </div>

              {/* Inline validation errors */}
              {validationError && (
                <div className="cs-inline-error">
                  <AlertTriangle size={14} />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Primary CTA */}
              <button 
                type="button" 
                className="cs-btn-primary" 
                onClick={handleScanResume}
                disabled={isScanningResume}
                style={{ width: "100%", marginTop: "12px" }}
              >
                {isScanningResume ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Analyzing Resume...
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    {resumeAnalysis ? "Re-Analyze Resume" : "Analyze Resume"}
                  </>
                )}
              </button>
            </div>

            {/* Results Column */}
            <div className="cs-panel">
              <div className="cs-panel-header">
                <h3 className="cs-panel-title">
                  <BarChart2 size={16} /> ATS Compliance Scorecard
                </h3>
                {resumeAnalysis && (
                  <span className={`cs-badge-status ${resumeAnalysis.ats_score >= 80 ? "pass" : "warn"}`}>
                    {resumeAnalysis.match_strength}
                  </span>
                )}
              </div>

              {/* Empty State */}
              {!resumeAnalysis && !isScanningResume && (
                <div style={{ padding: "64px 20px", textAlign: "center", color: "var(--cs-text-muted)" }}>
                  <FileText size={44} style={{ margin: "0 auto 16px auto", opacity: 0.3 }} />
                  <h4 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: 600, color: "var(--cs-text)" }}>
                    Ready to analyze your resume
                  </h4>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--cs-text-muted)", maxWidth: "380px", margin: "0 auto", lineHeight: 1.5 }}>
                    Paste your resume or LaTeX source, select your target role, and optionally add the complete JD for tailored ATS optimization.
                  </p>
                </div>
              )}

              {/* Multi-Stage Loading Progress */}
              {isScanningResume && (
                <div className="cs-loading-stage-box">
                  <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto 16px auto", color: "var(--cs-text)" }} />
                  <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: 600, color: "var(--cs-text)" }}>
                    Auditing ATS Alignment
                  </h4>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--cs-text-muted)" }}>
                    Benchmarking against Silicon Valley applicant tracking rubrics...
                  </p>

                  <div className="cs-stages-stepper">
                    {LOADING_STAGES.map((stage, idx) => {
                      const isActive = idx === currentStageIdx;
                      const isDone = idx < currentStageIdx;
                      return (
                        <div key={idx} className={`cs-stage-step ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}>
                          <div className="cs-stage-dot">
                            {isDone ? "✓" : idx + 1}
                          </div>
                          <span>{stage}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Output Dashboard */}
              {resumeAnalysis && !isScanningResume && (
                <div>
                  {/* 1. Overall ATS Compatibility Hero */}
                  <div className="cs-score-hero-card">
                    <div className="cs-score-hero-left">
                      <div className="cs-score-dial-large">
                        {resumeAnalysis.ats_score}
                        <small>/100</small>
                      </div>
                      <div className="cs-score-hero-meta">
                        <h3>
                          ATS Compatibility: {resumeAnalysis.match_strength}
                        </h3>
                        <p>{resumeAnalysis.summary}</p>
                      </div>
                    </div>

                    <div className="cs-action-toolbar">
                      <button 
                        type="button" 
                        className="cs-btn-ghost" 
                        onClick={handleCopyFullReport}
                        title="Copy text report"
                      >
                        {copiedReport ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedReport ? "Copied" : "Copy Report"}</span>
                      </button>
                      <button 
                        type="button" 
                        className="cs-btn-ghost" 
                        onClick={() => {
                          resumeEditorRef.current?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        <Edit3 size={12} /> Edit Resume
                      </button>
                    </div>
                  </div>

                  {/* 2. Top 3 Problems & Top 3 Quick Wins (5-Second Scannability) */}
                  <div className="cs-callout-grid">
                    <div className="cs-callout-card">
                      <h4 style={{ color: "var(--cs-red)" }}>
                        <AlertTriangle size={14} /> Top Areas to Fix
                      </h4>
                      <ul className="cs-callout-list">
                        {resumeAnalysis.top_problems?.map((p, i) => (
                          <li key={i}>
                            <span style={{ color: "var(--cs-red)", fontWeight: 700 }}>!</span>
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="cs-callout-card">
                      <h4 style={{ color: "var(--cs-green)" }}>
                        <CheckCircle2 size={14} /> Highest Impact Wins
                      </h4>
                      <ul className="cs-callout-list">
                        {resumeAnalysis.top_improvements?.map((im, i) => (
                          <li key={i}>
                            <span style={{ color: "var(--cs-green)", fontWeight: 700 }}>✓</span>
                            <span>{im}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* 3. 8-Category Score Breakdown */}
                  <div className="cs-form-label" style={{ marginBottom: "10px" }}>
                    <span>Detailed Score Breakdown</span>
                  </div>
                  <div className="cs-breakdown-grid">
                    {[
                      { key: "keyword_match", label: "Keyword Match" },
                      { key: "skills_alignment", label: "Skills Alignment" },
                      { key: "jd_match", label: "JD Alignment" },
                      { key: "experience_relevance", label: "Experience Relevance" },
                      { key: "resume_structure", label: "Structure & Flow" },
                      { key: "ats_parseability", label: "ATS Parseability" },
                      { key: "impact_strength", label: "Impact Strength" },
                      { key: "formatting_consistency", label: "Formatting Consistency" }
                    ].map((item) => {
                      const scoreVal = resumeAnalysis.score_breakdown?.[item.key] || 80;
                      const explanation = resumeAnalysis.score_explanations?.[item.key] || "";
                      return (
                        <div key={item.key} className="cs-metric-card">
                          <div>
                            <div className="cs-metric-top">
                              <span className="cs-metric-title">{item.label}</span>
                              <span className="cs-metric-score">{scoreVal}%</span>
                            </div>
                            <div className="cs-metric-bar-bg">
                              <div 
                                className="cs-metric-bar-fill" 
                                style={{ 
                                  width: `${scoreVal}%`,
                                  background: scoreVal >= 80 ? "var(--cs-green)" : scoreVal >= 70 ? "var(--cs-amber)" : "var(--cs-red)" 
                                }} 
                              />
                            </div>
                          </div>
                          {explanation && (
                            <p className="cs-metric-desc">{explanation}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 4. JD Keyword Matrix */}
                  <div className="cs-keywords-section">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <div className="cs-form-label" style={{ margin: 0 }}>
                        <span>Job Description Keyword Analysis</span>
                      </div>
                      <div className="cs-keyword-filter-nav">
                        <button 
                          type="button" 
                          className={`cs-keyword-filter-btn ${keywordFilter === "all" ? "active" : ""}`}
                          onClick={() => setKeywordFilter("all")}
                        >
                          All
                        </button>
                        <button 
                          type="button" 
                          className={`cs-keyword-filter-btn ${keywordFilter === "matched" ? "active" : ""}`}
                          onClick={() => setKeywordFilter("matched")}
                        >
                          Matched ({resumeAnalysis.jd_keywords?.matched?.length || 0})
                        </button>
                        <button 
                          type="button" 
                          className={`cs-keyword-filter-btn ${keywordFilter === "missing" ? "active" : ""}`}
                          onClick={() => setKeywordFilter("missing")}
                        >
                          Missing ({resumeAnalysis.jd_keywords?.missing?.length || 0})
                        </button>
                      </div>
                    </div>

                    <div className="cs-pills-wrap">
                      {(keywordFilter === "all" || keywordFilter === "matched") && 
                        resumeAnalysis.jd_keywords?.matched?.map((kw, i) => (
                          <span key={`m-${i}`} className="cs-pill matched">
                            <CheckCircle2 size={11} /> {kw}
                          </span>
                        ))}
                      {(keywordFilter === "all" || keywordFilter === "missing") && 
                        resumeAnalysis.jd_keywords?.missing?.map((kw, i) => (
                          <span key={`mis-${i}`} className="cs-pill missing">
                            ! {kw}
                          </span>
                        ))}
                      {(keywordFilter === "all" || keywordFilter === "partial") && 
                        resumeAnalysis.jd_keywords?.partially_covered?.map((kw, i) => (
                          <span key={`p-${i}`} className="cs-pill partial">
                            ~ {kw}
                          </span>
                        ))}
                    </div>

                    <div style={{ fontSize: "11px", color: "var(--cs-text-subtle)", marginTop: "8px", fontStyle: "italic" }}>
                      <Info size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />
                      Do not add missing keywords unless you have genuine hands-on experience with them. Avoid keyword stuffing.
                    </div>
                  </div>

                  {/* 5. Highest-Impact Improvements */}
                  {resumeAnalysis.highest_impact_improvements?.length > 0 && (
                    <div style={{ marginBottom: "24px" }}>
                      <div className="cs-form-label" style={{ marginBottom: "10px" }}>
                        <span>Highest-Impact Improvements (Prioritized)</span>
                      </div>
                      {resumeAnalysis.highest_impact_improvements.map((item, idx) => (
                        <div key={idx} className="cs-improvement-item">
                          <div className="cs-improvement-top">
                            <strong style={{ fontSize: "13px", color: "var(--cs-text)" }}>
                              {idx + 1}. {item.action}
                            </strong>
                            <span className={`cs-priority-tag ${item.priority?.toLowerCase() || "high"}`}>
                              {item.priority || "HIGH"}
                            </span>
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--cs-text-muted)", marginBottom: "6px" }}>
                            <strong>Reason:</strong> {item.reason}
                          </div>
                          {item.current_text && (
                            <div style={{ fontSize: "12px", color: "var(--cs-text-subtle)", fontStyle: "italic", marginBottom: "6px" }}>
                              <strong>Current:</strong> "{item.current_text}"
                            </div>
                          )}
                          <div style={{ fontSize: "12px", color: "var(--cs-text)", background: "var(--cs-surface)", padding: "8px 10px", borderRadius: "6px", marginBottom: "6px" }}>
                            <strong>Suggested:</strong> {item.suggested_improvement}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--cs-green)", fontWeight: 600 }}>
                            ★ Expected Impact: {item.expected_impact}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 6. Bullet Point / STAR Analysis */}
                  {resumeAnalysis.bullet_star_analysis?.length > 0 && (
                    <div style={{ marginBottom: "24px" }}>
                      <div className="cs-form-label" style={{ marginBottom: "10px" }}>
                        <span>Bullet Point & Measurable Impact (STAR) Analysis</span>
                      </div>
                      {resumeAnalysis.bullet_star_analysis.map((bullet, idx) => (
                        <div key={idx} className="cs-star-bullet-card">
                          <div className="cs-star-original">
                            <strong>Original:</strong> "{bullet.original}"
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--cs-amber)", marginBottom: "6px" }}>
                            <strong>Critique:</strong> {bullet.missing_dimension}
                          </div>
                          <div className="cs-star-guidance">
                            <strong>Metric Guidance:</strong> {bullet.metric_guidance}
                          </div>
                          <div className="cs-star-suggested">
                            <strong>Suggested Revision:</strong> {bullet.suggested_revision}
                          </div>
                          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "6px" }}>
                            <button 
                              type="button" 
                              className="cs-btn-ghost"
                              onClick={() => handleCopyBullet(bullet.suggested_revision, idx)}
                            >
                              {copiedBulletIdx === idx ? <Check size={12} /> : <Copy size={12} />}
                              <span>{copiedBulletIdx === idx ? "Copied" : "Copy Revision"}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 7. Section-by-Section Expandable Analysis */}
                  {resumeAnalysis.section_analysis?.length > 0 && (
                    <div style={{ marginBottom: "24px" }}>
                      <div className="cs-form-label" style={{ marginBottom: "10px" }}>
                        <span>Section-by-Section Audit</span>
                      </div>
                      {resumeAnalysis.section_analysis.map((sec, idx) => {
                        const isOpen = expandedSections[idx];
                        return (
                          <div key={idx} className="cs-accordion-item">
                            <button 
                              type="button"
                              className="cs-accordion-btn"
                              onClick={() => toggleSectionExpand(idx)}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span>{sec.section_name}</span>
                                <span className={`cs-badge-status ${sec.score >= 85 ? "pass" : "warn"}`}>
                                  {sec.score}/100
                                </span>
                              </div>
                              {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </button>
                            {isOpen && (
                              <div className="cs-accordion-content">
                                <div style={{ marginBottom: "6px" }}>
                                  <strong style={{ color: "var(--cs-green)" }}>✓ Strengths: </strong>
                                  {sec.strengths}
                                </div>
                                <div style={{ marginBottom: "6px" }}>
                                  <strong style={{ color: "var(--cs-amber)" }}>! Gaps / Issues: </strong>
                                  {sec.issues}
                                </div>
                                <div>
                                  <strong style={{ color: "var(--cs-text)" }}>★ Recommendation: </strong>
                                  {sec.recommendation}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 8. Recruiter Readiness Final Verdict */}
                  {resumeAnalysis.recruiter_verdict && (
                    <div className="cs-verdict-card">
                      <h4>
                        <Award size={18} color="var(--cs-text)" />
                        Recruiter Readiness: {resumeAnalysis.recruiter_verdict.match_label}
                      </h4>
                      <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "var(--cs-text)", lineHeight: 1.6 }}>
                        {resumeAnalysis.recruiter_verdict.assessment}
                      </p>

                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--cs-text-muted)", marginBottom: "6px" }}>
                        Recommended Before Applying:
                      </div>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                        {resumeAnalysis.recruiter_verdict.top_actions_before_applying?.map((act, i) => (
                          <li key={i} style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px", color: "var(--cs-text)" }}>
                            <ArrowRight size={12} color="var(--cs-green)" />
                            <span>{act}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Disclaimer */}
                  <div className="cs-disclaimer-card">
                    {resumeAnalysis.disclaimer || "ATS scores are an estimated compatibility signal based on resume structure, terminology, skills, and the supplied job description. Different ATS platforms may evaluate resumes differently."}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: NORA VOICE-FIRST AI TECHNICAL INTERVIEW PLATFORM        */}
        {/* ============================================================== */}
        {activeTab === "interview" && (
          <div style={{ position: "relative" }}>
            {/* Mandatory Fullscreen Lockdown Overlay */}
            {showFullscreenWarning && (
              <div className="nora-fullscreen-lock-overlay">
                <div className="nora-fullscreen-lock-card">
                  <Maximize size={40} color="var(--cs-accent)" style={{ margin: "0 auto 14px auto" }} />
                  <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", margin: "0 0 8px 0" }}>
                    Fullscreen Mode Required
                  </h3>
                  <p style={{ fontSize: "13px", color: "var(--cs-text-muted)", lineHeight: 1.6, margin: "0 0 20px 0" }}>
                    This Bar-Raiser technical interview is proctored and must remain in Fullscreen mode. Exiting full screen flags integrity warnings.
                  </p>
                  <button 
                    type="button" 
                    className="cs-btn-primary"
                    onClick={reEnterFullscreen}
                    style={{ width: "100%", padding: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                  >
                    <Maximize size={16} /> Return to Fullscreen
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 1: PRE-INTERVIEW SETUP & DEVICE VERIFICATION WIZARD */}
            {interviewStage === "WIZARD" && (
              <div className="nora-wizard-card">
                <div className="nora-wizard-header">
                  <div>
                    <h2>
                      <Sparkles size={18} color="var(--cs-accent)" />
                      Nora AI Bar-Raiser Interview Chamber
                    </h2>
                    <p>Voice-first, resume-aware technical architecture & live coding interview. Single attempt only.</p>
                  </div>
                  <span className="cs-badge-status info">
                    Silicon Valley Bar-Raiser v4.2
                  </span>
                </div>

                {hardwareError && (
                  <div className="cs-validation-box" style={{ marginBottom: "16px" }}>
                    <AlertTriangle size={15} />
                    <span>{hardwareError}</span>
                  </div>
                )}

                {/* Candidate & Role Track Configuration */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr 1.2fr", gap: "14px", marginBottom: "14px" }}>
                  <div className="cs-form-group" style={{ margin: 0 }}>
                    <label className="cs-form-label">Candidate Full Name</label>
                    <input 
                      type="text"
                      className="cs-text-input"
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value)}
                      placeholder="e.g. Alex Chen"
                    />
                  </div>
                  <div className="cs-form-group" style={{ margin: 0 }}>
                    <label className="cs-form-label">Candidate Email</label>
                    <input 
                      type="email"
                      className="cs-text-input"
                      value={candidateEmail}
                      onChange={(e) => setCandidateEmail(e.target.value)}
                      placeholder="e.g. ydvhimanshu461@gmail.com"
                    />
                  </div>
                  <div className="cs-form-group" style={{ margin: 0 }}>
                    <label className="cs-form-label">Target Role Track</label>
                    <select 
                      className="cs-select-input"
                      value={interviewRole}
                      onChange={(e) => setInterviewRole(e.target.value)}
                    >
                      {PRESET_ROLES.map((r, i) => (
                        <option key={i} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Unlimited Attempt or Single Attempt Notice Banner */}
                <div style={{ marginBottom: "18px" }}>
                  {isUnlimitedUser ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid var(--cs-green-border)", borderRadius: "var(--cs-radius-sm)", padding: "8px 14px", fontSize: "12px", color: "var(--cs-green)" }}>
                      <Zap size={14} color="var(--cs-green)" />
                      <span><strong>Unlimited Practice Access Active:</strong> Account ({candidateEmail || "ydvhimanshu461@gmail.com"}) has unrestricted attempts. Single-attempt locks will not apply.</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255, 255, 255, 0.04)", border: "1px solid var(--cs-border)", borderRadius: "var(--cs-radius-sm)", padding: "8px 14px", fontSize: "12px", color: "var(--cs-text-muted)" }}>
                      <Lock size={13} color="var(--cs-text-subtle)" />
                      <span><strong>Proctored Policy:</strong> Single attempt allowed per candidate track. Exiting fullscreen or switching browser tabs flags security violations.</span>
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                  <div className="cs-form-group" style={{ margin: 0 }}>
                    <label className="cs-form-label">Seniority Experience Bar</label>
                    <select 
                      className="cs-select-input"
                      value={experienceLevel}
                      onChange={(e) => setExperienceLevel(e.target.value)}
                    >
                      <option value="Junior (0-2 yrs)">Junior / Associate (0-2 years)</option>
                      <option value="Mid-Level (3-5 yrs)">Mid-Level Professional (3-5 years)</option>
                      <option value="Senior / Lead (6+ yrs)">Senior / Staff / Tech Lead (6+ years)</option>
                    </select>
                  </div>
                  <div className="cs-form-group" style={{ margin: 0 }}>
                    <label className="cs-form-label">Difficulty Calibration</label>
                    <select 
                      className="cs-select-input"
                      value={interviewDifficulty}
                      onChange={(e) => setInterviewDifficulty(e.target.value)}
                    >
                      <option value="Standard">Standard Enterprise</option>
                      <option value="Medium">Medium (Silicon Valley L4/L5)</option>
                      <option value="Hard">Hard (Staff / Bar Raiser)</option>
                    </select>
                  </div>
                </div>

                {/* Resume Grounding Status */}
                <div style={{ 
                  background: resumeText.trim().length >= 40 ? "rgba(16, 185, 129, 0.08)" : "rgba(245, 158, 11, 0.08)", 
                  border: `1px solid ${resumeText.trim().length >= 40 ? "var(--cs-green-border)" : "var(--cs-amber-border)"}`,
                  borderRadius: "var(--cs-radius-sm)",
                  padding: "12px 16px",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <FileCheck size={16} color={resumeText.trim().length >= 40 ? "var(--cs-green)" : "var(--cs-amber)"} />
                    <div>
                      <strong style={{ fontSize: "13px", color: "var(--cs-text)" }}>
                        {resumeText.trim().length >= 40 ? "Candidate Resume Grounded & Ready" : "Resume Not Provided"}
                      </strong>
                      <div style={{ fontSize: "11.5px", color: "var(--cs-text-muted)" }}>
                        {resumeText.trim().length >= 40 
                          ? `Parsed ${resumeText.trim().length} characters. Nora will cite actual projects from your resume.`
                          : "Please paste or upload your resume in Tab 1 (Resume Analyzer) before starting."}
                      </div>
                    </div>
                  </div>
                  {resumeText.trim().length < 40 && (
                    <button 
                      type="button" 
                      className="cs-btn-ghost"
                      onClick={() => setActiveTab("resume")}
                    >
                      Go to Tab 1
                    </button>
                  )}
                </div>

                {/* Pre-Interview Device Verification Grid */}
                <div className="cs-form-label" style={{ marginBottom: "12px" }}>
                  <span>Required Hardware & Integrity Verification</span>
                </div>

                <div className="nora-device-grid">
                  {/* Camera Verification */}
                  <div className={`nora-device-box ${camVerified ? "verified" : ""}`}>
                    <div className="nora-device-preview-cam" style={{ position: "relative", overflow: "hidden", borderRadius: "8px", background: "#06080e" }}>
                      <video 
                        ref={setWizardVideoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        style={{ 
                          width: "100%", 
                          height: "100%", 
                          objectFit: "cover", 
                          transform: "scaleX(-1)", 
                          display: camVerified ? "block" : "none"
                        }} 
                      />
                      {!camVerified && (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Video size={24} color="var(--cs-text-subtle)" />
                        </div>
                      )}
                    </div>
                    <strong style={{ fontSize: "13px", color: "var(--cs-text)", marginBottom: "4px" }}>
                      Webcam Stream
                    </strong>
                    <p style={{ fontSize: "11px", color: "var(--cs-text-muted)", margin: "0 0 10px 0" }}>
                      {camVerified ? "✓ Camera Connected" : "Face verification required"}
                    </p>
                    <button 
                      type="button"
                      className={`cs-btn-ghost ${camVerified ? "pass" : ""}`}
                      onClick={startCameraAndMicCheck}
                      style={{ width: "100%", fontSize: "11px" }}
                    >
                      {camVerified ? "Camera Active" : "Test Camera & Mic"}
                    </button>
                  </div>

                  {/* Microphone Verification */}
                  <div className={`nora-device-box ${micVerified ? "verified" : ""}`}>
                    <div style={{ 
                      width: "60px", 
                      height: "60px", 
                      borderRadius: "50%", 
                      background: micVerified ? "rgba(16, 185, 129, 0.12)" : "rgba(255, 255, 255, 0.04)", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center",
                      margin: "18px 0 12px 0"
                    }}>
                      <Mic size={24} color={micVerified ? "var(--cs-green)" : "var(--cs-text-subtle)"} />
                    </div>
                    <strong style={{ fontSize: "13px", color: "var(--cs-text)", marginBottom: "4px" }}>
                      Microphone Audio
                    </strong>
                    <div className="nora-mic-meter-track">
                      <div className="nora-mic-meter-fill" style={{ width: `${micLevel}%` }} />
                    </div>
                    <p style={{ fontSize: "11px", color: "var(--cs-text-muted)", margin: "0 0 10px 0" }}>
                      {micVerified ? `Active: ${micLevel}% level` : "Voice-first answering required"}
                    </p>
                    <button 
                      type="button"
                      className={`cs-btn-ghost ${micVerified ? "pass" : ""}`}
                      onClick={startCameraAndMicCheck}
                      style={{ width: "100%", fontSize: "11px" }}
                    >
                      {micVerified ? "Mic Calibrated" : "Enable Mic"}
                    </button>
                  </div>

                  {/* Screen Share Verification */}
                  <div className={`nora-device-box ${screenVerified ? "verified" : ""}`}>
                    <div style={{ 
                      width: "60px", 
                      height: "60px", 
                      borderRadius: "50%", 
                      background: screenVerified ? "rgba(16, 185, 129, 0.12)" : "rgba(255, 255, 255, 0.04)", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center",
                      margin: "18px 0 12px 0"
                    }}>
                      <Monitor size={24} color={screenVerified ? "var(--cs-green)" : "var(--cs-text-subtle)"} />
                    </div>
                    <strong style={{ fontSize: "13px", color: "var(--cs-text)", marginBottom: "4px" }}>
                      Screen Share Stream
                    </strong>
                    <p style={{ fontSize: "11px", color: "var(--cs-text-muted)", margin: "14px 0 10px 0" }}>
                      {screenVerified ? "✓ Screen Sharing Active" : "Full window proctoring"}
                    </p>
                    <button 
                      type="button"
                      className={`cs-btn-ghost ${screenVerified ? "pass" : ""}`}
                      onClick={startScreenShareCheck}
                      style={{ width: "100%", fontSize: "11px" }}
                    >
                      {screenVerified ? "Screen Connected" : "Share Entire Screen"}
                    </button>
                  </div>
                </div>

                {/* Strict Single Attempt Anti-Cheating Callout */}
                <div className="nora-rule-callout">
                  <ShieldAlert size={18} color="var(--cs-amber)" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <h4>Strict Single-Attempt & Anti-Cheating Rules</h4>
                    <p>
                      This session is limited to <strong>exactly 1 attempt</strong>. 
                      Switching browser tabs (<code>visibilitychange</code>) or exiting full screen immediately <strong>terminates and locks your attempt</strong> with zero retries. 
                      You will communicate with Nora primarily through <strong>voice</strong>. Answers auto-submit after 2.2 seconds of silence.
                    </p>
                  </div>
                </div>

                {/* Launch Button */}
                <button 
                  type="button"
                  className="cs-btn-primary"
                  onClick={handleLaunchNoraSession}
                  disabled={!camVerified || !micVerified || !screenVerified || isStartingSession || !resumeText.trim()}
                  style={{ width: "100%", padding: "14px", fontSize: "14px", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px" }}
                >
                  {isStartingSession ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Calibrating Nora Bar-Raiser Model...
                    </>
                  ) : (
                    <>
                      {isUnlimitedUser ? <Zap size={15} /> : <Lock size={15} />}
                      {isUnlimitedUser ? "Enter Chamber (Unlimited Practice Access)" : "Enter Proctored Single-Attempt Room"}
                    </>
                  )}
                </button>
              </div>
            )}

            {/* STAGE 2: LIVE FULLSCREEN VOICE-FIRST INTERVIEW ROOM */}
            {interviewStage === "ROOM" && interviewSession && (
              <div className="nora-chamber-wrap">
                {/* Left: Nora Stage & Voice Interaction */}
                <div className="nora-stage-card">
                  {/* Top Presence Bar */}
                  <div className="nora-presence-bar">
                    <div className="nora-interviewer-profile">
                      <div className={`nora-avatar-halo ${noraSpeaking ? "speaking" : ""}`}>
                        N
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--cs-text)" }}>
                          Nora
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--cs-text-muted)" }}>
                          Principal Bar Raiser • {interviewRole}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {noraSpeaking && (
                        <div className="nora-presence-status speaking">
                          <span className="nora-pulse-dot" />
                          <span>Nora Speaking</span>
                          <div className="nora-wave-wrap">
                            <span className="nora-wave-bar" />
                            <span className="nora-wave-bar" />
                            <span className="nora-wave-bar" />
                            <span className="nora-wave-bar" />
                            <span className="nora-wave-bar" />
                          </div>
                        </div>
                      )}

                      {candidateSpeaking && !noraSpeaking && (
                        <div className="nora-presence-status listening">
                          <span className="nora-pulse-dot" />
                          <span>Candidate Speaking</span>
                          <div className="nora-wave-wrap">
                            <span className="nora-wave-bar" />
                            <span className="nora-wave-bar" />
                            <span className="nora-wave-bar" />
                            <span className="nora-wave-bar" />
                          </div>
                        </div>
                      )}

                      {noraThinking && (
                        <div className="nora-presence-status thinking">
                          <Loader2 size={12} className="animate-spin" />
                          <span>Nora Synthesizing...</span>
                        </div>
                      )}

                      <div className="nora-presence-status" style={{ background: "rgba(255,255,255,0.06)", color: "var(--cs-text)" }}>
                        <span>Voice Question {currentQuestion?.question_number} of {currentQuestion?.total_voice_questions || 4}</span>
                      </div>

                      {/* Explicit Fullscreen Toggle */}
                      <button
                        type="button"
                        className="cs-btn-ghost"
                        onClick={reEnterFullscreen}
                        style={{ fontSize: "11px", padding: "4px 8px", display: "flex", alignItems: "center", gap: "4px" }}
                        title="Ensure Fullscreen Mode"
                      >
                        <Maximize size={12} /> Fullscreen
                      </button>
                    </div>
                  </div>

                  {/* Question Box */}
                  <div className="nora-question-box">
                    <div className="nora-question-meta">
                      <span className="nora-question-topic">
                        {currentQuestion?.topic || "System Architecture"}
                      </span>
                      <span className="cs-badge-status info">
                        {currentQuestion?.difficulty || "Medium"}
                      </span>
                    </div>
                    <h2 className="nora-question-text">
                      {currentQuestion?.question}
                    </h2>
                  </div>

                  {/* Upgraded Candidate Speech-to-Text Live Transcript Box */}
                  <div className={`nora-candidate-box ${candidateSpeaking ? "active-speech" : ""}`}>
                    {/* Active Mic Control Bar */}
                    <div className="nora-mic-control-bar">
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span className={`nora-mic-status-pill ${candidateSpeaking ? "active" : "inactive"}`}>
                          {candidateSpeaking ? <Mic size={13} /> : <MicOff size={13} />}
                          <span>{candidateSpeaking ? "Microphone Live & Listening" : "Microphone Paused"}</span>
                        </span>

                        {/* Speech Language Accent Model Selector */}
                        <select 
                          className="cs-select-input"
                          value={speechLang}
                          onChange={(e) => {
                            setSpeechLang(e.target.value);
                            speechLangRef.current = e.target.value;
                            backendSttModeRef.current = false;
                            networkErrorCountRef.current = 0;
                            if (isCandidateListeningRef.current) {
                              stopListeningCandidate();
                              setTimeout(() => startListeningCandidate(), 250);
                            }
                          }}
                          style={{ width: "145px", padding: "2px 6px", fontSize: "11px", background: "rgba(255,255,255,0.06)" }}
                          title="Microphone Language Recognition Accent"
                        >
                          <option value="en-IN">English (India) — en-IN ✓ Recommended</option>
                          <option value="hi-IN">Hindi / Hinglish — hi-IN</option>
                          <option value="en-US">English (US) — en-US</option>
                          <option value="en-GB">English (UK) — en-GB</option>
                        </select>

                        {/* Real-time Bouncing Decibel Level Bars */}
                        {candidateSpeaking && (
                          <div className="nora-live-bars-wrap" title={`Mic Volume: ${micLevel}%`}>
                            <span className="nora-live-bar" style={{ height: `${Math.max(4, micLevel * 0.3)}px` }} />
                            <span className="nora-live-bar" style={{ height: `${Math.max(4, micLevel * 0.6)}px` }} />
                            <span className="nora-live-bar" style={{ height: `${Math.max(4, micLevel * 0.45)}px` }} />
                            <span className="nora-live-bar" style={{ height: `${Math.max(4, micLevel * 0.25)}px` }} />
                          </div>
                        )}
                      </div>

                      {/* Manual Mic Toggle & Interrupt Nora Buttons */}
                      <div style={{ display: "flex", gap: "8px" }}>
                        {noraSpeaking && (
                          <button 
                            type="button" 
                            className="cs-btn-ghost warn"
                            onClick={handleInterruptNora}
                            style={{ fontSize: "11.5px", padding: "5px 12px", display: "flex", alignItems: "center", gap: "6px", fontWeight: 600, color: "#f59e0b", borderColor: "rgba(245, 158, 11, 0.4)" }}
                            title="Interrupt Nora and open candidate microphone immediately"
                          >
                            <Mic size={12} /> Interrupt & Speak Now
                          </button>
                        )}

                        <button 
                          type="button" 
                          className={`cs-btn-ghost ${candidateSpeaking ? "warn" : "pass"}`}
                          onClick={handleToggleMic}
                          style={{ fontSize: "11.5px", padding: "5px 12px", display: "flex", alignItems: "center", gap: "6px", fontWeight: 600 }}
                        >
                          {candidateSpeaking ? (
                            <>
                              <Square size={12} /> Pause Mic
                            </>
                          ) : (
                            <>
                              <Mic size={12} /> Click to Speak / Start Answering
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Editable Live Speech Area */}
                    <textarea 
                      className="nora-candidate-editable-input"
                      placeholder={
                        noraSpeaking 
                          ? "Nora is speaking... Listen to question or click 'Interrupt & Speak Now' to start speaking immediately." 
                          : (candidateSpeaking 
                              ? "🎤 Microphone Live: Speak clearly. Transcribed words appear here in real time (or you can edit / type directly)..." 
                              : "Microphone is paused. Click 'Click to Speak' above or type your answer directly in this box and click Submit...")
                      }
                      value={interimSpeechText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInterimSpeechText(val);
                        // Only update the ref used for submission — do NOT overwrite sessionPrefixRef
                        // which is managed exclusively by the STT recognition engine
                        interimSpeechTextRef.current = val;
                      }}
                      rows={4}
                    />

                    {/* Live Word Count & Mic Status Banner */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px", fontSize: "11.5px" }}>
                      {candidateSpeaking ? (
                        <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--cs-green)", fontWeight: 600 }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--cs-green)", boxShadow: "0 0 8px var(--cs-green)" }} />
                          {usingCloudStt
                            ? "Cloud STT active — words appear every few seconds as you speak..."
                            : "Microphone Live — Transcribing your speech in real time..."}
                        </span>
                      ) : noraSpeaking ? (
                        <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--cs-accent)" }}>
                          <Volume2 size={13} /> Nora is reading the question aloud...
                        </span>
                      ) : (
                        <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--cs-text-muted)" }}>
                          <Square size={10} /> Microphone paused (type or click speak)
                        </span>
                      )}

                      <span style={{ color: "var(--cs-text-subtle)", fontSize: "11px" }}>
                        {interimSpeechText.trim() ? `${interimSpeechText.trim().split(/\s+/).length} words` : "0 words"}
                      </span>
                    </div>

                    {sttError && (
                      <div style={{ color: "var(--cs-amber)", fontSize: "11.5px", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <AlertTriangle size={12} />
                        <span>{sttError}</span>
                      </div>
                    )}

                    {/* STT Fallback Banner — shown when Chrome STT network errors fail repeatedly */}
                    {sttFallbackMode && (
                      <div style={{
                        marginTop: "8px",
                        padding: "10px 14px",
                        background: "rgba(245, 158, 11, 0.1)",
                        border: "1px solid rgba(245, 158, 11, 0.4)",
                        borderRadius: "var(--cs-radius-sm)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px"
                      }}>
                        <AlertTriangle size={15} color="var(--cs-amber)" style={{ flexShrink: 0, marginTop: "1px" }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: "12.5px", color: "var(--cs-amber)", marginBottom: "3px" }}>
                            Voice Recognition Unavailable (Network Issue)
                          </div>
                          <div style={{ fontSize: "11.5px", color: "var(--cs-text-muted)", lineHeight: 1.5 }}>
                            Chrome's speech API couldn't connect to Google's servers. <strong style={{ color: "var(--cs-text)" }}>Type your answer directly in the box above</strong>, then click <strong style={{ color: "var(--cs-text)" }}>Submit Answer to Nora</strong>.
                          </div>
                          <button
                            type="button"
                            className="cs-btn-ghost"
                            onClick={() => {
                              setSttFallbackMode(false);
                              backendSttModeRef.current = false;
                              networkErrorCountRef.current = 0;
                              lastBrowserSttAtRef.current = 0;
                              setSttError("");
                              setTimeout(() => startListeningCandidate(), 300);
                            }}
                            style={{ marginTop: "6px", fontSize: "11px", padding: "3px 10px" }}
                          >
                            <RefreshCw size={11} /> Retry Voice
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="nora-speech-actions">
                      <div className="nora-silence-indicator">
                        <Radio size={12} color={candidateSpeaking ? "var(--cs-green)" : "var(--cs-text-subtle)"} />
                        <span>{sttFallbackMode ? "Type your answer above and click Submit" : "Auto-submits on 6.0s silence or click Submit Answer"}</span>
                      </div>

                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <button 
                          type="button" 
                          className="cs-btn-ghost"
                          onClick={handleEarlyConcludeInterview}
                          style={{ fontSize: "11px", padding: "6px 12px", color: "var(--cs-text-muted)" }}
                          title="Conclude interview early and generate full Bar-Raiser Executive Scorecard"
                        >
                          End & View Report
                        </button>

                        <button 
                          type="button" 
                          className="cs-btn-primary"
                          onClick={() => finalizeCandidateAnswer(interimSpeechText)}
                          disabled={!interimSpeechText.trim() || noraThinking}
                          style={{ fontSize: "12px", padding: "7px 16px" }}
                        >
                          <CheckCircle size={14} />
                          <span>Submit Answer to Nora</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Proctored Live Cam & Integrity Card */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", padding: "10px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--cs-border)", borderRadius: "var(--cs-radius)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--cs-text)", fontWeight: 600 }}>
                        <ShieldCheck size={14} color="var(--cs-green)" />
                        <span>Proctored Session: Active Integrity Monitoring</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--cs-text-muted)" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ef4444" }} />
                        <span>Live Webcam & Screen Monitored</span>
                      </div>
                    </div>

                    <div style={{ position: "relative", width: "125px", height: "85px", background: "#06080e", borderRadius: "8px", overflow: "hidden", border: "1.5px solid rgba(16, 185, 129, 0.4)", boxShadow: "0 4px 12px rgba(0,0,0,0.5)" }}>
                      <video 
                        ref={setChamberVideoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} 
                      />
                      <div style={{ position: "absolute", top: "4px", left: "5px", display: "flex", alignItems: "center", gap: "4px", background: "rgba(0,0,0,0.75)", padding: "1px 5px", borderRadius: "3px", fontSize: "9px", fontWeight: 700, color: "#ef4444" }}>
                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#ef4444" }} />
                        <span>LIVE</span>
                      </div>
                      <div style={{ position: "absolute", bottom: "3px", right: "5px", fontSize: "9px", color: "rgba(255,255,255,0.8)", background: "rgba(0,0,0,0.6)", padding: "1px 4px", borderRadius: "3px" }}>
                        {candidateName ? candidateName.split(" ")[0] : "Candidate"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Read-Only Persistent Transcript Feed */}
                <div className="nora-transcript-card">
                  <div className="nora-transcript-head">
                    <h4>
                      <MessageSquare size={14} /> Live Dialogue Transcript
                    </h4>
                    <span style={{ fontSize: "11px", color: "var(--cs-text-muted)" }}>
                      {transcriptFeed.length} turns
                    </span>
                  </div>

                  <div className="nora-transcript-feed">
                    {transcriptFeed.map((item, idx) => (
                      <div key={idx} className={`nora-bubble ${item.speaker.toLowerCase()}`}>
                        <div className="nora-bubble-sender">
                          <span>{item.speaker === "NORA" ? "Nora (Bar Raiser)" : (item.speaker === "CANDIDATE" ? candidateName : "System")}</span>
                          <span>{item.time}</span>
                        </div>
                        <div>{item.text}</div>
                      </div>
                    ))}
                    <div ref={transcriptBottomRef} />
                  </div>
                </div>
              </div>
            )}

            {/* STAGE 3: LIVE CODING CHALLENGE ENVIRONMENT */}
            {interviewStage === "CODING" && codingChallenge && (
              <div className="nora-coding-container">
                {/* Left Pane: Problem Specifications & Live Nora Discussion */}
                <div className="nora-coding-spec-pane">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span className="cs-badge-status info">Coding Assessment</span>
                    <span className="cs-badge-status warn">{codingChallenge.difficulty || "Medium"}</span>
                  </div>

                  <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--cs-text)", margin: "0 0 10px 0" }}>
                    {codingChallenge.title}
                  </h2>

                  <div style={{ fontSize: "13px", color: "var(--cs-text-muted)", lineHeight: 1.6, marginBottom: "16px", whiteSpace: "pre-wrap" }}>
                    {codingChallenge.instructions}
                  </div>

                  {codingChallenge.test_cases?.length > 0 && (
                    <div style={{ marginBottom: "16px" }}>
                      <div className="cs-form-label" style={{ marginBottom: "6px" }}>
                        <span>Example Test Cases</span>
                      </div>
                      {codingChallenge.test_cases.map((tc, i) => (
                        <div key={i} style={{ background: "var(--cs-surface)", border: "1px solid var(--cs-border)", borderRadius: "var(--cs-radius-sm)", padding: "8px 12px", marginBottom: "6px", fontSize: "11.5px" }}>
                          <div><strong>Input: </strong><code>{tc.input}</code></div>
                          <div><strong>Expected: </strong><code>{tc.expected}</code></div>
                          {tc.description && <div style={{ color: "var(--cs-text-muted)" }}>{tc.description}</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Live Nora Voice Intercom while coding */}
                  <div className="nora-voice-intercom-box">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <strong style={{ fontSize: "12px", color: "var(--cs-text)", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Mic size={13} color="var(--cs-accent)" />
                        Ask Nora (Voice Discussion)
                      </strong>
                      {noraSpeaking && <span className="cs-badge-status info">Nora Replying...</span>}
                    </div>
                    <p style={{ fontSize: "11px", color: "var(--cs-text-muted)", margin: "0 0 8px 0" }}>
                      Speak or type clarifying questions to Nora while writing your code.
                    </p>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input 
                        type="text"
                        className="cs-text-input"
                        placeholder="e.g. Can we assume sorted inputs?"
                        value={intercomInput}
                        onChange={(e) => setIntercomInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAskNoraWhileCoding(intercomInput)}
                        style={{ fontSize: "12px", padding: "6px 10px" }}
                      />
                      <button 
                        type="button"
                        className="cs-btn-primary"
                        onClick={() => handleAskNoraWhileCoding(intercomInput)}
                        style={{ fontSize: "12px", padding: "6px 12px" }}
                      >
                        Ask
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Pane: Monaco Code Editor */}
                <div className="nora-coding-editor-pane">
                  <div className="nora-editor-toolbar">
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <Code2 size={16} color="var(--cs-accent)" />
                      <select 
                        className="cs-select-input"
                        value={codingLang}
                        onChange={(e) => setCodingLang(e.target.value)}
                        style={{ width: "120px", padding: "4px 8px", fontSize: "12px" }}
                      >
                        <option value="python">Python 3</option>
                        <option value="javascript">JavaScript</option>
                        <option value="typescript">TypeScript</option>
                      </select>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div className={`nora-timer-pill ${codingTimeLeft < 60 ? "critical" : (codingTimeLeft < 300 ? "warning" : "")}`}>
                        <Clock size={13} />
                        <span>{Math.floor(codingTimeLeft / 60)}:{(codingTimeLeft % 60).toString().padStart(2, "0")}</span>
                      </div>

                      <button 
                        type="button"
                        className="cs-btn-primary"
                        onClick={handleSubmitCodeChallenge}
                        disabled={isSubmittingCode}
                        style={{ fontSize: "12px", padding: "6px 14px" }}
                      >
                        {isSubmittingCode ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                        <span>Submit Code Solution</span>
                      </button>
                    </div>
                  </div>

                  <div style={{ flex: 1, minHeight: "450px" }}>
                    <Editor 
                      height="100%"
                      defaultLanguage="python"
                      language={codingLang}
                      theme="vs-dark"
                      value={codeContent}
                      onChange={(val) => setCodeContent(val || "")}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        automaticLayout: true
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STAGE 4: POST-INTERVIEW EVIDENCE-BASED EVALUATION SCORECARD */}
            {interviewStage === "REPORT" && (
              <div className="nora-report-container">
                {isAnalyzingReport ? (
                  <div className="cs-loading-card" style={{ padding: "48px 24px" }}>
                    <Loader2 size={32} className="animate-spin" style={{ color: "var(--cs-accent)", marginBottom: "16px" }} />
                    <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--cs-text)", margin: "0 0 6px 0" }}>
                      Synthesizing Bar-Raiser Evidence Evaluation...
                    </h3>
                    <p style={{ fontSize: "13px", color: "var(--cs-text-muted)" }}>
                      Analyzing complete dialogue transcript, architecture claims, and submitted code.
                    </p>
                  </div>
                ) : evaluationReport ? (
                  <div>
                    {/* Terminated Notice Banner if session terminated */}
                    {isTerminated && (
                      <div className="nora-terminated-report-banner">
                        <AlertOctagon size={26} color="#ef4444" style={{ flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#ef4444", margin: "0 0 4px 0" }}>
                            Interview Session Terminated (Single Attempt Locked)
                          </h3>
                          <p style={{ fontSize: "12.5px", color: "var(--cs-text-muted)", margin: 0, lineHeight: 1.5 }}>
                            {terminationReason || "Session terminated due to browser tab switch or proctoring violation. Below is your Bar-Raiser Executive Scorecard evaluated up to the point of termination."}
                          </p>
                        </div>
                        <span className="cs-badge-status warn" style={{ background: "rgba(239, 68, 68, 0.2)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.4)", textTransform: "uppercase" }}>
                          TERMINATED
                        </span>
                      </div>
                    )}

                    {/* Verdict Banner */}
                    <div className="nora-verdict-banner">
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <span className={`cs-badge-status ${evaluationReport.recommendation.includes("Hire") ? "pass" : "warn"}`}>
                            {evaluationReport.recommendation}
                          </span>
                          <span style={{ fontSize: "12px", color: "var(--cs-text-muted)" }}>
                            Evaluated for {interviewRole}
                          </span>
                        </div>
                        <h2 style={{ fontSize: "22px", fontWeight: 800, color: "var(--cs-text)", margin: "0 0 10px 0" }}>
                          Bar-Raiser Executive Scorecard
                        </h2>
                        <p style={{ fontSize: "13px", color: "var(--cs-text-muted)", lineHeight: 1.6, maxWidth: "600px", margin: 0 }}>
                          {evaluationReport.executive_summary}
                        </p>
                      </div>

                      <div className="nora-verdict-score-ring">
                        {evaluationReport.overall_score}
                        <small>/100</small>
                      </div>
                    </div>

                    {/* Competencies with verbatim candidate quotes */}
                    <div className="cs-form-label" style={{ marginBottom: "12px" }}>
                      <span>Core Competencies & Direct Candidate Evidence</span>
                    </div>

                    {evaluationReport.competency_breakdown?.map((comp, i) => (
                      <div key={i} className="nora-competency-card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <strong style={{ fontSize: "14px", color: "var(--cs-text)" }}>{comp.name}</strong>
                          <span className={`cs-badge-status ${comp.score >= 80 ? "pass" : (comp.score >= 60 ? "warn" : "info")}`}>
                            {comp.score}/100
                          </span>
                        </div>
                        {comp.candidate_evidence && (
                          <div className="nora-evidence-quote">
                            "{comp.candidate_evidence}"
                          </div>
                        )}
                        <p style={{ fontSize: "12.5px", color: "var(--cs-text-muted)", margin: 0, lineHeight: 1.5 }}>
                          {comp.analysis}
                        </p>
                      </div>
                    ))}

                    {/* Strengths & Growth Areas */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "20px" }}>
                      <div className="cs-verdict-card">
                        <h4 style={{ color: "var(--cs-green)", display: "flex", alignItems: "center", gap: "6px" }}>
                          <CheckCircle2 size={16} /> Verified Strengths
                        </h4>
                        <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0 0", display: "flex", flexDirection: "column", gap: "8px" }}>
                          {evaluationReport.verified_strengths?.map((st, i) => (
                            <li key={i} style={{ fontSize: "12.5px", color: "var(--cs-text)", lineHeight: 1.5 }}>
                              <strong>{st.title}: </strong>{st.detail}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="cs-verdict-card">
                        <h4 style={{ color: "var(--cs-amber)", display: "flex", alignItems: "center", gap: "6px" }}>
                          <AlertTriangle size={16} /> Key Growth Areas
                        </h4>
                        <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0 0", display: "flex", flexDirection: "column", gap: "8px" }}>
                          {evaluationReport.areas_for_growth?.map((gr, i) => (
                            <li key={i} style={{ fontSize: "12.5px", color: "var(--cs-text)", lineHeight: 1.5 }}>
                              <strong>{gr.title}: </strong>{gr.detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Integrity Audit */}
                    {evaluationReport.integrity_audit && (
                      <div style={{ marginTop: "20px", padding: "16px 20px", background: "var(--cs-surface-2)", border: "1px solid var(--cs-border)", borderRadius: "var(--cs-radius-sm)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <ShieldCheck size={18} color={evaluationReport.integrity_audit.status === "PASSED" ? "var(--cs-green)" : "#ef4444"} />
                          <div>
                            <strong style={{ fontSize: "13px", color: "var(--cs-text)" }}>
                              Integrity Proctoring Audit: {evaluationReport.integrity_audit.status}
                            </strong>
                            <div style={{ fontSize: "12px", color: "var(--cs-text-muted)" }}>
                              {evaluationReport.integrity_audit.notes} ({evaluationReport.integrity_audit.violations_count} violations logged)
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button 
                            type="button"
                            className="cs-btn-ghost"
                            onClick={() => {
                              navigator.clipboard.writeText(JSON.stringify(evaluationReport, null, 2));
                              alert("Assessment scorecard copied to clipboard!");
                            }}
                          >
                            <Copy size={13} /> Copy Audit JSON
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Bottom Action Footer */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--cs-border)" }}>
                      <button 
                        type="button"
                        className="cs-btn-ghost"
                        onClick={() => {
                          const rpt = `# BAR-RAISER EXECUTIVE SCORECARD
Role: ${interviewRole}
Score: ${evaluationReport.overall_score}/100
Recommendation: ${evaluationReport.recommendation}

EXECUTIVE SUMMARY:
${evaluationReport.executive_summary}

COMPETENCIES:
${evaluationReport.competency_breakdown?.map(c => `### ${c.name} (${c.score}/100)\nQuote: "${c.candidate_evidence}"\nAnalysis: ${c.analysis}`).join("\n\n")}

VERIFIED STRENGTHS:
${evaluationReport.verified_strengths?.map(s => `- ${s.title}: ${s.detail}`).join("\n")}

AREAS FOR GROWTH:
${evaluationReport.areas_for_growth?.map(g => `- ${g.title}: ${g.detail}`).join("\n")}
`;
                          navigator.clipboard.writeText(rpt);
                          alert("Full markdown report copied to clipboard!");
                        }}
                      >
                        <Copy size={13} /> Copy Full Markdown Report
                      </button>

                      <button 
                        type="button" 
                        className="cs-btn-primary"
                        onClick={() => {
                          setInterviewStage("WIZARD");
                          setIsTerminated(false);
                          setInterviewSession(null);
                          setEvaluationReport(null);
                        }}
                      >
                        <RefreshCw size={13} /> Return to Interview Setup
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="cs-loading-card" style={{ padding: "40px", textAlign: "center" }}>
                    <AlertTriangle size={32} color="var(--cs-amber)" style={{ margin: "0 auto 12px auto" }} />
                    <h3 style={{ fontSize: "16px", color: "var(--cs-text)", margin: "0 0 6px 0" }}>
                      Evaluation Report In Progress
                    </h3>
                    <p style={{ fontSize: "12.5px", color: "var(--cs-text-muted)", marginBottom: "16px" }}>
                      If your report did not synthesize automatically, click below to retrieve your scorecard.
                    </p>
                    <button 
                      type="button" 
                      className="cs-btn-primary"
                      onClick={() => fetchEvaluationReport()}
                    >
                      <Sparkles size={13} /> Synthesize Scorecard
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: EXECUTIVE OUTREACH & COVER LETTERS                     */}
        {/* ============================================================== */}
        {activeTab === "outreach" && (
          <div className="cs-grid-split">
            <div className="cs-panel">
              <div className="cs-panel-header">
                <h3 className="cs-panel-title">
                  <Send size={16} /> Target Company & Opportunity
                </h3>
              </div>

              <div className="cs-form-group">
                <label className="cs-form-label">Target Organization</label>
                <input 
                  type="text" 
                  className="cs-text-input"
                  placeholder="e.g. OpenAI, Stripe, Linear, Vercel..."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              <div className="cs-form-group">
                <label className="cs-form-label">Target Role</label>
                <input 
                  type="text" 
                  className="cs-text-input"
                  placeholder="e.g. Senior Full-Stack Engineer"
                  value={outreachRole}
                  onChange={(e) => setOutreachRole(e.target.value)}
                />
              </div>

              <div className="cs-form-group">
                <label className="cs-form-label">Recipient Name / Title (Optional)</label>
                <input 
                  type="text" 
                  className="cs-text-input"
                  placeholder="e.g. Alex Rivera (Head of Engineering) or Hiring Team"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>

              <div className="cs-form-group">
                <label className="cs-form-label">Key Candidate Highlights</label>
                <textarea 
                  className="cs-textarea-input"
                  placeholder="e.g. 4+ yrs React/Python, reduced API latency by 38%, scaled services to 50k DAU..."
                  value={userHighlights}
                  onChange={(e) => setUserHighlights(e.target.value)}
                  style={{ minHeight: "100px" }}
                />
              </div>

              <div className="cs-form-group">
                <label className="cs-form-label">Outreach Tone</label>
                <select 
                  className="cs-select-input"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                >
                  <option value="Direct & Metric-Oriented">Direct & Metric-Oriented (Recommended)</option>
                  <option value="Confident & Professional">Confident & Professional</option>
                  <option value="Enthusiastic & High-Energy">Enthusiastic & High-Energy</option>
                </select>
              </div>

              <button 
                type="button" 
                className="cs-btn-primary"
                onClick={handleGenerateOutreach}
                disabled={isGeneratingOutreach}
                style={{ width: "100%", marginTop: "8px" }}
              >
                {isGeneratingOutreach ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Generating Executive Outreach...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Synthesize Outreach Drafts
                  </>
                )}
              </button>
            </div>

            <div className="cs-panel">
              <div className="cs-panel-header">
                <h3 className="cs-panel-title">
                  <FileText size={16} /> Generated Outreach Assets
                </h3>
              </div>

              {!outreachResult && !isGeneratingOutreach && (
                <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--cs-text-muted)" }}>
                  <Send size={36} style={{ margin: "0 auto 12px auto", opacity: 0.3 }} />
                  <p style={{ margin: 0, fontWeight: 600, color: "var(--cs-text)" }}>Executive Copywriter Ready</p>
                  <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "var(--cs-text-muted)" }}>
                    Input target company details to generate high-response LinkedIn InMail, Cold Email, and Cover Letter assets.
                  </p>
                </div>
              )}

              {isGeneratingOutreach && (
                <div style={{ padding: "60px 16px", textAlign: "center", color: "var(--cs-text-muted)" }}>
                  <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto 12px auto", color: "var(--cs-text)" }} />
                  <p style={{ fontWeight: 600, color: "var(--cs-text)" }}>Drafting tailored executive communications...</p>
                </div>
              )}

              {outreachResult && (
                <div>
                  <div className="cs-outreach-block">
                    <div className="cs-outreach-head">
                      <div>
                        <span className="cs-badge-status pass" style={{ marginRight: "8px" }}>LinkedIn InMail</span>
                        <strong style={{ fontSize: "13px", color: "var(--cs-text)" }}>
                          {outreachResult.linkedin_inmail?.subject}
                        </strong>
                      </div>
                      <button 
                        type="button" 
                        className="cs-btn-ghost"
                        onClick={() => copyOutreachCard("inmail", outreachResult.linkedin_inmail?.body)}
                      >
                        {copiedOutreach === "inmail" ? <Check size={12} /> : <Copy size={12} />}
                        {copiedOutreach === "inmail" ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="cs-outreach-text">
                      {outreachResult.linkedin_inmail?.body}
                    </div>
                  </div>

                  <div className="cs-outreach-block">
                    <div className="cs-outreach-head">
                      <div>
                        <span className="cs-badge-status pass" style={{ marginRight: "8px" }}>Cold Email</span>
                        <strong style={{ fontSize: "13px", color: "var(--cs-text)" }}>
                          {outreachResult.cold_email?.subject}
                        </strong>
                      </div>
                      <button 
                        type="button" 
                        className="cs-btn-ghost"
                        onClick={() => copyOutreachCard("email", outreachResult.cold_email?.body)}
                      >
                        {copiedOutreach === "email" ? <Check size={12} /> : <Copy size={12} />}
                        {copiedOutreach === "email" ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="cs-outreach-text">
                      {outreachResult.cold_email?.body}
                    </div>
                  </div>

                  <div className="cs-outreach-block">
                    <div className="cs-outreach-head">
                      <span className="cs-badge-status pass">Official Cover Letter</span>
                      <button 
                        type="button" 
                        className="cs-btn-ghost"
                        onClick={() => copyOutreachCard("letter", outreachResult.cover_letter?.body)}
                      >
                        {copiedOutreach === "letter" ? <Check size={12} /> : <Copy size={12} />}
                        {copiedOutreach === "letter" ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="cs-outreach-text" style={{ maxHeight: "240px", overflowY: "auto" }}>
                      {outreachResult.cover_letter?.body}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

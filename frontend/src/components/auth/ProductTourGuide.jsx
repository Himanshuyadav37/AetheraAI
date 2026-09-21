/**
 * ProductTourGuide.jsx — Aethera AI
 * Clean, minimal product tour. Visual-only female AI guide. No audio.
 */

import { useEffect, useRef, useCallback, useReducer } from "react";
import { createPortal } from "react-dom";
import {
  Wrench, Bot, Brain, GraduationCap, Zap,
  ChevronRight, ChevronLeft, X, Sparkles, Rocket,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import "./ProductTourGuide.css";

// ─── Tour steps (agents from Sidebar.jsx allEngines) ─────────────────────────
const STEPS = [
  {
    id: "welcome",
    phase: "welcome",
    title: "Welcome to Aethera AI",
    body: "Hi! I'm your Aethera guide. Let me walk you through the five AI engines powering your workspace.",
    icon: Sparkles,
    selector: null,
    tag: null,
  },
  {
    id: "engineer",
    phase: "touring",
    title: "Craft — Engineer AI",
    body: "<strong>Craft</strong> is your autonomous software engineer. Describe a task, and it plans, writes, and runs production-ready code in a sandboxed environment.",
    icon: Wrench,
    selector: '[data-tour="engine-engineer"]',
    tag: "CRAFT",
  },
  {
    id: "conversational",
    phase: "touring",
    title: "One — Conversational AI",
    body: "<strong>One</strong> is your always-on AI assistant. Ask anything and get precise, context-aware answers backed by long-term memory.",
    icon: Bot,
    selector: '[data-tour="engine-conversational"]',
    tag: "ONE",
  },
  {
    id: "research",
    phase: "touring",
    title: "Deep — Research Intelligence",
    body: "<strong>Deep</strong> performs autonomous multi-source research, cross-references facts, and delivers a verified structured dossier.",
    icon: Brain,
    selector: '[data-tour="engine-research"]',
    tag: "DEEP",
  },
  {
    id: "education",
    phase: "touring",
    title: "Mentor — Education AI",
    body: "<strong>Mentor</strong> is your adaptive tutor with learn, quiz, exam-prep, roadmap, revision, and interview modes.",
    icon: GraduationCap,
    selector: '[data-tour="engine-education"]',
    tag: "MENTOR",
  },
  {
    id: "automation",
    phase: "touring",
    title: "Agent — Workflow Automation",
    body: "<strong>Agent</strong> orchestrates multi-step automations. Describe a workflow in plain English and it executes it end-to-end.",
    icon: Zap,
    selector: '[data-tour="engine-automation"]',
    tag: "AGENT",
  },
  {
    id: "finish",
    phase: "finish",
    title: "You're all set 🚀",
    body: "Every AI engine is in the sidebar. You can replay this tour any time from Settings.",
    icon: Rocket,
    selector: null,
    tag: null,
  },
];

const AGENT_COUNT = 5;
const SPOTLIGHT_PAD = 10;

// ─── Reducer ─────────────────────────────────────────────────────────────────
const init = { idx: 0, rect: null };

function reducer(s, a) {
  switch (a.type) {
    case "NEXT": return { idx: Math.min(s.idx + 1, STEPS.length - 1), rect: a.rect ?? null };
    case "BACK": return { idx: Math.max(s.idx - 1, 0), rect: a.rect ?? null };
    case "RECT": return { ...s, rect: a.rect };
    case "RESET": return init;
    default: return s;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getElRect(sel) {
  if (!sel) return null;
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
}

// ─── Female AI Guide Avatar (SVG, visual-only) ────────────────────────────────
function GuideAvatar({ size = 56, speaking = false }) {
  return (
    <div className={`ptg-av${speaking ? " ptg-av--speaking" : ""}`} aria-hidden="true" style={{ width: size, height: size, flexShrink: 0 }}>
      <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: size, height: size, display: "block" }}>
        <circle cx="40" cy="40" r="38" stroke="url(#ptgRing)" strokeWidth="1.5" />
        <circle cx="40" cy="40" r="36" fill="url(#ptgBg)" />
        {/* Hair */}
        <ellipse cx="40" cy="26" rx="18" ry="14" fill="#1a1a2e" />
        <path d="M22 28 Q20 44 24 52" stroke="#1a1a2e" strokeWidth="5" strokeLinecap="round" />
        <path d="M58 28 Q60 44 56 52" stroke="#1a1a2e" strokeWidth="5" strokeLinecap="round" />
        <path d="M30 16 Q40 12 50 16" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round" />
        {/* Face */}
        <ellipse cx="40" cy="37" rx="14" ry="16" fill="#f5d0a0" />
        {/* Eyes */}
        <ellipse cx="34.5" cy="34" rx="2.4" ry="2.8" fill="#2d2d3d" />
        <ellipse cx="45.5" cy="34" rx="2.4" ry="2.8" fill="#2d2d3d" />
        <circle cx="35.4" cy="33.1" r="0.8" fill="rgba(255,255,255,0.9)" />
        <circle cx="46.4" cy="33.1" r="0.8" fill="rgba(255,255,255,0.9)" />
        {/* Lashes */}
        <path d="M32.5 31.8 L31 30.2" stroke="#2d2d3d" strokeWidth="0.8" strokeLinecap="round" />
        <path d="M34.5 31.5 L34 30" stroke="#2d2d3d" strokeWidth="0.8" strokeLinecap="round" />
        <path d="M43.5 31.5 L43 30" stroke="#2d2d3d" strokeWidth="0.8" strokeLinecap="round" />
        <path d="M45.5 31.8 L47 30.2" stroke="#2d2d3d" strokeWidth="0.8" strokeLinecap="round" />
        {/* Eyebrows */}
        <path d="M31.5 30.5 Q34.5 29 37 30" stroke="#5c3d2e" strokeWidth="1.3" strokeLinecap="round" fill="none" />
        <path d="M43 30 Q45.5 29 48.5 30.5" stroke="#5c3d2e" strokeWidth="1.3" strokeLinecap="round" fill="none" />
        {/* Nose */}
        <path d="M39 37 Q38.5 40 40 41 Q41.5 40 41 37" stroke="#d4a074" strokeWidth="0.9" strokeLinecap="round" fill="none" />
        {/* Mouth */}
        <path className="ptg-mouth" d="M36 44.5 Q40 47.5 44 44.5" stroke="#c07860" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        {/* Blush */}
        <ellipse cx="30" cy="40" rx="3.5" ry="2" fill="rgba(255,150,130,0.22)" />
        <ellipse cx="50" cy="40" rx="3.5" ry="2" fill="rgba(255,150,130,0.22)" />
        {/* Neck + body */}
        <rect x="36" y="52" width="8" height="7" rx="3" fill="#f5d0a0" />
        <path d="M20 72 Q24 60 36 58 Q40 57 44 58 Q56 60 60 72" fill="#6366f1" />
        <path d="M36 58 Q40 62 44 58" stroke="rgba(255,255,255,0.25)" strokeWidth="1" fill="none" />
        {/* Sparkle */}
        <path d="M64 18 L65.5 14 L67 18 L71 19.5 L67 21 L65.5 25 L64 21 L60 19.5 Z" fill="rgba(255,255,255,0.45)" />
        <defs>
          <linearGradient id="ptgBg" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1e1e2e" />
            <stop offset="1" stopColor="#12121f" />
          </linearGradient>
          <linearGradient id="ptgRing" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(255,255,255,0.3)" />
            <stop offset="0.5" stopColor="rgba(99,102,241,0.55)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.08)" />
          </linearGradient>
        </defs>
      </svg>
      <span className="ptg-av-ring ptg-av-ring--1" />
      <span className="ptg-av-ring ptg-av-ring--2" />
    </div>
  );
}

// ─── Spotlight overlay ────────────────────────────────────────────────────────
function Spotlight({ rect }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!rect) return <div className="ptg-overlay" aria-hidden="true" />;

  const x = Math.max(0, rect.left - SPOTLIGHT_PAD);
  const y = Math.max(0, rect.top - SPOTLIGHT_PAD);
  const w = Math.min(rect.width + SPOTLIGHT_PAD * 2, vw - x);
  const h = Math.min(rect.height + SPOTLIGHT_PAD * 2, vh - y);

  return (
    <svg className="ptg-overlay-svg" width={vw} height={vh} viewBox={`0 0 ${vw} ${vh}`} aria-hidden="true">
      <defs>
        <mask id="ptg-hole">
          <rect width={vw} height={vh} fill="white" />
          <rect x={x} y={y} width={w} height={h} rx="10" fill="black" />
        </mask>
      </defs>
      <rect width={vw} height={vh} fill="rgba(5,6,10,0.80)" mask="url(#ptg-hole)" />
      <rect x={x - 1} y={y - 1} width={w + 2} height={h + 2} rx="11" fill="none"
        stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" />
    </svg>
  );
}

// ─── Tooltip position engine ──────────────────────────────────────────────────
function calcTooltipPos(rect) {
  // On mobile always centre
  if (window.innerWidth < 640) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const TW = Math.min(380, vw - 32);
  const TH = 240;
  const GAP = 18;

  const candidates = [
    { top: rect.bottom + SPOTLIGHT_PAD + GAP, left: rect.left + rect.width / 2 - TW / 2 },
    { top: rect.top - SPOTLIGHT_PAD - GAP - TH, left: rect.left + rect.width / 2 - TW / 2 },
    { top: rect.top + rect.height / 2 - TH / 2, left: rect.right + SPOTLIGHT_PAD + GAP },
    { top: rect.top + rect.height / 2 - TH / 2, left: rect.left - SPOTLIGHT_PAD - GAP - TW },
  ];

  for (const c of candidates) {
    const l = Math.max(16, Math.min(c.left, vw - TW - 16));
    const t = Math.max(16, Math.min(c.top, vh - TH - 16));
    if (l + TW <= vw - 16 && t + TH <= vh - 16 && t >= 16) {
      return { position: "fixed", top: t, left: l, width: TW };
    }
  }

  return {
    position: "fixed",
    top: Math.max(16, vh / 2 - TH / 2),
    left: Math.max(16, vw / 2 - TW / 2),
    width: TW,
  };
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ current }) {
  return (
    <div className="ptg-progress" role="progressbar" aria-valuenow={current} aria-valuemin={1} aria-valuemax={AGENT_COUNT} aria-label={`Step ${current} of ${AGENT_COUNT}`}>
      {Array.from({ length: AGENT_COUNT }, (_, i) => (
        <span key={i} className={`ptg-prog-dot${i + 1 === current ? " active" : i + 1 < current ? " done" : ""}`} />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProductTourGuide() {
  const { isProductTourOpen, completeProductTour } = useAuth();
  const [state, dispatch] = useReducer(reducer, init);
  const cardRef = useRef(null);

  const step = STEPS[state.idx];
  const phase = step.phase;
  const isTour = phase === "touring";
  const agentNum = isTour ? state.idx : 0; // 1-5

  const getRect = useCallback((s) => getElRect(s), []);

  const goNext = useCallback(() => {
    const next = STEPS[state.idx + 1];
    dispatch({ type: "NEXT", rect: next ? getRect(next.selector) : null });
  }, [state.idx, getRect]);

  const goBack = useCallback(() => {
    const prev = STEPS[state.idx - 1];
    dispatch({ type: "BACK", rect: prev ? getRect(prev.selector) : null });
  }, [state.idx, getRect]);

  const skip = useCallback(() => {
    dispatch({ type: "RESET" });
    completeProductTour();
  }, [completeProductTour]);

  const finish = useCallback(() => {
    dispatch({ type: "RESET" });
    completeProductTour();
  }, [completeProductTour]);

  const startTour = useCallback(() => {
    dispatch({ type: "NEXT", rect: getRect(STEPS[1].selector) });
  }, [getRect]);

  // Re-measure rect on step change
  useEffect(() => {
    if (!isProductTourOpen || !step.selector) return;
    const id = requestAnimationFrame(() => {
      const r = getRect(step.selector);
      if (r) dispatch({ type: "RECT", rect: r });
    });
    return () => cancelAnimationFrame(id);
  }, [isProductTourOpen, state.idx, step.selector, getRect]);

  // Re-measure on resize
  useEffect(() => {
    if (!isProductTourOpen || !step.selector) return;
    const handle = () => dispatch({ type: "RECT", rect: getRect(step.selector) });
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [isProductTourOpen, step.selector, getRect]);

  // Lock scroll
  useEffect(() => {
    if (!isProductTourOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isProductTourOpen]);

  // Keyboard
  useEffect(() => {
    if (!isProductTourOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") { skip(); return; }
      if (e.key === "ArrowRight" || e.key === "Enter") {
        if (phase === "welcome") startTour();
        else if (phase === "touring") goNext();
        else if (phase === "finish") finish();
        return;
      }
      if (e.key === "ArrowLeft" && phase === "touring" && state.idx > 1) goBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isProductTourOpen, phase, state.idx, startTour, goNext, goBack, skip, finish]);

  // Focus
  useEffect(() => {
    if (isProductTourOpen) cardRef.current?.focus();
  }, [isProductTourOpen, state.idx]);

  if (!isProductTourOpen) return null;

  const tooltipPos = isTour ? (state.rect ? calcTooltipPos(state.rect) : null) : null;
  const Icon = step.icon;

  // ── WELCOME ───────────────────────────────────────────────────────────
  if (phase === "welcome") {
    return createPortal(
      <div className="ptg-root" role="dialog" aria-modal="true" aria-label="Aethera product tour">
        <div className="ptg-overlay" aria-hidden="true" />
        <div className="ptg-center-card" ref={cardRef} tabIndex={-1}>
          <div className="ptg-card-top-line" />
          <div className="ptg-center-body">
            <GuideAvatar size={64} speaking={false} />
            <div className="ptg-center-text">
              <span className="ptg-label">AETHERA AI · WORKSPACE TOUR</span>
              <h2 className="ptg-title">Welcome to Aethera AI</h2>
              <p className="ptg-desc">
                Hi! I'm your guide. I'll introduce you to the five AI engines — Craft, One, Deep, Mentor, and Agent — so you can start building right away.
              </p>
            </div>
          </div>
          <div className="ptg-card-footer">
            <button className="ptg-btn-ghost" onClick={skip} type="button">Skip</button>
            <button className="ptg-btn-primary" onClick={startTour} type="button" autoFocus>
              Start Tour <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // ── FINISH ────────────────────────────────────────────────────────────
  if (phase === "finish") {
    return createPortal(
      <div className="ptg-root" role="dialog" aria-modal="true" aria-label="Tour complete">
        <div className="ptg-overlay" aria-hidden="true" />
        <div className="ptg-center-card" ref={cardRef} tabIndex={-1}>
          <div className="ptg-card-top-line ptg-card-top-line--green" />
          <div className="ptg-center-body">
            <GuideAvatar size={64} speaking={true} />
            <div className="ptg-center-text">
              <span className="ptg-label ptg-label--green">ALL DONE</span>
              <h2 className="ptg-title">You're all set 🚀</h2>
              <p className="ptg-desc">
                Every AI engine is in the sidebar on the left. Replay this tour any time from <strong>Settings → Replay Product Tour</strong>.
              </p>
            </div>
          </div>
          <div className="ptg-card-footer ptg-card-footer--end">
            <button className="ptg-btn-primary ptg-btn-green" onClick={finish} type="button" autoFocus>
              <Rocket size={14} /> Start Exploring
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // ── AGENT STEP ────────────────────────────────────────────────────────
  const isMobile = window.innerWidth < 640;
  const tooltipStyle = (!isMobile && tooltipPos) ? tooltipPos : undefined;

  return createPortal(
    <div className="ptg-root" role="dialog" aria-modal="true"
      aria-label={`Tour step ${agentNum} of ${AGENT_COUNT}: ${step.title}`}>
      <Spotlight rect={state.rect} />

      <div
        className={`ptg-tooltip${!tooltipStyle ? " ptg-tooltip--bottom-sheet" : ""}`}
        style={tooltipStyle}
        ref={cardRef}
        tabIndex={-1}
        aria-live="polite"
      >
        <div className="ptg-card-top-line" />

        {/* Header row */}
        <div className="ptg-tt-header">
          <GuideAvatar size={44} speaking={true} />
          <div className="ptg-tt-meta">
            <div className="ptg-tt-meta-top">
              <span className="ptg-step-label">{agentNum} / {AGENT_COUNT}</span>
              {step.tag && <span className="ptg-tag">{step.tag}</span>}
            </div>
            <div className="ptg-tt-title-row">
              <span className="ptg-tt-icon" aria-hidden="true"><Icon size={14} /></span>
              <h3 className="ptg-tt-title">{step.title}</h3>
            </div>
          </div>
          <button className="ptg-x" onClick={skip} aria-label="Skip tour" type="button">
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <p className="ptg-tt-body" dangerouslySetInnerHTML={{ __html: step.body }} />

        {/* Progress */}
        <ProgressBar current={agentNum} />

        {/* Nav */}
        <div className="ptg-tt-nav">
          <button
            className="ptg-btn-ghost"
            onClick={goBack}
            disabled={state.idx <= 1}
            aria-label="Previous"
            type="button"
          >
            <ChevronLeft size={13} /> Back
          </button>
          <button
            className="ptg-btn-ghost ptg-skip-inline"
            onClick={skip}
            aria-label="Skip tour"
            type="button"
          >
            Skip
          </button>
          <button
            className="ptg-btn-primary"
            onClick={goNext}
            aria-label={state.idx >= STEPS.length - 2 ? "Finish" : "Next"}
            type="button"
          >
            {state.idx >= STEPS.length - 2 ? "Finish" : "Next"} <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

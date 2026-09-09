import { useEffect, useRef } from "react";
import "./LimitReachedModal.css";

export default function LimitReachedModal({ onClose }) {
  const overlayRef = useRef(null);

  const handleBackdrop = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="lrm-overlay" ref={overlayRef} onClick={handleBackdrop}>
      <div className="lrm-card">
        <div className="lrm-orb" />

        <div className="lrm-icon-wrap">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="24" fill="url(#lrmGrad)" opacity="0.12" />
            <path d="M24 14v12M24 34h.01" stroke="url(#lrmGrad)" strokeWidth="3" strokeLinecap="round" />
            <defs>
              <linearGradient id="lrmGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop stopColor="#818cf8" />
                <stop offset="1" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <h2 className="lrm-title">You've Reached Your Limit</h2>
        <p className="lrm-sub">
          Thank you for trying <span className="lrm-brand">NexusAI</span>!
          You have used your <strong>free prompt</strong> for this model.
        </p>

        <div className="lrm-divider" />

        <p className="lrm-feedback-label">Share your experience with us</p>
        <p className="lrm-feedback-desc">
          Your feedback helps us build something truly remarkable.
          We would love to hear your thoughts!
        </p>

        <div className="lrm-actions">
          <a
            className="lrm-btn-primary"
            href="mailto:feedback@nexusai.com?subject=NexusAI Feedback"
            target="_blank"
            rel="noopener noreferrer"
          >
            Send Feedback
          </a>
          <button className="lrm-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="lrm-footer">
          Want unlimited access?{" "}
          <a href="mailto:contact@nexusai.com" className="lrm-link">
            Contact us for a plan
          </a>
        </p>
      </div>
    </div>
  );
}

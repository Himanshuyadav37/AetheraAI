import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ShieldCheck, RotateCcw, ArrowRight } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import "./Auth.css";

function VerifyOtp() {
  const { loginWithToken } = useAuth();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(600);
  const inputRefs = useRef([]);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";

  // Auto-focus first box on load
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Countdown
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const formatTimer = () => {
    const m = Math.floor(timer / 60).toString().padStart(2, "0");
    const s = (timer % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
    e.preventDefault();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      setError("Please enter the complete 6-digit OTP");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/verify-otp", { email, code });
      const { access_token, user: userData } = res.data;

      // Store token and auto-login via context
      loginWithToken(access_token, userData);
      sessionStorage.setItem("show_login_welcome", "true");

      setSuccess("Verified! Taking you to your workspace...");
      setTimeout(() => navigate("/workspace"), 1500);
    } catch (err) {
      setError(err.response?.data?.detail || "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    try {
      await api.post("/auth/send-otp", { email });
      setTimer(600);
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      setSuccess("New OTP sent!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to resend OTP");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-background">
        <div className="blur blur1"></div>
        <div className="blur blur2"></div>
      </div>

      <div className="auth-left">
        <div className="brand-badge"><ShieldCheck size={15} /><span>NexusAI Verification</span></div>
        <h1>Check your <span>Email</span></h1>
        <p>We sent a 6-digit code to your email. Enter it to instantly access your NexusAI workspace — no password needed, ever.</p>
        <div className="system-status">
          <div className="status-dot" style={{ background: timer <= 60 ? "#ef4444" : "#22c55e" }}></div>
          <span>Code expires in</span>
          <strong style={{ color: timer <= 60 ? "#ef4444" : "#22c55e" }}>{formatTimer()}</strong>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card auth-card--compact">
          <div className="login-icon login-icon--sm" style={{ display: "flex", justifyContent: "center", alignItems: "center", background: "none", border: "none" }}>
            <svg
              width="46"
              height="46"
              viewBox="0 0 100 100"
              style={{
                color: "#ffffff",
                filter: "drop-shadow(0 0 10px rgba(255, 255, 255, 0.25))"
              }}
            >
              {/* Outer Nodes & Branches */}
              <line x1="50" y1="30" x2="50" y2="18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="50" cy="15" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <line x1="41.3" y1="35" x2="36.3" y2="26.3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="34" cy="22.3" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <line x1="58.7" y1="35" x2="63.7" y2="26.3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="66" cy="22.3" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <line x1="32.7" y1="45" x2="22" y2="45" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="18" cy="45" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <line x1="32.7" y1="55" x2="22" y2="55" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="18" cy="55" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <line x1="67.3" y1="45" x2="78" y2="45" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="82" cy="45" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <line x1="67.3" y1="55" x2="78" y2="55" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="82" cy="55" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <line x1="41.3" y1="65" x2="36.3" y2="73.7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="34" cy="77.7" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <line x1="58.7" y1="65" x2="63.7" y2="73.7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="66" cy="77.7" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <line x1="50" y1="70" x2="50" y2="82" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="50" cy="85" r="4.5" fill="none" stroke="currentColor" strokeWidth="2.5" />

              {/* Core Processor Hexagon */}
              <polygon points="50,35 63,42.5 63,57.5 50,65 37,57.5 37,42.5" fill="none" stroke="currentColor" strokeWidth="3" />
              
              {/* Inner Circle / Node */}
              <circle cx="50" cy="50" r="6" fill="currentColor" />
            </svg>
          </div>

          <div className="auth-header auth-header--sm">
            <h2>Enter Code</h2>
            <p>Sent to <strong style={{ color: "#ffffff" }}>{email}</strong></p>
          </div>

          {error && (
            <div className="auth-error"><ShieldCheck size={16} /><span>{error}</span></div>
          )}

          {success && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", borderRadius: "12px", marginBottom: "16px", background: "rgba(34,197,94,.08)", border: "1px solid rgba(34,197,94,.35)", color: "#22c55e", fontSize: "14px" }}>
              <ShieldCheck size={16} /><span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginBottom: "24px" }}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (inputRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  style={{
                    width: "48px", height: "54px", textAlign: "center",
                    fontSize: "24px", fontWeight: "700",
                    background: digit ? "rgba(255,255,255,0.03)" : "#161616",
                    border: digit ? "1px solid rgba(255, 255, 255, 0.4)" : "1px solid #303030",
                    borderRadius: "12px", color: "#ffffff",
                    outline: "none", transition: "all 0.2s",
                    caretColor: "#ffffff"
                  }}
                />
              ))}
            </div>

            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? "Verifying..." : <><span>Verify & Sign In</span><ArrowRight size={17} /></>}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: "18px" }}>
            {timer > 0 ? (
              <p style={{ color: "#6b7280", fontSize: "13px" }}>
                Resend in <strong style={{ color: "#ffffff" }}>{formatTimer()}</strong>
              </p>
            ) : (
              <button type="button" onClick={handleResend} disabled={resending}
                style={{ background: "none", border: "none", color: "#ffffff", cursor: "pointer", fontSize: "14px", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <RotateCcw size={14} />
                {resending ? "Sending..." : "Resend Code"}
              </button>
            )}
          </div>

          <div className="auth-footer" style={{ marginTop: "14px" }}>
            <p>Wrong email?</p>
            <Link to="/login">Go back</Link>
          </div>

          <div className="powered-by-nft" style={{
            textAlign: "center",
            marginTop: "20px",
            fontSize: "11px",
            color: "rgba(255, 255, 255, 0.35)",
            borderTop: "1px solid rgba(255, 255, 255, 0.05)",
            paddingTop: "12px"
          }}>
            Powered & Managed by <strong style={{ color: "rgba(255, 255, 255, 0.7)" }}>NexusAI Technologies (NFT)</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerifyOtp;

import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { ShieldCheck, RotateCcw, ArrowRight, Sun, Moon, Sparkles, CheckCircle2, Lock } from "lucide-react";
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
  const [isLight, setIsLight] = useState(() => document.body.classList.contains("light"));
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

  const toggleTheme = () => {
    const nextLight = !isLight;
    setIsLight(nextLight);
    if (nextLight) {
      document.body.classList.add("light");
      document.documentElement.classList.add("light");
      localStorage.setItem("theme", "light");
    } else {
      document.body.classList.remove("light");
      document.documentElement.classList.remove("light");
      localStorage.setItem("theme", "dark");
    }
  };

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

      setSuccess("Verified! Booting into your secure workspace...");
      setTimeout(() => navigate("/workspace"), 1200);
    } catch (err) {
      setError(err.response?.data?.detail || "Verification failed. Please check your OTP code.");
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
      setSuccess("New 6-digit verification code dispatched to your email!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to resend code");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className={`auth-page ${isLight ? "light" : ""}`}>
      {/* Top Floating Controls */}
      <div className="auth-topbar-controls">
        <button 
          type="button" 
          className="auth-theme-toggle" 
          onClick={toggleTheme}
          title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
          aria-label="Toggle Theme"
        >
          {isLight ? <Moon size={16} /> : <Sun size={16} />}
          <span>{isLight ? "Dark" : "Light"}</span>
        </button>
      </div>

      <div className="auth-background">
        <div className="blur blur1"></div>
        <div className="blur blur2"></div>
      </div>

      {/* Left Value Showcase */}
      <div className="auth-left">
        <div className="brand-badge">
          <ShieldCheck size={15} />
          <span>Multi-Factor Verification</span>
        </div>
        
        <h1 className="auth-hero-heading">
          Check Your <span>Work Email</span>
        </h1>
        
        <p className="auth-hero-desc">
          We sent a temporary 6-digit verification code to <strong style={{ color: "inherit", fontWeight: 700 }}>{email || "your email"}</strong>. Enter the code to securely access your NexusAI organization workspace.
        </p>

        <div className="system-status">
          <div className="status-dot" style={{ background: timer <= 60 ? "#ef4444" : "#22c55e" }}></div>
          <span>OTP valid for</span>
          <strong style={{ color: timer <= 60 ? "#ef4444" : "inherit" }}>{formatTimer()}</strong>
        </div>

        <div className="auth-security-badges">
          <div className="security-badge-item">
            <CheckCircle2 size={13} />
            <span>Encrypted Session</span>
          </div>
          <div className="security-badge-item">
            <Lock size={13} />
            <span>Zero Password Footprint</span>
          </div>
          <div className="security-badge-item">
            <ShieldCheck size={13} />
            <span>SOC2 Verified</span>
          </div>
        </div>
      </div>

      {/* Right OTP Card */}
      <div className="auth-right">
        <div className="auth-card auth-card--compact">
          <div className="auth-card-header">
            <div className="auth-brand-wordmark">NEXUSAI</div>
            <h2>Verify Your Identity</h2>
            <p>Enter the 6-digit code sent to your inbox</p>
          </div>

          {error && (
            <div className="auth-error">
              <ShieldCheck size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="auth-success-box">
              <CheckCircle2 size={16} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form auth-form--compact">
            <div className="otp-inputs-grid" onPaste={handlePaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (inputRefs.current[i] = el)}
                  type="text"
                  maxLength={1}
                  className="otp-digit-box"
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  autoComplete="one-time-code"
                />
              ))}
            </div>

            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? (
                <span>Verifying credentials...</span>
              ) : (
                <>
                  <span>Verify & Enter Workspace</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className="otp-actions-row">
            <button
              type="button"
              className="otp-resend-btn"
              onClick={handleResend}
              disabled={resending || timer > 540}
            >
              <RotateCcw size={13} />
              <span>{resending ? "Sending code..." : "Resend 6-Digit Code"}</span>
            </button>
            <Link to="/login" className="otp-back-link">
              Use different email
            </Link>
          </div>

          <div className="auth-security-footer">
            <span>🔒 Enterprise Grade 256-bit Encryption • ISO 27001</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerifyOtp;

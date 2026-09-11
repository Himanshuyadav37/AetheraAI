import React, { useState, useEffect, useRef } from "react";
import { 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  RotateCcw, 
  X, 
  CheckCircle2, 
  Lock, 
  Mail, 
  Loader2 
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import api from "../../services/api";
import "./AuthModal.css";

export default function AuthModal() {
  const { 
    isAuthModalOpen, 
    closeAuthModal, 
    loginWithToken, 
    authModalTitle, 
    authModalSubtitle 
  } = useAuth();

  const [step, setStep] = useState("email"); // "email" | "otp"
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(600);
  
  const otpInputsRef = useRef([]);
  const emailInputRef = useRef(null);

  // Reset state on open
  useEffect(() => {
    if (isAuthModalOpen) {
      setStep("email");
      setError("");
      setSuccess("");
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => {
        emailInputRef.current?.focus();
      }, 100);
    }
  }, [isAuthModalOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isAuthModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  // OTP timer
  useEffect(() => {
    if (step !== "otp" || timer <= 0) return;
    const interval = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [step, timer]);

  const formatTimer = () => {
    const m = Math.floor(timer / 60).toString().padStart(2, "0");
    const s = (timer % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Google OAuth Login
  const handleGoogleCallback = async (response) => {
    setError("");
    setLoading(true);
    try {
      const token = response.credential || response.access_token;
      const res = await api.post("/auth/google-login", { id_token: token });
      const { access_token, user: userData } = res.data;
      loginWithToken(access_token, userData);
    } catch (err) {
      setError(err.response?.data?.detail || "Google authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const client_id = import.meta.env.VITE_GOOGLE_CLIENT_ID || "952942649756-9cq0su8134k48mhnjss7aojtr5dlilpj.apps.googleusercontent.com";
    if (!client_id) {
      setError("Google authentication client is not configured.");
      return;
    }

    setError("");
    if (window.google?.accounts?.oauth2) {
      try {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id,
          scope: "email profile openid",
          callback: (tokenResponse) => {
            if (tokenResponse?.access_token) {
              handleGoogleCallback(tokenResponse);
            } else if (tokenResponse?.error) {
              setError(tokenResponse.error_description || "Google authorization was cancelled.");
            }
          },
        });
        tokenClient.requestAccessToken({ prompt: "consent" });
      } catch (err) {
        console.error("OAuth client error:", err);
        setError("Failed to open Google login. Please try again.");
      }
    } else if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id,
          callback: handleGoogleCallback,
          auto_select: false,
        });
        window.google.accounts.id.prompt();
      } catch (err) {
        console.error("GSI prompt error:", err);
        setError("Failed to open Google login. Please try again.");
      }
    } else {
      setError("Google Sign-In is initializing. Please try again in a moment.");
    }
  };

  // Send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await api.post("/auth/send-otp", { email });
      setStep("otp");
      setTimer(600);
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resending || timer > 540) return;
    setError("");
    setSuccess("");
    setResending(true);
    try {
      await api.post("/auth/send-otp", { email });
      setSuccess("New verification code sent!");
      setTimer(600);
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => {
        otpInputsRef.current[0]?.focus();
      }, 100);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to resend code.");
    } finally {
      setResending(false);
    }
  };

  // Handle OTP Inputs
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      otpInputsRef.current[5]?.focus();
    }
    e.preventDefault();
  };

  // Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      setError("Please enter the complete 6-digit code");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/verify-otp", { email, code });
      const { access_token, user: userData } = res.data;
      loginWithToken(access_token, userData);
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthModalOpen) return null;

  return (
    <div className="auth-modal-backdrop" onClick={closeAuthModal}>
      <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button
          type="button"
          className="auth-modal-close-btn"
          onClick={closeAuthModal}
          title="Close (Esc)"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Brand Header */}
        <div className="auth-modal-header">
          <h2 className="auth-modal-title">{authModalTitle || "Sign In to Continue"}</h2>
          <p className="auth-modal-subtitle">
            {step === "otp" 
              ? `Enter the 6-digit verification code sent to ${email}`
              : (authModalSubtitle || "Access autonomous agents, RAG knowledge, and project workspaces.")
            }
          </p>
        </div>

        {error && <div className="auth-modal-alert error">{error}</div>}
        {success && <div className="auth-modal-alert success">{success}</div>}

        {step === "email" ? (
          <div className="auth-modal-body">
            {/* Google 1-Click Login */}
            <button
              type="button"
              className="auth-modal-google-btn"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.616z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.347 2.825.957 4.039l3.007-2.332z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="auth-modal-divider">
              <span>or continue with email</span>
            </div>

            {/* Email OTP Request Form */}
            <form onSubmit={handleSendOtp} className="auth-modal-form">
              <div className="auth-modal-input-wrap">
                <Mail size={16} className="auth-modal-input-icon" />
                <input
                  ref={emailInputRef}
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="auth-modal-input"
                />
              </div>

              <button
                type="submit"
                className="auth-modal-submit-btn"
                disabled={loading || !email.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin-icon" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="auth-modal-body">
            {/* OTP Verification Form */}
            <form onSubmit={handleVerifyOtp} className="auth-modal-form">
              <div className="auth-modal-otp-grid">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (otpInputsRef.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    onPaste={handleOtpPaste}
                    className="auth-modal-otp-box"
                    autoFocus={index === 0}
                  />
                ))}
              </div>

              <div className="auth-modal-timer-row">
                <span className="auth-modal-timer-text">
                  Expires in: <strong>{formatTimer()}</strong>
                </span>
                <button
                  type="button"
                  className="auth-modal-resend-btn"
                  onClick={handleResendOtp}
                  disabled={resending || timer > 540}
                >
                  <RotateCcw size={12} className={resending ? "spin-icon" : ""} />
                  {resending ? "Resending..." : "Resend Code"}
                </button>
              </div>

              <button
                type="submit"
                className="auth-modal-submit-btn"
                disabled={loading || otp.join("").length < 6}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin-icon" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Continue</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>

              <button
                type="button"
                className="auth-modal-back-btn"
                onClick={() => setStep("email")}
              >
                ← Back to email
              </button>
            </form>
          </div>
        )}

        {/* Footer Security Note */}
        <div className="auth-modal-footer">
          <div className="auth-modal-security-pill">
            <Lock size={12} />
            <span>256-Bit TLS · SOC2 Type II Certified</span>
          </div>
        </div>
      </div>
    </div>
  );
}

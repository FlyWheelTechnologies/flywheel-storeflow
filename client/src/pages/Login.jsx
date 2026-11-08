import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  TrendingUp,
  Receipt,
  Store,
  HelpCircle,
  X,
  PhoneCall
} from "lucide-react";
import "./Auth.css";

// ── StoreFlow Origami Emblem ──
// Pure self-contained SVG geometric origami facets (no external defs/gradient dependencies).
const OrigamiIcon = ({ 
  size = 32, 
  isFluttering = false, 
  onClick 
}) => (
  <div 
    className={`sf-origami-badge ${isFluttering ? "is-fluttering" : ""}`}
    onClick={(e) => {
      e.stopPropagation();
      onClick?.(e);
    }}
    title="StoreFlow"
    role="button"
    tabIndex={0}
    onKeyDown={(e) => { 
      if (e.key === "Enter" || e.key === " ") { 
        e.preventDefault(); 
        onClick?.(e); 
      } 
    }}
  >
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 40 40" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className="sf-origami-svg"
    >
      {/* Origami Head & Beak */}
      <polygon points="20,4 16,9 20,11" fill="#fb923c" />
      <polygon points="16,9 11,10 16,11" fill="#ea580c" />
      <polygon points="20,4 20,11 18,7.5" fill="#ffffff" fillOpacity="0.45" />

      {/* Left Wing Facets */}
      <polygon points="20,11 4,16 20,22" fill="#ff7a45" />
      <polygon points="4,16 12,27 20,22" fill="#f97316" />
      <polygon points="20,22 12,27 20,36" fill="#fdba74" />
      <polygon points="20,11 20,22 15,16.5" fill="#ffffff" fillOpacity="0.32" />

      {/* Right Wing Facets */}
      <polygon points="20,11 36,16 20,22" fill="#ea580c" />
      <polygon points="36,16 28,27 20,22" fill="#c2410c" />
      <polygon points="20,22 28,27 20,36" fill="#9a3412" />
      <polygon points="20,11 20,22 25,16.5" fill="#000000" fillOpacity="0.14" />

      {/* Center Spine Crease Line */}
      <line x1="20" y1="4" x2="20" y2="36" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1" />
    </svg>
  </div>
);

export default function Login() {
  const [mode, setMode] = useState("signin"); // "signin" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [origamiFlutter, setOrigamiFlutter] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showDemoModal, setShowDemoModal] = useState(false);

  const navigate = useNavigate();
  const { user } = useAuth();

  // Load remembered email on mount
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem("storeflow_remembered_email");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch (_) {
      // Ignore localStorage availability issues
    }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      if (user.role === "super_admin" || user.email?.trim().toLowerCase() === "godwinokro2020@gmail.com") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [user, navigate]);

  // Handle Caps Lock detection
  const handleKeyDown = (e) => {
    if (e.getModifierState) {
      setCapsLockActive(e.getModifierState("CapsLock"));
    }
  };

  const triggerOrigamiFlutter = () => {
    setOrigamiFlutter(true);
    setTimeout(() => setOrigamiFlutter(false), 600);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    // Fail-safe timeout for slow networks
    const loginTimer = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setErrorMsg("The connection is taking longer than expected. Please check your internet and retry.");
      }
    }, 15000);

    try {
      const trimmedEmail = email.trim();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes("invalid login credentials")) {
          setErrorMsg("Incorrect email or password. Please verify your credentials and try again.");
        } else {
          setErrorMsg(error.message);
        }
      } else {
        // Save or remove remembered email
        try {
          if (rememberMe) {
            localStorage.setItem("storeflow_remembered_email", trimmedEmail);
          } else {
            localStorage.removeItem("storeflow_remembered_email");
          }
        } catch (_) {}

        const isSuperAdmin = trimmedEmail.toLowerCase() === "godwinokro2020@gmail.com" || 
          data?.user?.user_metadata?.role === "super_admin" || 
          data?.user?.app_metadata?.role === "super_admin";

        if (isSuperAdmin) {
          navigate("/admin", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      }
    } catch (err) {
      console.error("Login unexpected error:", err);
      setErrorMsg("An unexpected network error occurred: " + (err.message || "Please try again."));
    } finally {
      clearTimeout(loginTimer);
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg("Please enter your email address to receive a recovery link.");
      return;
    }

    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg(`We've sent a secure password reset link to ${email.trim()}. Please check your inbox.`);
      }
    } catch (err) {
      console.error("Password reset error:", err);
      setErrorMsg("Failed to send reset link: " + (err.message || "Please contact your store administrator."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sf-auth-layout">
      {/* ── Left Hero Visual / Brand Side (Desktop Showcase) ── */}
      <aside className="sf-auth-hero">
        <div className="sf-hero-gradient-overlay" />
        
        {/* Ambient Glow Orbs */}
        <div className="sf-glow-orb orb-primary" />
        <div className="sf-glow-orb orb-secondary" />

        <div className="sf-hero-inner">
          {/* Top Brand Showcase */}
          <div className="sf-hero-brand-row">
            <OrigamiIcon 
              size={32} 
              isFluttering={origamiFlutter}
              onClick={triggerOrigamiFlutter}
            />
            <Link to="/" className="sf-hero-brand" title="Return to StoreFlow Home">
              <div className="sf-brand-text-col">
                <span className="sf-brand-title">StoreFlow</span>
                <span className="sf-brand-tag">By Flywheel</span>
              </div>
            </Link>
          </div>

          {/* Central Pitch / Headline */}
          <div className="sf-hero-pitch">
            <div className="sf-hero-pill">
              <Sparkles size={14} className="sf-pill-icon" />
              <span>Built for Ghanaian Commerce</span>
            </div>
            <h1 className="sf-hero-headline">
              Complete control over your stock, sales, and accounts.
            </h1>
            <p className="sf-hero-subtext">
              Real-time POS checkout, automated double-entry ledgers, and instant receipts designed for modern retail & wholesale operations.
            </p>

            {/* Feature Cards Grid */}
            <div className="sf-hero-features-grid">
              <div className="sf-feature-card">
                <div className="sf-feature-icon-wrap icon-orange">
                  <Store size={18} />
                </div>
                <div>
                  <h4 className="sf-feature-title">Multi-Tenant Isolation</h4>
                  <p className="sf-feature-desc">Granular roles keep cashiers focused on sales and ledger profits strictly confidential.</p>
                </div>
              </div>

              <div className="sf-feature-card">
                <div className="sf-feature-icon-wrap icon-green">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h4 className="sf-feature-title">Automatic Balancing</h4>
                  <p className="sf-feature-desc">Every transaction posts double-entry journal entries with integrated Ghana tax math.</p>
                </div>
              </div>

              <div className="sf-feature-card">
                <div className="sf-feature-icon-wrap icon-blue">
                  <Receipt size={18} />
                </div>
                <div>
                  <h4 className="sf-feature-title">Instant Digital Receipts</h4>
                  <p className="sf-feature-desc">Deliver itemized PDF receipts directly to customers via email and messaging.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Live System Operational Badge */}
          <div className="sf-hero-footer">
            <div className="sf-system-status">
              <span className="sf-status-pulsar" />
              <span>All Systems Operational • Cloudflare Edge</span>
            </div>
            <a 
              href="https://bookflywheel.com" 
              target="_blank" 
              rel="noreferrer" 
              className="sf-hero-flywheel-link"
            >
              bookflywheel.com ↗
            </a>
          </div>
        </div>
      </aside>

      {/* ── Right Auth Form Panel (Centered Form Container) ── */}
      <main className="sf-auth-form-panel">
        <div className="sf-form-container">
          
          {/* Top Bar Navigation */}
          <div className="sf-form-top-nav">
            <Link to="/" className="sf-back-link">
              <ArrowLeft size={16} />
              <span>Back to home</span>
            </Link>

            <button 
              type="button" 
              onClick={() => setShowDemoModal(true)} 
              className="sf-help-btn"
              title="Need help or request access?"
            >
              <HelpCircle size={15} />
              <span>Need help?</span>
            </button>
          </div>

          {/* ── Brand Header (Left-Aligned with Form) ── */}
          <div className="sf-form-brand-row">
            <OrigamiIcon 
              size={34} 
              isFluttering={origamiFlutter}
              onClick={triggerOrigamiFlutter}
            />
            <div className="sf-form-brand-meta">
              <span className="sf-form-brand-title">StoreFlow</span>
              <span className="sf-form-brand-subtitle">by Flywheel</span>
            </div>
          </div>

          {/* Form Header */}
          <div className="sf-form-header">
            {mode === "signin" ? (
              <>
                <h2 className="sf-form-title">Welcome back</h2>
                <p className="sf-form-subtitle">
                  Sign in to access your store inventory, transactions, and reports.
                </p>
              </>
            ) : (
              <>
                <h2 className="sf-form-title">Reset your password</h2>
                <p className="sf-form-subtitle">
                  Enter your registered store email to receive a recovery link.
                </p>
              </>
            )}
          </div>

          {/* Alerts */}
          {errorMsg && (
            <div className="sf-alert sf-alert-error animate-fade-in" role="alert">
              <AlertCircle size={18} className="sf-alert-icon" />
              <div className="sf-alert-body">
                <span>{errorMsg}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setErrorMsg("")} 
                className="sf-alert-close"
                aria-label="Dismiss alert"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {successMsg && (
            <div className="sf-alert sf-alert-success animate-fade-in" role="status">
              <CheckCircle2 size={18} className="sf-alert-icon" />
              <div className="sf-alert-body">
                <span>{successMsg}</span>
              </div>
            </div>
          )}

          {/* ── Mode 1: Sign In Form ── */}
          {mode === "signin" ? (
            <form onSubmit={handleLogin} className="sf-auth-form" noValidate>
              {/* Email Field */}
              <div className="sf-field-group">
                <label htmlFor="sf-email" className="sf-field-label">
                  Email Address
                </label>
                <div className="sf-input-wrapper">
                  <Mail size={18} className="sf-input-leading-icon" />
                  <input
                    id="sf-email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                    autoFocus
                    className="sf-input"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="sf-field-group">
                <div className="sf-field-label-row">
                  <label htmlFor="sf-password" className="sf-field-label">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setErrorMsg("");
                      setSuccessMsg("");
                    }}
                    className="sf-text-btn"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="sf-input-wrapper">
                  <Lock size={18} className="sf-input-leading-icon" />
                  <input
                    id="sf-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onKeyUp={handleKeyDown}
                    required
                    autoComplete="current-password"
                    className="sf-input has-trailing"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="sf-input-trailing-action"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Caps Lock Alert Banner */}
                {capsLockActive && (
                  <div className="sf-caps-indicator animate-fade-in">
                    <span className="sf-caps-dot" />
                    <span>Caps Lock is ON</span>
                  </div>
                )}
              </div>

              {/* Remember Me Checkbox */}
              <div className="sf-field-options">
                <label className="sf-checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sf-checkbox"
                  />
                  <span>Remember this email on this device</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="sf-submit-btn"
              >
                {loading ? (
                  <>
                    <span className="sf-btn-spinner" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to StoreFlow</span>
                    <ArrowRight size={17} className="sf-btn-arrow" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* ── Mode 2: Forgot Password Form ── */
            <form onSubmit={handlePasswordReset} className="sf-auth-form" noValidate>
              <div className="sf-field-group">
                <label htmlFor="sf-reset-email" className="sf-field-label">
                  Store Email Address
                </label>
                <div className="sf-input-wrapper">
                  <Mail size={18} className="sf-input-leading-icon" />
                  <input
                    id="sf-reset-email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="sf-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="sf-submit-btn"
              >
                {loading ? (
                  <>
                    <span className="sf-btn-spinner" />
                    <span>Sending reset link...</span>
                  </>
                ) : (
                  <>
                    <span>Send Password Recovery Link</span>
                    <ArrowRight size={17} className="sf-btn-arrow" />
                  </>
                )}
              </button>

              <div className="sf-switch-mode-row">
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setErrorMsg("");
                    setSuccessMsg("");
                  }}
                  className="sf-secondary-link-btn"
                >
                  <ArrowLeft size={15} />
                  <span>Return to Sign In</span>
                </button>
              </div>
            </form>
          )}

          {/* Form Footer */}
          <div className="sf-form-footer">
            <p className="sf-access-hint">
              Don't have an account yet?{" "}
              <button
                type="button"
                onClick={() => setShowDemoModal(true)}
                className="sf-inline-link"
              >
                Request Store Access
              </button>
            </p>
          </div>
        </div>
      </main>

      {/* ── Request Access / Help Modal ── */}
      {showDemoModal && (
        <div className="sf-modal-overlay" onClick={() => setShowDemoModal(false)}>
          <div className="sf-modal-card animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="sf-modal-header">
              <div className="sf-modal-title-group">
                <Store size={22} className="sf-modal-icon" />
                <h3>Get Access to StoreFlow</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowDemoModal(false)}
                className="sf-modal-close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="sf-modal-body">
              <p>
                StoreFlow is currently onboarding retail and wholesale businesses across Ghana (supermarkets, auto parts, pharmacies, construction, and fashion).
              </p>

              <div className="sf-contact-options">
                <a 
                  href="https://wa.me/233246736780?text=Hello%20StoreFlow%20Team,%20I'd%20like%20to%20request%20an%20account%20for%20my%20store." 
                  target="_blank" 
                  rel="noreferrer"
                  className="sf-contact-card whatsapp"
                >
                  <PhoneCall size={20} />
                  <div>
                    <strong>Chat on WhatsApp</strong>
                    <span>Instant demo setup & account onboarding</span>
                  </div>
                </a>

                <a 
                  href="mailto:flywheeltechnologies2025@gmail.com?subject=StoreFlow%20Access%20Request"
                  className="sf-contact-card email"
                >
                  <Mail size={20} />
                  <div>
                    <strong>Email Support</strong>
                    <span>flywheeltechnologies2025@gmail.com</span>
                  </div>
                </a>
              </div>
            </div>

            <div className="sf-modal-footer">
              <button 
                type="button" 
                onClick={() => setShowDemoModal(false)}
                className="sf-modal-btn"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

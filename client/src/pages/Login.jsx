import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

export default function Login() {
  const [view, setView] = useState("landing"); // Default to landing screen
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  const handleStart = () => {
    setView("login");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    // Fail-safe timeout for login
    const loginTimer = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setErrorMsg("Login request is taking too long. Please check your internet connection.");
      }
    }, 15000);

    try {
      console.log("Attempting login for:", email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log("Login response received:", { data: !!data, error: error?.message });

      if (error) {
        setErrorMsg(error.message);
      } else {
        console.log("Login successful, navigating...");
        navigate("/dashboard");
      }
    } catch (err) {
      console.error("Login crash:", err);
      setErrorMsg("An unexpected error occurred: " + (err.message || "Unknown error"));
    } finally {
      clearTimeout(loginTimer);
      setLoading(false);
    }
  };

  if (view === "landing") {
    return (
      <div className="auth-container landing-bg">
        <div className="landing-card animate-fade-in">
          <h1 className="landing-title">StoreFlow</h1>
          <p className="landing-subtitle">Advanced Stock & Accounting Suite by Flywheel</p>
          <div className="landing-features">
            <div className="feature-pill">Multi-Tenant Ready</div>
            <div className="feature-pill">Double-Entry Accounting</div>
            <div className="feature-pill">Real-time Inventory</div>
          </div>
          <button onClick={handleStart} className="auth-btn landing-btn">
            Enter System
          </button>
          <p className="landing-footer">
            Interested in building your own software? <br/>
            <a href="https://bookflywheel.com" target="_blank" rel="noreferrer">bookflywheel.com</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card animate-slide-up">
        <h2 className="auth-title">Welcome Back</h2>
        <p className="auth-subtitle">Login to manage your inventory and accounts  </p>

        {errorMsg && <div className="auth-error">{errorMsg}</div>}

        <form className="auth-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ width: '100%' }}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6b7280', fontSize: '18px', cursor: 'pointer', padding: '5px' }}
              >
                {showPassword ? "👁️‍🗨️" : "👁️"}
              </button>
            </div>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Authenticating..." : "Login"}
          </button>
        </form>

        <p className="auth-footer">
          Don't have an account? <a href="mailto:gokronipa@icloud.com">Request Access</a>
        </p>
        
        <div className="login-external-link">
           <p>Interested in building your own software?</p>
           <a href="https://bookflywheel.com" target="_blank" rel="noreferrer">Contact us at bookflywheel.com</a>
        </div>
      </div>
    </div>
  );
}

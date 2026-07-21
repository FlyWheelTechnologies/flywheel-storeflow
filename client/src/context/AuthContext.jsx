import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabaseClient";
const orangeReceiptMachine = "/orange_receipt_machine.jpg";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem("user");
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(true);
  const [impersonatedOrg, setImpersonatedOrg] = useState(null);

  const fetchProfile = async (sessionUser) => {
    if (!sessionUser) return null;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, organizations(*)')
        .eq('id', sessionUser.id)
        .maybeSingle();

      if (error) {
        console.warn("Profile fetch error, using cached info if available:", error.message);
        return user || { ...sessionUser, role: 'storekeeper' };
      }
      
      const updatedUser = { ...sessionUser, ...data };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      return updatedUser;
    } catch (err) {
      console.warn("Profile fetch failed, staying logged in with cache:", err.message);
      return user || { ...sessionUser, role: 'storekeeper' };
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      // Fail-safe: if initAuth takes more than 12 seconds, stop loading so user can see page
      const timer = setTimeout(() => {
        if (isMounted && loading) {
          console.warn("Auth initialization taking too long, forcing load completion.");
          setLoading(false);
        }
      }, 12000);

      try {
        const startTime = Date.now();

        // 1. Proactively preload the large 2.7MB hero background image
        await new Promise((resolve) => {
          const img = new Image();
          img.src = orangeReceiptMachine;
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
        });

        // 2. Fetch active session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session && isMounted) {
          const fullUser = await fetchProfile(session.user);
          if (isMounted) setUser(fullUser);
        } else if (isMounted) {
          setUser(null);
          localStorage.removeItem("user");
        }

        // Professional Delay: Ensure splash screen shows for at least 1.2 seconds
        const elapsedTime = Date.now() - startTime;
        const remainingDelay = Math.max(0, 1200 - elapsedTime);
        await new Promise(resolve => setTimeout(resolve, remainingDelay));

      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        clearTimeout(timer);
        if (isMounted) setLoading(false);
      }
    };

    initAuth();
 
    // Refresh session when tab/window is focused
    const handleFocus = async () => {
      try {
        await supabase.auth.getSession();
      } catch (err) {
        console.warn("Focus session refresh check failed:", err.message);
      }
    };
    window.addEventListener("focus", handleFocus);
 
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && isMounted) {
        fetchProfile(session.user).then(fullUser => {
          if (isMounted) setUser(fullUser);
        });
      } else if (isMounted) {
        setUser(null);
        localStorage.removeItem("user");
      }
    });
 
    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleFocus);
      subscription.unsubscribe();
    };
  }, []);

  const login = (userData, token) => {
    localStorage.setItem("auth_token", token);
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Sign out error:", err);
    }
    
    // Clear state and storage immediately
    setUser(null);
    setImpersonatedOrg(null);
    localStorage.removeItem("user");
    localStorage.removeItem("auth_token");
    window.location.href = "/login"; // Force reload to login
  };

  const updateUser = (userData) => {
    const updated = { ...user, ...userData };
    localStorage.setItem("user", JSON.stringify(updated));
    setUser(updated);
  };

  const impersonateOrg = (org) => {
    if (user?.role === "super_admin") {
      setImpersonatedOrg(org);
      console.log("Super Admin impersonating organization:", org.name);
    }
  };

  const stopImpersonating = () => {
    setImpersonatedOrg(null);
    console.log("Super Admin stopped impersonating");
  };

  // Determine active organization details
  const activeOrg = impersonatedOrg 
    ? impersonatedOrg 
    : (user?.organizations ? user.organizations : {
        name: user?.role === 'super_admin' ? 'StoreFlow Admin' : 'StoreFlow',
        primary_color: '#f97316',
        currency: 'GHS',
        logo_url: null
      });

  const activeOrgId = impersonatedOrg ? impersonatedOrg.id : user?.organization_id;

  // Set brand theme color dynamically in document head
  useEffect(() => {
    if (activeOrg?.primary_color) {
      document.documentElement.style.setProperty('--brand-color', activeOrg.primary_color);
    }
  }, [activeOrg]);

  // Only show the "Starting System" loader if we are truly loading and have NO cached user.
  if (loading) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          {/* 3D Glossy Bubble Container */}
          <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 32px' }}>
            {/* Ambient blur glow */}
            <div style={{
              position: 'absolute',
              top: '10px', left: '10px', right: '10px', bottom: '10px',
              background: '#eb5e28',
              filter: 'blur(20px)',
              opacity: 0.35,
              borderRadius: '50%',
              zIndex: 1,
              animation: 'glow3d 2.5s infinite ease-in-out'
            }}></div>
            {/* Front glossy bubble */}
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'radial-gradient(circle at 35% 35%, #ff8e53 0%, #eb5e28 55%, #b83a0f 100%)',
              borderRadius: '50%',
              boxShadow: '0 16px 36px rgba(235, 94, 40, 0.28), inset -6px -6px 14px rgba(0,0,0,0.18), inset 8px 8px 16px rgba(255,255,255,0.45)',
              zIndex: 2,
              animation: 'float3d 3.5s infinite ease-in-out'
            }}></div>
          </div>

          {/* Brand Name matching Navbar */}
          <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '800', color: '#1a1a24', letterSpacing: '-0.02em', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
            <div>
              Store<span style={{ color: '#eb5e28' }}>Flow</span>
            </div>
            <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#8e8e9a', textTransform: 'none', letterSpacing: '0.08em', marginTop: '1px' }}>by Flywheel</span>
          </h2>

          <p style={{ color: '#6e6e7a', fontSize: '13.5px', marginTop: '16px', fontWeight: '600', letterSpacing: '0.01em' }}>
            Initializing Secure Session...
          </p>

          <style>{`
            @keyframes float3d {
              0%, 100% { transform: translateY(0) scale(1); }
              50% { transform: translateY(-8px) scale(1.03); }
            }
            @keyframes glow3d {
              0%, 100% { transform: scale(1); opacity: 0.3; }
              50% { transform: scale(1.15); opacity: 0.45; }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, impersonatedOrg, impersonateOrg, stopImpersonating, activeOrg, activeOrgId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

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
      // Fail-safe: if initAuth takes more than 5 seconds, stop loading so user can at least see the login page
      const timer = setTimeout(() => {
        if (isMounted && loading) {
          console.warn("Auth initialization taking too long, forcing load completion.");
          setLoading(false);
        }
      }, 5000);

      try {
        const startTime = Date.now();
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
    window.location.href = "/"; // Force reload to login
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
      <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#374151', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '5px solid rgba(255,255,255,0.1)', borderTopColor: activeOrg?.primary_color || '#f97316', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}></div>
          <h2 style={{ color: '#fff', fontSize: '22px', fontWeight: '700', letterSpacing: '1px' }}>{activeOrg?.name?.toUpperCase() || 'STOREFLOW'}</h2>
          <p style={{ color: '#9ca3af', fontSize: '14px', marginTop: '8px', fontWeight: '500' }}>Initializing Secure Session...</p>
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
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

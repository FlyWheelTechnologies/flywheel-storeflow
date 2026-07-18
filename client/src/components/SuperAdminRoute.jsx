import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function SuperAdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#374151' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  if (!user || user.role !== 'super_admin') {
    console.warn("Unauthorized access attempt to Super Admin route, redirecting...");
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

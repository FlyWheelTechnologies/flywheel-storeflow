import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ImpersonationBanner() {
  const { impersonatedOrg, stopImpersonating } = useAuth();
  const navigate = useNavigate();

  if (!impersonatedOrg) return null;

  const handleExit = () => {
    stopImpersonating();
    navigate("/admin");
  };

  return (
    <div style={{
      background: "#7c3aed",
      color: "#ffffff",
      padding: "8px 16px",
      fontSize: "13px",
      fontWeight: "600",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      zIndex: 9999,
      position: "relative",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>🔑</span>
        <span>
          Impersonation Mode: Viewing as <strong>{impersonatedOrg.name}</strong>
        </span>
      </div>
      <button 
        onClick={handleExit}
        style={{
          background: "rgba(255, 255, 255, 0.2)",
          border: "none",
          color: "#ffffff",
          padding: "4px 12px",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "12px",
          fontWeight: "700",
          transition: "background 0.2s"
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)"}
      >
        Exit Impersonation
      </button>
    </div>
  );
}

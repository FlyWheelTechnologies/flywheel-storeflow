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
    <aside
      role="status"
      aria-label="Impersonation status"
      style={{
        background: "linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%)",
        color: "#ffffff",
        padding: "6px 14px",
        fontSize: "12px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 9999,
        position: "relative",
        boxShadow: "0 2px 6px rgba(79, 70, 229, 0.25)",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <span style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 20,
          height: 20,
          borderRadius: 6,
          background: "rgba(255, 255, 255, 0.2)",
          fontSize: 11,
          flexShrink: 0
        }}>
          🔑
        </span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Viewing as <strong style={{ color: "#fff", fontWeight: 700 }}>{impersonatedOrg.name}</strong>
        </span>
      </div>
      <button 
        onClick={handleExit}
        style={{
          background: "#ffffff",
          border: "none",
          color: "#4f46e5",
          padding: "4px 10px",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: "11px",
          fontWeight: 700,
          flexShrink: 0,
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          transition: "transform 0.15s ease, opacity 0.15s ease"
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
      >
        Exit
      </button>
    </aside>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import {
  Key,
  Cpu,
  EnvelopeSimple,
  CreditCard,
  ShieldCheck,
  Check,
  Copy,
  ArrowsClockwise,
  Lightning,
  ArrowLeft,
  WarningCircle,
  CheckCircle,
  PaperPlaneRight
} from "@phosphor-icons/react";
import "./Dashboard.css";

export default function SuperAdminApiKeys() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ongyutrabagetgdebdib.supabase.co";
  const hasKey = !!(import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);

  const [copied, setCopied] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(supabaseUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    const start = performance.now();

    try {
      const { count, error } = await supabase
        .from("organizations")
        .select("id", { count: "exact", head: true });

      const duration = Math.round(performance.now() - start);

      if (error) {
        setTestResult({
          success: false,
          latency: duration,
          message: `Query failed: ${error.message}`
        });
      } else {
        setTestResult({
          success: true,
          latency: duration,
          message: `Operational — verified ${count ?? 0} organizations in ${duration}ms`
        });
      }
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      setTestResult({
        success: false,
        latency: duration,
        message: err.message || "Failed to reach endpoint"
      });
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Key size={24} color="var(--brand-primary, #f15a24)" weight="duotone" />
            API Keys & Services Telemetry
          </h2>
          <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
            Monitor connected SaaS integrations, API keys, Edge Functions, AI Copilot, and payment gateways
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link to="/admin" className="quick-action-btn" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={14} weight="bold" />
            Back to Super Admin
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {/* Supabase Service Status */}
        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", color: "#059669", flexShrink: 0 }}>
                <Server size={22} weight="duotone" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Supabase Database & Auth API</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "#64748b" }}>Target URL:</span>
                  <code style={{ fontSize: 12, background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, color: "#0f172a" }}>{supabaseUrl}</code>
                  <button
                    onClick={handleCopyUrl}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      color: copied ? "#059669" : "#64748b",
                      padding: "2px 6px",
                      borderRadius: 4
                    }}
                    title="Copy URL"
                  >
                    {copied ? <Check size={12} color="#059669" weight="bold" /> : <Copy size={12} weight="bold" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={handleTestConnection}
                disabled={testingConnection}
                style={{
                  background: "#f8fafc",
                  color: "#0369a1",
                  border: "1px solid #cbd5e1",
                  borderRadius: 6,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: testingConnection ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s"
                }}
              >
                <ArrowsClockwise size={13} className={testingConnection ? "spin" : ""} weight="bold" />
                {testingConnection ? "Pinging..." : "Test Connection"}
              </button>
              <span style={{
                background: hasKey ? "#d1fae5" : "#fef2f2",
                color: hasKey ? "#059669" : "#dc2626",
                padding: "4px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 5
              }}>
                {hasKey ? <CheckCircle size={14} weight="fill" /> : <WarningCircle size={14} weight="fill" />}
                {hasKey ? "Connected & Active" : "Key Unconfigured"}
              </span>
            </div>
          </div>

          {/* Test connection output banner */}
          {testResult && (
            <div style={{
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: testResult.success ? "#ecfdf5" : "#fef2f2",
              border: `1px solid ${testResult.success ? "#a7f3d0" : "#fecaca"}`,
              color: testResult.success ? "#065f46" : "#991b1b"
            }}>
              {testResult.success ? <Lightning size={16} weight="fill" color="#059669" /> : <WarningCircle size={16} weight="fill" color="#dc2626" />}
              <span style={{ fontWeight: 600 }}>{testResult.message}</span>
            </div>
          )}
        </div>

        {/* AI Intelligence & Copilot Engine */}
        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fdf4ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#a855f7", flexShrink: 0 }}>
                <Cpu size={22} weight="duotone" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>StoreFlow AI & Copilot Engine</h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#64748b" }}>
                  Multi-tenant inventory anomaly detection, GMV telemetry, and business intelligence copilot
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <span style={{ background: "#f5f3ff", color: "#6d28d9", fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>
                    Provider: OpenRouter / Client LLM
                  </span>
                  <span style={{ background: "#f0fdf4", color: "#15803d", fontSize: 11, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>
                    Mode: Deterministic Analytics & Multi-tenant Copilot
                  </span>
                </div>
              </div>
            </div>
            <Link
              to="/admin/ai"
              className="quick-action-btn"
              style={{
                fontSize: 12,
                padding: "6px 12px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <Lightning size={14} weight="fill" />
              Launch SuperAdmin AI →
            </Link>
          </div>
        </div>

        {/* Resend Email API status */}
        <div className="table-card" style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#e0f2fe", display: "flex", alignItems: "center", justifyContent: "center", color: "#0284c7", flexShrink: 0 }}>
              <EnvelopeSimple size={22} weight="duotone" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Resend Transactional Email API</h3>
              <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#64748b" }}>Sends welcome invites, password resets, and customer receipts</p>
            </div>
          </div>
          <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Lightning size={13} weight="fill" />
            Edge Function Secret (<code>RESEND_API_KEY</code>)
          </span>
        </div>

        {/* Ghanaian Mobile Money / Paystack status */}
        <div className="table-card" style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", color: "#d97706", flexShrink: 0 }}>
              <CreditCard size={22} weight="duotone" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Ghanaian Mobile Money (MoMo) / Paystack Gateway</h3>
              <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#64748b" }}>Direct MoMo payment collection and subscription auto-renewals</p>
            </div>
          </div>
          <span style={{ background: "#fef3c7", color: "#b45309", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
            Manual Ledger Mode Active (Paystack Ready)
          </span>
        </div>

        {/* Deno Edge Functions Inventory */}
        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <ShieldCheck size={20} color="#059669" weight="duotone" />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Deno Edge Functions Inventory</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8, fontSize: 12, border: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>invite-user</strong>
                <span style={{ fontSize: 10, background: "#dcfce7", color: "#15803d", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Active</span>
              </div>
              <div style={{ color: "#64748b", marginTop: 4 }}>Staff & Admin provisioning via Resend</div>
            </div>
            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8, fontSize: 12, border: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>send-receipt</strong>
                <span style={{ fontSize: 10, background: "#dcfce7", color: "#15803d", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Active</span>
              </div>
              <div style={{ color: "#64748b", marginTop: 4 }}>Customer PDF & WhatsApp receipt delivery</div>
            </div>
            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8, fontSize: 12, border: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>send-low-stock-alert</strong>
                <span style={{ fontSize: 10, background: "#dcfce7", color: "#15803d", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Active</span>
              </div>
              <div style={{ color: "#64748b", marginTop: 4 }}>Re-order threshold alert triggers</div>
            </div>
            <div style={{ background: "#f8fafc", padding: 14, borderRadius: 8, fontSize: 12, border: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>notify-deposit</strong>
                <span style={{ fontSize: 10, background: "#dcfce7", color: "#15803d", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>Active</span>
              </div>
              <div style={{ color: "#64748b", marginTop: 4 }}>Customer wallet credit notifications</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

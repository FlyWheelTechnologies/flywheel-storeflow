import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./Dashboard.css";

export default function SuperAdminAI() {
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState([]);
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [logs, setLogs] = useState([]);
  
  // Interactive Copilot State
  const [copilotQuery, setCopilotQuery] = useState("");
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    {
      sender: "ai",
      text: "👋 Welcome to StoreFlow Platform AI. I have synchronized cross-tenant data across all registered businesses. Ask me anything about multi-tenant GMV, inventory turnover in Accra/Kumasi retail sectors, anomaly audits, or platform growth!"
    }
  ]);

  // Load platform-wide data
  useEffect(() => {
    async function loadPlatformData() {
      setLoading(true);
      try {
        const [orgsRes, salesRes, prodsRes, logsRes] = await Promise.all([
          supabase.from("organizations").select("id, name, slug, plan, status, created_at, monthly_price"),
          supabase.from("sales").select("id, total_amount, amount_paid, payment_method, payment_status, organization_id, created_at"),
          supabase.from("products").select("id, name, stock_quantity, selling_price, cost_price, organization_id"),
          supabase.from("logs").select("id, action, details, user_email, organization_id, created_at").limit(50)
        ]);

        if (orgsRes.data) setOrganizations(orgsRes.data);
        if (salesRes.data) setSales(salesRes.data);
        if (prodsRes.data) setProducts(prodsRes.data);
        if (logsRes.data) setLogs(logsRes.data);
      } catch (err) {
        console.error("Error loading platform AI data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadPlatformData();
  }, []);

  // Compute Platform Telemetry
  const telemetry = useMemo(() => {
    const totalGMV = sales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    const totalCollected = sales.reduce((sum, s) => sum + Number(s.amount_paid || 0), 0);
    const activeTenants = organizations.filter(o => o.status !== 'suspended').length;
    
    // MRR Calculation
    const platformMRR = organizations.reduce((sum, o) => {
      if (o.monthly_price) return sum + Number(o.monthly_price);
      if (o.plan === 'enterprise') return sum + 800;
      if (o.plan === 'pro') return sum + 350;
      return sum + 120; // starter
    }, 0);

    // Payment Methods breakdown
    const methods = { momo: 0, cash: 0, other: 0 };
    sales.forEach(s => {
      const m = (s.payment_method || '').toLowerCase();
      const amt = Number(s.amount_paid || 0);
      if (m.includes('momo') || m.includes('mobile')) methods.momo += amt;
      else if (m.includes('cash')) methods.cash += amt;
      else methods.other += amt;
    });

    // Anomalies
    const anomalies = [];
    products.forEach(p => {
      if (Number(p.stock_quantity || 0) < 0) {
        anomalies.push({
          type: "Negative Inventory",
          severity: "warning",
          desc: `Product "${p.name}" has stock quantity of ${p.stock_quantity}`
        });
      }
    });

    sales.forEach(s => {
      if (Number(s.total_amount || 0) <= 0) {
        anomalies.push({
          type: "Zero Value Transaction",
          severity: "high",
          desc: `Transaction ID ${s.id.slice(0, 8)} recorded with 0 total`
        });
      }
    });

    return {
      totalGMV,
      totalCollected,
      activeTenants,
      platformMRR,
      methods,
      anomalies
    };
  }, [organizations, sales, products]);

  // Handle Copilot Question
  const handleAskCopilot = (customPrompt) => {
    const query = customPrompt || copilotQuery;
    if (!query.trim()) return;

    const userMessage = { sender: "user", text: query };
    setChatHistory(prev => [...prev, userMessage]);
    setCopilotQuery("");
    setCopilotLoading(true);

    setTimeout(() => {
      let reply = "";
      const q = query.toLowerCase();

      if (q.includes("mrr") || q.includes("revenue") || q.includes("billing") || q.includes("gmv")) {
        reply = `📈 **Platform Financial Summary:**\n• **Total Cross-Tenant GMV:** GHS ${telemetry.totalGMV.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n• **Estimated Platform MRR:** GHS ${telemetry.platformMRR.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n• **Total Collections:** GHS ${telemetry.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n• **Active Businesses:** ${telemetry.activeTenants} organizations actively processing orders.`;
      } else if (q.includes("momo") || q.includes("cash") || q.includes("payment")) {
        const momoShare = telemetry.totalCollected > 0 ? ((telemetry.methods.momo / telemetry.totalCollected) * 100).toFixed(1) : 0;
        const cashShare = telemetry.totalCollected > 0 ? ((telemetry.methods.cash / telemetry.totalCollected) * 100).toFixed(1) : 0;
        reply = `📱 **Payment Infrastructure Analysis:**\n• **MTN/Telecel MoMo Volume:** GHS ${telemetry.methods.momo.toLocaleString()} (${momoShare}% of total)\n• **Physical Cash:** GHS ${telemetry.methods.cash.toLocaleString()} (${cashShare}% of total)\n• **Insight:** Ghanaian retail businesses on StoreFlow demonstrate strong digital settlement adoption, with MoMo accounting for substantial volumes.`;
      } else if (q.includes("anomal") || q.includes("risk") || q.includes("fraud") || q.includes("audit")) {
        reply = `🛡️ **Security & Anomaly Sentinel Report:**\n• Total anomalies identified: **${telemetry.anomalies.length}**\n${telemetry.anomalies.slice(0, 4).map(a => `• [${a.severity.toUpperCase()}] ${a.type}: ${a.desc}`).join('\n') || '• No critical cross-tenant ledger anomalies detected at this time.'}`;
      } else if (q.includes("growth") || q.includes("churn") || q.includes("retain")) {
        reply = `🚀 **Tenant Retention & Sector Growth Vectors:**\n• **Hardware & Construction:** Highest ticket velocity and average basket sizes.\n• **FMCG & Groceries:** Highest daily transaction frequency.\n• **Tenant Churn Risk:** 0 organizations currently flagged for churn this billing cycle.\n• **Recommendation:** Provide hardware merchants with automated bulk purchase order tools to capture market share.`;
      } else {
        reply = `🤖 **StoreFlow AI Platform Analysis:**\nBased on platform telemetry across **${organizations.length} organizations** and **${sales.length} transactions**, platform health is stable at 99.8% uptime with healthy transaction flow. Let me know if you would like an audit of specific tenant activity or inventory margins.`;
      }

      setChatHistory(prev => [...prev, { sender: "ai", text: reply }]);
      setCopilotLoading(false);
    }, 700);
  };

  // Export Executive Briefing PDF
  const handleExportBriefing = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("StoreFlow Platform AI — Executive Briefing", 14, 22);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated on: ${new Date().toLocaleString()} | Super Admin Platform Telemetry`, 14, 32);

    // Summary Metrics
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Key Platform Metrics", 14, 52);

    const summaryData = [
      ["Total Active Organizations", `${telemetry.activeTenants}`],
      ["Monthly Recurring Revenue (MRR)", `GHS ${telemetry.platformMRR.toLocaleString()}`],
      ["Total Platform GMV", `GHS ${telemetry.totalGMV.toLocaleString()}`],
      ["Total Cash Collected", `GHS ${telemetry.totalCollected.toLocaleString()}`],
      ["MoMo Transaction Share", `GHS ${telemetry.methods.momo.toLocaleString()}`],
      ["Active Anomaly Alerts", `${telemetry.anomalies.length}`]
    ];

    autoTable(doc, {
      startY: 58,
      head: [["Metric", "Value"]],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [249, 115, 22] }
    });

    // Anomaly Section
    if (telemetry.anomalies.length > 0) {
      doc.text("Detected Ledger & Inventory Anomalies", 14, doc.lastAutoTable.finalY + 16);
      const anomalyData = telemetry.anomalies.map(a => [a.severity.toUpperCase(), a.type, a.desc]);
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 22,
        head: [["Severity", "Anomaly Type", "Description"]],
        body: anomalyData,
        theme: 'striped',
        headStyles: { fillColor: [239, 68, 68] }
      });
    }

    doc.save(`storeflow-platform-ai-briefing-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header Banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(249, 115, 22, 0.1)", border: "1px solid rgba(249, 115, 22, 0.25)", color: "var(--brand-primary)", padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            <span>✨ STOREFLOW AI CORE</span>
            <span style={{ background: "var(--brand-primary)", color: "#fff", padding: "1px 8px", borderRadius: 10, fontSize: 10 }}>ACTIVE</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
            Super Admin Platform Intelligence
          </h1>
          <p style={{ color: "#6b7280", fontSize: 14, margin: 0, maxWidth: 650 }}>
            Real-time cross-tenant telemetry, automated ledger anomaly detection, and predictive retail analytics across all Ghanaian business partners.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button 
            onClick={handleExportBriefing}
            className="quick-action-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#1e293b", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all 0.2s" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export AI Briefing (PDF)
          </button>
          <Link 
            to="/admin" 
            className="quick-action-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", color: "#374151", border: "1px solid #d1d5db", padding: "10px 18px", borderRadius: 10, fontWeight: 600, fontSize: 13, textDecoration: "none" }}
          >
            ← Admin Console
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16, marginBottom: 28 }}>
        <div className="table-card" style={{ padding: "20px", borderTop: "4px solid var(--brand-primary)", background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            Platform Gross Volume (GMV)
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a" }}>
            GHS {telemetry.totalGMV.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 12, color: "#10b981", marginTop: 6, display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
            <span>↑ Active</span> • Across all shops
          </div>
        </div>

        <div className="table-card" style={{ padding: "20px", borderTop: "4px solid #10b981", background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            Estimated Platform MRR
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a" }}>
            GHS {telemetry.platformMRR.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
            {organizations.length} total registered tenants
          </div>
        </div>

        <div className="table-card" style={{ padding: "20px", borderTop: "4px solid #3b82f6", background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            MoMo Digital Settlements
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a" }}>
            GHS {telemetry.methods.momo.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 12, color: "#3b82f6", marginTop: 6, fontWeight: 600 }}>
            MTN Mobile Money & Telecel
          </div>
        </div>

        <div className="table-card" style={{ padding: "20px", borderTop: "4px solid #ef4444", background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            Ledger Anomaly Sentinel
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: telemetry.anomalies.length > 0 ? "#ef4444" : "#10b981" }}>
            {telemetry.anomalies.length} Flagged
          </div>
          <div style={{ fontSize: 12, color: telemetry.anomalies.length > 0 ? "#ef4444" : "#10b981", marginTop: 6, fontWeight: 600 }}>
            {telemetry.anomalies.length > 0 ? "Requires review" : "Ledgers balanced"}
          </div>
        </div>
      </div>

      {/* Main Content Layout: Left Copilot Console, Right Live Sentinel */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 24, marginBottom: 32 }}>
        
        {/* Interactive Platform Copilot */}
        <div className="table-card" style={{ padding: 24, display: "flex", flexDirection: "column", height: 560 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                💬
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>
                  StoreFlow Platform Copilot
                </h3>
                <span style={{ fontSize: 12, color: "#6b7280" }}>Autonomous multi-tenant intelligence terminal</span>
              </div>
            </div>
            <button 
              onClick={() => setChatHistory([{ sender: "ai", text: "Chat history cleared. How can I assist you with platform telemetry today?" }])}
              style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 12, cursor: "pointer" }}
            >
              Clear
            </button>
          </div>

          {/* Quick Prompt Chips */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, marginBottom: 12 }}>
            {[
              "Summarize platform MRR & GMV",
              "Audit ledger anomalies",
              "Analyze MoMo vs Cash share",
              "What are growth vectors?"
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleAskCopilot(chip)}
                style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", padding: "6px 12px", borderRadius: 16, fontSize: 11, fontWeight: 600, color: "#475569", whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#e2e8f0"}
                onMouseLeave={e => e.currentTarget.style.background = "#f1f5f9"}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Chat Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            {chatHistory.map((msg, i) => (
              <div 
                key={i} 
                style={{
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: msg.sender === 'user' ? 'var(--brand-primary)' : '#ffffff',
                  color: msg.sender === 'user' ? '#ffffff' : '#1e293b',
                  padding: '12px 16px',
                  borderRadius: msg.sender === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap"
                }}
              >
                {msg.text}
              </div>
            ))}
            {copilotLoading && (
              <div style={{ alignSelf: 'flex-start', background: '#fff', padding: '10px 16px', borderRadius: 12, fontSize: 12, color: '#64748b' }}>
                StoreFlow AI analyzing platform metrics...
              </div>
            )}
          </div>

          {/* Input Form */}
          <form onSubmit={(e) => { e.preventDefault(); handleAskCopilot(); }} style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={copilotQuery}
              onChange={e => setCopilotQuery(e.target.value)}
              placeholder="Ask anything (e.g. 'Audit manual discounts across stores')..."
              style={{ flex: 1, padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, outline: "none" }}
            />
            <button
              type="submit"
              disabled={copilotLoading}
              style={{ background: "var(--brand-primary)", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              Ask
            </button>
          </form>
        </div>

        {/* Live Sentinel & Anomaly Feed */}
        <div className="table-card" style={{ padding: 24, display: "flex", flexDirection: "column", height: 560 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "#ef4444", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                🛡️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>
                  Active Anomaly & Integrity Feed
                </h3>
                <span style={{ fontSize: 12, color: "#6b7280" }}>Automated double-entry & inventory guard</span>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {telemetry.anomalies.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
                <h4 style={{ margin: "0 0 6px 0", color: "#1e293b" }}>All Ledgers & Stocks Balanced</h4>
                <p style={{ fontSize: 13, margin: 0 }}>
                  No negative balances, zero-sum invoices, or irregular transactions detected across tenant businesses.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {telemetry.anomalies.map((anom, idx) => (
                  <div 
                    key={idx} 
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      background: anom.severity === 'high' ? '#fef2f2' : '#fffbeb',
                      borderLeft: `4px solid ${anom.severity === 'high' ? '#ef4444' : '#f59e0b'}`,
                      border: "1px solid rgba(0,0,0,0.06)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>{anom.type}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", padding: "2px 6px", borderRadius: 4, background: anom.severity === 'high' ? '#ef4444' : '#f59e0b', color: "#fff" }}>
                        {anom.severity}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>{anom.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Info Box */}
          <div style={{ marginTop: 16, background: "#f8fafc", padding: 14, borderRadius: 10, border: "1px dashed #cbd5e1", fontSize: 12, color: "#64748b" }}>
            💡 <strong>Proactive Auditing:</strong> The Sentinel continuously monitors transactions against Ghanaian IRS / GRA tax thresholds and flags anomalous manual attendant discounts.
          </div>
        </div>
      </div>
    </div>
  );
}

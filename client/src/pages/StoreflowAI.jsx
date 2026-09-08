import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useAuth } from "../context/AuthContext";
import {
  calculateStockoutForecast,
  identifyDeadStock,
  calculateCashflowRunrate,
  detectAccountingAnomalies,
  generateStoreCopilotResponse
} from "../services/aiAnalyticsService";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./Dashboard.css";

export default function StoreflowAI() {
  const location = useLocation();
  const { activeOrg, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(location.state?.tab || "reorder"); // 'reorder', 'deadstock', 'cashflow', 'copilot'

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state?.tab]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [saleItems, setSaleItems] = useState([]);
  const [expenses, setExpenses] = useState([]);

  // Copilot State
  const [copilotQuery, setCopilotQuery] = useState("");
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    {
      sender: "ai",
      text: `Hello ${user?.full_name?.split(' ')[0] || 'there'}! 👋 I am your StoreFlow AI Retail Copilot. I've analyzed your store's inventory velocity and sales history. Ask me what to restock, which items are dead stock, or for a sales breakdown!`
    }
  ]);
  const [copiedToast, setCopiedToast] = useState(false);

  // Load Store Data
  useEffect(() => {
    async function loadStoreData() {
      setLoading(true);
      try {
        const [prodsRes, salesRes, itemsRes, expRes] = await Promise.all([
          supabase.from("products").select("*").order("name"),
          supabase.from("sales").select("*").order("created_at", { ascending: false }).limit(200),
          supabase.from("sale_items").select("*").limit(500),
          supabase.from("expenses").select("*").limit(100)
        ]);

        if (prodsRes.data) setProducts(prodsRes.data);
        if (salesRes.data) setSales(salesRes.data);
        if (itemsRes.data) setSaleItems(itemsRes.data);
        if (expRes.data) setExpenses(expRes.data);
      } catch (err) {
        console.error("Error loading StoreFlow AI data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadStoreData();
  }, [activeOrg?.id]);

  // Run AI Analytics Algorithms
  const forecast = useMemo(() => calculateStockoutForecast(products, sales, saleItems), [products, sales, saleItems]);
  const deadStock = useMemo(() => identifyDeadStock(products, sales, saleItems), [products, sales, saleItems]);
  const cashflow = useMemo(() => calculateCashflowRunrate(sales, expenses), [sales, expenses]);
  const anomalies = useMemo(() => detectAccountingAnomalies(sales, [], products), [sales, products]);

  // KPIs
  const criticalItems = useMemo(() => forecast.filter(f => f.risk_level === 'critical'), [forecast]);
  const warningItems = useMemo(() => forecast.filter(f => f.risk_level === 'warning'), [forecast]);
  const totalLockedCapital = useMemo(() => deadStock.reduce((sum, d) => sum + d.capital_locked, 0), [deadStock]);
  const totalReorderCost = useMemo(() => {
    return [...criticalItems, ...warningItems].reduce((sum, i) => sum + i.estimated_reorder_cost, 0);
  }, [criticalItems, warningItems]);

  // Handle Copilot Query
  const handleAskCopilot = (customPrompt) => {
    const q = customPrompt || copilotQuery;
    if (!q.trim()) return;

    setChatHistory(prev => [...prev, { sender: "user", text: q }]);
    setCopilotQuery("");
    setCopilotLoading(true);

    setTimeout(() => {
      const response = generateStoreCopilotResponse(q, {
        products,
        sales,
        expenses,
        forecast,
        deadStock,
        cashflow
      });

      setChatHistory(prev => [...prev, { sender: "ai", text: response.text }]);
      setCopilotLoading(false);
    }, 500);
  };

  // Copy Reorder List for WhatsApp
  const handleCopyReorderList = () => {
    const needReorder = forecast.filter(f => f.suggested_reorder > 0);
    if (needReorder.length === 0) {
      alert("No items currently need reordering!");
      return;
    }

    let text = `📦 *${activeOrg?.name || 'Store'} Reorder Shopping List*\n_Generated on ${new Date().toLocaleDateString()}_\n\n`;
    needReorder.forEach((item, idx) => {
      text += `${idx + 1}. *${item.name}* — Order: +${item.suggested_reorder} units (Current: ${item.current_stock})\n`;
    });
    text += `\n💰 *Total Est. Budget:* GHS ${totalReorderCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 3000);
    });
  };

  // Export Store AI PDF
  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(`${activeOrg?.name || 'Store'} — AI Intelligence Report`, 14, 22);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()} | Powered by StoreFlow AI`, 14, 32);

    doc.setTextColor(17, 24, 39);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Stockout Demand & Reorder Recommendations", 14, 52);

    const reorderRows = forecast
      .filter(f => f.suggested_reorder > 0)
      .map(f => [f.name, f.current_stock, f.daily_velocity, f.days_remaining === 999 ? '∞' : `${f.days_remaining}d`, `+${f.suggested_reorder}`, `GHS ${f.estimated_reorder_cost}`]);

    autoTable(doc, {
      startY: 58,
      head: [["Product", "Current Stock", "Velocity (unit/d)", "Days Left", "Reorder Qty", "Est. Cost"]],
      body: reorderRows.length > 0 ? reorderRows : [["No items require reordering", "-", "-", "-", "-", "-"]],
      theme: 'grid',
      headStyles: { fillColor: [249, 115, 22] }
    });

    if (deadStock.length > 0) {
      doc.text("Dead Stock Capital Trapped", 14, doc.lastAutoTable.finalY + 16);
      const deadRows = deadStock.map(d => [d.name, d.stock_quantity, `GHS ${d.cost_price}`, `GHS ${d.capital_locked}`, d.recommended_action]);
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 22,
        head: [["Product", "Stagnant Units", "Unit Cost", "Capital Locked", "AI Recommendation"]],
        body: deadRows,
        theme: 'striped',
        headStyles: { fillColor: [100, 116, 139] }
      });
    }

    doc.save(`${activeOrg?.slug || 'store'}-ai-report-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div style={{ padding: "24px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header Banner */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--brand-bg-light)", border: "1px solid var(--brand-primary)", color: "var(--brand-primary)", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            <span>✨ STOREFLOW AI</span>
            <span style={{ background: "var(--brand-primary)", color: "#fff", padding: "1px 6px", borderRadius: 10, fontSize: 10 }}>COPILOT</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
            Retail Intelligence & Copilot
          </h1>
          <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>
            Automated stockout forecasting, dead-stock capital analysis, and natural language retail assistant.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button 
            onClick={handleCopyReorderList}
            className="quick-action-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#10b981", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            📋 {copiedToast ? "Copied to Clipboard!" : "Copy Reorder List (WhatsApp)"}
          </button>
          <button 
            onClick={handleExportPDF}
            className="quick-action-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#1e293b", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            📄 Export Store PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 28 }}>
        <div className="table-card" style={{ padding: "20px", borderTop: "4px solid #ef4444" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
            Critical Stockout Risk
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: criticalItems.length > 0 ? "#ef4444" : "#10b981" }}>
            {criticalItems.length} Products
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {criticalItems.length > 0 ? "Stock will deplete in ≤ 3 days" : "Adequate stock for all fast sellers"}
          </div>
        </div>

        <div className="table-card" style={{ padding: "20px", borderTop: "4px solid #f59e0b" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
            Recommended Reorder Budget
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a" }}>
            GHS {totalReorderCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            To sustain 14-day safe sales buffer
          </div>
        </div>

        <div className="table-card" style={{ padding: "20px", borderTop: "4px solid #64748b" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
            Dead Stock Trapped Capital
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: totalLockedCapital > 0 ? "#b45309" : "#10b981" }}>
            GHS {totalLockedCapital.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {deadStock.length} items with 0 sales in 30 days
          </div>
        </div>

        <div className="table-card" style={{ padding: "20px", borderTop: "4px solid var(--brand-primary)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>
            Projected 7-Day Revenue
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a" }}>
            GHS {cashflow.projectedWeeklyRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 12, color: "#10b981", marginTop: 4, fontWeight: 600 }}>
            Based on current transaction velocity
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: "flex", gap: 8, borderBottom: "2px solid #e2e8f0", marginBottom: 24 }}>
        {[
          { id: "reorder", label: "📦 Stockout & Reorder AI" },
          { id: "deadstock", label: "💤 Dead Stock Optimizer" },
          { id: "cashflow", label: "📊 Cash Flow Run-Rate" },
          { id: "copilot", label: "💬 Retail Copilot" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "12px 18px",
              border: "none",
              background: "none",
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: 14,
              color: activeTab === tab.id ? "var(--brand-primary)" : "#64748b",
              borderBottom: activeTab === tab.id ? "3px solid var(--brand-primary)" : "3px solid transparent",
              cursor: "pointer",
              marginBottom: -2,
              transition: "all 0.15s"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Reorder Demand Forecasting */}
      {activeTab === 'reorder' && (
        <div className="table-card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Product Stockout Velocity & Purchase Order Suggestions</h3>
              <span style={{ fontSize: 12, color: "#64748b" }}>Prioritized by stockout urgency based on 30-day historical customer sales</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--brand-primary)" }}>
              {forecast.filter(f => f.suggested_reorder > 0).length} items need reordering
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Current Stock</th>
                  <th>Daily Velocity</th>
                  <th>Days Left</th>
                  <th>Risk Level</th>
                  <th>Suggested Reorder</th>
                  <th>Est. Cost</th>
                </tr>
              </thead>
              <tbody>
                {forecast.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: 30, color: "#9ca3af" }}>
                      No inventory records found.
                    </td>
                  </tr>
                ) : (
                  forecast.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600, color: "#1e293b" }}>{item.name}</td>
                      <td>{item.current_stock}</td>
                      <td>{item.daily_velocity} / day</td>
                      <td>
                        {item.days_remaining === 999 ? "Plenty" : `${item.days_remaining} days`}
                      </td>
                      <td>
                        <span 
                          style={{
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            background: 
                              item.risk_level === 'critical' ? '#fee2e2' :
                              item.risk_level === 'warning' ? '#fef3c7' :
                              item.risk_level === 'overstock' ? '#f1f5f9' : '#dcfce7',
                            color:
                              item.risk_level === 'critical' ? '#dc2626' :
                              item.risk_level === 'warning' ? '#d97706' :
                              item.risk_level === 'overstock' ? '#475569' : '#15803d'
                          }}
                        >
                          {item.risk_level}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: item.suggested_reorder > 0 ? "var(--brand-primary)" : "#64748b" }}>
                        {item.suggested_reorder > 0 ? `+${item.suggested_reorder} units` : "Adequate"}
                      </td>
                      <td>GHS {item.estimated_reorder_cost.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Dead Stock Optimizer */}
      {activeTab === 'deadstock' && (
        <div className="table-card" style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Stagnant Inventory & Trapped Capital Optimizer</h3>
            <span style={{ fontSize: 12, color: "#64748b" }}>Products currently sitting in store with zero sales over the last 30 days</span>
          </div>

          {deadStock.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
              <h4 style={{ margin: "0 0 6px 0", color: "#1e293b" }}>No Dead Stock Detected!</h4>
              <p style={{ fontSize: 13, margin: 0 }}>Every stocked product has registered sales recently.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Stagnant Product</th>
                    <th>Stock on Hand</th>
                    <th>Unit Cost</th>
                    <th>Capital Locked</th>
                    <th>AI Recommended Strategy</th>
                  </tr>
                </thead>
                <tbody>
                  {deadStock.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600, color: "#1e293b" }}>{item.name}</td>
                      <td>{item.stock_quantity} units</td>
                      <td>GHS {item.cost_price}</td>
                      <td style={{ fontWeight: 700, color: "#b45309" }}>GHS {item.capital_locked.toLocaleString()}</td>
                      <td>
                        <span style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", padding: "4px 8px", borderRadius: 6, fontSize: 12, color: "#334155" }}>
                          💡 {item.recommended_action}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Cash Flow Run-Rate */}
      {activeTab === 'cashflow' && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 20 }}>
          <div className="table-card" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Payment Methods Settlement Breakdown</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px", background: "#f8fafc", borderRadius: 8 }}>
                <span style={{ fontWeight: 600, color: "#475569" }}>💵 Physical Cash Collected</span>
                <span style={{ fontWeight: 700, color: "#1e293b" }}>GHS {cashflow.methodTotals.cash.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px", background: "#f8fafc", borderRadius: 8 }}>
                <span style={{ fontWeight: 600, color: "#475569" }}>📱 Mobile Money (MoMo)</span>
                <span style={{ fontWeight: 700, color: "#1e293b" }}>GHS {cashflow.methodTotals.momo.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px", background: "#f8fafc", borderRadius: 8 }}>
                <span style={{ fontWeight: 600, color: "#475569" }}>🏦 Bank / Transfer / Card</span>
                <span style={{ fontWeight: 700, color: "#1e293b" }}>GHS {cashflow.methodTotals.bank.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "12px", background: "#fef2f2", borderRadius: 8, borderLeft: "4px solid #ef4444" }}>
                <span style={{ fontWeight: 600, color: "#991b1b" }}>⚠️ Uncollected Customer Debt</span>
                <span style={{ fontWeight: 700, color: "#991b1b" }}>GHS {cashflow.totalUncollected.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="table-card" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 700, color: "#1e293b" }}>Net Operating Runway & Projections</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <span style={{ fontSize: 12, color: "#64748b" }}>Gross Revenue Sampled</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1e293b" }}>GHS {cashflow.totalRevenue.toLocaleString()}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: "#64748b" }}>Operating Expenses Deducted</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#ef4444" }}>- GHS {cashflow.totalExpense.toLocaleString()}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: "#64748b" }}>Net Cash Retained</span>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#10b981" }}>GHS {cashflow.netOperatingCash.toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Retail Copilot */}
      {activeTab === 'copilot' && (
        <div className="table-card" style={{ padding: 24, height: 600, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                🤖
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                  StoreFlow Retail Assistant
                </h3>
                <span style={{ fontSize: 12, color: "#64748b" }}>Query your store's sales, margins, and restocking needs</span>
              </div>
            </div>
            <button 
              onClick={() => setChatHistory([{ sender: "ai", text: "Chat cleared. What can I check for you in your store today?" }])}
              style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 12, cursor: "pointer" }}
            >
              Clear
            </button>
          </div>

          {/* Quick Prompt Chips */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 12 }}>
            {[
              "What should I reorder from the market today?",
              "Which items are dead stock?",
              "Summarize today's sales and payment methods",
              "Show my top 5 highest-margin products"
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleAskCopilot(chip)}
                style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "6px 12px", borderRadius: 16, fontSize: 12, fontWeight: 600, color: "#334155", whiteSpace: "nowrap", cursor: "pointer" }}
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Message Stream */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            {chatHistory.map((msg, idx) => (
              <div
                key={idx}
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
                StoreFlow AI thinking...
              </div>
            )}
          </div>

          {/* Prompt Input */}
          <form onSubmit={(e) => { e.preventDefault(); handleAskCopilot(); }} style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={copilotQuery}
              onChange={e => setCopilotQuery(e.target.value)}
              placeholder="Ask anything about your store (e.g. 'How much cement should I buy?')..."
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
      )}
    </div>
  );
}

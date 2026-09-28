import { useState, useEffect, useMemo, useRef } from "react";
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
import {
  queryStoreLLM,
  getCurrentModel,
  setCurrentModel,
  getStoredApiKey,
  setStoredApiKey,
  getTemperature,
  setTemperature,
  CURATED_MODELS
} from "../services/llmService";
import AIMessageContent from "../components/AI/AIMessageContent";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Sparkle,
  Robot,
  WhatsappLogo,
  FilePdf,
  Gear,
  WarningOctagon,
  Package,
  HourglassHigh,
  TrendUp,
  ChatCircleDots,
  PaperPlaneTilt,
  Money,
  DeviceMobile,
  Bank,
  WarningCircle,
  Tag,
  CheckCircle,
  Lightning,
  Trash,
  X,
  Check,
  ShieldCheck,
  Coins,
  Cpu
} from "@phosphor-icons/react";
import "./Dashboard.css";
import "./StoreflowAI.css";

export default function StoreflowAI() {
  const location = useLocation();
  const { activeOrg, user, activeOrgId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(location.state?.tab || "reorder");

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state?.tab]);

  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [saleItems, setSaleItems] = useState([]);
  const [expenses, setExpenses] = useState([]);

  // Copilot & RAG State
  const [copilotQuery, setCopilotQuery] = useState("");
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() => getCurrentModel());
  const [apiKeyInput, setApiKeyInput] = useState(() => getStoredApiKey());
  const [temperatureVal, setTemperatureVal] = useState(() => getTemperature());
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [apiKeySavedToast, setApiKeySavedToast] = useState(false);
  const chatBottomRef = useRef(null);

  const [chatHistory, setChatHistory] = useState([
    {
      sender: "ai",
      text: `Hello ${user?.full_name?.split(" ")[0] || "there"}! I am your StoreFlow AI Retail Copilot. I have grounded context on your store's live sales velocity, inventory, and cash flow. Ask me what to restock, which items are dead stock, or for revenue projections!`
    }
  ]);

  // Load Store Data Strictly Isolated to Current Organization
  useEffect(() => {
    async function loadStoreData() {
      const resolvedOrgId =
        activeOrgId ||
        activeOrg?.id ||
        user?.organization_id ||
        user?.organizations?.id;

      if (!resolvedOrgId) {
        setProducts([]);
        setSales([]);
        setSaleItems([]);
        setExpenses([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [prodsRes, salesRes, expRes] = await Promise.all([
          supabase
            .from("products")
            .select("*")
            .eq("organization_id", resolvedOrgId)
            .order("name"),
          supabase
            .from("sales")
            .select("*")
            .eq("organization_id", resolvedOrgId)
            .order("created_at", { ascending: false })
            .limit(200),
          supabase
            .from("expenses")
            .select("*")
            .eq("organization_id", resolvedOrgId)
            .limit(100)
        ]);

        const saleIds = (salesRes.data || []).map((s) => s.id);
        let itemsData = [];
        if (saleIds.length > 0) {
          const itemsRes = await supabase
            .from("sale_items")
            .select("*")
            .in("sale_id", saleIds)
            .limit(500);
          itemsData = itemsRes.data || [];
        }

        setProducts(prodsRes.data || []);
        setSales(salesRes.data || []);
        setSaleItems(itemsData);
        setExpenses(expRes.data || []);
      } catch (err) {
        console.error("Error loading StoreFlow AI data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadStoreData();
  }, [activeOrgId, activeOrg?.id, user?.organization_id]);

  // Run AI Analytics Algorithms
  const forecast = useMemo(
    () => calculateStockoutForecast(products, sales, saleItems),
    [products, sales, saleItems]
  );
  const deadStock = useMemo(
    () => identifyDeadStock(products, sales, saleItems),
    [products, sales, saleItems]
  );
  const cashflow = useMemo(
    () => calculateCashflowRunrate(sales, expenses),
    [sales, expenses]
  );
  const anomalies = useMemo(
    () => detectAccountingAnomalies(sales, [], products),
    [sales, products]
  );

  // KPIs
  const criticalItems = useMemo(
    () => forecast.filter((f) => f.risk_level === "critical"),
    [forecast]
  );
  const warningItems = useMemo(
    () => forecast.filter((f) => f.risk_level === "warning"),
    [forecast]
  );
  const totalLockedCapital = useMemo(
    () => deadStock.reduce((sum, d) => sum + d.capital_locked, 0),
    [deadStock]
  );
  const totalReorderCost = useMemo(() => {
    return [...criticalItems, ...warningItems].reduce(
      (sum, i) => sum + i.estimated_reorder_cost,
      0
    );
  }, [criticalItems, warningItems]);

  // Scroll chat to bottom
  useEffect(() => {
    if (activeTab === "copilot") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatHistory, copilotLoading, activeTab]);

  // Handle Copilot Query with Live RAG Pipeline
  const handleAskCopilot = async (customPrompt) => {
    const q = (customPrompt || copilotQuery).trim();
    if (!q) return;

    setChatHistory((prev) => [...prev, { sender: "user", text: q }]);
    setCopilotQuery("");
    setCopilotLoading(true);

    try {
      const result = await queryStoreLLM({
        query: q,
        storeData: {
          products,
          sales,
          expenses,
          forecast,
          deadStock,
          cashflow,
          activeOrg
        },
        chatHistory,
        modelId: selectedModel,
        temperature: temperatureVal
      });

      setChatHistory((prev) => [
        ...prev,
        {
          sender: "ai",
          text: result.text,
          source: result.source,
          modelName: result.modelName
        }
      ]);
    } catch (err) {
      console.error("Copilot error:", err);
      setChatHistory((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "An error occurred while communicating with the AI model. Please try again."
        }
      ]);
    } finally {
      setCopilotLoading(false);
    }
  };

  // Copy Reorder List for WhatsApp
  const handleCopyReorderList = () => {
    const needReorder = forecast.filter((f) => f.suggested_reorder > 0);
    if (needReorder.length === 0) {
      alert("No items currently need reordering!");
      return;
    }

    let text = `*${activeOrg?.name || "Store"} Reorder Shopping List*\nGenerated on ${new Date().toLocaleDateString()}\n\n`;
    needReorder.forEach((item, idx) => {
      text += `${idx + 1}. *${item.name}* — Order: +${item.suggested_reorder} units (Current: ${item.current_stock})\n`;
    });
    text += `\n*Total Est. Budget:* GHS ${totalReorderCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 3000);
    });
  };

  // Export Store AI PDF
  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(`${activeOrg?.name || "Store"} — AI Intelligence Report`, 14, 22);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Generated: ${new Date().toLocaleString()} | Powered by StoreFlow AI`,
      14,
      32
    );

    doc.setTextColor(17, 24, 39);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Stockout Demand & Reorder Recommendations", 14, 52);

    const reorderRows = forecast
      .filter((f) => f.suggested_reorder > 0)
      .map((f) => [
        f.name,
        f.current_stock,
        f.daily_velocity,
        f.days_remaining === 999 ? "∞" : `${f.days_remaining}d`,
        `+${f.suggested_reorder}`,
        `GHS ${f.estimated_reorder_cost}`
      ]);

    autoTable(doc, {
      startY: 58,
      head: [
        [
          "Product",
          "Current Stock",
          "Velocity (unit/d)",
          "Days Left",
          "Reorder Qty",
          "Est. Cost"
        ]
      ],
      body:
        reorderRows.length > 0
          ? reorderRows
          : [["No items require reordering", "-", "-", "-", "-", "-"]],
      theme: "grid",
      headStyles: { fillColor: [241, 90, 36] }
    });

    if (deadStock.length > 0) {
      doc.text("Dead Stock Capital Trapped", 14, doc.lastAutoTable.finalY + 16);
      const deadRows = deadStock.map((d) => [
        d.name,
        d.stock_quantity,
        `GHS ${d.cost_price}`,
        `GHS ${d.capital_locked}`,
        d.recommended_action
      ]);
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 22,
        head: [
          [
            "Product",
            "Stagnant Units",
            "Unit Cost",
            "Capital Locked",
            "AI Recommendation"
          ]
        ],
        body: deadRows,
        theme: "striped",
        headStyles: { fillColor: [100, 116, 139] }
      });
    }

    doc.save(
      `${activeOrg?.slug || "store"}-ai-report-${new Date().toISOString().split("T")[0]}.pdf`
    );
  };

  const handleSaveSettings = () => {
    setStoredApiKey(apiKeyInput);
    setCurrentModel(selectedModel);
    setTemperature(temperatureVal);
    setApiKeySavedToast(true);
    setTimeout(() => {
      setApiKeySavedToast(false);
      setShowSettingsModal(false);
    }, 1200);
  };

  const activeModelObj =
    CURATED_MODELS.find((m) => m.id === selectedModel) || CURATED_MODELS[0];

  return (
    <div className="storeflow-ai-container">
      {/* Header Banner */}
      <div className="ai-page-header">
        <div>
          <div className="ai-page-badge">
            <Sparkle size={14} weight="fill" />
            <span>StoreFlow AI Engine</span>
            <span className="ai-page-badge__pill">RAG Grounded</span>
          </div>
          <h1 className="ai-page-title">
            Retail Intelligence & Copilot
          </h1>
          <p className="ai-page-desc">
            Automated stockout velocity forecasting, dead-stock capital liberation, and natural language copilot grounded in live shop data.
          </p>
        </div>

        <div className="ai-header-actions">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="ai-btn-action ai-btn-action--settings"
            title="Configure AI Model & RAG parameters"
          >
            <Cpu size={16} weight="duotone" />
            <span>{activeModelObj.name}</span>
            <Gear size={14} weight="bold" />
          </button>
          <button
            onClick={handleCopyReorderList}
            className="ai-btn-action ai-btn-action--whatsapp"
          >
            <WhatsappLogo size={16} weight="fill" />
            <span>{copiedToast ? "Copied!" : "WhatsApp Reorder List"}</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="ai-btn-action ai-btn-action--pdf"
          >
            <FilePdf size={16} weight="duotone" />
            <span>Export Report PDF</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Widgets (Redesigned from cards to icons) */}
      <div className="ai-stat-grid">
        {/* Widget 1: Critical Stockout Risk */}
        <div className="ai-stat-widget">
          <div className="ai-stat-icon ai-stat-icon--critical">
            <WarningOctagon size={24} weight="duotone" />
          </div>
          <div className="ai-stat-body">
            <div className="ai-stat-label">Critical Stockout Risk</div>
            <div
              className="ai-stat-value"
              style={{
                color: criticalItems.length > 0 ? "#dc2626" : "#059669"
              }}
            >
              {criticalItems.length} Products
            </div>
            <div className="ai-stat-sub">
              {criticalItems.length > 0 ? (
                <span className="ai-stat-pill ai-stat-pill--danger">
                  Depletes in ≤ 3 days
                </span>
              ) : (
                <span className="ai-stat-pill ai-stat-pill--success">
                  Adequate buffers
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Widget 2: Reorder Budget */}
        <div className="ai-stat-widget">
          <div className="ai-stat-icon ai-stat-icon--warning">
            <Package size={24} weight="duotone" />
          </div>
          <div className="ai-stat-body">
            <div className="ai-stat-label">Recommended Reorder Budget</div>
            <div className="ai-stat-value">
              GHS {totalReorderCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <div className="ai-stat-sub">
              <span className="ai-stat-pill ai-stat-pill--warning">
                14-Day safe stock buffer
              </span>
            </div>
          </div>
        </div>

        {/* Widget 3: Dead Stock Locked */}
        <div className="ai-stat-widget">
          <div className="ai-stat-icon ai-stat-icon--locked">
            <HourglassHigh size={24} weight="duotone" />
          </div>
          <div className="ai-stat-body">
            <div className="ai-stat-label">Dead Stock Trapped Capital</div>
            <div
              className="ai-stat-value"
              style={{
                color: totalLockedCapital > 0 ? "#7c3aed" : "#059669"
              }}
            >
              GHS {totalLockedCapital.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <div className="ai-stat-sub">
              {deadStock.length} items with 0 sales in 30 days
            </div>
          </div>
        </div>

        {/* Widget 4: Projected Run-Rate */}
        <div className="ai-stat-widget">
          <div className="ai-stat-icon ai-stat-icon--projected">
            <TrendUp size={24} weight="duotone" />
          </div>
          <div className="ai-stat-body">
            <div className="ai-stat-label">Projected 7-Day Revenue</div>
            <div className="ai-stat-value">
              GHS {cashflow.projectedWeeklyRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
            <div className="ai-stat-sub">
              <span className="ai-stat-pill ai-stat-pill--success">
                Based on active transaction velocity
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation with Phosphor Icons */}
      <div className="ai-tab-nav">
        {[
          {
            id: "reorder",
            label: "Stockout & Reorder AI",
            icon: <Package size={18} weight="duotone" />,
            count: forecast.filter((f) => f.suggested_reorder > 0).length
          },
          {
            id: "deadstock",
            label: "Dead Stock Optimizer",
            icon: <HourglassHigh size={18} weight="duotone" />,
            count: deadStock.length
          },
          {
            id: "cashflow",
            label: "Cash Flow Run-Rate",
            icon: <TrendUp size={18} weight="duotone" />,
            count: null
          },
          {
            id: "copilot",
            label: "Retail Copilot & RAG",
            icon: <ChatCircleDots size={18} weight="duotone" />,
            count: activeModelObj.badge
          }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`ai-tab-btn ${activeTab === tab.id ? "ai-tab-btn--active" : ""}`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span className="ai-tab-count">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab 1: Reorder Demand Forecasting */}
      {activeTab === "reorder" && (
        <div className="ai-card">
          <div className="ai-card-header">
            <div>
              <h3 className="ai-card-title">
                <Package size={20} weight="duotone" color="var(--brand-primary)" />
                Stockout Velocity & Purchase Order Planning
              </h3>
              <span className="ai-card-sub">
                Prioritized by stockout urgency based on 30-day customer transaction velocity
              </span>
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--brand-primary)"
              }}
            >
              {forecast.filter((f) => f.suggested_reorder > 0).length} items need replenishment
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="ai-table">
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
                    <td
                      colSpan={7}
                      style={{ textAlign: "center", padding: 36, color: "#94a3b8" }}
                    >
                      No inventory records found for active organization.
                    </td>
                  </tr>
                ) : (
                  forecast.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600, color: "#0f172a" }}>
                        {item.name}
                      </td>
                      <td>{item.current_stock} units</td>
                      <td>{item.daily_velocity} / day</td>
                      <td>
                        {item.days_remaining === 999 ? (
                          <span style={{ color: "#059669" }}>Buffer Adequate</span>
                        ) : (
                          `${item.days_remaining} days`
                        )}
                      </td>
                      <td>
                        <span
                          className={`ai-risk-badge ai-risk-badge--${item.risk_level}`}
                        >
                          {item.risk_level === "critical" && <WarningOctagon size={12} weight="fill" />}
                          {item.risk_level === "warning" && <WarningCircle size={12} weight="fill" />}
                          {item.risk_level === "healthy" && <CheckCircle size={12} weight="fill" />}
                          {item.risk_level}
                        </span>
                      </td>
                      <td
                        style={{
                          fontWeight: 700,
                          color:
                            item.suggested_reorder > 0
                              ? "var(--brand-primary)"
                              : "#64748b"
                        }}
                      >
                        {item.suggested_reorder > 0
                          ? `+${item.suggested_reorder} units`
                          : "Adequate"}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        GHS {item.estimated_reorder_cost.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Dead Stock Optimizer */}
      {activeTab === "deadstock" && (
        <div className="ai-card">
          <div className="ai-card-header">
            <div>
              <h3 className="ai-card-title">
                <HourglassHigh size={20} weight="duotone" color="#7c3aed" />
                Stagnant Inventory & Trapped Capital Optimizer
              </h3>
              <span className="ai-card-sub">
                Products currently sitting on shop shelves with zero sales over the last 30 days
              </span>
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#7c3aed"
              }}
            >
              GHS {totalLockedCapital.toLocaleString()} Locked
            </span>
          </div>

          {deadStock.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "60px 20px",
                color: "#64748b"
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "#ecfdf5",
                  color: "#059669",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px"
                }}
              >
                <CheckCircle size={32} weight="duotone" />
              </div>
              <h4 style={{ margin: "0 0 6px 0", color: "#1e293b", fontSize: 16, fontWeight: 700 }}>
                No Dead Stock Detected!
              </h4>
              <p style={{ fontSize: 13, margin: 0 }}>
                All stocked products have recorded customer sales in the monitoring period.
              </p>
            </div>
          ) : (
            <div className="ai-deadstock-grid">
              {deadStock.map((item) => (
                <div key={item.id} className="ai-deadstock-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h4 style={{ margin: "0 0 4px 0", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                        {item.name}
                      </h4>
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        {item.stock_quantity} units idle
                      </span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#7c3aed" }}>
                        GHS {item.capital_locked.toLocaleString()}
                      </span>
                      <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>Locked</div>
                    </div>
                  </div>

                  <div className="ai-deadstock-action-pill">
                    <Lightning size={14} weight="fill" />
                    <span>{item.recommended_action}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Cash Flow Run-Rate */}
      {activeTab === "cashflow" && (
        <div className="ai-card">
          <div className="ai-card-header">
            <div>
              <h3 className="ai-card-title">
                <TrendUp size={20} weight="duotone" color="#059669" />
                Payment Channels & Operating Cash Runway
              </h3>
              <span className="ai-card-sub">
                Comprehensive settlement distribution across Ghanaian retail tender channels
              </span>
            </div>
          </div>

          <div className="ai-cashflow-layout">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                Payment Method Collections
              </h4>

              {/* Cash */}
              <div className="ai-channel-row">
                <div className="ai-channel-left">
                  <div className="ai-channel-icon" style={{ background: "#ecfdf5", color: "#059669" }}>
                    <Money size={20} weight="duotone" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "#1e293b" }}>Physical Cash in Drawer</div>
                    <span style={{ fontSize: 11, color: "#64748b" }}>Counter settlements</span>
                  </div>
                </div>
                <div style={{ fontWeight: 800, color: "#0f172a" }}>
                  GHS {cashflow.methodTotals.cash.toLocaleString()}
                </div>
              </div>

              {/* MoMo */}
              <div className="ai-channel-row">
                <div className="ai-channel-left">
                  <div className="ai-channel-icon" style={{ background: "#fef3c7", color: "#d97706" }}>
                    <DeviceMobile size={20} weight="duotone" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "#1e293b" }}>Mobile Money (MTN / Telecel)</div>
                    <span style={{ fontSize: 11, color: "#64748b" }}>Direct digital wallet</span>
                  </div>
                </div>
                <div style={{ fontWeight: 800, color: "#0f172a" }}>
                  GHS {cashflow.methodTotals.momo.toLocaleString()}
                </div>
              </div>

              {/* Bank */}
              <div className="ai-channel-row">
                <div className="ai-channel-left">
                  <div className="ai-channel-icon" style={{ background: "#eff6ff", color: "#2563eb" }}>
                    <Bank size={20} weight="duotone" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "#1e293b" }}>Bank Transfer / Card</div>
                    <span style={{ fontSize: 11, color: "#64748b" }}>Direct settlement</span>
                  </div>
                </div>
                <div style={{ fontWeight: 800, color: "#0f172a" }}>
                  GHS {cashflow.methodTotals.bank.toLocaleString()}
                </div>
              </div>

              {/* Debt */}
              <div className="ai-channel-row ai-channel-row--debt">
                <div className="ai-channel-left">
                  <div className="ai-channel-icon" style={{ background: "#fee2e2", color: "#dc2626" }}>
                    <WarningCircle size={20} weight="duotone" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: "#991b1b" }}>Uncollected Customer Debt</div>
                    <span style={{ fontSize: 11, color: "#b91c1c" }}>Customer credit balances</span>
                  </div>
                </div>
                <div style={{ fontWeight: 800, color: "#dc2626" }}>
                  GHS {cashflow.totalUncollected.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Runway Summary */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                Net Operating Balance
              </h4>

              <div style={{ padding: 18, background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>Gross Revenue Recorded</span>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
                  GHS {cashflow.totalRevenue.toLocaleString()}
                </div>
              </div>

              <div style={{ padding: 18, background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>Operating Expenses Deducted</span>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#dc2626", marginTop: 2 }}>
                  - GHS {cashflow.totalExpense.toLocaleString()}
                </div>
              </div>

              <div style={{ padding: 18, background: "#ecfdf5", borderRadius: 12, border: "1px solid #a7f3d0" }}>
                <span style={{ fontSize: 12, color: "#065f46" }}>Net Cash Retained</span>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#059669", marginTop: 2 }}>
                  GHS {cashflow.netOperatingCash.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Retail Copilot & RAG */}
      {activeTab === "copilot" && (
        <div className="ai-copilot-panel">
          {/* Copilot Header */}
          <div className="ai-copilot-header">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  background: "var(--brand-primary, #f15a24)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Sparkle size={20} weight="fill" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                  StoreFlow Retail Copilot
                </h3>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Model: {activeModelObj.name}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="ai-copilot-telemetry-badge">
                <Lightning size={12} weight="fill" />
                <span>RAG Grounded ({products.length} items / {sales.length} orders)</span>
              </div>
              <button
                onClick={() => setShowSettingsModal(true)}
                style={{
                  background: "none",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 12,
                  color: "#475569",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <Gear size={14} />
                <span>Settings</span>
              </button>
              <button
                onClick={() =>
                  setChatHistory([
                    {
                      sender: "ai",
                      text: "Chat cleared. What store data can I analyze for you today?"
                    }
                  ])
                }
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4
                }}
              >
                <Trash size={14} />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Prompt Chips Bar */}
          <div className="ai-prompt-chips-bar">
            {[
              "What should I reorder from the market today?",
              "Which products are dead stock and tying up cash?",
              "Summarize today's sales and payment methods",
              "Show my top 5 highest-margin products"
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleAskCopilot(chip)}
                className="ai-prompt-chip"
              >
                <Lightning size={12} weight="fill" color="var(--brand-primary)" />
                <span>{chip}</span>
              </button>
            ))}
          </div>

          {/* Messages Stream */}
          <div className="ai-copilot-chat-area">
            {chatHistory.map((msg, idx) => (
              <div
                key={idx}
                className={`ai-chat-bubble ai-chat-bubble--${msg.sender}`}
              >
                <AIMessageContent text={msg.text} isUser={msg.sender === "user"} />
                {msg.sender === "ai" && msg.modelName && (
                  <div className="ai-chat-bubble-meta">
                    <Sparkle size={11} weight="fill" />
                    <span>{msg.modelName.split("/").pop()}</span>
                  </div>
                )}
              </div>
            ))}
            {copilotLoading && (
              <div
                style={{
                  alignSelf: "flex-start",
                  background: "#ffffff",
                  padding: "12px 18px",
                  borderRadius: 14,
                  fontSize: 13,
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: "1px solid #e2e8f0"
                }}
              >
                <Sparkle size={16} weight="fill" color="var(--brand-primary)" className="spin" />
                <span>StoreFlow AI is synthesizing live telemetry...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Copilot Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAskCopilot();
            }}
            className="ai-copilot-input-bar"
          >
            <input
              type="text"
              value={copilotQuery}
              onChange={(e) => setCopilotQuery(e.target.value)}
              placeholder="Ask anything (e.g. 'How much cement should I reorder?' or 'Give me a cash breakdown')..."
              className="ai-copilot-input"
            />
            <button
              type="submit"
              disabled={copilotLoading}
              className="ai-copilot-send-btn"
            >
              <span>Ask</span>
              <PaperPlaneTilt size={14} weight="bold" />
            </button>
          </form>
        </div>
      )}

      {/* Model & RAG Settings Modal */}
      {showSettingsModal && (
        <div className="ai-modal-backdrop" onClick={() => setShowSettingsModal(false)}>
          <div className="ai-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ai-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Cpu size={22} weight="duotone" color="var(--brand-primary)" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                  AI Model & RAG Settings
                </h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="ai-modal-body">
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>
                  SELECT LLM MODEL:
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {CURATED_MODELS.map((model) => (
                    <div
                      key={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className={`ai-model-card ${selectedModel === model.id ? "ai-model-card--selected" : ""}`}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                          <span>{model.name}</span>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: "1px 6px",
                              borderRadius: 6,
                              background: model.badge === "Free" ? "#ecfdf5" : "#f1f5f9",
                              color: model.badge === "Free" ? "#059669" : "#475569"
                            }}
                          >
                            {model.badge}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{model.desc}</span>
                      </div>
                      {selectedModel === model.id && (
                        <Check size={18} weight="bold" color="var(--brand-primary)" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>
                  OPENROUTER / LLM API KEY:
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-or-v1-..."
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    fontFamily: "monospace",
                    boxSizing: "border-box"
                  }}
                />
                <span style={{ fontSize: 11, color: "#64748b", marginTop: 4, display: "block" }}>
                  Used to query free or cheap models on OpenRouter. Pre-configured for store copilot.
                </span>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
                    CREATIVITY / TEMPERATURE:
                  </label>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-primary)" }}>
                    {temperatureVal}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={temperatureVal}
                  onChange={(e) => setTemperatureVal(parseFloat(e.target.value))}
                  style={{ width: "100%" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8" }}>
                  <span>Deterministic (0.1)</span>
                  <span>Creative Retail Advisor (0.7)</span>
                  <span>Wild (1.0)</span>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  style={{
                    background: "#f1f5f9",
                    border: "none",
                    padding: "10px 18px",
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 13,
                    color: "#475569",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  style={{
                    background: "var(--brand-primary, #f15a24)",
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 13,
                    color: "#ffffff",
                    cursor: "pointer"
                  }}
                >
                  {apiKeySavedToast ? "Saved!" : "Save & Apply"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sparkle,
  PaperPlaneTilt,
  ArrowsOutSimple,
  Trash,
  X,
  MapPin,
  Lightning,
  Cpu,
} from "@phosphor-icons/react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../services/supabaseClient";
import {
  calculateStockoutForecast,
  identifyDeadStock,
  calculateCashflowRunrate,
} from "../../services/aiAnalyticsService";
import {
  queryStoreLLM,
  getCurrentModel,
  setCurrentModel,
  CURATED_MODELS,
} from "../../services/llmService";
import AIMessageContent from "./AIMessageContent";
import "./AIBubble.css";


// ── Page context map ─────────────────────────────────────
const PAGE_CONTEXT_MAP = {
  "/dashboard": { label: "Dashboard", scope: "overview" },
  "/sales": { label: "Sales Records", scope: "sales" },
  "/customers": { label: "Customers", scope: "customers" },
  "/products": { label: "Products", scope: "stock" },
  "/deposits": { label: "Deposits", scope: "finance" },
  "/expenses": { label: "Expenses", scope: "finance" },
  "/reports/daily": { label: "Journal Entries", scope: "accounting" },
  "/logs": { label: "Activity Logs", scope: "operations" },
  "/settings": { label: "Settings", scope: "admin" },
  "/ai": { label: "AI Analytics", scope: "analytics" },
  "/admin": { label: "Admin Console", scope: "superadmin" },
  "/admin/billing": { label: "Billing", scope: "superadmin" },
  "/admin/database": { label: "Database", scope: "superadmin" },
  "/admin/api-keys": { label: "API Keys", scope: "superadmin" },
};

function getPageContext(pathname) {
  const match = Object.entries(PAGE_CONTEXT_MAP).find(([path]) =>
    pathname === path || pathname.startsWith(path + "/")
  );
  return match
    ? match[1]
    : { label: "StoreFlow", scope: "general" };
}

// ── Preset prompts based on page context ─────────────────
function getPresetPrompts(scope) {
  const universal = [
    "What should I reorder today?",
    "Summarize my store performance",
  ];

  const scopedPrompts = {
    overview: [
      "Any anomalies in today's numbers?",
      "How's my cash flow looking?",
    ],
    sales: [
      "Show my top selling products",
      "Any large uncollected credits?",
    ],
    customers: [
      "Which customers owe the most?",
      "Who are my most frequent buyers?",
    ],
    stock: [
      "Which items are dead stock?",
      "Show my highest-margin products",
    ],
    finance: [
      "Break down payment methods",
      "What's my net operating cash?",
    ],
    accounting: [
      "Detect any accounting anomalies",
      "Summarize today's entries",
    ],
    analytics: [
      "Give me a full store health report",
      "Show my projected weekly revenue",
    ],
    operations: [
      "Any suspicious activity recently?",
      "Summarize today's operations",
    ],
  };

  return [...(scopedPrompts[scope] || universal), ...universal].slice(0, 4);
}

// ── Format timestamp ─────────────────────────────────────
function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ═══════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════
export default function AIBubble() {
  const { activeOrg, user, activeOrgId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // ── State ──
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState(() => [
    {
      sender: "ai",
      text: `Hey ${user?.full_name?.split(" ")[0] || "there"}! I'm your StoreFlow assistant. Ask me anything about your inventory, sales, or cash flow.`,
      time: new Date(),
    },
  ]);

  const [selectedModel, setSelectedModel] = useState(() => getCurrentModel());
  const [showModelPicker, setShowModelPicker] = useState(false);

  // ── Data for AI context ──
  const [storeData, setStoreData] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  // ── Page context ──
  const pageCtx = getPageContext(location.pathname);
  const presets = getPresetPrompts(pageCtx.scope);

  // ── Load store data lazily on first open ──
  useEffect(() => {
    if (!isOpen || dataLoaded) return;

    const resolvedOrgId =
      activeOrgId ||
      activeOrg?.id ||
      user?.organization_id ||
      user?.organizations?.id;

    if (!resolvedOrgId) {
      setDataLoaded(true);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [prodsRes, salesRes, expRes] = await Promise.all([
          supabase.from("products").select("*").eq("organization_id", resolvedOrgId).order("name"),
          supabase.from("sales").select("*").eq("organization_id", resolvedOrgId).order("created_at", { ascending: false }).limit(200),
          supabase.from("expenses").select("*").eq("organization_id", resolvedOrgId).limit(100),
        ]);

        if (cancelled) return;

        const saleIds = (salesRes.data || []).map((s) => s.id);
        let itemsData = [];
        if (saleIds.length > 0) {
          const itemsRes = await supabase.from("sale_items").select("*").in("sale_id", saleIds).limit(500);
          itemsData = itemsRes.data || [];
        }

        const products = prodsRes.data || [];
        const sales = salesRes.data || [];
        const saleItems = itemsData;
        const expenses = expRes.data || [];

        const forecast = calculateStockoutForecast(products, sales, saleItems);
        const deadStock = identifyDeadStock(products, sales, saleItems);
        const cashflow = calculateCashflowRunrate(sales, expenses);

        if (!cancelled) {
          setStoreData({ products, sales, expenses, forecast, deadStock, cashflow });
          setDataLoaded(true);
        }
      } catch (err) {
        console.error("AIBubble: failed to load store data", err);
        if (!cancelled) setDataLoaded(true);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [isOpen, dataLoaded, activeOrgId, activeOrg?.id, user?.organization_id]);

  // ── Scroll to latest message ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, loading]);

  // ── Focus input when overlay opens ──
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [isOpen]);

  // ── Toggle ──
  const handleToggle = useCallback(() => {
    if (isOpen) {
      setIsClosing(true);
      setTimeout(() => {
        setIsOpen(false);
        setIsClosing(false);
      }, 220);
    } else {
      setIsOpen(true);
    }
  }, [isOpen]);

  // ── Send message ──
  const handleSend = useCallback(
    async (customPrompt) => {
      const q = (customPrompt || query).trim();
      if (!q) return;

      const userMsg = { sender: "user", text: q, time: new Date() };
      setChatHistory((prev) => [...prev, userMsg]);
      setQuery("");
      setLoading(true);

      try {
        const result = await queryStoreLLM({
          query: q,
          storeData: {
            products: storeData?.products || [],
            sales: storeData?.sales || [],
            expenses: storeData?.expenses || [],
            forecast: storeData?.forecast || [],
            deadStock: storeData?.deadStock || [],
            cashflow: storeData?.cashflow || {},
            activeOrg,
          },
          chatHistory,
          modelId: selectedModel,
        });

        setChatHistory((prev) => [
          ...prev,
          {
            sender: "ai",
            text: result.text,
            time: new Date(),
            model: result.modelName,
            source: result.source,
          },
        ]);
      } catch (err) {
        console.error("AIBubble copilot error:", err);
        setChatHistory((prev) => [
          ...prev,
          {
            sender: "ai",
            text: "Failed to generate response. Please check your connection or switch to offline engine.",
            time: new Date(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [query, storeData, chatHistory, activeOrg, selectedModel]
  );


  // ── Clear chat ──
  const handleClear = useCallback(() => {
    setChatHistory([
      {
        sender: "ai",
        text: "Chat cleared. What would you like to know?",
        time: new Date(),
      },
    ]);
  }, []);

  // ── Navigate to full AI page ──
  const handleExpand = useCallback(() => {
    const isSuper = user?.role === "super_admin";
    navigate(isSuper ? "/admin/ai" : "/ai");
    handleToggle();
  }, [navigate, user?.role, handleToggle]);

  // ── Keyboard shortcut: Ctrl+K ──
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        handleToggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleToggle]);

  return (
    <div className="ai-bubble">
      {/* ── Overlay Panel ── */}
      {(isOpen || isClosing) && (
        <div className={`ai-overlay ${isClosing ? "ai-overlay--closing" : ""}`}>
          {/* Header */}
          <div className="ai-overlay__header">
            <div className="ai-overlay__avatar">
              <Sparkle size={18} weight="fill" />
            </div>
            <div className="ai-overlay__header-info">
              <h4 className="ai-overlay__header-title">StoreFlow AI</h4>
              <span className="ai-overlay__header-subtitle">
                <span className="ai-overlay__header-status">
                  <span className="ai-overlay__status-dot" />
                  {dataLoaded ? "Ready" : "Loading data…"}
                </span>
              </span>
            </div>
            <div className="ai-overlay__header-actions">
              <button
                className="ai-overlay__header-btn"
                onClick={handleClear}
                title="Clear chat"
              >
                <Trash size={14} />
              </button>
              <button
                className="ai-overlay__header-btn"
                onClick={handleExpand}
                title="Open full AI page"
              >
                <ArrowsOutSimple size={14} />
              </button>
            </div>
          </div>

          {/* Context Bar */}
          <div className="ai-overlay__context">
            <span className="ai-overlay__context-badge">
              <MapPin size={12} weight="bold" />
              {pageCtx.label}
            </span>
            <span className="ai-overlay__context-badge">
              <Lightning size={12} weight="bold" />
              {activeOrg?.name || "Store"}
            </span>
            <button
              className="ai-overlay__context-badge"
              onClick={() => setShowModelPicker(!showModelPicker)}
              style={{ background: "#f5f3ff", color: "#6d28d9", border: "none", cursor: "pointer" }}
              title="Click to change AI model"
            >
              <Cpu size={12} weight="bold" />
              {CURATED_MODELS.find((m) => m.id === selectedModel)?.name.split(" ")[0] || "AI"}
            </button>
          </div>

          {/* Model picker dropdown */}
          {showModelPicker && (
            <div style={{ padding: "8px 12px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>PLUGGED MODEL (RAG GROUNDED):</span>
                <span style={{ fontSize: 10, color: "#059669", fontWeight: 600 }}>Zero stars / Clean layout</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {CURATED_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedModel(m.id);
                      setCurrentModel(m.id);
                      setShowModelPicker(false);
                    }}
                    style={{
                      fontSize: 11,
                      padding: "4px 8px",
                      borderRadius: 6,
                      border: "1px solid",
                      borderColor: selectedModel === m.id ? "var(--brand-primary)" : "#cbd5e1",
                      background: selectedModel === m.id ? "var(--brand-bg-light)" : "#fff",
                      color: selectedModel === m.id ? "var(--brand-primary)" : "#334155",
                      cursor: "pointer",
                      fontWeight: selectedModel === m.id ? 700 : 500,
                    }}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="ai-overlay__messages">
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`ai-msg ai-msg--${msg.sender}`}>
                <div className="ai-msg__bubble">
                  <AIMessageContent text={msg.text} isUser={msg.sender === "user"} />
                </div>
                {msg.time && (
                  <span className="ai-msg__time">
                    {msg.source === "live-llm" ? "⚡ AI • " : ""}
                    {formatTime(msg.time)}
                  </span>
                )}
              </div>
            ))}
            {loading && (
              <div className="ai-typing">
                <span className="ai-typing__dot" />
                <span className="ai-typing__dot" />
                <span className="ai-typing__dot" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="ai-overlay__prompts">
            {presets.map((prompt, idx) => (
              <button
                key={idx}
                className="ai-overlay__prompt-chip"
                onClick={() => handleSend(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            className="ai-overlay__input-area"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              className="ai-overlay__input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about your store…"
              disabled={loading}
            />
            <button
              type="submit"
              className="ai-overlay__send-btn"
              disabled={loading || !query.trim()}
            >
              <PaperPlaneTilt size={16} weight="fill" />
            </button>
          </form>

          {/* Footer — expand link */}
          <div className="ai-overlay__footer">
            <button className="ai-overlay__expand-link" onClick={handleExpand}>
              <ArrowsOutSimple size={12} />
              Open full analytics · Ctrl+K
            </button>
          </div>
        </div>
      )}

      {/* ── Trigger Bubble ── */}
      <button
        className={`ai-bubble__trigger ${isOpen ? "ai-bubble__trigger--open" : ""}`}
        onClick={handleToggle}
        aria-label={isOpen ? "Close AI assistant" : "Open AI assistant"}
        title={isOpen ? "Close" : "StoreFlow AI (Ctrl+K)"}
      >
        <span className="ai-bubble__pulse" />
        <span className="ai-bubble__trigger-icon">
          {isOpen ? <X size={22} weight="bold" /> : <Sparkle size={22} weight="fill" />}
        </span>
      </button>
    </div>
  );
}

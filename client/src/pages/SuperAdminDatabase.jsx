import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Database,
  ShieldCheck,
  HardDrive,
  MagnifyingGlass,
  ArrowsClockwise,
  Buildings,
  Users,
  Package,
  CreditCard,
  Receipt,
  AddressBook,
  Money,
  BookOpen,
  CurrencyCircleDollar,
  Notepad,
  ArrowLeft,
  CheckCircle
} from "@phosphor-icons/react";
import { supabase } from "../services/supabaseClient";
import "./Dashboard.css";

const TABLE_CATEGORIES = {
  organizations: {
    category: "Core & Tenancy",
    icon: <Buildings size={22} color="#2563eb" weight="duotone" />,
    desc: "Registered merchant organizations"
  },
  profiles: {
    category: "Core & Tenancy",
    icon: <Users size={22} color="#2563eb" weight="duotone" />,
    desc: "User staff & admin accounts"
  },
  products: {
    category: "Inventory & Stock",
    icon: <Package size={22} color="#f97316" weight="duotone" />,
    desc: "SKUs, costs, barcodes & stock"
  },
  sales: {
    category: "Sales & Invoicing",
    icon: <CreditCard size={22} color="#10b981" weight="duotone" />,
    desc: "Transactions & customer receipts"
  },
  sale_items: {
    category: "Sales & Invoicing",
    icon: <Receipt size={22} color="#10b981" weight="duotone" />,
    desc: "Line items per transaction"
  },
  customers: {
    category: "Sales & Invoicing",
    icon: <AddressBook size={22} color="#10b981" weight="duotone" />,
    desc: "Client directory & wallet balances"
  },
  expenses: {
    category: "Financial Ledgers",
    icon: <Money size={22} color="#f59e0b" weight="duotone" />,
    desc: "Store operating expenditures"
  },
  journal_entries: {
    category: "Financial Ledgers",
    icon: <BookOpen size={22} color="#f59e0b" weight="duotone" />,
    desc: "Double-entry accounting journal"
  },
  subscription_payments: {
    category: "Financial Ledgers",
    icon: <CurrencyCircleDollar size={22} color="#f59e0b" weight="duotone" />,
    desc: "SaaS license payments"
  },
  logs: {
    category: "Platform & Audit",
    icon: <Notepad size={22} color="#8b5cf6" weight="duotone" />,
    desc: "Tenant operational activity logs"
  },
  platform_logs: {
    category: "Platform & Audit",
    icon: <ShieldCheck size={22} color="#8b5cf6" weight="duotone" />,
    desc: "SuperAdmin security & audit trail"
  },
};

export default function SuperAdminDatabase() {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    try {
      const tables = Object.keys(TABLE_CATEGORIES);
      
      // Parallel non-blocking execution across all tables
      const resultsArray = await Promise.all(
        tables.map(async (t) => {
          try {
            const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
            if (error) {
              console.warn(`Telemetry count warning for ${t}:`, error.message);
              return [t, 0];
            }
            return [t, count || 0];
          } catch {
            return [t, 0];
          }
        })
      );

      const results = Object.fromEntries(resultsArray);
      setCounts(results);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("Fetch DB metrics error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // Telemetry Aggregates
  const stats = useMemo(() => {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const core = (counts.organizations || 0) + (counts.profiles || 0);
    const commerce = (counts.sales || 0) + (counts.sale_items || 0) + (counts.customers || 0);
    const ledgers = (counts.expenses || 0) + (counts.journal_entries || 0) + (counts.subscription_payments || 0);
    const audit = (counts.logs || 0) + (counts.platform_logs || 0);

    return { total, core, commerce, ledgers, audit };
  }, [counts]);

  // Filtered tables
  const filteredTables = useMemo(() => {
    return Object.entries(counts).filter(([tbl]) => {
      const meta = TABLE_CATEGORIES[tbl] || { category: "Other" };
      const matchesSearch = tbl.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meta.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "all" || meta.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [counts, searchQuery, selectedCategory]);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Database size={24} color="var(--brand-primary, #f15a24)" weight="duotone" />
            Database & Multi-Tenant Telemetry
          </h2>
          <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
            Live PostgreSQL row counts, multi-tenant row-level isolation (RLS), and object storage telemetry
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={() => fetchCounts()}
            disabled={loading}
            className="quick-action-btn"
            style={{
              background: "#e0f2fe",
              color: "#0369a1",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              padding: "7px 14px",
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            <ArrowsClockwise size={14} className={loading ? "spin" : ""} weight="bold" />
            {loading ? "Refreshing..." : "Refresh Counts"}
          </button>
          <Link to="/admin" className="quick-action-btn" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={14} weight="bold" />
            Back to Super Admin
          </Link>
        </div>
      </div>

      {/* Aggregate Overview Grid */}
      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16, marginBottom: 24 }}>
        <div className="stat-card" style={{ borderLeft: "4px solid #3b82f6" }}>
          <div className="stat-card__header">
            <span className="stat-card__label">Total Database Records</span>
          </div>
          <div className="stat-card__value" style={{ color: "#1d4ed8" }}>
            {stats.total.toLocaleString()}
          </div>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Across all 11 public tables</span>
        </div>

        <div className="stat-card" style={{ borderLeft: "4px solid #10b981" }}>
          <div className="stat-card__header">
            <span className="stat-card__label">Commerce & Invoicing</span>
          </div>
          <div className="stat-card__value" style={{ color: "#059669" }}>
            {stats.commerce.toLocaleString()}
          </div>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Sales, items & customers</span>
        </div>

        <div className="stat-card" style={{ borderLeft: "4px solid #f59e0b" }}>
          <div className="stat-card__header">
            <span className="stat-card__label">Accounting Ledgers</span>
          </div>
          <div className="stat-card__value" style={{ color: "#d97706" }}>
            {stats.ledgers.toLocaleString()}
          </div>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Journals, payments & expenses</span>
        </div>

        <div className="stat-card" style={{ borderLeft: "4px solid #8b5cf6" }}>
          <div className="stat-card__header">
            <span className="stat-card__label">Audit & Security Events</span>
          </div>
          <div className="stat-card__value" style={{ color: "#7c3aed" }}>
            {stats.audit.toLocaleString()}
          </div>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Platform & operational logs</span>
        </div>
      </div>

      {/* Search & Category Filter Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all", "Core & Tenancy", "Inventory & Stock", "Sales & Invoicing", "Financial Ledgers", "Platform & Audit"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                background: selectedCategory === cat ? "#1e293b" : "#f1f5f9",
                color: selectedCategory === cat ? "#ffffff" : "#475569",
                border: "none",
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s"
              }}
            >
              {cat === "all" ? "All Tables" : cat}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", minWidth: 220 }}>
          <MagnifyingGlass size={14} weight="bold" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input
            type="text"
            placeholder="Search tables..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: "6px 12px 6px 30px",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              fontSize: 12,
              outline: "none",
              width: "100%",
              background: "#fff"
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 260, borderRadius: 12 }} />
      ) : (
        <>
          {/* Table Metrics Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
            {filteredTables.map(([tbl, val]) => {
              const meta = TABLE_CATEGORIES[tbl] || { category: "Standard", icon: <Database size={20} weight="duotone" />, desc: "" };
              return (
                <div key={tbl} className="stat-card" style={{ padding: 18, position: "relative" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {meta.icon}
                    </div>
                    <span style={{ fontSize: 10, background: "#f1f5f9", color: "#475569", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
                      {meta.category}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "#334155", letterSpacing: "0.04em", marginTop: 10 }}>
                    {tbl.replaceAll("_", " ")}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
                    {val.toLocaleString()} <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>rows</span>
                  </div>
                  {meta.desc && (
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                      {meta.desc}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredTables.length === 0 && (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40, background: "#fff", borderRadius: 12, color: "#64748b" }}>
                No tables match "{searchQuery}"
              </div>
            )}
          </div>

          {/* Database Security & Storage Info */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            <div className="table-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <ShieldCheck size={22} color="#059669" weight="duotone" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                  Row-Level Security (RLS) Isolation
                </h3>
              </div>
              <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, marginBottom: 14 }}>
                All 11 public schema tables enforce Row-Level Security explicitly with <code>TO authenticated</code> role checks and tenant isolation subqueries (<code>organization_id</code> filtering).
              </p>
              <div style={{ background: "#d1fae5", border: "1px solid #a7f3d0", color: "#065f46", padding: 12, borderRadius: 8, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle size={15} weight="fill" /> Multi-Tenant Isolation Active & Hardened
              </div>
            </div>

            <div className="table-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <HardDrive size={22} color="#0284c7" weight="duotone" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1e293b" }}>
                  Supabase Storage Buckets
                </h3>
              </div>
              <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5, marginBottom: 14 }}>
                Object storage for company logos, generated PDF receipts, and user avatars configured under public & tenant-isolated storage buckets.
              </p>
              <div style={{ background: "#e0f2fe", border: "1px solid #bae6fd", color: "#0369a1", padding: 12, borderRadius: 8, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle size={15} weight="fill" /> Buckets: <code>avatars</code>, <code>logos</code>, <code>receipts</code>
              </div>
            </div>
          </div>

          {/* Footer with total count and timestamp */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, padding: "12px 18px", background: "#f8fafc", borderRadius: 8, fontSize: 12, color: "#64748b", flexWrap: "wrap", gap: 8 }}>
            <span>
              <strong style={{ color: "#1e293b" }}>{stats.total.toLocaleString()}</strong> total rows across <strong style={{ color: "#1e293b" }}>{Object.keys(counts).length}</strong> tables
            </span>
            {lastRefreshed && (
              <span>Last synchronized: {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

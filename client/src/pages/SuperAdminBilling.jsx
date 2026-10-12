import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CreditCard,
  Plus,
  WarningCircle,
  ClockCountdown,
  PencilSimple,
  WhatsappLogo,
  X,
  Buildings,
  Money,
  TrendUp,
  CheckCircle,
  CurrencyCircleDollar
} from "@phosphor-icons/react";
import { supabase } from "../services/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import "./SuperAdmin.css";
import "./Dashboard.css";

export default function SuperAdminBilling() {
  const { user } = useAuth();
  const toast = useToast();
  const [orgs, setOrgs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit / Record Payment Modal State
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("MoMo");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [newStatus, setNewStatus] = useState("active");
  const [newSubRate, setNewSubRate] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch All Organizations with Billing Info
      const { data: orgData, error: orgErr } = await supabase
        .from("organizations")
        .select("*")
        .order("name", { ascending: true });

      if (orgErr) throw orgErr;
      setOrgs(orgData || []);

      // 2. Fetch Subscription Payment History Ledger
      const { data: payData, error: payErr } = await supabase
        .from("subscription_payments")
        .select("*, organizations(name)")
        .order("created_at", { ascending: false })
        .limit(20);

      if (payErr && !payErr.message.includes("does not exist")) {
        console.warn("Subscription payments fetch error:", payErr.message);
      }
      setPayments(payData || []);

    } catch (err) {
      console.error("Billing fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate Verified Realized Cash Collected
  const totalCashCollected = payments.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0) +
    orgs.reduce((acc, o) => acc + (parseFloat(o.setup_fee) || 0), 0);

  // Calculate Verified Monthly Recurring Revenue (MRR)
  const verifiedMRR = orgs.reduce((acc, o) => {
    if (o.payment_status !== "active") return acc;
    const rate = parseFloat(o.subscription_amount) || 0;
    if (o.billing_cycle === "annual") return acc + (rate / 12);
    if (o.billing_cycle === "quarterly") return acc + (rate / 3);
    if (o.billing_cycle === "semi_annual") return acc + (rate / 6);
    if (o.billing_cycle === "monthly") return acc + rate;
    return acc;
  }, 0);

  // Expiring Watchlist: Expiring within 30 days or Overdue
  const now = new Date();
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const watchlist = orgs.filter(o => {
    if (!o.subscription_expires_at) return false;
    const exp = new Date(o.subscription_expires_at);
    return exp <= thirtyDaysFromNow || o.payment_status === "overdue" || o.payment_status === "pending";
  });

  const openPaymentModal = (org) => {
    setSelectedOrg(org);
    setPaymentAmount(org.subscription_amount || "");
    setPaymentMethod("MoMo");
    setPaymentRef("");
    setPaymentNotes(`Subscription renewal for ${org.name}`);
    setNewSubRate(org.subscription_amount || 0);
    setNewStatus(org.payment_status || "active");
    
    // Default extend by 30 days or 1 year
    const currentExp = org.subscription_expires_at ? new Date(org.subscription_expires_at) : new Date();
    const nextExp = new Date(currentExp.getTime() + 30 * 24 * 60 * 60 * 1000);
    setNewExpiry(nextExp.toISOString().split("T")[0]);
  };

  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrg || savingPayment) return;
    setSavingPayment(true);

    try {
      const amount = parseFloat(paymentAmount) || 0;

      // 1. Record payment in subscription_payments ledger if amount > 0
      if (amount > 0) {
        const { error: payInsertErr } = await supabase
          .from("subscription_payments")
          .insert({
            organization_id: selectedOrg.id,
            amount: amount,
            payment_type: "renewal",
            payment_method: paymentMethod,
            reference_no: paymentRef,
            notes: paymentNotes,
            recorded_by: user?.email
          });

        if (payInsertErr && !payInsertErr.message.includes("does not exist")) {
          throw payInsertErr;
        }
      }

      // 2. Update organization subscription expiry & status
      const { error: orgUpdateErr } = await supabase
        .from("organizations")
        .update({
          subscription_amount: parseFloat(newSubRate) || 0,
          payment_status: newStatus,
          subscription_expires_at: newExpiry ? new Date(newExpiry).toISOString() : null,
          last_payment_date: new Date().toISOString()
        })
        .eq("id", selectedOrg.id);

      if (orgUpdateErr) throw orgUpdateErr;

      // 3. Log event in platform_logs
      await supabase.from("platform_logs").insert({
        organization_id: selectedOrg.id,
        organization_name: selectedOrg.name,
        action: "BILLING_RECORD",
        details: `Recorded GH₵ ${amount} payment via ${paymentMethod} for ${selectedOrg.name}. Expiry extended to ${newExpiry}.`,
        user_email: user?.email
      });

      setSelectedOrg(null);
      fetchData();
      toast.success(`Payment of GH₵ ${amount} recorded for ${selectedOrg.name}!`);
    } catch (err) {
      toast.error("Error recording payment: " + err.message);
    } finally {
      setSavingPayment(false);
    }
  };

  const generateWhatsAppReminder = async (org) => {
    const text = `Hello ${org.name} Admin,\n\nYour StoreFlow SaaS subscription is due for renewal.\nAmount Due: GH₵ ${org.subscription_amount || 0}\nBilling Cycle: ${org.billing_cycle || 'monthly'}\nExpiry Date: ${org.subscription_expires_at ? new Date(org.subscription_expires_at).toLocaleDateString() : 'Immediate'}\n\nPlease send payment via Mobile Money to Godwin.\nThank you!`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback
    }

    const phoneClean = (org.phone || org.admin_phone || "").replace(/[^0-9]/g, "");
    const waUrl = phoneClean
      ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    toast.success("WhatsApp reminder text copied to clipboard!", {
      action: () => window.open(waUrl, "_blank"),
      actionLabel: "Open WhatsApp"
    });
  };

  if (loading) {
    return (
      <div className="super-admin-container">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="skeleton" style={{ height: 40, width: 280 }} />
          <div className="skeleton" style={{ height: 120, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 380, borderRadius: 16 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="super-admin-container">
      {/* Header */}
      <div className="super-header">
        <div className="super-header__titles">
          <div className="super-badge-row">
            <span className="super-platform-badge super-platform-badge--live">Revenue Ledger</span>
            <span className="super-platform-badge">Ghana Commercial Hub</span>
          </div>
          <h1 className="super-header__title">Commercial Billing & MRR</h1>
          <p className="super-header__subtitle">
            Verified cash collected, contracted MRR, MoMo payment records and renewal tracking
          </p>
        </div>

        <div className="super-header__actions">
          <Link to="/admin" className="super-btn super-btn--secondary">
            Admin Console
          </Link>
          <Link to="/admin/organizations/new" className="super-btn super-btn--primary">
            <Plus size={18} weight="bold" /> Onboard New Business
          </Link>
        </div>
      </div>

      {error && (
        <div style={{
          background: "#fef2f2",
          color: "#991b1b",
          padding: "14px 18px",
          borderRadius: 12,
          marginBottom: 24,
          fontSize: 13.5,
          border: "1px solid #fee2e2",
          display: "flex",
          alignItems: "center",
          gap: 10
        }}>
          <WarningCircle size={20} weight="fill" color="#dc2626" />
          <span>{error}</span>
        </div>
      )}

      {/* Verified Revenue KPI Cards */}
      <div className="super-kpi-grid">
        <div className="super-kpi-card">
          <div className="super-kpi-card__top">
            <span className="super-kpi-card__label">Realized Cash Collected</span>
            <div className="super-kpi-card__icon-box super-kpi-card__icon-box--emerald">
              <Money size={22} weight="duotone" />
            </div>
          </div>
          <div className="super-kpi-card__value" style={{ color: "#059669" }}>
            GH₵ {totalCashCollected.toLocaleString()}
          </div>
          <div className="super-kpi-card__footer">
            <span className="super-kpi-card__subtitle">Actual cash in bank (Setup + MoMo)</span>
            <span className="super-kpi-card__badge super-kpi-card__badge--green">Realized</span>
          </div>
        </div>

        <div className="super-kpi-card">
          <div className="super-kpi-card__top">
            <span className="super-kpi-card__label">Contracted MRR</span>
            <div className="super-kpi-card__icon-box super-kpi-card__icon-box--blue">
              <TrendUp size={22} weight="duotone" />
            </div>
          </div>
          <div className="super-kpi-card__value" style={{ color: "#2563eb" }}>
            GH₵ {Math.round(verifiedMRR).toLocaleString()}<span style={{ fontSize: 16 }}>/mo</span>
          </div>
          <div className="super-kpi-card__footer">
            <span className="super-kpi-card__subtitle">Normalized active subscriptions</span>
            <span className="super-kpi-card__badge">Recurring</span>
          </div>
        </div>

        <div className="super-kpi-card">
          <div className="super-kpi-card__top">
            <span className="super-kpi-card__label">Subscribed Businesses</span>
            <div className="super-kpi-card__icon-box super-kpi-card__icon-box--orange">
              <Buildings size={22} weight="duotone" />
            </div>
          </div>
          <div className="super-kpi-card__value">{orgs.length}</div>
          <div className="super-kpi-card__footer">
            <span className="super-kpi-card__subtitle">Active tenant accounts</span>
            <span className="super-kpi-card__badge super-kpi-card__badge--green">Live</span>
          </div>
        </div>

        <div className="super-kpi-card">
          <div className="super-kpi-card__top">
            <span className="super-kpi-card__label">Renewals Watchlist</span>
            <div className="super-kpi-card__icon-box" style={{ background: watchlist.length > 0 ? "#fee2e2" : "#f1f5f9", color: watchlist.length > 0 ? "#dc2626" : "#64748b" }}>
              <ClockCountdown size={22} weight="duotone" />
            </div>
          </div>
          <div className="super-kpi-card__value" style={{ color: watchlist.length > 0 ? "#dc2626" : "#059669" }}>
            {watchlist.length}
          </div>
          <div className="super-kpi-card__footer">
            <span className="super-kpi-card__subtitle">Expiring within 30 days or overdue</span>
            <span className="super-kpi-card__badge">{watchlist.length > 0 ? "Action Required" : "All Clear"}</span>
          </div>
        </div>
      </div>

      {/* Expiring Renewals Watchlist */}
      {watchlist.length > 0 && (
        <div className="super-card" style={{ marginBottom: 24, border: "1.5px solid #fecaca" }}>
          <div className="super-card__header" style={{ background: "#fff5f5" }}>
            <div className="super-card__title-group">
              <h2 className="super-card__title" style={{ color: "#991b1b", display: "flex", alignItems: "center", gap: 8 }}>
                <ClockCountdown size={20} color="#dc2626" weight="duotone" />
                30-Day Expiration & Renewal Watchlist
              </h2>
              <span className="super-card__count-badge" style={{ background: "#fee2e2", color: "#b91c1c" }}>
                {watchlist.length} stores
              </span>
            </div>
          </div>

          <div className="super-table-container">
            <table className="super-table">
              <thead>
                <tr>
                  <th>Business Name</th>
                  <th>Admin Phone</th>
                  <th>Rate</th>
                  <th>Expiration Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 700, color: "#0f172a" }}>{o.name}</td>
                    <td>{o.phone || o.admin_email}</td>
                    <td>GH₵ {o.subscription_amount} / {o.billing_cycle}</td>
                    <td style={{ color: "#dc2626", fontWeight: 700 }}>
                      {o.subscription_expires_at ? new Date(o.subscription_expires_at).toLocaleDateString() : "Immediate"}
                    </td>
                    <td>
                      <span className="super-status-pill super-status-pill--suspended">
                        <span className="super-status-dot" />
                        {o.payment_status || 'due'}
                      </span>
                    </td>
                    <td>
                      <div className="super-action-group" style={{ justifyContent: "flex-end" }}>
                        <button
                          onClick={() => openPaymentModal(o)}
                          className="super-action-btn super-action-btn--edit"
                          style={{ background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0" }}
                        >
                          <PencilSimple size={13} weight="bold" /> Record Payment
                        </button>
                        <button
                          onClick={() => generateWhatsAppReminder(o)}
                          className="super-action-btn"
                          style={{ background: "#25d366", color: "#ffffff" }}
                        >
                          <WhatsappLogo size={14} weight="fill" /> WhatsApp Reminder
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full Business Billing Directory */}
      <div className="super-card">
        <div className="super-card__header">
          <div className="super-card__title-group">
            <h2 className="super-card__title">Business Billing & Subscription Directory</h2>
            <span className="super-card__count-badge">{orgs.length} businesses</span>
          </div>
        </div>

        <div className="super-table-container">
          <table className="super-table">
            <thead>
              <tr>
                <th>Business Name</th>
                <th>Setup Fee</th>
                <th>Subscription Rate</th>
                <th>Cadence</th>
                <th>Status</th>
                <th>Expiration Date</th>
                <th>Payment Terms</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(o => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 700, color: "#0f172a" }}>{o.name}</td>
                  <td>GH₵ {o.setup_fee || 0}</td>
                  <td style={{ fontWeight: 700, color: "#2563eb" }}>GH₵ {o.subscription_amount || 0}</td>
                  <td style={{ textTransform: "capitalize" }}>{o.billing_cycle || "monthly"}</td>
                  <td>
                    <span className={`super-status-pill ${o.payment_status === "active" ? "super-status-pill--active" : "super-status-pill--suspended"}`}>
                      <span className="super-status-dot" />
                      {o.payment_status || "active"}
                    </span>
                  </td>
                  <td>{o.subscription_expires_at ? new Date(o.subscription_expires_at).toLocaleDateString() : "N/A"}</td>
                  <td style={{ fontSize: 12, color: "#64748b", maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {o.payment_terms || "Standard MoMo terms"}
                  </td>
                  <td>
                    <div className="super-action-group" style={{ justifyContent: "flex-end" }}>
                      <button
                        onClick={() => openPaymentModal(o)}
                        className="super-action-btn super-action-btn--enter"
                      >
                        <PencilSimple size={13} weight="bold" /> Edit & Record Payment
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View for Billing */}
        <div className="super-mobile-cards">
          {orgs.map(o => (
            <div key={o.id} className="super-biz-card">
              <div className="super-biz-card__top">
                <span style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{o.name}</span>
                <span className={`super-status-pill ${o.payment_status === "active" ? "super-status-pill--active" : "super-status-pill--suspended"}`}>
                  <span className="super-status-dot" />
                  {o.payment_status || "active"}
                </span>
              </div>
              <div className="super-biz-card__meta">
                <div className="super-biz-card__meta-item">
                  <span className="super-biz-card__meta-label">Rate & Cadence</span>
                  <span className="super-biz-card__meta-val">GH₵ {o.subscription_amount || 0} / {o.billing_cycle || "monthly"}</span>
                </div>
                <div className="super-biz-card__meta-item">
                  <span className="super-biz-card__meta-label">Expiry Date</span>
                  <span className="super-biz-card__meta-val">
                    {o.subscription_expires_at ? new Date(o.subscription_expires_at).toLocaleDateString() : "N/A"}
                  </span>
                </div>
              </div>
              <div className="super-biz-card__actions">
                <button
                  onClick={() => openPaymentModal(o)}
                  className="super-action-btn super-action-btn--enter"
                  style={{ width: "100%", padding: 10 }}
                >
                  <PencilSimple size={14} weight="bold" /> Record Payment
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Record Payment / Update Terms Modal */}
      {selectedOrg && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20
        }}>
          <form onSubmit={handleRecordPaymentSubmit} style={{
            background: "#ffffff", borderRadius: 20, maxWidth: 540, width: "100%", padding: 28,
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", border: "1px solid #e2e8f0"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
                  Record Payment & Terms
                </h3>
                <span style={{ fontSize: 13, color: "#64748b" }}>{selectedOrg.name}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrg(null)}
                style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4 }}
              >
                <X size={20} weight="bold" />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label className="super-form-label">Payment Amount (GH₵) *</label>
                <input
                  className="super-form-input"
                  type="number"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="super-form-label">Payment Method *</label>
                <select
                  className="super-form-select"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                >
                  <option value="MoMo">Mobile Money (MoMo)</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash Handover</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label className="super-form-label">Payment Ref / TxID</label>
                <input
                  className="super-form-input"
                  type="text"
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  placeholder="e.g. 1928374612"
                />
              </div>
              <div>
                <label className="super-form-label">Extend Expiry Date *</label>
                <input
                  className="super-form-input"
                  type="date"
                  value={newExpiry}
                  onChange={e => setNewExpiry(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label className="super-form-label">Subscription Rate (GH₵)</label>
                <input
                  className="super-form-input"
                  type="number"
                  value={newSubRate}
                  onChange={e => setNewSubRate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="super-form-label">Subscription Status</label>
                <select
                  className="super-form-select"
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                >
                  <option value="active">Active (Paid)</option>
                  <option value="pending">Pending Payment</option>
                  <option value="overdue">Overdue</option>
                  <option value="trial">Trial Period</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label className="super-form-label">Payment Notes / Ledger Comment</label>
              <input
                className="super-form-input"
                type="text"
                value={paymentNotes}
                onChange={e => setPaymentNotes(e.target.value)}
                placeholder="Payment notes..."
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                type="button"
                onClick={() => setSelectedOrg(null)}
                className="super-btn super-btn--secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingPayment}
                className="super-btn super-btn--primary"
                style={{ background: "#059669" }}
              >
                {savingPayment ? "Saving Payment..." : "Save Payment & Update Expiry"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

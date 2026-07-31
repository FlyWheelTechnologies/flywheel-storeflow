import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";

export default function SuperAdminBilling() {
  const { user } = useAuth();
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
    setPaymentNotes(`Subscription payment for ${org.name}`);
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
    } catch (err) {
      alert("Error recording payment: " + err.message);
    } finally {
      setSavingPayment(false);
    }
  };

  const generateWhatsAppReminder = (org) => {
    const text = `Hello ${org.name} Admin,\n\nYour StoreFlow SaaS subscription is due for renewal.\nAmount Due: GH₵ ${org.subscription_amount || 0}\nBilling Cycle: ${org.billing_cycle || 'monthly'}\nExpiry Date: ${org.subscription_expires_at ? new Date(org.subscription_expires_at).toLocaleDateString() : 'Immediate'}\n\nPlease send payment via Mobile Money to Godwin.\nThank you!`;
    navigator.clipboard.writeText(text);
    alert("WhatsApp payment reminder copied to clipboard!\n\n" + text);
  };

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <h2 className="section-title">Commercial Billing & Payment Center</h2>
        <div className="skeleton" style={{ height: 120, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 350 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 className="section-title">💳 Ghanaian Business Billing & Revenue Hub</h2>
          <p style={{ color: "#6b7280", fontSize: 13 }}>Verified MRR, Cash Collected, Setup Fees & Renewal Watchlist</p>
        </div>
        <Link to="/admin/organizations/new" className="quick-action-btn" style={{ textDecoration: "none" }}>
          + Onboard New Business
        </Link>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", color: "#ef4444", padding: 12, borderRadius: 8, marginBottom: 20, fontSize: 13, border: "1px solid #fee2e2" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Verified Revenue Grid */}
      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 20, marginBottom: 24 }}>
        <div className="stat-card" style={{ borderLeft: "4px solid #10b981" }}>
          <div className="stat-card__header">
            <span className="stat-card__label">Realized Cash Collected</span>
          </div>
          <div className="stat-card__value" style={{ color: "#059669" }}>GH₵ {totalCashCollected.toLocaleString()}</div>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Actual cash in bank (Setup fees + Payments)</span>
        </div>

        <div className="stat-card" style={{ borderLeft: "4px solid #2563eb" }}>
          <div className="stat-card__header">
            <span className="stat-card__label">Verified Contracted MRR</span>
          </div>
          <div className="stat-card__value" style={{ color: "#2563eb" }}>GH₵ {Math.round(verifiedMRR).toLocaleString()}<span style={{ fontSize: 14 }}>/mo</span></div>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Normalized active subscription revenue</span>
        </div>

        <div className="stat-card" style={{ borderLeft: "4px solid #f97316" }}>
          <div className="stat-card__header">
            <span className="stat-card__label">Subscribed Businesses</span>
          </div>
          <div className="stat-card__value">{orgs.length}</div>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Active tenant accounts</span>
        </div>

        <div className="stat-card" style={{ borderLeft: "4px solid #ef4444" }}>
          <div className="stat-card__header">
            <span className="stat-card__label">Renewals Watchlist</span>
          </div>
          <div className="stat-card__value" style={{ color: watchlist.length > 0 ? "#dc2626" : "#059669" }}>{watchlist.length}</div>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Expiring within 30 days or overdue</span>
        </div>
      </div>

      {/* Expiring Renewals Watchlist */}
      {watchlist.length > 0 && (
        <div className="table-card" style={{ marginBottom: 24, border: "1px solid #fecaca" }}>
          <div className="table-card__header" style={{ background: "#fff5f5" }}>
            <h3 className="table-card__title" style={{ color: "#991b1b", display: "flex", alignItems: "center", gap: 8 }}>
              ⏰ 30-Day Expiration & Renewal Watchlist ({watchlist.length})
            </h3>
          </div>
          <div className="table-wrapper">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Business Name</th>
                  <th>Admin Phone</th>
                  <th>Rate</th>
                  <th>Expiration Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>{o.name}</td>
                    <td>{o.phone || o.admin_email}</td>
                    <td>GH₵ {o.subscription_amount} / {o.billing_cycle}</td>
                    <td style={{ color: "#dc2626", fontWeight: 600 }}>
                      {o.subscription_expires_at ? new Date(o.subscription_expires_at).toLocaleDateString() : "Immediate"}
                    </td>
                    <td>
                      <span style={{ background: "#fef2f2", color: "#dc2626", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                        {o.payment_status || 'due'}
                      </span>
                    </td>
                    <td style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => openPaymentModal(o)} className="quick-action-btn" style={{ background: "#d1fae5", color: "#047857", fontSize: 12, padding: "4px 8px" }}>
                        ✏️ Record Payment
                      </button>
                      <button onClick={() => generateWhatsAppReminder(o)} className="quick-action-btn" style={{ background: "#25d366", color: "#ffffff", fontSize: 12, padding: "4px 8px" }}>
                        💬 WhatsApp Reminder
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full Business Billing Ledger */}
      <div className="table-card" style={{ marginBottom: 24 }}>
        <div className="table-card__header">
          <h3 className="table-card__title">Business Billing & Subscription Directory</h3>
        </div>
        <div className="table-wrapper">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Business Name</th>
                <th>Setup Fee</th>
                <th>Sub Rate</th>
                <th>Cadence</th>
                <th>Status</th>
                <th>Expiration Date</th>
                <th>Custom Payment Terms</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(o => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 600 }}>{o.name}</td>
                  <td>GH₵ {o.setup_fee || 0}</td>
                  <td style={{ fontWeight: 600, color: "#2563eb" }}>GH₵ {o.subscription_amount || 0}</td>
                  <td style={{ textTransform: "capitalize" }}>{o.billing_cycle || "monthly"}</td>
                  <td>
                    <span style={{
                      background: o.payment_status === "active" ? "#d1fae5" : "#fef2f2",
                      color: o.payment_status === "active" ? "#059669" : "#dc2626",
                      padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600
                    }}>
                      {o.payment_status || "active"}
                    </span>
                  </td>
                  <td>{o.subscription_expires_at ? new Date(o.subscription_expires_at).toLocaleDateString() : "N/A"}</td>
                  <td style={{ fontSize: 12, color: "#64748b", maxWidth: 180, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {o.payment_terms || "Standard MoMo terms"}
                  </td>
                  <td>
                    <button onClick={() => openPaymentModal(o)} className="quick-action-btn" style={{ background: "#e0f2fe", color: "#0369a1", fontSize: 12, padding: "4px 10px" }}>
                      ✏️ Edit & Record Payment
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment / Update Terms Modal */}
      {selectedOrg && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 20
        }}>
          <form onSubmit={handleRecordPaymentSubmit} style={{
            background: "#ffffff", borderRadius: 16, maxWidth: 540, width: "100%", padding: 24,
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)", border: "1px solid #e2e8f0"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1e293b" }}>
                Record Payment & Update Terms — {selectedOrg.name}
              </h3>
              <button type="button" onClick={() => setSelectedOrg(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Payment Amount (GH₵)</label>
                <input style={inp} type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} required />
              </div>
              <div>
                <label style={lbl}>Payment Method</label>
                <select style={inp} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
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
                <label style={lbl}>Payment Ref / Transaction ID</label>
                <input style={inp} type="text" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="e.g. 1928374612" />
              </div>
              <div>
                <label style={lbl}>Extend Subscription Expiry To</label>
                <input style={inp} type="date" value={newExpiry} onChange={e => setNewExpiry(e.target.value)} required />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Subscription Rate (GH₵)</label>
                <input style={inp} type="number" value={newSubRate} onChange={e => setNewSubRate(e.target.value)} required />
              </div>
              <div>
                <label style={lbl}>Subscription Status</label>
                <select style={inp} value={newStatus} onChange={e => setNewStatus(e.target.value)}>
                  <option value="active">Active (Paid)</option>
                  <option value="pending">Pending Payment</option>
                  <option value="overdue">Overdue</option>
                  <option value="trial">Trial Period</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Payment Notes / Ledger Comment</label>
              <input style={inp} type="text" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="Notes..." />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button type="button" onClick={() => setSelectedOrg(null)} style={{ background: "#f1f5f9", color: "#475569", border: "none", padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
              <button type="submit" disabled={savingPayment} style={{ background: "#059669", color: "#ffffff", border: "none", padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {savingPayment ? "Saving Payment..." : "Save Payment & Update Expiry"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 };
const inp = { width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" };

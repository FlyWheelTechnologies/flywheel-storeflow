import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Export, Plus, CaretDown } from "@phosphor-icons/react";
import { useAuth } from "../context/AuthContext";
import { useExpenses } from "../hooks/useExpenses";
import { useToast } from "../context/ToastContext";
import "./Dashboard.css";
import { formatCurrency } from "../services/formatters";
import {
  Label, Input, Select, SectionHeader, CardSection, FieldGroup, ActionButton
} from "../components/ui/FormFields";
import { PageSkeleton } from "../components/LoadingStates";

const CATEGORIES = ['Utilities', 'Transport', 'Salary', 'Maintenance', 'Supplies', 'Misc'];

export default function Expenses() {
  const { user, activeOrgId } = useAuth();
  const location = useLocation();
  const { success, error: showError } = useToast();
  const { expenses, loading, refetch, createExpense } = useExpenses();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ description: '', category: 'Misc', amount: '' });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [itemsToShow, setItemsToShow] = useState(25);
  const [timeframe, setTimeframe] = useState('All');
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    if (location.state?.showForm) {
      setShowForm(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);

    try {
      const payload = {
        ...form,
        amount: parseFloat(form.amount) || 0,
        recorded_by: user?.email || 'System'
      };
      await createExpense(payload);

      success("Expense recorded successfully!");
      setForm({ description: '', category: 'Misc', amount: '' });
      setShowForm(false);
    } catch (err) {
      console.error("Expense record error:", err);
      showError(`Failed to record expense: ${err.message || "Network error"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const csv = "Date,Description,Category,Amount,Recorded By\n"
      + expenses.map(e => `${new Date(e.created_at).toLocaleDateString()},${e.description},${e.category},${e.amount},${e.recorded_by}`).join("\n");
    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8," + encodeURI(csv);
    link.download = `Expenses_Export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const filtered = useMemo(() => {
    return expenses
      .filter(e => e.description.toLowerCase().includes(search.toLowerCase()))
      .filter(e => {
        if (timeframe === 'All') return true;
        const date = new Date(e.created_at);
        const today = new Date();
        if (timeframe === 'Today') return date.toDateString() === today.toDateString();
        if (timeframe === 'Week') {
          const lastWeek = new Date();
          lastWeek.setDate(today.getDate() - 7);
          return date >= lastWeek;
        }
        if (timeframe === 'Month') return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
        if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
        if (sortBy === 'amount_high') return parseFloat(b.amount) - parseFloat(a.amount);
        if (sortBy === 'amount_low') return parseFloat(a.amount) - parseFloat(b.amount);
        return 0;
      });
  }, [expenses, search, timeframe, sortBy]);

  const paginated = useMemo(() => filtered.slice(0, itemsToShow), [filtered, itemsToShow]);

  const totalExpenses = useMemo(() => filtered.reduce((a, e) => a + parseFloat(e.amount), 0), [filtered]);
  const currency = user?.organizations?.currency || 'GHS';

  if (loading) {
    return <PageSkeleton title stats table tableRows={8} tableColumns={5} />;
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 className="section-title">Expenses</h2>
          <p style={{ fontSize: '12.5px', color: '#6b7280' }}>Record operational costs like utilities, salaries, and maintenance</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="summary-card" style={{ padding: '10px 20px', width: 'auto' }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>Total: </span>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{formatCurrency(totalExpenses, currency)}</span>
          </div>
          <ActionButton variant="secondary" onClick={handleExport} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Export size={15} weight="bold" /> Export
          </ActionButton>
          <ActionButton onClick={() => setShowForm(!showForm)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {showForm ? 'Cancel' : <><Plus size={15} weight="bold" /> Record Expense</>}
          </ActionButton>
        </div>
      </div>

      {showForm && (
        <div className="table-card" style={{ marginBottom: 24 }}>
          <form onSubmit={handleSubmit} style={{ padding: 20, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 14, alignItems: 'end' }}>
            <FieldGroup columns={1}>
              <div>
                <Label required>Description</Label>
                <Input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label required>Category</Label>
                <Select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  options={CATEGORIES.map(c => ({ value: c, label: c }))}
                  required
                />
              </div>
              <div>
                <Label required>Amount ({currency})</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  required
                />
              </div>
              <ActionButton type="submit" fullWidth disabled={saving} style={{ marginTop: 'auto' }}>
                {saving ? 'Saving...' : 'Save'}
              </ActionButton>
            </FieldGroup>
          </form>
        </div>
      )}

      <div className="table-card">
        <div className="table-card__header" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <h3 className="table-card__title" style={{ margin: 0, marginRight: 'auto' }}>Expense Ledger</h3>

          <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3 }}>
            {['All', 'Today', 'Week', 'Month'].map(t => (
              <ActionButton
                key={t}
                variant={timeframe === t ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setTimeframe(t)}
                style={{ padding: '4px 10px', fontSize: 11, height: 'auto' }}
              >
                {t}
              </ActionButton>
            ))}
          </div>

          <Select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            options={[
              { value: "newest", label: "Newest First" },
              { value: "oldest", label: "Oldest First" },
              { value: "amount_high", label: "Highest Amount" },
              { value: "amount_low", label: "Lowest Amount" }
            ]}
            style={{ minWidth: 160 }}
          />

          <Input
            type="search"
            placeholder="Search description..."
            value={search}
            onChange={e => { setSearch(e.target.value); setItemsToShow(25); }}
            style={{ minWidth: 200 }}
          />
        </div>
        <div className="table-wrapper">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: 24 }}>No expenses found.</td>
                </tr>
              ) : paginated.map(e => (
                <tr key={e.id}>
                  <td style={{ fontSize: 12, color: '#6b7280' }}>{new Date(e.created_at).toLocaleDateString()}</td>
                  <td style={{ fontWeight: 500 }}>{e.description}</td>
                  <td><span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{e.category}</span></td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(e.amount, currency)}</td>
                  <td>{e.recorded_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length > itemsToShow && (
          <div style={{ padding: 20, textAlign: 'center', borderTop: '1px solid #f3f4f6' }}>
            <ActionButton variant="secondary" onClick={() => setItemsToShow(prev => prev + 25)} fullWidth style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              See More Expenses <CaretDown size={14} weight="bold" />
            </ActionButton>
          </div>
        )}
      </div>
    </div>
  );
}
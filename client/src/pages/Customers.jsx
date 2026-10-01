import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../services/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useCustomers } from "../hooks/useCustomers";
import { useToast } from "../context/ToastContext";
import { useConfirmation } from "../hooks/useConfirmation";
import "./Dashboard.css";
import { formatCurrency, formatPhone } from "../services/formatters";
import {
  Label, Input, Select, SectionHeader, CardSection, FieldGroup, ActionButton
} from "../components/ui/FormFields";
import { PageSkeleton } from "../components/LoadingStates";

const emptyForm = { name: '', phone: '+233', email: '', address: '', is_contractor: false };

export default function Customers() {
  const { user, activeOrgId } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const { success, error: showError } = useToast();
  const { modalState, confirm, handleConfirm, handleCancel, ConfirmationModal } = useConfirmation();
  const { customers, loading, refetch, createCustomer, updateCustomer, deleteCustomer } = useCustomers();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [history, setHistory] = useState([]);
  const [sortBy, setSortBy] = useState('name');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchCustomers = useCallback(async () => {
    await refetch();
  }, [refetch]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);

    // Clean phone number (normalize 024 -> +23324)
    let cleanedPhone = (form.phone || '').trim();
    if (cleanedPhone.startsWith('0')) {
      cleanedPhone = '+233' + cleanedPhone.slice(1);
    } else if (cleanedPhone.startsWith('233') && !cleanedPhone.startsWith('+233')) {
      cleanedPhone = '+' + cleanedPhone;
    }

    const payload = {
      name: (form.name || '').trim(),
      phone: cleanedPhone || '+233',
      email: (form.email || '').trim(),
      address: (form.address || '').trim(),
      is_contractor: !!form.is_contractor
    };

    // Prevent duplicate phone on creation
    if (!editingId && payload.phone && payload.phone !== '+233') {
      const existing = customers.find(c => c.phone && c.phone.replace(/\s+/g, '') === payload.phone.replace(/\s+/g, ''));
      if (existing) {
        showError(`A customer with phone ${payload.phone} already exists (${existing.name}). Please edit the existing customer instead.`);
        setSaving(false);
        return;
      }
    }

    try {
      if (editingId) {
        await updateCustomer(editingId, payload);
        success("Customer updated successfully!");
      } else {
        await createCustomer(payload);
        success("Customer created successfully!");
      }

      setForm({ ...emptyForm });
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      console.error("Customer save error:", err);
      showError(`Failed to save customer: ${err.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (c) => {
    setForm({ ...c, phone: c.phone || '+233' });
    setEditingId(c.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async () => {
    if (modalState.confirmData?.id) {
      try {
        await deleteCustomer(modalState.confirmData.id);
        success("Customer and all associated sales & records deleted successfully!");
        if (selectedCustomer?.id === modalState.confirmData.id) setSelectedCustomer(null);
        await refetch();
      } catch (err) {
        console.error("Delete error:", err);
        showError(err.message || "Failed to delete customer");
      }
    }
  };

  const confirmDelete = (c) => {
    confirm({
      title: "Delete Customer & All History",
      message: `Are you sure you want to permanently delete "${c.name}"? This will delete this customer along with ALL of their sales history, deposits, and accounting records from the system. This action CANNOT be undone.`,
      confirmText: "Delete Everything",
      type: "danger",
      onConfirm: handleDelete,
      confirmData: c
    });
  };

  const viewHistory = async (customer) => {
    setSelectedCustomer(customer);
    const { data } = await supabase.from('sales').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false });
    setHistory(data || []);
  };

  const filtered = useMemo(() => {
    return customers
      .filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search)
      )
      .sort((a, b) => {
        if (sortBy === 'spent') return (b.total_spent || 0) - (a.total_spent || 0);
        if (sortBy === 'orders') return (b.transaction_count || 0) - (a.transaction_count || 0);
        return (a.name || "").localeCompare(b.name || "");
      });
  }, [customers, search, sortBy]);

  const totalPages = useMemo(() => Math.ceil(filtered.length / itemsPerPage), [filtered.length, itemsPerPage]);
  const paginated = useMemo(() => filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [filtered, currentPage, itemsPerPage]);

  if (loading) {
    return <PageSkeleton title stats table tableRows={8} tableColumns={6} />;
  }

  const currency = user?.organizations?.currency || 'GHS';

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 className="section-title">Customer Directory</h2>
          <p style={{ fontSize: '12.5px', color: '#6b7280' }}>Manage high-value clients and view their purchase history</p>
        </div>
        <ActionButton onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ ...emptyForm }); }}>
          {showForm ? 'Cancel' : '+ New Customer'}
        </ActionButton>
      </div>

      {showForm && (
        <div className="table-card" style={{ marginBottom: 24 }}>
          <div className="table-card__header">
            <h3 className="table-card__title">{editingId ? 'Edit Customer' : 'Add New Customer'}</h3>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <FieldGroup columns={1}>
              <div>
                <Label required>Full Name</Label>
                <Input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input
                  value={form.phone || ''}
                  onChange={e => {
                    let val = e.target.value;
                    if (val.startsWith('0')) val = '+233' + val.substring(1);
                    setForm({ ...form, phone: val });
                  }}
                  placeholder="+233XXXXXXXXX"
                />
              </div>
              <div>
                <Label>Email Address</Label>
                <Input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Address / Location</Label>
                <Input value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <input
                  type="checkbox"
                  id="contractor"
                  checked={form.is_contractor}
                  onChange={e => setForm({ ...form, is_contractor: e.target.checked })}
                />
                <Label htmlFor="contractor" style={{ fontSize: 13, fontWeight: 600, marginBottom: 0 }}>
                  Is Contractor / Large Buyer?
                </Label>
              </div>
              <ActionButton type="submit" fullWidth disabled={saving}>
                {saving ? 'Saving...' : (editingId ? 'Update Customer' : 'Save Customer')}
              </ActionButton>
            </FieldGroup>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selectedCustomer ? '1.5fr 1fr' : '1fr', gap: 24 }}>
        <div className="table-card">
          <div className="table-card__header">
            <h3 className="table-card__title">All Customers</h3>
            <div className="table-card__actions" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                options={[
                  { value: "name", label: "Sort by Name" },
                  { value: "spent", label: "High Value (Spent)" },
                  { value: "orders", label: "Most Orders" }
                ]}
                style={{ width: 180 }}
              />
              <Input
                type="search"
                placeholder="Search..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                style={{ minWidth: 250 }}
              />
            </div>
          </div>
          <div className="table-wrapper">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Category</th>
                  <th>Last Seen</th>
                  <th>Lifetime Spent</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(c => (
                  <tr key={c.id} style={{ background: selectedCustomer?.id === c.id ? '#eff6ff' : '' }}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>
                      <div style={{ fontSize: 12 }}>{c.phone}</div>
                    </td>
                    <td>
                      <span style={{
                        background: c.is_contractor ? '#dbeafe' : '#f3f4f6',
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600
                      }}>
                        {c.is_contractor ? 'Contractor' : 'Regular'}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: '#6b7280' }}>
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {formatCurrency(c.total_spent || 0, currency)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <ActionButton variant="secondary" size="sm" onClick={() => viewHistory(c)}>
                          History
                        </ActionButton>
                        <ActionButton variant="ghost" size="sm" onClick={() => startEdit(c)} title="Edit">
                          ✏️
                        </ActionButton>
                        {isAdmin && (
                          <ActionButton variant="ghost" size="sm" onClick={() => confirmDelete(c)} title="Delete" style={{ color: '#ef4444' }}>
                            🗑️
                          </ActionButton>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16, borderTop: '1px solid #f3f4f6' }}>
              <ActionButton variant="secondary" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</ActionButton>
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 600 }}>Page {currentPage} of {totalPages}</div>
              <ActionButton variant="secondary" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</ActionButton>
            </div>
          )}
        </div>

        {selectedCustomer && (
          <div className="table-card" style={{ height: 'fit-content' }}>
            <div className="table-card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="table-card__title">Sales History: {selectedCustomer.name}</h3>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>
                Lifetime Spent: {currency} {history.reduce((a, s) => a + parseFloat(s.total_amount || 0), 0).toFixed(1)}
              </div>
              <ActionButton variant="ghost" size="sm" aria-label="Close customer details" onClick={() => setSelectedCustomer(null)}>✕</ActionButton>
            </div>
            <div className="table-wrapper">
              <table className="stock-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>ID</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: 20 }}>No sales recorded.</td>
                    </tr>
                  ) : history.map(h => (
                    <tr key={h.id}>
                      <td>{new Date(h.created_at).toLocaleDateString()}</td>
                      <td className="table-code">{h.invoice_no ? h.invoice_no : `#INV-${String(h.id).slice(-6).padStart(3, '0')}`}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(parseFloat(h.total_amount), currency)}</td>
                      <td><span className={`status-pill status-pill--${h.payment_status === 'PAID' ? 'ok' : 'low'}`} style={{ fontSize: 10 }}>{h.payment_status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ConfirmationModal
        show={modalState.show}
        title={modalState.title}
        message={modalState.message}
        confirmText={modalState.confirmText}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        type={modalState.type}
        isLoading={modalState.isLoading}
      />
    </div>
  );
}
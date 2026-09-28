import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../hooks/useProducts";
import { useToast } from "../context/ToastContext";
import { useConfirmation } from "../hooks/useConfirmation";
import "./Dashboard.css";
import { formatCurrency } from "../services/formatters";
import {
  Label, Input, Select, SectionHeader, CardSection, FieldGroup, ActionButton
} from "../components/ui/FormFields";
import { PageSkeleton } from "../components/LoadingStates";

const CATEGORIES = ['Building Materials', 'Plumbing', 'Electrical', 'Roofing', 'Paint', 'General'];

const emptyForm = {
  name: '',
  category: 'General',
  buying_uom: 'Piece',
  selling_uom: 'Piece',
  conversion_factor: 1,
  cost_price: '',
  selling_price: '',
  stock_quantity: '',
  low_stock_threshold: 10
};

export default function Products() {
  const { user } = useAuth();
  const location = useLocation();
  const isAuditor = user?.role === 'auditor';
  const { success, error: showError } = useToast();
  const { modalState, confirm, handleConfirm, handleCancel, ConfirmationModal } = useConfirmation();
  const { products, loading, refetch, createProduct, updateProduct, deleteProduct } = useProducts();

  // Local state
  const [form, setForm] = useState({ ...emptyForm });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [nameError, setNameError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState('name');

  // Load draft on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem("product_draft");
    if (savedDraft && !editingId) {
      try {
        const draft = JSON.parse(savedDraft);
        setForm(f => ({ ...f, ...draft }));
        setShowForm(true);
      } catch (e) { console.error("Product draft load error", e); }
    }
  }, [editingId]);

  // Save draft
  useEffect(() => {
    if (showForm && !editingId) {
      localStorage.setItem("product_draft", JSON.stringify(form));
    }
  }, [form, showForm, editingId]);

  const clearDraft = () => {
    localStorage.removeItem("product_draft");
    setForm({ ...emptyForm });
    setEditingId(null);
    setNameError('');
  };

  const handleCategoryChange = (cat) => {
    setForm(f => ({ ...f, category: cat }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (modalState.isLoading) return;

    const trimmedName = (form.name || '').trim().toUpperCase();
    const isDuplicate = products.some(p => p.name.trim().toUpperCase() === trimmedName && p.id !== editingId);
    if (isDuplicate) {
      setNameError(`Error: Product name ${form.name.trim()} already exists, please use another`);
      return;
    }

    const payload = {
      ...form,
      item_code: form.item_code?.trim() || `FA-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      cost_price: parseFloat(form.cost_price) || 0,
      selling_price: parseFloat(form.selling_price) || 0,
      stock_quantity: parseFloat(form.stock_quantity) || 0,
      conversion_factor: parseFloat(form.conversion_factor) || 1,
      low_stock_threshold: parseInt(form.low_stock_threshold) || 10,
      updated_at: new Date().toISOString()
    };

    try {
      if (editingId) {
        await updateProduct(editingId, payload);
        success("Product updated!");
      } else {
        await createProduct(payload);
        success("Product created!");
      }
      clearDraft();
      setShowForm(false);
    } catch (err) {
      console.error("Product save error:", err);
      showError(`Failed to save product: ${err.message || "Please check your network"}`);
    }
  };

  const startEdit = (p) => {
    setForm({ ...p });
    setEditingId(p.id);
    setShowForm(true);
    setNameError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async () => {
    if (modalState.onConfirm) {
      await deleteProduct(modalState.confirmData?.id);
      success("Product deleted!");
    }
  };

  const confirmDelete = (p) => {
    confirm({
      title: "Delete Product",
      message: `Are you sure you want to delete "${p.name}"? This action cannot be undone.`,
      confirmText: "Delete",
      type: "danger",
      onConfirm: handleDelete,
      confirmData: p
    });
  };

  const handleExport = () => {
    const csv = "Item Code,Name,Category,Buy UOM,Sell UOM,Conv Factor,Cost,Price,Stock\n"
      + products.map(p => `${p.item_code},${p.name},${p.category},${p.buying_uom},${p.selling_uom},${p.conversion_factor},${p.cost_price},${p.selling_price},${p.stock_quantity}`).join("\n");
    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8," + encodeURI(csv);
    link.download = "florzy_products.csv";
    link.click();
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const lines = ev.target.result.split("\n").slice(1);
      const productsToInsert = [];
      for (const line of lines) {
        const [, name, category, buying_uom, selling_uom, conversion_factor, cost_price, selling_price, stock_quantity] = line.split(",");
        if (!name) continue;
        productsToInsert.push({
          name, category, buying_uom, selling_uom,
          conversion_factor: parseFloat(conversion_factor),
          cost_price: parseFloat(cost_price),
          selling_price: parseFloat(selling_price),
          stock_quantity: parseFloat(stock_quantity),
          created_at: new Date().toISOString()
        });
      }

      if (productsToInsert.length > 0) {
        try {
          for (const p of productsToInsert) {
            await createProduct(p);
          }
          success(`Imported ${productsToInsert.length} products`);
        } catch (err) {
          showError(`Import failed: ${err.message}`);
        }
      }
    };
    reader.readAsText(file);
  };

  const filtered = useMemo(() => {
    return products
      .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.item_code?.toLowerCase().includes(search.toLowerCase()))
      .filter(p => categoryFilter === 'All' || p.category === categoryFilter)
      .sort((a, b) => {
        if (sortBy === 'stock_low') return a.stock_quantity - b.stock_quantity;
        if (sortBy === 'stock_high') return b.stock_quantity - a.stock_quantity;
        if (sortBy === 'price_high') return b.selling_price - a.selling_price;
        if (sortBy === 'price_low') return a.selling_price - b.selling_price;
        if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
        if (sortBy === 'margin') {
          const profitA = a.selling_price - a.cost_price;
          const profitB = b.selling_price - b.cost_price;
          return profitB - profitA;
        }
        return a.name.localeCompare(b.name);
      });
  }, [products, search, categoryFilter, sortBy]);

  const paginated = filtered;

  if (loading) {
    return <PageSkeleton title stats table tableRows={8} tableColumns={8} />;
  }

  const currency = user?.organizations?.currency || 'GHS';

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className="section-title">Product Inventory ({products.length} items)</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <ActionButton onClick={() => { setShowForm(!showForm); if (showForm) { setForm({ ...emptyForm }); setEditingId(null); setNameError(''); } }}>
            {showForm ? 'Cancel' : '+ Add Product'}
          </ActionButton>
          <ActionButton variant="secondary" onClick={handleExport}>Export CSV</ActionButton>
          <label style={{ ...ActionButton({ variant: "success", children: "Import CSV" }).props, cursor: 'pointer' }}>
            Import CSV <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} />
          </label>
        </div>
      </div>

      {showForm && (
        <div className="table-card" style={{ marginBottom: 24 }}>
          <div className="table-card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="table-card__title">{editingId ? 'Edit Product' : 'New Product'}</h3>
            {!editingId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>✓ Draft Auto-saved</span>
                <ActionButton variant="danger" size="sm" onClick={clearDraft}>Clear Form</ActionButton>
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit} style={{ padding: 0 }} autoComplete="off">
            {/* SECTION 1: BASIC INFO */}
            <CardSection>
              <SectionHeader number="01">Basic Information</SectionHeader>
              <FieldGroup columns={2} gap={20}>
                <div>
                  <Label required>Product Name</Label>
                  <Input
                    value={form.name}
                    onChange={e => {
                      setForm(f => ({ ...f, name: e.target.value.toUpperCase() }));
                      if (nameError) setNameError('');
                    }}
                    required
                    list="existing-products"
                    error={!!nameError}
                  />
                  {nameError && (
                    <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: 600, marginTop: '4px', display: 'block' }}>
                      {nameError}
                    </span>
                  )}
                  <datalist id="existing-products">
                    {products.map(p => <option key={p.id} value={p.name} />)}
                  </datalist>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select
                    value={form.category}
                    onChange={e => handleCategoryChange(e.target.value)}
                    options={CATEGORIES.map(c => ({ value: c, label: c }))}
                  />
                </div>
              </FieldGroup>
            </CardSection>

            {/* SECTION 2: PRICING & UNITS */}
            <CardSection>
              <SectionHeader number="02">Pricing & Units</SectionHeader>
              <FieldGroup columns={3} gap={20}>
                <div>
                  <Label required>Cost Price ({currency})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.cost_price}
                    onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label required>Selling Price ({currency})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.selling_price}
                    onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))}
                    required
                    style={{ fontWeight: 700, color: '#059669', border: '1px solid #10b981' }}
                  />
                </div>
                <div>
                  <Label>Unit of Measure (e.g. Bag, Pcs)</Label>
                  <Input
                    value={form.selling_uom}
                    onChange={e => setForm(f => ({ ...f, selling_uom: e.target.value }))}
                  />
                </div>
              </FieldGroup>
            </CardSection>

            {/* SECTION 3: STOCK CONTROL */}
            <CardSection>
              <SectionHeader number="03">Stock Inventory</SectionHeader>
              <FieldGroup columns={3} gap={20}>
                <div>
                  <Label required>Current Stock Qty</Label>
                  <Input
                    type="number"
                    value={form.stock_quantity}
                    onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))}
                    required
                    style={{ fontWeight: 700 }}
                  />
                </div>
                <div>
                  <Label>Low Stock Alert Level</Label>
                  <Input
                    type="number"
                    value={form.low_stock_threshold}
                    onChange={e => setForm(f => ({ ...f, low_stock_threshold: e.target.value }))}
                    required
                    style={{ border: '1px solid #fca5a5' }}
                  />
                </div>
                <div style={{ alignSelf: 'end' }}>
                  <ActionButton type="submit" fullWidth disabled={modalState.isLoading}>
                    {modalState.isLoading ? 'Saving...' : (editingId ? 'Update Product' : 'Create Product')}
                  </ActionButton>
                </div>
              </FieldGroup>
            </CardSection>
          </form>
        </div>
      )}

      <div className="table-card">
        <div className="table-card__header">
          <h3 className="table-card__title">Current Stock</h3>
          <div className="table-card__actions" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                options={[{ value: "All", label: "All Categories" }, ...CATEGORIES.map(c => ({ value: c, label: c }))]}
                style={{ paddingLeft: 30, width: 180 }}
              />
            </div>

            <div style={{ position: 'relative' }}>
              <Select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                options={[
                  { value: "name", label: "Sort by Name" },
                  { value: "newest", label: "Newest Added" },
                  { value: "margin", label: "Best Profit" },
                  { value: "stock_low", label: "Low Stock First" },
                  { value: "stock_high", label: "High Stock First" },
                  { value: "price_high", label: "Price: High to Low" },
                  { value: "price_low", label: "Price: Low to High" }
                ]}
                style={{ paddingLeft: 30, width: 180 }}
              />
            </div>

            <div style={{ position: 'relative' }}>
              <Input
                type="search"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ paddingLeft: 34, height: 32, minWidth: 250 }}
              />
            </div>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Sell Unit</th>
                {user?.role !== 'storekeeper' && <th>Cost</th>}
                <th>Price</th>
                {user?.role !== 'storekeeper' && <th>Profit</th>}
                <th>Status</th>
                {!isAuditor && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={isAuditor ? "9" : "10"} style={{ textAlign: 'center', padding: 24 }}>No products found.</td>
                </tr>
              ) : paginated.map(p => (
                <tr key={p.id}>
                  <td className="table-code">{p.item_code || '---'}</td>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td><span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{p.category}</span></td>
                  <td style={{ fontWeight: 600 }}>{p.stock_quantity} {p.selling_uom}s</td>
                  <td>{p.selling_uom}</td>
                  {user?.role !== 'storekeeper' && <td>{formatCurrency(p.cost_price, currency)}</td>}
                  <td style={{ fontWeight: 600 }}>{formatCurrency(p.selling_price, currency)}</td>
                  {user?.role !== 'storekeeper' && (
                    <td style={{ color: (p.selling_price - p.cost_price) / p.selling_price > 0.2 ? '#059669' : '#f59e0b', fontWeight: 600 }}>
                      {formatCurrency(p.selling_price - p.cost_price, currency)}
                    </td>
                  )}
                  <td>
                    {p.stock_quantity <= 0 ? (
                      <span className="status-pill" style={{ background: '#000', color: '#fff', fontSize: '10px' }}>DEPLETED</span>
                    ) : p.stock_quantity < (p.low_stock_threshold || 10) ? (
                      <span className={`status-pill status-pill--low`} style={{ fontSize: '10px' }}>Low Stock</span>
                    ) : (
                      <span className={`status-pill status-pill--ok`} style={{ fontSize: '10px' }}>OK</span>
                    )}
                  </td>
                  {!isAuditor && (
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <ActionButton variant="ghost" size="sm" onClick={() => startEdit(p)} title="Edit Product">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </ActionButton>
                        {user?.role === 'admin' && (
                          <ActionButton variant="ghost" size="sm" onClick={() => confirmDelete(p)} title="Delete Product">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </ActionButton>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
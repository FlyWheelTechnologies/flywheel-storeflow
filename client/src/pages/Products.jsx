import { useState, useEffect, useMemo } from "react";
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
import { getIndustryCategories, getIndustryInfo } from "../constants/industries";
import { CheckCircle } from "@phosphor-icons/react";


const emptyForm = {
  name: '',
  category: 'General',
  condition: 'new',
  buying_uom: 'Piece',
  selling_uom: 'Piece',
  conversion_factor: 1,
  cost_price: '',
  selling_price: '',
  stock_quantity: '',
  low_stock_threshold: 10
};

export default function Products() {
  const { user, activeOrg, activeOrgId } = useAuth();
  const isAuditor = user?.role === 'auditor';
  const { success, error: showError } = useToast();
  const { modalState, confirm, handleConfirm, handleCancel, ConfirmationModal } = useConfirmation();
  const { products, loading, createProduct, updateProduct, deleteProduct } = useProducts();
  const [saving, setSaving] = useState(false);

  // Active business industry resolution (from activeOrg, profile org, or local cache)
  const orgIndustry = useMemo(() => {
    return (
      activeOrg?.industry ||
      user?.organizations?.industry ||
      (activeOrgId ? localStorage.getItem(`storeflow_org_industry_${activeOrgId}`) : null) ||
      "auto_parts"
    );
  }, [activeOrg, user, activeOrgId]);

  const industryInfo = useMemo(() => getIndustryInfo(orgIndustry), [orgIndustry]);
  const industryPresetCategories = useMemo(() => getIndustryCategories(orgIndustry), [orgIndustry]);

  // Local state
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    category: industryPresetCategories[0] || 'General'
  }));
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [nameError, setNameError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortBy, setSortBy] = useState('name');

  // Merge industry predetermined categories with any existing custom product categories dynamically
  const availableCategories = useMemo(() => {
    const existing = (products || []).map(p => p.category).filter(Boolean);
    const combined = Array.from(new Set([...industryPresetCategories, ...existing]));
    return combined;
  }, [industryPresetCategories, products]);

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
    setForm({ ...emptyForm, category: industryPresetCategories[0] || 'General' });
    setEditingId(null);
    setNameError('');
  };

  const handleCategoryChange = (cat) => {
    setForm(f => ({ ...f, category: cat }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const trimmedName = (form.name || '').trim().toUpperCase();
    const isDuplicate = products.some(p => p.name.trim().toUpperCase() === trimmedName && p.id !== editingId);
    if (isDuplicate) {
      setNameError(`Error: Product name ${form.name.trim()} already exists, please use another`);
      return;
    }

    setSaving(true);
    const payload = {
      ...form,
      condition: form.condition || 'new',
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
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (p) => {
    setForm({ ...p, condition: p.condition || 'new' });
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
    const storeName = activeOrg?.name || user?.organizations?.name || 'storeflow';
    const storeSlug = storeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const today = new Date().toISOString().split('T')[0];

    const escapeCsv = (str) => {
      const val = str === undefined || str === null ? '' : String(str);
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const csv = "Item Code,Name,Category,Condition,Buy UOM,Sell UOM,Conv Factor,Cost,Price,Stock\n"
      + products.map(p => [
          escapeCsv(p.item_code || ''),
          escapeCsv(p.name || ''),
          escapeCsv(p.category || 'General'),
          escapeCsv(p.condition || 'new'),
          escapeCsv(p.buying_uom || 'Piece'),
          escapeCsv(p.selling_uom || 'Piece'),
          p.conversion_factor || 1,
          p.cost_price || 0,
          p.selling_price || 0,
          p.stock_quantity || 0
        ].join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${storeSlug}_products_${today}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleImport = (e) => {
    if (saving) return;
    const file = e.target.files[0];
    if (!file) return;
    setSaving(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0).slice(1);
        const productsToInsert = [];

        const parseCsvLine = (line) => {
          const row = [];
          let insideQuote = false;
          let entry = '';
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"' || char === "'") {
              insideQuote = !insideQuote;
            } else if (char === ',' && !insideQuote) {
              row.push(entry.trim().replace(/^["']|["']$/g, ''));
              entry = '';
            } else {
              entry += char;
            }
          }
          row.push(entry.trim().replace(/^["']|["']$/g, ''));
          return row;
        };

        for (const line of lines) {
          const parts = parseCsvLine(line);
          // Handle both 10-column (with condition) and 9-column (without condition) CSVs
          let name, category, condition = 'new', buying_uom, selling_uom, conversion_factor, cost_price, selling_price, stock_quantity;
          if (parts.length >= 10) {
            [, name, category, condition, buying_uom, selling_uom, conversion_factor, cost_price, selling_price, stock_quantity] = parts;
          } else if (parts.length >= 9) {
            [, name, category, buying_uom, selling_uom, conversion_factor, cost_price, selling_price, stock_quantity] = parts;
          } else {
            continue;
          }
          if (!name) continue;

          productsToInsert.push({
            name,
            category: category || 'General',
            condition: condition?.toLowerCase() === 'used' ? 'used' : 'new',
            buying_uom: buying_uom || 'Piece',
            selling_uom: selling_uom || 'Piece',
            conversion_factor: parseFloat(conversion_factor) || 1,
            cost_price: parseFloat(cost_price) || 0,
            selling_price: parseFloat(selling_price) || 0,
            stock_quantity: parseFloat(stock_quantity) || 0,
            created_at: new Date().toISOString()
          });
        }

        if (productsToInsert.length > 0) {
          for (const p of productsToInsert) {
            await createProduct(p);
          }
          success(`Imported ${productsToInsert.length} products`);
        } else {
          showError("No valid product rows found in CSV.");
        }
      } catch (err) {
        showError(`Import failed: ${err.message}`);
      } finally {
        setSaving(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const filtered = useMemo(() => {
    // Bolt Optimization: Single-pass filtering with pre-lowercased search query to eliminate redundant string allocations & lowercasing on every item
    const query = search.trim().toLowerCase();

    return products
      .filter(p => {
        if (categoryFilter !== 'All' && p.category !== categoryFilter) {
          return false;
        }
        if (!query) return true;
        return (
          p.name.toLowerCase().includes(query) ||
          (p.item_code && p.item_code.toLowerCase().includes(query))
        );
      })
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
      <div className="page-header-row">
        <h2 className="section-title">Product Inventory ({products.length} items)</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          <ActionButton disabled={saving} onClick={() => { 
            if (saving) return;
            const willShow = !showForm;
            setShowForm(willShow); 
            if (willShow && !editingId) {
              setForm({ ...emptyForm, category: industryPresetCategories[0] || 'General' });
              setNameError('');
            } else if (!willShow) {
              setForm({ ...emptyForm }); 
              setEditingId(null); 
              setNameError(''); 
            }
          }}>
            {showForm ? 'Cancel' : '+ Add Product'}
          </ActionButton>
          <ActionButton variant="secondary" onClick={handleExport} disabled={saving} className="desktop-only">Export CSV</ActionButton>
          <label 
            className="desktop-only" 
            style={{ 
              ...ActionButton({ variant: "success", children: "Import CSV" }).props, 
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              pointerEvents: saving ? 'none' : 'auto'
            }}
          >
            {saving ? 'Importing...' : 'Import CSV'} <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImport} disabled={saving} />
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
                <ActionButton variant="danger" size="sm" onClick={() => { if (!saving) clearDraft(); }} disabled={saving} className="desktop-only">Clear Form</ActionButton>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Label>Category</Label>
                    {industryInfo && (
                      <span style={{ fontSize: 11, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span>{industryInfo.icon}</span>
                        <span>{industryInfo.name}</span>
                      </span>
                    )}
                  </div>
                  <Select
                    value={availableCategories.includes(form.category) ? form.category : '__custom__'}
                    onChange={e => {
                      if (e.target.value === '__custom__') {
                        handleCategoryChange('');
                      } else {
                        handleCategoryChange(e.target.value);
                      }
                    }}
                    options={[
                      ...availableCategories.map(c => ({ value: c, label: c })),
                      { value: '__custom__', label: '➕ Custom Category...' }
                    ]}
                  />
                  {(!availableCategories.includes(form.category) || form.category === '') && (
                    <Input
                      style={{ marginTop: 8 }}
                      placeholder="Type custom category name..."
                      value={form.category}
                      onChange={e => handleCategoryChange(e.target.value)}
                      required
                    />
                  )}
                </div>
              </FieldGroup>

              {/* Product Condition Selection with Checkmarks */}
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
                <Label>Product Condition</Label>
                <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                  <label
                    onClick={() => setForm(f => ({ ...f, condition: 'new' }))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: `1.5px solid ${form.condition === 'new' ? '#10b981' : '#cbd5e1'}`,
                      background: form.condition === 'new' ? '#ecfdf5' : '#ffffff',
                      cursor: 'pointer',
                      fontWeight: form.condition === 'new' ? 700 : 500,
                      color: form.condition === 'new' ? '#065f46' : '#64748b',
                      fontSize: 13,
                      transition: 'all 0.15s ease',
                      userSelect: 'none'
                    }}
                  >
                    <input
                      type="radio"
                      name="product-condition"
                      value="new"
                      checked={form.condition === 'new'}
                      onChange={() => {}}
                      style={{ display: 'none' }}
                    />
                    <CheckCircle
                      size={18}
                      weight={form.condition === 'new' ? 'fill' : 'regular'}
                      color={form.condition === 'new' ? '#10b981' : '#94a3b8'}
                    />
                    <span>Brand New</span>
                  </label>

                  <label
                    onClick={() => setForm(f => ({ ...f, condition: 'used' }))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 16px',
                      borderRadius: 8,
                      border: `1.5px solid ${form.condition === 'used' ? '#f59e0b' : '#cbd5e1'}`,
                      background: form.condition === 'used' ? '#fffbeb' : '#ffffff',
                      cursor: 'pointer',
                      fontWeight: form.condition === 'used' ? 700 : 500,
                      color: form.condition === 'used' ? '#92400e' : '#64748b',
                      fontSize: 13,
                      transition: 'all 0.15s ease',
                      userSelect: 'none'
                    }}
                  >
                    <input
                      type="radio"
                      name="product-condition"
                      value="used"
                      checked={form.condition === 'used'}
                      onChange={() => {}}
                      style={{ display: 'none' }}
                    />
                    <CheckCircle
                      size={18}
                      weight={form.condition === 'used' ? 'fill' : 'regular'}
                      color={form.condition === 'used' ? '#f59e0b' : '#94a3b8'}
                    />
                    <span>Used / Second-hand</span>
                  </label>
                </div>
              </div>
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
                  <ActionButton 
                    type="submit" 
                    fullWidth 
                    disabled={saving}
                    loading={saving}
                  >
                    {saving ? (editingId ? 'Updating Product...' : 'Creating Product...') : (editingId ? 'Update Product' : 'Create Product')}
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
                options={[{ value: "All", label: "All Categories" }, ...availableCategories.map(c => ({ value: c, label: c }))]}
                style={{ paddingLeft: 30, width: 220 }}
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
                  <td style={{ fontWeight: 500 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{p.name}</span>
                      {p.condition === 'used' ? (
                        <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', padding: '1px 5px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase' }}>
                          Used
                        </span>
                      ) : (
                        <span style={{ fontSize: 10, background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', padding: '1px 5px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase' }}>
                          New
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ color: '#475569', fontSize: 13 }}>{p.category}</td>
                  <td style={{ fontWeight: 600 }}>{p.stock_quantity} {p.selling_uom}s</td>
                  <td>{p.selling_uom}</td>
                  {user?.role !== 'storekeeper' && <td>{formatCurrency(p.cost_price, currency)}</td>}
                  <td style={{ fontWeight: 600 }}>{formatCurrency(p.selling_price, currency)}</td>
                  {user?.role !== 'storekeeper' && (
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>
                      {formatCurrency(p.selling_price - p.cost_price, currency)}
                    </td>
                  )}
                  <td>
                    {p.stock_quantity <= 0 ? (
                      <span className="status-pill status-pill--danger">Out of Stock</span>
                    ) : p.stock_quantity < (p.low_stock_threshold || 10) ? (
                      <span className="status-pill status-pill--low">Low Stock</span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>In Stock</span>
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
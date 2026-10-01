import React, { useState, useEffect, useMemo } from "react";
import { formatCurrency, formatPhone } from "../../services/formatters";
import { supabase } from "../../services/supabaseClient";
import { Label, Input, Select, ActionButton, SectionHeader, CardSection, FieldGroup } from "../ui/FormFields";

const SalesForm = ({
  products,
  customers,
  onSave,
  onCancel,
  initialData = {},
  saving = false,
  orgTaxSettings = {}
}) => {
  const [customerId, setCustomerId] = useState(initialData.customerId || '');
  const [customerName, setCustomerName] = useState(initialData.customerName || 'Walk-in Customer');
  const [customerSearch, setCustomerSearch] = useState(initialData.customerId ? initialData.customerName : '');
  const [customerPhone, setCustomerPhone] = useState(initialData.customerPhone || '+233');
  const [customerEmail, setCustomerEmail] = useState(initialData.customerEmail || '');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [items, setItems] = useState(initialData.items || [{ product_id: '', product_name: '', quantity: 1, unit_price: 0 }]);
  const [amountPaid, setAmountPaid] = useState(initialData.amountPaid || '');
  const [paymentMethod, setPaymentMethod] = useState(initialData.paymentMethod || 'Cash');
  const [notes, setNotes] = useState(initialData.notes || '');
  const [isDeposit, setIsDeposit] = useState(initialData.isDeposit || false);
  // Use org default tax settings, fallback to initialData, then to sensible defaults
  const defaultTaxRate = orgTaxSettings.default_tax_rate ?? 20;
  const defaultTaxInclusive = orgTaxSettings.default_tax_inclusive ?? true;
  const [taxPercentage, setTaxPercentage] = useState(initialData.taxPercentage ?? defaultTaxRate);
  const [taxInclusive, setTaxInclusive] = useState(
    initialData.taxInclusive !== undefined ? initialData.taxInclusive : defaultTaxInclusive
  );
  const [customerCredit, setCustomerCredit] = useState(0);
  const [useCredit, setUseCredit] = useState(initialData.useCredit || '');

  // Build dynamic tax options based on org configuration
  const taxOptions = useMemo(() => {
    const options = [];
    const defaultRate = orgTaxSettings.default_tax_rate ?? 20;
    const isVatRegistered = orgTaxSettings.is_vat_registered ?? true;

    // Always include the organization's default tax rate as the first option
    if (defaultRate === 20) {
      options.push({ value: "20", label: "20% Unified (15% VAT + 2.5% NHIL + 2.5% GETFund)" });
    } else if (defaultRate === 15) {
      options.push({ value: "15", label: "15% Standard VAT Only" });
    } else if (defaultRate === 0) {
      options.push({ value: "0", label: "0% Exempt / Zero-Rated" });
    } else {
      options.push({ value: String(defaultRate), label: `${defaultRate}% Custom Rate` });
    }

    // Add other common options if they're different from default
    if (defaultRate !== 20 && isVatRegistered) {
      options.push({ value: "20", label: "20% Unified (15% VAT + 2.5% NHIL + 2.5% GETFund)" });
    }
    if (defaultRate !== 15) {
      options.push({ value: "15", label: "15% Standard VAT Only" });
    }
    if (defaultRate !== 0) {
      options.push({ value: "0", label: "0% Exempt / Zero-Rated" });
    }

    return options;
  }, [orgTaxSettings]);

  // --- Draft Persistence ---
  useEffect(() => {
    const draft = { customerId, customerName, customerPhone, customerEmail, items, amountPaid, paymentMethod, notes, isDeposit, taxPercentage, taxInclusive };
    localStorage.setItem("sales_draft", JSON.stringify(draft));
  }, [customerId, customerName, customerPhone, customerEmail, items, amountPaid, paymentMethod, notes, isDeposit, taxPercentage, taxInclusive]);

  const filteredCustomers = customerSearch.length > 0
    ? customers.filter(c => c.name?.toLowerCase().includes(customerSearch.toLowerCase()))
    : customers;

  const handleCustomerSelect = async (c) => {
    setCustomerId(c.id);
    setCustomerName(c.name);
    setCustomerSearch(c.name);
    setCustomerPhone(c.phone || '+233');
    setCustomerEmail(c.email || '');
    setShowCustomerSuggestions(false);

    // Fetch customer credit balance
    const { data } = await supabase.from('deposits').select('total_balance').eq('customer_id', c.id).single();
    if (data && data.total_balance < 0) {
      setCustomerCredit(Math.abs(data.total_balance));
    } else {
      setCustomerCredit(0);
    }
  };

  const handleCustomerInputChange = (e) => {
    const val = e.target.value;
    setCustomerSearch(val);
    setCustomerName(val || 'Walk-in Customer');
    setCustomerId('');
    setCustomerPhone('+233');
    setCustomerEmail('');
    setShowCustomerSuggestions(true);
  };

  const total = Math.round(items.reduce((a, i) => a + (Number(i.quantity || 0) * Number(i.unit_price || 0)), 0) * 100) / 100;
  const taxAmount = taxPercentage > 0
    ? (taxInclusive
        ? Math.round((total - (total / (1 + (taxPercentage / 100)))) * 100) / 100
        : Math.round((total * (taxPercentage / 100)) * 100) / 100)
    : 0;
  const grandTotal = taxInclusive ? total : Math.round((total + taxAmount) * 100) / 100;
  const balance = Math.round((grandTotal - (parseFloat(amountPaid) || 0) - (parseFloat(useCredit) || 0)) * 100) / 100;

  const handleSubmit = (e) => {
    if (e) e.preventDefault();

    let finalAmountPaid = parseFloat(amountPaid) || 0;
    let finalNotes = notes;

    if (!isDeposit && finalAmountPaid > grandTotal) {
      const change = Math.round((finalAmountPaid - grandTotal) * 100) / 100;
      finalAmountPaid = grandTotal;
      finalNotes = `${finalNotes ? finalNotes + ' | ' : ''}Change given: GHS ${change.toFixed(2)}`;
    }

    onSave({
      customerId, customerName, customerPhone, customerEmail, items,
      amountPaid: finalAmountPaid.toString(),
      paymentMethod, notes: finalNotes, isDeposit, taxPercentage, taxInclusive, useCredit, total, grandTotal,
      balance: isDeposit ? balance : Math.max(0, balance)
    });
  };

  return (
    <div style={{ padding: 0 }}>
      {/* SECTION 1: CUSTOMER & NOTES */}
      <CardSection>
        <SectionHeader number="01">Customer Information</SectionHeader>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 20 }}>
          <div style={{ position: 'relative' }}>
            <Label required>Select Customer</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Input
                  value={customerSearch}
                  onChange={handleCustomerInputChange}
                  onFocus={() => setShowCustomerSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
                  placeholder="Search existing or type new name..."
                  style={{ border: customerId ? '1.5px solid #3b82f6' : '1px solid #ddd' }}
                />
                {showCustomerSuggestions && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0,
                    background: '#fff', border: '1px solid #ddd', borderRadius: 8,
                    zIndex: 100, maxHeight: 200, overflowY: 'auto',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', marginTop: 4
                  }}>
                    <div
                      onMouseDown={() => { setCustomerId(''); setCustomerName('Walk-in Customer'); setCustomerSearch(''); setCustomerPhone('+233'); setCustomerEmail(''); }}
                      style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1.5px solid #e5e7eb', fontWeight: 700, color: '#f97316', background: '#fff7ed' }}
                    >
                      👤 Generic Walk-in Customer (Default)
                    </div>
                    {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                      <div key={c.id} onMouseDown={() => handleCustomerSelect(c)}
                        style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={e => e.target.style.background = '#f3f4f6'}
                        onMouseLeave={e => e.target.style.background = '#fff'}
                      >
                        <span style={{ fontWeight: 600 }}>{c.name}</span> {c.phone ? `— ${c.phone}` : ''}
                      </div>
                    )) : (
                      <div style={{ padding: '12px', textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
                        No matching customers
                      </div>
                    )}
                  </div>
                )}
              </div>
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={() => { setCustomerId(''); setCustomerName('Walk-in Customer'); setCustomerSearch(''); setCustomerPhone('+233'); setCustomerEmail(''); }}
              >
                Reset
              </ActionButton>
            </div>
          </div>
          <div>
            <Label>Customer Phone</Label>
            <Input
              value={customerPhone}
              onChange={e => setCustomerPhone(formatPhone(e.target.value))}
              placeholder="+233XXXXXXXXX"
            />
          </div>
          <div>
            <Label>Customer Email</Label>
            <Input
              type="email"
              value={customerEmail}
              onChange={e => setCustomerEmail(e.target.value)}
              placeholder="customer@email.com"
            />
          </div>
          <div style={{ gridColumn: '1 / span 3' }}>
            <Label>Internal Sale Notes</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. For delivery / special packaging..." />
            <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: customerId ? '#3b82f6' : '#6b7280' }}>
              Active: <span style={{ color: '#111827' }}>{customerName}</span> {customerId && ' (Linked Account)'}
            </div>
          </div>
        </div>
      </CardSection>

      {/* SECTION 2: ITEMS */}
      <CardSection>
        <SectionHeader number="02">Items Selection</SectionHeader>
        <table className="stock-table" style={{ marginBottom: 16 }}>
          <thead>
            <tr>
              <th>Product</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx}>
                <td style={{ position: 'relative' }}>
                  <div style={{ position: 'relative' }}>
                    <Input
                      placeholder="Search code or name..."
                      value={item.product_id ? (products.find(p => p.id === parseInt(item.product_id) || p.id === item.product_id)?.name || '') : item.searchQuery || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx].searchQuery = e.target.value;
                        newItems[idx].product_id = '';
                        setItems(newItems);
                      }}
                      onFocus={() => {
                        const newItems = [...items];
                        newItems[idx].showDropdown = true;
                        setItems(newItems);
                      }}
                      style={{ minWidth: 250 }}
                    />
                    {item.showDropdown && (
                      <div className="search-dropdown" style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                        background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', marginTop: 4,
                        maxHeight: 250, overflowY: 'auto'
                      }}>
                        {products.filter(p =>
                          !item.searchQuery ||
                          (p.name?.toLowerCase() || '').includes(item.searchQuery.toLowerCase()) ||
                          (p.item_code?.toLowerCase() || '').includes(item.searchQuery.toLowerCase())
                        ).length === 0 ? (
                          <div style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
                            ⚠️ Product not found
                          </div>
                        ) : (
                          products.filter(p =>
                            !item.searchQuery ||
                            (p.name?.toLowerCase() || '').includes(item.searchQuery.toLowerCase()) ||
                            (p.item_code?.toLowerCase() || '').includes(item.searchQuery.toLowerCase())
                          ).map(p => (
                            <div
                              key={p.id}
                              style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6', transition: 'background 0.2s' }}
                              className="search-item"
                              onClick={() => {
                                const newItems = [...items];
                                newItems[idx].product_id = p.id;
                                newItems[idx].product_name = p.name;
                                newItems[idx].unit_price = p.selling_price;
                                newItems[idx].showDropdown = false;
                                newItems[idx].searchQuery = p.name;
                                setItems(newItems);
                              }}
                            >
                              <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{p.name}</div>
                              <div style={{ fontSize: 11, color: '#6b7280' }}>
                                {p.item_code} • {p.stock_quantity} {p.selling_uom} available
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                    {item.showDropdown && <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => {
                      const newItems = [...items];
                      newItems[idx].showDropdown = false;
                      setItems(newItems);
                    }} />}
                  </div>
                </td>
                <td>
                  <Input type="number" min="1" value={item.quantity} onChange={e => {
                    const newItems = [...items];
                    newItems[idx].quantity = parseFloat(e.target.value) || 0;
                    setItems(newItems);
                  }} style={{ width: 80 }} />
                </td>
                <td>
                  <Input type="number" step="0.01" value={item.unit_price} onChange={e => {
                    const newItems = [...items];
                    newItems[idx].unit_price = parseFloat(e.target.value) || 0;
                    setItems(newItems);
                  }} style={{ width: 100 }} />
                </td>
                <td style={{ fontWeight: 600 }}>GHS {formatCurrency(item.quantity * item.unit_price)}</td>
                <td>
                  <ActionButton variant="ghost" size="sm" onClick={() => setItems(items.filter((_, i) => i !== idx))} style={{ color: '#ef4444' }} aria-label="Remove item">
                    ✕
                  </ActionButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ActionButton variant="secondary" size="sm" onClick={() => setItems([...items, { product_id: '', product_name: '', quantity: 1, unit_price: 0 }])}>
          + Add Item Row
        </ActionButton>
      </CardSection>

      {/* SECTION 3: TOTALS & PAYMENT */}
      <CardSection>
        <SectionHeader number="03">Totals & Payment</SectionHeader>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '0 0 20px', padding: '12px 16px', background: isDeposit ? '#ecfdf5' : '#eff6ff', borderRadius: 10, border: `1.5px solid ${isDeposit ? '#10b981' : '#3b82f6'}` }}>
          <ActionButton
            variant={isDeposit ? 'success' : 'info'}
            size="sm"
            onClick={() => setIsDeposit(!isDeposit)}
          >
            {isDeposit ? '✓ Marked as Deposit' : '📥 Mark as Deposit'}
          </ActionButton>
          <span style={{ fontSize: 12, color: isDeposit ? '#065f46' : '#1e40af' }}>
            {isDeposit ? 'Payment held as advance deposit. Items stay in stock reservation.' : 'Toggle this if customer is paying in advance.'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: 20, padding: 20, background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
          <div>
            <Label>Tax Options</Label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Select
                value={taxPercentage}
                onChange={e => setTaxPercentage(parseFloat(e.target.value))}
                options={taxOptions}
                style={{ padding: '6px' }}
              />
              <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={taxInclusive} onChange={e => setTaxInclusive(e.target.checked)} /> Inclusive
              </label>
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
              Tax: GHS {formatCurrency(taxAmount)}
              {taxPercentage === 20 && (
                <span style={{ display: 'block', fontSize: '10px', color: '#059669', fontWeight: 600, marginTop: 2 }}>
                  🇬🇭 15% VAT • 2.5% NHIL • 2.5% GETFund
                </span>
              )}
              {taxPercentage === 15 && (
                <span style={{ display: 'block', fontSize: '10px', color: '#059669', fontWeight: 600, marginTop: 2 }}>
                  🇬🇭 15% Standard VAT Only
                </span>
              )}
              {taxPercentage === 0 && (
                <span style={{ display: 'block', fontSize: '10px', color: '#6b7280', fontWeight: 600, marginTop: 2 }}>
                  🇬🇭 0% Exempt / Zero-Rated
                </span>
              )}
            </div>
          </div>
          <div>
            <Label>Grand Total</Label>
            <p style={{ fontSize: 24, fontWeight: 800, color: '#111827' }}>GHS {formatCurrency(grandTotal)}</p>
          </div>
          <div>
            <Label required>{isDeposit ? 'Deposit Amt' : 'Paid Amt'}</Label>
            <Input
              type="number"
              step="0.01"
              value={amountPaid}
              onChange={e => setAmountPaid(e.target.value)}
              style={{ fontSize: 16, fontWeight: 700, border: '2px solid #3b82f6' }}
            />
          </div>
          <div>
            <Label>Pay Method</Label>
            <Select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              options={[
                { value: "Cash", label: "💵 Cash" },
                { value: "Momo", label: "📱 Momo" },
                { value: "Bank", label: "🏦 Bank" }
              ]}
              style={{ fontWeight: 600 }}
            />
          </div>
        </div>

        {customerCredit > 0 && (
          <div style={{ marginTop: 16, padding: 16, background: '#f0fdf4', borderRadius: 12, border: '1.5px dashed #22c55e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>🎁 Available Customer Credit: GHS {formatCurrency(customerCredit)}</span>
              <p style={{ fontSize: 11, color: '#15803d', margin: '4px 0 0' }}>This customer has overpaid in the past. You can apply this to the current sale.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Apply Credit: </label>
              <Input
                type="number"
                step="0.01"
                value={useCredit}
                onChange={e => setUseCredit(e.target.value)}
                style={{ width: 100, border: '1.5px solid #22c55e' }}
              />
              <ActionButton
                variant="success"
                size="sm"
                onClick={() => setUseCredit(Math.min(customerCredit, grandTotal))}
              >
                Max
              </ActionButton>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
          <div style={{ display: 'flex', gap: 20 }}>
            <div>
              <Label>Subtotal</Label>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>GHS {formatCurrency(total)}</p>
            </div>
            <div>
              <Label>{isDeposit ? 'Balance on Delivery' : (balance < 0 ? 'Change' : 'Balance Due')}</Label>
              <p style={{ fontSize: 15, fontWeight: 700, color: balance > 0 ? (isDeposit ? '#f59e0b' : '#ef4444') : '#059669' }}>
                GHS {formatCurrency(Math.abs(balance))}
              </p>
            </div>
          </div>
          <ActionButton
            variant={isDeposit ? 'success' : 'primary'}
            fullWidth
            onClick={handleSubmit}
            disabled={saving}
            style={{ width: 280, height: 50, fontSize: 16 }}
          >
            {isDeposit ? '📥 Record Deposit' : 'Confirm & Complete Sale'}
          </ActionButton>
        </div>
      </CardSection>
    </div>
  );
};

export default SalesForm;
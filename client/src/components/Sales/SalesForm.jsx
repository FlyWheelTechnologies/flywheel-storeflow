import React, { useState, useEffect } from "react";
import { formatCurrency, formatPhone } from "../../services/formatters";
import { supabase } from "../../services/supabaseClient";

const lbl = { display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 };
const secH = { fontSize:13, fontWeight:800, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'1px', marginBottom:16 };
const inp = { width:'100%', padding:8, borderRadius:6, border:'1px solid #ddd', fontSize:13, outline: 'none' };

const SalesForm = ({
  products,
  customers,
  onSave,
  onCancel,
  initialData = {},
  saving = false
}) => {
  const [customerId, setCustomerId] = useState(initialData.customerId || '');
  const [customerName, setCustomerName] = useState(initialData.customerName || 'Walk-in Customer');
  const [customerSearch, setCustomerSearch] = useState(initialData.customerId ? initialData.customerName : '');
  const [customerPhone, setCustomerPhone] = useState(initialData.customerPhone || '+233');
  const [customerEmail, setCustomerEmail] = useState(initialData.customerEmail || '');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [items, setItems] = useState(initialData.items || [{ product_id:'', product_name:'', quantity:1, unit_price:0 }]);
  const [amountPaid, setAmountPaid] = useState(initialData.amountPaid || '');
  const [paymentMethod, setPaymentMethod] = useState(initialData.paymentMethod || 'Cash');
  const [notes, setNotes] = useState(initialData.notes || '');
  const [isDeposit, setIsDeposit] = useState(initialData.isDeposit || false);
  const [taxPercentage, setTaxPercentage] = useState(initialData.taxPercentage || 20);
  const [taxInclusive, setTaxInclusive] = useState(initialData.taxInclusive !== undefined ? initialData.taxInclusive : true);
  const [customerCredit, setCustomerCredit] = useState(0);
  const [useCredit, setUseCredit] = useState(initialData.useCredit || '');

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

  const total = items.reduce((a, i) => a + (i.quantity * i.unit_price), 0);
  const taxAmount = taxInclusive
    ? total - (total / (1 + (taxPercentage / 100)))
    : total * (taxPercentage / 100);
  const grandTotal = taxInclusive ? total : total + taxAmount;
  const balance = grandTotal - (parseFloat(amountPaid) || 0) - (parseFloat(useCredit) || 0);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    
    let finalAmountPaid = parseFloat(amountPaid) || 0;
    let finalNotes = notes;
    
    if (!isDeposit && finalAmountPaid > grandTotal) {
      const change = finalAmountPaid - grandTotal;
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
    <div style={{ padding:0 }}>
      {/* SECTION 1: CUSTOMER & NOTES */}
      <div style={{ padding: 20, borderBottom: '1px solid #f3f4f6' }}>
        <h4 style={secH}>01. Customer Information</h4>
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:20 }}>
          <div style={{ position: 'relative' }}>
            <label style={lbl}>Select Customer *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  style={{ ...inp, border: customerId ? '1.5px solid #3b82f6' : '1px solid #ddd' }}
                  value={customerSearch}
                  onChange={handleCustomerInputChange}
                  onFocus={() => setShowCustomerSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
                  placeholder="Search existing or type new name..."
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
                {showCustomerSuggestions && (
                  <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1px solid #ddd', borderRadius:8, zIndex:100, maxHeight:200, overflowY:'auto', boxShadow:'0 10px 15px -3px rgba(0,0,0,0.1)', marginTop:4 }}>
                    <div
                      onMouseDown={() => { setCustomerId(''); setCustomerName('Walk-in Customer'); setCustomerSearch(''); setCustomerPhone('+233'); setCustomerEmail(''); }}
                      style={{ padding:'10px 12px', cursor:'pointer', fontSize:13, borderBottom:'1.5px solid #e5e7eb', fontWeight:700, color:'#f97316', background: '#fff7ed' }}
                    >
                      👤 Generic Walk-in Customer (Default)
                    </div>
                    {filteredCustomers.length > 0 ? filteredCustomers.map(c => (
                      <div key={c.id} onMouseDown={() => handleCustomerSelect(c)}
                        style={{ padding:'10px 12px', cursor:'pointer', fontSize:13, borderBottom:'1px solid #f3f4f6' }}
                        onMouseEnter={e => e.target.style.background='#f3f4f6'}
                        onMouseLeave={e => e.target.style.background='#fff'}
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
              <button
                type="button"
                onClick={() => { setCustomerId(''); setCustomerName('Walk-in Customer'); setCustomerSearch(''); setCustomerPhone('+233'); setCustomerEmail(''); }}
                style={{ background:'#f3f4f6', border:'none', borderRadius:8, padding:'0 12px', cursor:'pointer', color:'#6b7280', fontSize:12, fontWeight:600 }}
              >
                Reset
              </button>
            </div>
          </div>
          <div>
            <label style={lbl}>Customer Phone</label>
            <input
              style={inp}
              value={customerPhone}
              onChange={e => setCustomerPhone(formatPhone(e.target.value))}
              placeholder="+233XXXXXXXXX"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div>
            <label style={lbl}>Customer Email</label>
            <input
              style={inp}
              value={customerEmail}
              onChange={e => setCustomerEmail(e.target.value)}
              placeholder="customer@email.com"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <div style={{ gridColumn: '1 / span 3' }}>
            <label style={lbl}>Internal Sale Notes</label>
            <input style={inp} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. For delivery / special packaging..." onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
            <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: customerId ? '#3b82f6' : '#6b7280' }}>
              Active: <span style={{ color: '#111827' }}>{customerName}</span> {customerId && ' (Linked Account)'}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: ITEMS */}
      <div style={{ padding: 20, borderBottom: '1px solid #f3f4f6' }}>
        <h4 style={secH}>02. Items Selection</h4>
        <table className="stock-table" style={{ marginBottom:16 }}>
          <thead><tr><th>Product</th><th>Qty</th><th>Unit Price (GHS)</th><th>Subtotal</th><th></th></tr></thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx}>
                <td style={{ position: 'relative' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      style={{...inp, minWidth:250}}
                      placeholder="Search code or name..."
                      value={item.product_id ? (products.find(p => p.id === parseInt(item.product_id) || p.id === item.product_id)?.name || '') : item.searchQuery || ''}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[idx].searchQuery = e.target.value;
                        newItems[idx].product_id = ''; // Clear selected if typing
                        setItems(newItems);
                      }}
                      onFocus={() => {
                        const newItems = [...items];
                        newItems[idx].showDropdown = true;
                        setItems(newItems);
                      }}
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
                  </div>
                  {item.showDropdown && <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => {
                    const newItems = [...items];
                    newItems[idx].showDropdown = false;
                    setItems(newItems);
                  }} />}
                </td>
                <td><input style={{...inp, width:80}} type="number" min="1" value={item.quantity} onChange={e => {
                  const newItems = [...items];
                  newItems[idx].quantity = parseFloat(e.target.value)||0;
                  setItems(newItems);
                }} /></td>
                <td><input style={{...inp, width:100}} type="number" step="0.01" value={item.unit_price} onChange={e => {
                  const newItems = [...items];
                  newItems[idx].unit_price = parseFloat(e.target.value)||0;
                  setItems(newItems);
                }} /></td>
                <td style={{fontWeight:600}}>GHS {formatCurrency(item.quantity * item.unit_price)}</td>
                <td><button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} style={{background:'#f3f4f6', color:'#ef4444', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer'}}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" onClick={() => setItems([...items, { product_id:'', product_name:'', quantity:1, unit_price:0 }])} style={{background:'#f3f4f6', border:'1px solid #ddd', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontSize:13}}>+ Add Item Row</button>
      </div>

      {/* SECTION 3: TOTALS & PAYMENT */}
      <div style={{ padding: 20 }}>
        <h4 style={secH}>03. Totals & Payment</h4>

        <div style={{ display:'flex', alignItems:'center', gap:12, margin:'0 0 20px', padding:'12px 16px', background: isDeposit ? '#ecfdf5' : '#eff6ff', borderRadius:10, border: `1.5px solid ${isDeposit ? '#10b981' : '#3b82f6'}` }}>
          <button type="button" onClick={() => setIsDeposit(!isDeposit)} style={{ background: isDeposit ? '#10b981' : '#3b82f6', color:'#fff', border:'none', borderRadius:20, padding:'6px 18px', fontWeight:700, cursor:'pointer', fontSize:13 }}>
            {isDeposit ? '✓ Marked as Deposit' : '📥 Mark as Deposit'}
          </button>
          <span style={{ fontSize:12, color: isDeposit ? '#065f46' : '#1e40af' }}>{isDeposit ? 'Payment held as advance deposit. Items stay in stock reservation.' : 'Toggle this if customer is paying in advance.'}</span>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr 1fr 1fr', gap:20, padding:20, background:'#f9fafb', borderRadius:12, border: '1px solid #e5e7eb' }}>
          <div>
            <label style={lbl}>Tax Options</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <select style={{ ...inp, padding: '6px' }} value={taxPercentage} onChange={e => setTaxPercentage(parseFloat(e.target.value))}>
                <option value="20">20% Unified (VAT+NHIL+GET)</option>
                <option value="15">15% VAT Only</option>
                <option value="12.5">12.5% Flat Rate</option>
                <option value="0">0% Exempt</option>
              </select>
              <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: 4, whiteSpace:'nowrap' }}>
                <input type="checkbox" checked={taxInclusive} onChange={e => setTaxInclusive(e.target.checked)} /> Inclusive
              </label>
            </div>
            <div style={{fontSize:11, color:'#6b7280', marginTop:6}}>Tax: GHS {formatCurrency(taxAmount)}</div>
          </div>
          <div>
            <label style={lbl}>Grand Total</label>
            <p style={{fontSize:24, fontWeight:800, color: '#111827'}}>GHS {formatCurrency(grandTotal)}</p>
          </div>
          <div>
            <label style={lbl}>{isDeposit ? 'Deposit Amt' : 'Paid Amt'} *</label>
            <input style={{...inp, fontSize:16, fontWeight:700, border: '2px solid #3b82f6'}} type="number" step="0.01" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>
          <div>
            <label style={lbl}>Pay Method</label>
            <select style={{...inp, fontWeight:600}} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              <option value="Cash">💵 Cash</option>
              <option value="Momo">📱 Momo</option>
              <option value="Bank">🏦 Bank</option>
            </select>
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
              <input
                type="number"
                step="0.01"
                style={{ ...inp, width: 100, border: '1.5px solid #22c55e' }}
                value={useCredit}
                onChange={e => setUseCredit(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setUseCredit(Math.min(customerCredit, grandTotal))}
                style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                Max
              </button>
            </div>
          </div>
        )}

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:20 }}>
          <div style={{ display:'flex', gap: 20 }}>
            <div>
              <label style={lbl}>Subtotal</label>
              <p style={{fontSize:15, fontWeight:600, color:'#6b7280'}}>GHS {formatCurrency(total)}</p>
            </div>
            <div>
              <label style={lbl}>{isDeposit ? 'Balance on Delivery' : (balance < 0 ? 'Change' : 'Balance Due')}</label>
              <p style={{fontSize:15, fontWeight:700, color: balance > 0 ? (isDeposit ? '#f59e0b' : '#ef4444') : '#059669'}}>GHS {formatCurrency(Math.abs(balance))}</p>
            </div>
          </div>
          <button type="button" onClick={handleSubmit} className="quick-action-btn" style={{ width:'280px', height:'50px', fontSize:16, background: isDeposit ? '#10b981' : undefined }}>
            {isDeposit ? '📥 Record Deposit' : 'Confirm & Complete Sale'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesForm;

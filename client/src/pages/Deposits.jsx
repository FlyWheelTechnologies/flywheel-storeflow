import React, { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import ConfirmationModal from "../components/ConfirmationModal";
import "./Dashboard.css";
import { formatCurrency, formatPhone } from "../services/formatters";

export default function Deposits() {
  const location = useLocation();
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [fulfilling, setFulfilling] = useState(false);
  const [toast, setToast] = useState(null);
  
  // Search & Sort & Pagination
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [itemsToShow, setItemsToShow] = useState(25);
  
  // Record Deposit Modal State
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depCustName, setDepCustName] = useState('');
  const [depCustPhone, setDepCustPhone] = useState('+233');
  const [depAmount, setDepAmount] = useState('');
  const [depMethod, setDepMethod] = useState('Cash');
  const [depSaving, setDepSaving] = useState(false);

  // Fulfillment Modal State
  const [showFulfillModal, setShowFulfillModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [items, setItems] = useState([{ product_id: '', product_name: '', quantity: 1, unit_price: 0 }]);
  
  // Confirmation Modal State
  const [showConfirm, setShowConfirm] = useState(false);
  const [saleToFulfill, setSaleToFulfill] = useState(null);

  useEffect(() => { 
    fetchDeposits(); 
    if (location.state?.showForm) {
      setShowDepositModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const fetchDeposits = async () => {
    const [depRes, prodRes] = await Promise.all([
      supabase.from("deposits").select("*"),
      supabase.from("products").select("*")
    ]);
    if (depRes.data) setDeposits(depRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    setTimeout(() => setLoading(false), 1000);
  };

  const toggleOrders = async (cid) => {
    if (expandedCustomerId === cid) {
      setExpandedCustomerId(null);
      setCustomerOrders([]);
      return;
    }
    setExpandedCustomerId(cid);
    const { data } = await supabase
      .from('sales')
      .select('*')
      .eq('customer_id', cid)
      .or('payment_status.eq.DEPOSIT,notes.ilike.%Pure Deposit%,total_amount.eq.0,balance_due.lt.0')
      .not('notes', 'ilike', '%(Fulfilled)%') 
      .order('created_at', { ascending: false });
    setCustomerOrders(data || []);
  };

  const handlePureDeposit = async () => {
    if (!depCustName || !depAmount) {
      setToast({ message: "Please enter name and amount", type: "error" });
      return;
    }
    setDepSaving(true);
    // Prevent JWT expired error by proactively refreshing session if dormant
    await supabase.auth.getSession();
    try {
      const { error } = await supabase.rpc('record_pure_deposit', {
        p_customer_name: depCustName,
        p_customer_phone: depCustPhone,
        p_amount: parseFloat(depAmount),
        p_payment_method: depMethod,
        p_recorded_by: JSON.parse(localStorage.getItem("user"))?.email || 'System'
      });
      if (error) throw error;
      
      setToast({ message: "Deposit recorded successfully!", type: "success" });
      setShowDepositModal(false);
      setDepCustName(''); setDepAmount(''); setDepCustPhone('+233');
      fetchDeposits();
    } catch (err) {
      setToast({ message: err.message, type: "error" });
    } finally {
      setDepSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleFulfillClick = (sale) => {
    if (sale.total_amount === 0) {
      // Pure Deposit - Need items selection
      setSelectedSale(sale);
      setItems([{ product_id: '', product_name: '', quantity: 1, unit_price: 0 }]);
      setShowFulfillModal(true);
    } else {
      // Regular Deposit - Just confirmation
      setSaleToFulfill(sale.id);
      setShowConfirm(true);
    }
  };

  const executeFulfillment = async () => {
    setFulfilling(true);
    // Prevent JWT expired error by proactively refreshing session if dormant
    await supabase.auth.getSession();
    const { error } = await supabase.rpc('fulfill_sale', { p_sale_id: saleToFulfill });
    if (error) {
      setToast({ message: "Error: " + error.message, type: "error" });
    } else {
      setToast({ message: "Order marked as fulfilled!", type: "success" });
      setCustomerOrders(prev => prev.filter(o => o.id !== saleToFulfill));
      fetchDeposits();
    }
    setShowConfirm(false);
    setFulfilling(false);
    setTimeout(() => setToast(null), 4000);
  };

  const handlePureFulfillment = async () => {
    if (items.length === 0 || !items[0].product_id) {
      setToast({ message: "Please add at least one product.", type: "error" });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    
    setFulfilling(true);
    // Prevent JWT expired error by proactively refreshing session if dormant
    await supabase.auth.getSession();
    try {
      const validItems = items.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: parseFloat(i.quantity),
        unit_price: parseFloat(i.unit_price),
        subtotal: parseFloat(i.quantity) * parseFloat(i.unit_price)
      }));

      const { error } = await supabase.rpc('fulfill_pure_deposit', {
        p_sale_id: selectedSale.id,
        p_items: validItems
      });

      if (error) throw error;

      setToast({ message: "Deposit fulfilled and items deducted!", type: "success" });
      setShowFulfillModal(false);
      setCustomerOrders(prev => prev.filter(o => o.id !== selectedSale.id));
      fetchDeposits();
    } catch (err) {
      setToast({ message: "Error: " + err.message, type: "error" });
    } finally {
      setFulfilling(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const filtered = useMemo(() => {
    return deposits
      .filter(d => {
        const matchesSearch = d.customer_name?.toLowerCase().includes(search.toLowerCase()) || d.phone?.includes(search);
        const hasBalanceOrPending = (d.total_balance || 0) !== 0 || (d.pending_sales_count || 0) > 0;
        return matchesSearch && hasBalanceOrPending;
      })
      .sort((a, b) => {
        if (sortBy === 'latest') return new Date(b.last_sale_date) - new Date(a.last_sale_date);
        if (sortBy === 'oldest') return new Date(a.last_sale_date) - new Date(b.last_sale_date);
        if (sortBy === 'credit_high') return a.total_balance - b.total_balance;
        if (sortBy === 'debt_high') return b.total_balance - a.total_balance;
        if (sortBy === 'name_az') return a.customer_name.localeCompare(b.customer_name);
        return new Date(b.last_sale_date) - new Date(a.last_sale_date);
      });
  }, [deposits, search, sortBy]);

  const paginated = useMemo(() => filtered.slice(0, itemsToShow), [filtered, itemsToShow]);

  const { totalHeld, totalOwed } = useMemo(() => {
    const held = deposits.reduce((a, d) => a + ((d.total_balance || 0) < 0 ? Math.abs(d.total_balance || 0) : 0), 0);
    const owed = deposits.reduce((a, d) => a + ((d.total_balance || 0) > 0 ? (d.total_balance || 0) : 0), 0);
    return { totalHeld: held, totalOwed: owed };
  }, [deposits]);

  if (loading) {
    return (
      <div className="deposits-container" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div className="skeleton" style={{ width: 300, height: 40 }} />
          <div className="skeleton" style={{ width: 250, height: 45 }} />
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="skeleton" style={{ height: 50, marginBottom: 12, width: '100%' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h2 className="section-title">Advance Deposits & Credit</h2>
          <p style={{ fontSize: '12.5px', color: '#6b7280' }}>Track customer prepayments (Credit) and outstanding balances (Debt)</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button 
            className="quick-action-btn" 
            onClick={() => setShowDepositModal(true)}
            style={{ width: 'auto', background: '#3b82f6', padding: '10px 20px' }}
          >
            💰 Record Deposit
          </button>
          <div className="summary-card" style={{ padding:'10px 20px', width: 'auto', background: '#ecfdf5', borderColor: '#10b981' }}>
            <span style={{ fontSize:10, color:'#065f46', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Total Credit:</span>
            <span style={{ fontSize:18, fontWeight:700, color:'#059669' }}>GHS {formatCurrency(totalHeld)}</span>
          </div>
          <div className="summary-card" style={{ padding:'10px 20px', width: 'auto', background: '#fef2f2', borderColor: '#ef4444' }}>
            <span style={{ fontSize:10, color:'#991b1b', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Total Owed:</span>
            <span style={{ fontSize:18, fontWeight:700, color:'#b91c1c' }}>GHS {formatCurrency(totalOwed)}</span>
          </div>
        </div>
      </div>

      <div className="table-card" style={{ marginBottom: 20 }}>
        <div className="table-card__header" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 250 }}>
            <input 
              type="search" 
              className="table-search" 
              placeholder="Search by name or phone..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              style={{ paddingLeft: 36, width: '100%' }}
            />
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>🔍</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>Sort:</span>
            <select style={{ ...miniInp, width: 180 }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="latest">Latest Activity</option>
              <option value="oldest">Oldest Activity</option>
              <option value="credit_high">Highest Credit</option>
              <option value="debt_high">Highest Debt</option>
              <option value="name_az">Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-wrapper">
          <table className="stock-table">
            <thead><tr><th>Customer Name</th><th>Phone</th><th>Status</th><th>Last Action</th><th>Balance</th></tr></thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan="5" style={{textAlign:'center', padding:24}}>No customers matching filters. 📦</td></tr>
              ) : paginated.map(d => (
                <React.Fragment key={d.customer_id}>
                  <tr 
                    onClick={() => toggleOrders(d.customer_id)}
                    style={{ cursor: 'pointer', background: expandedCustomerId === d.customer_id ? '#f9fafb' : 'transparent' }}
                  >
                    <td style={{fontWeight:600}}>
                      <span style={{ marginRight: 8 }}>{expandedCustomerId === d.customer_id ? '▼' : '▶'}</span>
                      {d.customer_name}
                    </td>
                    <td>{d.phone || '—'}</td>
                    <td>
                      {d.pending_sales_count > 0 ? (
                        <span style={{background: '#eff6ff', color: '#2563eb', padding:'2px 8px', borderRadius:4, fontSize:11, fontWeight: 700}}>
                          {d.pending_sales_count} PENDING ORDERS
                        </span>
                      ) : (
                        <span style={{color: '#6b7280', fontSize: 11}}>No Pending Items</span>
                      )}
                    </td>
                    <td style={{fontSize:12, color:'#6b7280'}}>{d.last_sale_date ? new Date(d.last_sale_date).toLocaleDateString() : '—'}</td>
                    <td style={{fontWeight:700, color: (d.total_balance || 0) < 0 ? '#059669' : ((d.total_balance || 0) === 0 ? '#6b7280' : '#b91c1c')}}>
                      {(d.total_balance || 0) < 0 ? (
                        <span title="Customer has credit">GHS {formatCurrency(Math.abs(d.total_balance || 0))} (Credit)</span>
                      ) : ((d.total_balance || 0) === 0 ? (
                        <span title="No balance">GHS 0.00</span>
                      ) : (
                        <span title="Customer owes balance">GHS {formatCurrency(d.total_balance || 0)} (Due)</span>
                      ))}
                    </td>
                  </tr>
                  {expandedCustomerId === d.customer_id && (
                    <tr>
                      <td colSpan="5" style={{ padding: '0 24px 24px', background: '#f9fafb' }}>
                        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.05)' }}>
                          <h5 style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            📋 Pending Orders for {d.customer_name}
                          </h5>
                          {customerOrders.length === 0 ? (
                            <p style={{ fontSize: 12, color: '#6b7280' }}>No items awaiting fulfillment for this customer.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {customerOrders.map(order => (
                                <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{order.total_amount === 0 ? '💰 Pure Prepayment' : (order.invoice_no ? order.invoice_no : `Order #INV-${String(order.id).slice(-6)}`)}</div>
                                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                                      {new Date(order.created_at).toLocaleString()} • GHS {formatCurrency(parseFloat(order.total_amount === 0 ? order.amount_paid : order.total_amount) || 0)}
                                      {order.total_amount === 0 && <span style={{ marginLeft: 8, color: '#059669', fontWeight: 700 }}>(Credit Added)</span>}
                                    </div>
                                  </div>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleFulfillClick(order); }}
                                    disabled={fulfilling}
                                    style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                                    onMouseEnter={e => e.target.style.background = '#059669'}
                                    onMouseLeave={e => e.target.style.background = '#10b981'}
                                  >
                                    ✓ Mark as Fulfilled
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > itemsToShow && (
          <div style={{ padding: 20, textAlign: 'center', borderTop: '1px solid #f3f4f6' }}>
            <button 
              onClick={() => setItemsToShow(prev => prev + 25)}
              style={{ width: '100%', padding: '12px', background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 8, color: '#4b5563', fontWeight: 600, cursor: 'pointer' }}
            >
              See More Customers ↓
            </button>
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      {toast && (
        <div style={{ 
          position:'fixed', top:24, left:'50%', transform:'translateX(-50%)', 
          background: toast.type === 'success' ? '#064e3b' : '#7f1d1d', 
          color:'#fff', padding:'12px 24px', borderRadius:'12px', 
          boxShadow:'0 10px 15px -3px rgba(0,0,0,0.2)', zIndex:4000, 
          display:'flex', alignItems:'center', gap:10, animation:'slideDown 0.3s ease' 
        }}>
          <span style={{fontSize:18}}>{toast.type === 'success' ? '✅' : '⚠️'}</span>
          <span style={{fontWeight:600}}>{toast.message}</span>
          <style>{`
            @keyframes slideDown { 
              from { transform: translateX(-50%) translateY(-50px); opacity: 0; }
              to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* Pure Deposit Fulfillment Modal */}
      {showFulfillModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 20, width: 700, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>📦 Fulfill Prepayment Items</h2>
              <button onClick={() => setShowFulfillModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            
            <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 8, border: '1px solid #bbf7d0', marginBottom: 20, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
                💰 Total Paid: GHS {formatCurrency(parseFloat(selectedSale?.amount_paid || 0))}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
                🏦 Remaining Credit: GHS {formatCurrency(Math.abs(selectedSale?.balance_due || 0))}
              </span>
            </div>

            <table className="stock-table" style={{ marginBottom: 20 }}>
              <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Subtotal</th><th></th></tr></thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ position: 'relative' }}>
                      <div style={{ position: 'relative' }}>
                        <input
                          style={{ ...inp, width: '100%' }}
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
                                    {p.item_code} • {p.stock_quantity} in stock
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
                    <td><input type="number" style={{ width: 60, padding: 6 }} value={item.quantity} onChange={e => {
                      const newItems = [...items];
                      newItems[idx].quantity = e.target.value;
                      setItems(newItems);
                    }} /></td>
                    <td><input type="number" style={{ width: 100, padding: 6 }} value={item.unit_price} onChange={e => {
                      const newItems = [...items];
                      newItems[idx].unit_price = e.target.value;
                      setItems(newItems);
                    }} /></td>
                    <td style={{ fontWeight: 600 }}>GHS {formatCurrency(item.quantity * item.unit_price)}</td>
                    <td><button onClick={() => setItems(items.filter((_, i) => i !== idx))} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => setItems([...items, { product_id: '', product_name: '', quantity: 1, unit_price: 0 }])} style={{ background: '#f3f4f6', padding: '8px 16px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ Add Row</button>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Total Items: GHS {formatCurrency(items.reduce((a, i) => a + (i.quantity * i.unit_price), 0))}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: (items.reduce((a, i) => a + (i.quantity * i.unit_price), 0) - selectedSale?.amount_paid) > 0 ? '#ef4444' : '#059669' }}>
                  Balance Due: GHS {formatCurrency(Math.max(0, items.reduce((a, i) => a + (i.quantity * i.unit_price), 0) - selectedSale?.amount_paid))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              <button onClick={() => setShowFulfillModal(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button 
                onClick={handlePureFulfillment} 
                disabled={fulfilling}
                style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: fulfilling ? 0.7 : 1 }}
              >
                {fulfilling ? 'Processing...' : 'Complete Fulfillment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Deposit Modal */}
      {showDepositModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 20, width: 450, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800 }}>💰 Record New Deposit</h2>
              <button onClick={() => setShowDepositModal(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={lbl}>Customer Name</label>
                <input style={inp} value={depCustName} onChange={e => setDepCustName(e.target.value)} placeholder="Enter name..." />
              </div>
              <div>
                <label style={lbl}>Customer Phone (Optional)</label>
                <input 
                  style={inp} 
                  value={depCustPhone} 
                  onChange={e => setDepCustPhone(formatPhone(e.target.value))} 
                  placeholder="+233XXXXXXXXX" 
                />
              </div>
              <div>
                <label style={lbl}>Amount (GHS)</label>
                <input style={{...inp, fontSize: 18, fontWeight: 700}} type="number" value={depAmount} onChange={e => setDepAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label style={lbl}>Payment Method</label>
                <select style={inp} value={depMethod} onChange={e => setDepMethod(e.target.value)}>
                  <option value="Cash">Cash</option>
                  <option value="Momo">Momo</option>
                  <option value="Bank">Bank Transfer</option>
                </select>
              </div>
              <button 
                onClick={handlePureDeposit} 
                disabled={depSaving}
                style={{ marginTop: 10, padding: '14px', borderRadius: 12, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: depSaving ? 0.7 : 1 }}
              >
                {depSaving ? 'Saving...' : 'Record Deposit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal 
        show={showConfirm}
        title="Confirm Fulfillment"
        message="Are you sure you want to mark this order as fulfilled? This confirms items have been physically delivered to the customer."
        confirmText="Yes, Mark Fulfilled"
        onConfirm={executeFulfillment}
        onCancel={() => setShowConfirm(false)}
        type="primary"
        isLoading={fulfilling}
      />
    </div>
  );
}

const lbl = { display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 };
const inp = { width:'100%', padding:8, borderRadius:6, border:'1px solid #ddd', fontSize:13, outline: 'none' };
const miniInp = { padding:'6px 10px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:12, background:'#f9fafb', outline: 'none' };

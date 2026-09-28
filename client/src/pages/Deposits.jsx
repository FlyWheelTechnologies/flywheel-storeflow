import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  Coins,
  MagnifyingGlass,
  Package,
  CaretDown,
  CaretRight,
  ClipboardText,
  Check,
  X,
  Plus,
  HandCoins,
  Warning,
  CurrencyCircleDollar
} from "@phosphor-icons/react";
import { supabase } from "../services/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../hooks/useProducts";
import { useSales } from "../hooks/useSales";
import { useToast } from "../context/ToastContext";
import { useConfirmation } from "../hooks/useConfirmation";
import "./Dashboard.css";
import { formatCurrency, formatPhone } from "../services/formatters";
import { Label, Input, Select, ActionButton, SectionHeader, CardSection, FieldGroup } from "../components/ui/FormFields";
import { PageSkeleton } from "../components/LoadingStates";

export default function Deposits() {
  const { user, activeOrgId } = useAuth();
  const location = useLocation();
  const { success, error: showError } = useToast();
  const { modalState, confirm, handleConfirm, handleCancel, ConfirmationModal } = useConfirmation();
  const { products, loading: productsLoading, refetch: refetchProducts } = useProducts();
  const { sales, loading: salesLoading, refetch: refetchSales } = useSales();

  const [deposits, setDeposits] = useState([]);
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);

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
  const [fulfilling, setFulfilling] = useState(false);

  // Settle & Fulfill Modal State (for regular deposit orders)
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleSale, setSettleSale] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('Cash');

  // Search & Sort & Pagination
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('latest');
  const [itemsToShow, setItemsToShow] = useState(25);

  const loading = productsLoading || salesLoading;

  const fetchDeposits = useCallback(async () => {
    if (!activeOrgId) {
      setDeposits([]);
      return;
    }
    const [depRes] = await Promise.all([
      supabase.from("deposits").select("*").eq("organization_id", activeOrgId)
    ]);
    setDeposits(depRes.data || []);
    refetchProducts();
    refetchSales();
  }, [activeOrgId, refetchProducts, refetchSales]);

  useEffect(() => {
    fetchDeposits();
    if (location.state?.showForm) {
      setShowDepositModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, fetchDeposits]);

  const toggleOrders = useCallback(async (cid) => {
    if (expandedCustomerId === cid) {
      setExpandedCustomerId(null);
      setCustomerOrders([]);
      return;
    }
    setExpandedCustomerId(cid);
    if (!activeOrgId) {
      setCustomerOrders([]);
      return;
    }

    let ordersQ = supabase
      .from('sales')
      .select('*')
      .eq('organization_id', activeOrgId)
      .eq('customer_id', cid)
      .or('payment_status.eq.DEPOSIT,payment_status.eq.PARTIAL,payment_status.eq.UNPAID,notes.ilike.%Pure Deposit%,total_amount.eq.0,balance_due.lt.0,balance_due.gt.0')
      .not('notes', 'ilike', '%(Fulfilled)%');

    const { data } = await ordersQ.order('created_at', { ascending: false });
    setCustomerOrders(data || []);
  }, [expandedCustomerId, activeOrgId]);

  const handlePureDeposit = async (e) => {
    e.preventDefault();
    if (!depCustName || !depAmount) return showError("Please enter name and amount");
    setDepSaving(true);
    try {
      await supabase.auth.getSession();
      const { error } = await supabase.rpc('record_pure_deposit', {
        p_customer_name: depCustName,
        p_customer_phone: depCustPhone,
        p_amount: parseFloat(depAmount),
        p_payment_method: depMethod,
        p_recorded_by: user?.email || 'System',
        p_organization_id: activeOrgId || null
      });
      if (error) throw error;

      success("Deposit recorded successfully!");
      setShowDepositModal(false);
      setDepCustName(''); setDepAmount(''); setDepCustPhone('+233');
      fetchDeposits();
    } catch (err) {
      showError(err.message);
    } finally {
      setDepSaving(false);
    }
  };

  const handleFulfillClick = (sale) => {
    if (sale.total_amount === 0) {
      // Pure deposit: open item assignment modal
      setSelectedSale(sale);
      setItems([{ product_id: '', product_name: '', quantity: 1, unit_price: 0 }]);
      setShowFulfillModal(true);
    } else {
      // Regular deposit order: open settlement modal
      setSettleSale(sale);
      const outstanding = parseFloat(sale.balance_due || 0);
      setSettleAmount(outstanding > 0 ? outstanding.toFixed(2) : '');
      setSettleMethod('Cash');
      setShowSettleModal(true);
    }
  };

  const executeSettleAndFulfill = async () => {
    if (!settleSale) return;
    setFulfilling(true);
    try {
      await supabase.auth.getSession();
      const saleId = settleSale.id;
      const outstanding = parseFloat(settleSale.balance_due || 0);
      const additionalPayment = parseFloat(settleAmount) || 0;

      // If user is collecting additional payment, update the sale record first
      if (additionalPayment > 0 && outstanding > 0) {
        const newAmountPaid = parseFloat(settleSale.amount_paid || 0) + additionalPayment;
        const newBalance = Math.max(0, outstanding - additionalPayment);
        const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIAL';
        const paymentNote = `Additional payment: ${currency} ${additionalPayment.toFixed(2)} via ${settleMethod}`;

        const { error: updateErr } = await supabase
          .from('sales')
          .update({
            amount_paid: newAmountPaid,
            balance_due: newBalance,
            payment_status: newStatus,
            notes: settleSale.notes
              ? settleSale.notes + ` | ${paymentNote}`
              : paymentNote
          })
          .eq('id', saleId)
          .eq('organization_id', activeOrgId);

        if (updateErr) throw updateErr;
      }

      // Now mark as fulfilled via RPC
      const { error } = await supabase.rpc('fulfill_sale', { p_sale_id: saleId });
      if (error) throw error;

      success("Order settled and marked as fulfilled");
      setShowSettleModal(false);
      setSettleSale(null);
      setCustomerOrders(prev => prev.filter(o => o.id !== saleId));
      fetchDeposits();
    } catch (err) {
      showError("Error: " + err.message);
    } finally {
      setFulfilling(false);
    }
  };

  const handlePureFulfillment = async () => {
    if (items.length === 0 || !items[0].product_id) return showError("Please add at least one product.");
    setFulfilling(true);
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

      success("Deposit fulfilled and items deducted!");
      setShowFulfillModal(false);
      setCustomerOrders(prev => prev.filter(o => o.id !== selectedSale.id));
      fetchDeposits();
    } catch (err) {
      showError("Error: " + err.message);
    } finally {
      setFulfilling(false);
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

  const currency = user?.organizations?.currency || 'GHS';

  if (loading) {
    return <PageSkeleton title stats table tableRows={6} tableColumns={5} />;
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 className="section-title">Advance Deposits & Credit</h2>
          <p style={{ fontSize: '12.5px', color: '#6b7280' }}>Track customer prepayments (Credit) and outstanding balances (Debt)</p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <ActionButton variant="info" onClick={() => setShowDepositModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <HandCoins size={16} weight="duotone" /> Record Deposit
          </ActionButton>
          <div className="summary-card" style={{ padding: '10px 20px', width: 'auto', background: '#ecfdf5', borderColor: '#10b981' }}>
            <span style={{ fontSize: 10, color: '#065f46', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Total Credit:</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#059669' }}>{formatCurrency(totalHeld, currency)}</span>
          </div>
          <div className="summary-card" style={{ padding: '10px 20px', width: 'auto', background: '#fef2f2', borderColor: '#ef4444' }}>
            <span style={{ fontSize: 10, color: '#991b1b', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Total Owed:</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#b91c1c' }}>{formatCurrency(totalOwed, currency)}</span>
          </div>
        </div>
      </div>

      <div className="table-card" style={{ marginBottom: 20 }}>
        <div className="table-card__header" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 250 }}>
            <Input
              type="search"
              placeholder="Search by name or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, width: '100%' }}
            />
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
              <MagnifyingGlass size={16} />
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>Sort:</span>
            <Select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              options={[
                { value: "latest", label: "Latest Activity" },
                { value: "oldest", label: "Oldest Activity" },
                { value: "credit_high", label: "Highest Credit" },
                { value: "debt_high", label: "Highest Debt" },
                { value: "name_az", label: "Name (A-Z)" }
              ]}
              style={{ width: 180 }}
            />
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-wrapper">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Last Action</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: 24, color: '#6b7280' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <Package size={20} weight="duotone" /> No customers matching filters.
                    </div>
                  </td>
                </tr>
              ) : paginated.map(d => (
                <React.Fragment key={d.customer_id}>
                  <tr
                    onClick={() => toggleOrders(d.customer_id)}
                    style={{ cursor: 'pointer', background: expandedCustomerId === d.customer_id ? '#f9fafb' : 'transparent' }}
                  >
                    <td style={{ fontWeight: 600 }}>
                      <span style={{ marginRight: 8, display: 'inline-flex', verticalAlign: 'middle' }}>
                        {expandedCustomerId === d.customer_id ? <CaretDown size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />}
                      </span>
                      {d.customer_name}
                    </td>
                    <td>{d.phone || '—'}</td>
                    <td>
                      {d.pending_sales_count > 0 ? (
                        <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                          {d.pending_sales_count} PENDING ORDERS
                        </span>
                      ) : (
                        <span style={{ color: '#6b7280', fontSize: 11 }}>No Pending Items</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: '#6b7280' }}>{d.last_sale_date ? new Date(d.last_sale_date).toLocaleDateString() : '—'}</td>
                    <td style={{ fontWeight: 700, color: (d.total_balance || 0) < 0 ? '#059669' : ((d.total_balance || 0) === 0 ? '#6b7280' : '#b91c1c') }}>
                      {(d.total_balance || 0) < 0 ? (
                        <span title="Customer has credit">{formatCurrency(Math.abs(d.total_balance || 0), currency)} (Credit)</span>
                      ) : ((d.total_balance || 0) === 0 ? (
                        <span title="No balance">{currency} 0.00</span>
                      ) : (
                        <span title="Customer owes balance">{formatCurrency(d.total_balance || 0, currency)} (Due)</span>
                      ))}
                    </td>
                  </tr>
                  {expandedCustomerId === d.customer_id && (
                    <tr>
                      <td colSpan="5" style={{ padding: '0 24px 24px', background: '#f9fafb' }}>
                        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.05)' }}>
                          <h5 style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ClipboardText size={16} weight="duotone" /> Pending Orders for {d.customer_name}
                          </h5>
                          {customerOrders.length === 0 ? (
                            <p style={{ fontSize: 12, color: '#6b7280' }}>No items awaiting fulfillment for this customer.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {customerOrders.map(order => (
                                <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                                      {order.total_amount === 0 ? <><HandCoins size={14} weight="duotone" color="#059669" /> Pure Prepayment</> : (order.invoice_no ? order.invoice_no : `Order #INV-${String(order.id).slice(-6)}`)}
                                      {order.payment_status && order.total_amount > 0 && (
                                        <span style={{
                                          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                                          background: order.payment_status === 'PAID' ? '#d1fae5' : order.payment_status === 'DEPOSIT' ? '#dbeafe' : '#fef3c7',
                                          color: order.payment_status === 'PAID' ? '#065f46' : order.payment_status === 'DEPOSIT' ? '#1e40af' : '#92400e',
                                          textTransform: 'uppercase', letterSpacing: '0.5px'
                                        }}>
                                          {order.payment_status}
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                                      <span>{new Date(order.created_at).toLocaleString()}</span>
                                      <span>•</span>
                                      <span>{formatCurrency(parseFloat(order.total_amount === 0 ? order.amount_paid : order.total_amount) || 0, currency)}</span>
                                      {order.total_amount === 0 && <span style={{ color: '#059669', fontWeight: 700 }}>(Credit Added)</span>}
                                      {parseFloat(order.balance_due || 0) > 0 && (
                                        <span style={{ color: '#dc2626', fontWeight: 700 }}>
                                          (Owes {formatCurrency(parseFloat(order.balance_due), currency)})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <ActionButton
                                    variant="success"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleFulfillClick(order); }}
                                    disabled={fulfilling}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}
                                  >
                                    <Check size={14} weight="bold" /> {parseFloat(order.balance_due || 0) > 0 ? 'Settle & Fulfill' : 'Mark Fulfilled'}
                                  </ActionButton>
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
            <ActionButton variant="secondary" fullWidth onClick={() => setItemsToShow(prev => prev + 25)} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              See More Customers <CaretDown size={14} weight="bold" />
            </ActionButton>
          </div>
        )}
      </div>

      {/* Pure Deposit Fulfillment Modal */}
      {showFulfillModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 20, width: 700, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Package size={22} weight="duotone" color="#f97316" /> Fulfill Prepayment Items
              </h2>
              <ActionButton variant="ghost" size="sm" onClick={() => setShowFulfillModal(false)}>
                <X size={16} weight="bold" />
              </ActionButton>
            </div>

            <div style={{ background: '#f0fdf4', padding: 12, borderRadius: 8, border: '1px solid #bbf7d0', marginBottom: 20, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
                💰 Total Paid: {formatCurrency(parseFloat(selectedSale?.amount_paid || 0), currency)}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
                🏦 Remaining Credit: {formatCurrency(Math.abs(selectedSale?.balance_due || 0), currency)}
              </span>
            </div>

            <table className="stock-table" style={{ marginBottom: 20 }}>
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
                    <td>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={e => {
                          const newItems = [...items];
                          newItems[idx].quantity = e.target.value;
                          setItems(newItems);
                        }}
                        style={{ width: 60 }}
                      />
                    </td>
                    <td>
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={e => {
                          const newItems = [...items];
                          newItems[idx].unit_price = e.target.value;
                          setItems(newItems);
                        }}
                        style={{ width: 100 }}
                      />
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(item.quantity * item.unit_price, currency)}</td>
                    <td>
                      <ActionButton variant="ghost" size="sm" onClick={() => setItems(items.filter((_, i) => i !== idx))} style={{ color: '#ef4444' }}>
                        <X size={14} weight="bold" />
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <ActionButton variant="secondary" onClick={() => setItems([...items, { product_id: '', product_name: '', quantity: 1, unit_price: 0 }])} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14} weight="bold" /> Add Row
              </ActionButton>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Total Items: {formatCurrency(items.reduce((a, i) => a + (i.quantity * i.unit_price), 0), currency)}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: (items.reduce((a, i) => a + (i.quantity * i.unit_price), 0) - selectedSale?.amount_paid) > 0 ? '#ef4444' : '#059669' }}>
                  Balance Due: {currency} {formatCurrency(Math.max(0, items.reduce((a, i) => a + (i.quantity * i.unit_price), 0) - selectedSale?.amount_paid))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              <ActionButton variant="secondary" fullWidth onClick={() => setShowFulfillModal(false)}>
                Cancel
              </ActionButton>
              <ActionButton variant="success" fullWidth disabled={fulfilling} onClick={handlePureFulfillment}>
                {fulfilling ? 'Processing...' : 'Complete Fulfillment'}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Settle & Fulfill Modal (for regular deposit orders) */}
      {showSettleModal && settleSale && (() => {
        const outstanding = parseFloat(settleSale.balance_due || 0);
        const paid = parseFloat(settleSale.amount_paid || 0);
        const total = parseFloat(settleSale.total_amount || 0);
        const collecting = parseFloat(settleAmount) || 0;
        const remainingAfter = Math.max(0, outstanding - collecting);

        return (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#fff', padding: 28, borderRadius: 20, width: 480, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CurrencyCircleDollar size={22} weight="duotone" color="#2563eb" /> Settle and Fulfill Order
                </h2>
                <ActionButton variant="ghost" size="sm" onClick={() => setShowSettleModal(false)}>
                  <X size={16} weight="bold" />
                </ActionButton>
              </div>

              {/* Order Summary */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>Order Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>Invoice</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{settleSale.invoice_no || `#INV-${String(settleSale.id).slice(-6)}`}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>Customer</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{settleSale.customer_name}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>Order Total</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(total, currency)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>Already Paid</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>{formatCurrency(paid, currency)}</div>
                  </div>
                </div>
              </div>

              {/* Outstanding Balance */}
              {outstanding > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Warning size={16} weight="duotone" color="#dc2626" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#991b1b' }}>
                      Outstanding Balance: {formatCurrency(outstanding, currency)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <Label>Collect Payment ({currency})</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={outstanding}
                        value={settleAmount}
                        onChange={e => setSettleAmount(e.target.value)}
                        placeholder="0.00"
                        style={{ fontSize: 16, fontWeight: 700 }}
                      />
                    </div>
                    <div>
                      <Label>Payment Method</Label>
                      <Select
                        value={settleMethod}
                        onChange={e => setSettleMethod(e.target.value)}
                        options={[
                          { value: "Cash", label: "Cash" },
                          { value: "Momo", label: "Momo" },
                          { value: "Bank", label: "Bank Transfer" }
                        ]}
                      />
                    </div>
                    {remainingAfter > 0 && collecting > 0 && (
                      <div style={{ fontSize: 12, color: '#b91c1c', fontWeight: 600, padding: '6px 10px', background: '#fff5f5', borderRadius: 6 }}>
                        {formatCurrency(remainingAfter, currency)} will remain outstanding after this collection
                      </div>
                    )}
                    {collecting >= outstanding && outstanding > 0 && (
                      <div style={{ fontSize: 12, color: '#059669', fontWeight: 600, padding: '6px 10px', background: '#f0fdf4', borderRadius: 6 }}>
                        Balance will be fully settled
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Already fully paid */}
              {outstanding <= 0 && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Check size={16} weight="bold" color="#059669" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>
                      This order is fully paid. Ready to mark as fulfilled.
                    </span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <ActionButton variant="secondary" fullWidth onClick={() => setShowSettleModal(false)}>
                  Cancel
                </ActionButton>
                <ActionButton
                  variant="success"
                  fullWidth
                  disabled={fulfilling}
                  onClick={executeSettleAndFulfill}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Check size={14} weight="bold" />
                  {fulfilling ? 'Processing...' : (outstanding > 0 && collecting > 0 ? 'Collect & Fulfill' : 'Mark as Fulfilled')}
                </ActionButton>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Record Deposit Modal */}
      {showDepositModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 20, width: 450, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Coins size={22} weight="duotone" color="#059669" /> Record New Deposit
              </h2>
              <ActionButton variant="ghost" size="sm" onClick={() => setShowDepositModal(false)}>
                <X size={16} weight="bold" />
              </ActionButton>
            </div>

            <form onSubmit={handlePureDeposit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <FieldGroup columns={1}>
                <div>
                  <Label required>Customer Name</Label>
                  <Input value={depCustName} onChange={e => setDepCustName(e.target.value)} placeholder="Enter name..." required />
                </div>
                <div>
                  <Label>Customer Phone (Optional)</Label>
                  <Input value={depCustPhone} onChange={e => setDepCustPhone(formatPhone(e.target.value))} placeholder="+233XXXXXXXXX" />
                </div>
                <div>
                  <Label required>Amount ({currency})</Label>
                  <Input type="number" step="0.01" value={depAmount} onChange={e => setDepAmount(e.target.value)} placeholder="0.00" required style={{ fontSize: 18, fontWeight: 700 }} />
                </div>
                <div>
                  <Label required>Payment Method</Label>
                  <Select value={depMethod} onChange={e => setDepMethod(e.target.value)} options={[
                    { value: "Cash", label: "Cash" },
                    { value: "Momo", label: "Momo" },
                    { value: "Bank", label: "Bank Transfer" }
                  ]} required />
                </div>
                <ActionButton type="submit" fullWidth disabled={depSaving}>
                  {depSaving ? 'Saving...' : 'Record Deposit'}
                </ActionButton>
              </FieldGroup>
            </form>
          </div>
        </div>
      )}

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
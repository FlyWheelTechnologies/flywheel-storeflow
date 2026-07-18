import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import ConfirmationModal from "../components/ConfirmationModal";
import "./Dashboard.css";
import { SalesService } from "../services/SalesService";
import SalesForm from "../components/Sales/SalesForm";
import SalesTable from "../components/Sales/SalesTable";

export default function Sales() {
  const location = useLocation();
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  // State for UI control
  const [showForm, setShowForm] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null); // { message, type, action, actionLabel }
  const [pendingSaleData, setPendingSaleData] = useState(null);

  // State for filtering and pagination
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [itemsToShow, setItemsToShow] = useState(25);

  const fetchData = async () => {
    const [salesRes, productsRes, customersRes] = await Promise.all([
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*'),
      supabase.from('customers').select('*')
    ]);
    if (salesRes.data) setSales(salesRes.data);
    if (productsRes.data) setProducts(productsRes.data);
    if (customersRes.data) setCustomers(customersRes.data);
    setTimeout(() => setLoading(false), 1000);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (location.state?.isDeposit) {
      setShowForm(true);
    }
    if (location.state?.showForm) {
      setShowForm(true);
    }
    // Clear state after handling it
    if (location.state) {
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  const filtered = useMemo(() => {
    return sales
      .filter(s => s.customer_name?.toLowerCase().includes(search.toLowerCase()))
      .filter(s => statusFilter === 'All' || s.payment_status === statusFilter)
      .filter(s => !dateFilter || new Date(s.created_at).toDateString() === new Date(dateFilter).toDateString())
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [sales, search, statusFilter, dateFilter]);

  const paginated = useMemo(() => {
    return filtered.slice(0, itemsToShow);
  }, [filtered, itemsToShow]);

  const handleExportCSV = () => {
    SalesService.exportToCSV(filtered);
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const lines = text.split('\n').filter(l => l.trim() !== '');
      if (lines.length <= 1) return;

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const salesToImport = [];
      let lastValidDate = null;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, idx) => row[h] = values[idx]);

        // Carry forward the date if empty
        if (row.date) {
          lastValidDate = row.date;
        } else {
          row.date = lastValidDate;
        }

        salesToImport.push(row);
      }

      if (salesToImport.length > 0) {
        if (!window.confirm(`Found ${salesToImport.length} records. Import them now?`)) return;

        setSaving(true);
        try {
          for (const row of salesToImport) {
            const prod = products.find(p => p.name.toLowerCase() === row.product?.toLowerCase()) || products[0];
            if (!prod) continue;

            console.log("Importing row:", row);
            const cust = customers.find(c => c.name.toLowerCase() === (row.customer || 'Walk-in Customer').toLowerCase());
            const payload = {
              p_customer_id: cust ? cust.id : null,
              p_customer_name: row.customer || 'Walk-in Customer',
              p_total_amount: (parseFloat((row.price || '0').toString().replace(/[^\d.-]/g, '')) * parseFloat((row.quantity || '0').toString().replace(/[^\d.-]/g, ''))) || 0,
              p_amount_paid: parseFloat((row.paid || '0').toString().replace(/[^\d.-]/g, '')) || 0,
              p_payment_method: row.method || 'Cash',
              p_payment_status: 'PAID',
              p_items: [{
                product_id: prod.id,
                product_name: prod.name,
                quantity: parseFloat((row.quantity || '0').toString().replace(/[^\d.-]/g, '')) || 1,
                unit_price: parseFloat((row.price || '0').toString().replace(/[^\d.-]/g, '')) || prod.selling_price,
                subtotal: (parseFloat((row.quantity || '0').toString().replace(/[^\d.-]/g, '')) || 1) * (parseFloat((row.price || '0').toString().replace(/[^\d.-]/g, '')) || prod.selling_price)
              }],
              p_recorded_by: JSON.parse(localStorage.getItem("user"))?.email || 'Import',
              p_tax_percentage: 0,
              p_tax_inclusive: true,
              p_credit_used: 0,
              p_created_at: row.date ? `${row.date} 00:00:00+00` : null,
              p_invoice_no: row.invoice_no || null
            };

            await SalesService.recordSaleTransaction(payload);
          }
          alert("Import completed successfully!");
          fetchData();
        } catch (err) {
          console.error(err);
          alert("Import failed: " + err.message);
        } finally {
          setSaving(false);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleSaleSave = (data) => {
    setPendingSaleData(data);
    setShowConfirm(true);
  };

  const handleSubmit = async () => {
    if (!pendingSaleData) return;
    setSaving(true);
    setError('');

    // Prevent JWT expired error by proactively refreshing session if dormant
    await supabase.auth.getSession();

    const userEmail = JSON.parse(localStorage.getItem("user"))?.email || 'System';

    try {
      let resolvedCustomerId = pendingSaleData.customerId ? parseInt(pendingSaleData.customerId) : null;
      const isNewCustomer = pendingSaleData.customerName && pendingSaleData.customerName !== 'Walk-in Customer' && !pendingSaleData.customerId;
      
      if (isNewCustomer) {
        const { data: newCust, error: custErr } = await supabase.from('customers').insert([{
          name: pendingSaleData.customerName,
          phone: pendingSaleData.customerPhone,
          email: pendingSaleData.customerEmail || '',
          is_contractor: false,
          created_at: new Date().toISOString()
        }]).select().single();
        
        if (custErr) throw custErr;
        resolvedCustomerId = newCust.id;
      } else if (resolvedCustomerId && pendingSaleData.customerEmail) {
        // Update existing customer email if provided
        const { error: custErr } = await supabase.from('customers').update({
          email: pendingSaleData.customerEmail
        }).eq('id', resolvedCustomerId);
        
        if (custErr) console.error("Failed to update customer email:", custErr);
      }

      const validItems = [];
      for (const item of pendingSaleData.items) {
        if (!item.product_id) continue;
        const prod = products.find(p => p.id === parseInt(item.product_id) || p.id === item.product_id);
        
        if (!pendingSaleData.isDeposit && parseFloat(item.quantity) > prod.stock_quantity) {
          throw new Error(`Insufficient stock for "${prod.name}". Available: ${prod.stock_quantity} ${prod.selling_uom}. Requested: ${item.quantity}`);
        }

        validItems.push({
          product_id: prod.id,
          product_name: item.product_name,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price),
          subtotal: parseFloat(item.quantity) * parseFloat(item.unit_price)
        });
      }

      const status = pendingSaleData.isDeposit ? 'DEPOSIT' : (pendingSaleData.balance <= 0 ? 'PAID' : pendingSaleData.amountPaid > 0 ? 'PARTIAL' : 'UNPAID');

      const newSaleId = await SalesService.recordSaleTransaction({
        p_customer_id: resolvedCustomerId,
        p_customer_name: pendingSaleData.customerName,
        p_total_amount: pendingSaleData.grandTotal,
        p_amount_paid: parseFloat(pendingSaleData.amountPaid) || 0,
        p_payment_method: pendingSaleData.paymentMethod,
        p_payment_status: status,
        p_items: validItems,
        p_recorded_by: userEmail,
        p_tax_percentage: pendingSaleData.taxPercentage,
        p_tax_inclusive: pendingSaleData.taxInclusive,
        p_credit_used: parseFloat(pendingSaleData.useCredit) || 0
      });

      // Clear draft on success
      localStorage.removeItem("sales_draft");
      setShowConfirm(false);
      setShowForm(false);
      setPendingSaleData(null);
      fetchData();

      setToast({ 
        message: "Sale recorded successfully!", 
        type: "success",
        action: async () => {
          try {
            await SalesService.shareViaWhatsApp({
              id: newSaleId,
              customer_id: resolvedCustomerId,
              customer_name: pendingSaleData.customerName,
              total_amount: pendingSaleData.grandTotal,
              amount_paid: (parseFloat(pendingSaleData.amountPaid) || 0) + (parseFloat(pendingSaleData.useCredit) || 0),
              balance_due: pendingSaleData.balance,
              created_at: new Date().toISOString()
            }, {
              customerPhone: pendingSaleData.customerPhone,
              customerName: pendingSaleData.customerName,
              customers
            });
          } catch (err) {
            setToast({ message: err.message, type: "error" });
          }
        },
        actionLabel: "Send WhatsApp Receipt"
      });
      setTimeout(() => setToast(null), 10000);
    } catch (err) {
      console.error(err);
      setShowConfirm(false);
      setError(err.message || 'Network issue');
      setShowErrorModal(true);
    } finally {
      setSaving(false);
    }
  };

  const initialDraft = (() => {
    const savedDraft = localStorage.getItem("sales_draft");
    if (savedDraft) {
      try { return JSON.parse(savedDraft); } catch (e) { return {}; }
    }
    return {};
  })();

  if (loading) {
    return (
      <div className="sales-container" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div className="skeleton" style={{ width: 300, height: 40 }} />
          <div className="skeleton" style={{ width: 140, height: 40 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 45, borderRadius: 10 }} />)}
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div className="skeleton" style={{ height: 45, marginBottom: 20, width: '100%' }} />
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="skeleton" style={{ height: 55, marginBottom: 12, width: '100%' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h2 className="section-title">Sales & Orders</h2>
          <p style={{ fontSize: '12.5px', color: '#6b7280' }}>Record transactions and track Momo/Cash payments</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {showForm && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>✓ Draft Auto-saved</span>
              <button 
                onClick={() => { localStorage.removeItem("sales_draft"); window.location.reload(); }}
                style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}
              >
                Clear Form
              </button>
            </div>
          )}
          <button className="quick-action-btn" style={{ width: 'auto' }} onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Close Form' : '+ New Sale'}
          </button>
        </div>
      </div>



      {showForm && (
        <SalesForm
          products={products}
          customers={customers}
          initialData={initialDraft}
          onSave={handleSaleSave}
          onCancel={() => setShowForm(false)}
          saving={saving}
        />
      )}

      <SalesTable
        filteredSales={filtered}
        paginatedSales={paginated}
        itemsToShow={itemsToShow}
        setItemsToShow={setItemsToShow}
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        onExportCSV={handleExportCSV}
        onImportCSV={handleImportCSV}
        onGenerateReceipt={(s) => SalesService.generateReceipt(s)}
        onShareViaWhatsApp={async (s) => {
          try {
            await SalesService.shareViaWhatsApp(s, { customers });
          } catch (err) {
            setToast({ message: err.message, type: "error" });
          }
        }}
      />

      {toast && (
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{ 
            position:'fixed', top:24, left:'50%', transform:'translateX(-50%)', 
            background: toast.type === 'error' ? '#991b1b' : '#064e3b', 
            color:'#fff', padding:'16px 24px', borderRadius:'16px', 
            boxShadow:'0 20px 25px -5px rgba(0,0,0,0.2), 0 10px 10px -5px rgba(0,0,0,0.1)', 
            zIndex:3000, display:'flex', alignItems:'center', gap:15, 
            animation:'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            minWidth: '300px'
          }}
        >
          <div style={{ fontSize:24 }}>{toast.type === 'error' ? '⚠️' : '✅'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight:700, fontSize: 14 }}>{toast.message}</div>
            {toast.action && (
              <button 
                onClick={() => { toast.action(); setToast(null); }}
                style={{ 
                  background: '#f15a24', border: 'none', color: '#fff', 
                  padding: '6px 12px', borderRadius: '8px', fontSize: '11px', 
                  fontWeight: 800, cursor: 'pointer', marginTop: 8,
                  display: 'flex', alignItems: 'center', gap: 6,
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                }}
              >
                <span>📱</span> {toast.actionLabel}
              </button>
            )}
          </div>
          <button 
            onClick={() => setToast(null)}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}
          >✕</button>
          <style>{`
            @keyframes slideDown { 
              from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
              to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      <ConfirmationModal 
        show={showConfirm}
        title="Confirm Transaction"
        message={`Are you sure you want to record this sale for GHS ${pendingSaleData?.total?.toFixed(1)}? This will deduct items from stock and create a journal entry.`}
        confirmText="Yes, Record Sale"
        onConfirm={handleSubmit}
        onCancel={() => setShowConfirm(false)}
        type="primary"
        isLoading={saving}
      />

      <ConfirmationModal 
        show={showErrorModal}
        title="⚠️ Transaction Failed"
        message={`Reason: ${error}. Your data is safe in this draft. Please adjust the quantities and try again.`}
        confirmText="Okay, Let me fix it"
        onConfirm={() => { setShowErrorModal(false); setError(''); }}
        onCancel={() => { setShowErrorModal(false); setError(''); }}
        type="danger"
      />
    </div>
  );
}

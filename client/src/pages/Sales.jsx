import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../hooks/useProducts";
import { useCustomers } from "../hooks/useCustomers";
import { useSales } from "../hooks/useSales";
import { useToast } from "../context/ToastContext";
import { useConfirmation } from "../hooks/useConfirmation";
import { SalesService } from "../services/SalesService";
import { PrinterService } from "../services/PrinterService";
import { Printer, Usb, Bluetooth, Lightning, X } from "@phosphor-icons/react";
import SalesForm from "../components/Sales/SalesForm";
import SalesTable from "../components/Sales/SalesTable";
import "./Dashboard.css";
import { formatCurrency } from "../services/formatters";
import { ActionButton, Input, Select } from "../components/ui/FormFields";
import { PageSkeleton } from "../components/LoadingStates";

export default function Sales() {
  const { user, activeOrgId } = useAuth();
  const location = useLocation();
  const { success, error: showError } = useToast();
  const { modalState, confirm, handleConfirm, handleCancel, ConfirmationModal } = useConfirmation();
  const { products, loading: productsLoading, refetch: refetchProducts } = useProducts();
  const { customers, loading: customersLoading, refetch: refetchCustomers } = useCustomers();
  const { sales, loading: salesLoading, refetch: refetchSales } = useSales();

  const loading = productsLoading || customersLoading || salesLoading;

  // State for UI control
  const [showForm, setShowForm] = useState(false);
  const [pendingSaleData, setPendingSaleData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [hardwareConfig, setHardwareConfig] = useState(() => PrinterService.getLocalHardwareConfig());
  const [hardwareTesting, setHardwareTesting] = useState(false);

  // State for filtering and pagination
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [itemsToShow, setItemsToShow] = useState(25);

  useEffect(() => {
    if (location.state?.isDeposit) {
      setShowForm(true);
    }
    if (location.state?.showForm) {
      setShowForm(true);
    }
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

  const paginated = useMemo(() => filtered.slice(0, itemsToShow), [filtered, itemsToShow]);

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

        if (row.date) {
          lastValidDate = row.date;
        } else {
          row.date = lastValidDate;
        }

        salesToImport.push(row);
      }

      if (salesToImport.length > 0) {
        const confirmed = await confirm({
          title: "Import Sales",
          message: `Found ${salesToImport.length} records. Import them now?`,
          confirmText: "Import",
          type: "primary"
        });

        if (!confirmed) return;

        setSaving(true);
        try {
          for (const row of salesToImport) {
            const prod = products.find(p => p.name.toLowerCase() === row.product?.toLowerCase()) || products[0];
            if (!prod) continue;

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
              p_recorded_by: user?.email || 'Import',
              p_tax_percentage: 0,
              p_tax_inclusive: true,
              p_credit_used: 0,
              p_created_at: row.date ? `${row.date} 00:00:00+00` : null,
              p_invoice_no: row.invoice_no || null,
              p_organization_id: activeOrgId || user?.organization_id
            };

            await SalesService.recordSaleTransaction(payload);
          }
          success("Import completed successfully!");
          refetchProducts();
          refetchCustomers();
          refetchSales();
        } catch (err) {
          console.error(err);
          showError("Import failed: " + err.message);
        } finally {
          setSaving(false);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleSaleSave = (data) => {
    setPendingSaleData(data);
    confirm({
      title: "Confirm Transaction",
      message: `Are you sure you want to record this sale for ${formatCurrency(data.grandTotal)}? This will deduct items from stock and create a journal entry.`,
      confirmText: "Yes, Record Sale",
      type: "primary",
      onConfirm: (confirmData) => handleSubmit(confirmData || data),
      confirmData: data
    });
  };

  const handleSubmit = async (saleDataParam) => {
    const data = saleDataParam || pendingSaleData;
    if (!data) return;
    setSaving(true);
    try {
      let resolvedCustomerId = data.customerId ? parseInt(data.customerId) : null;
      const isNewCustomer = data.customerName && data.customerName !== 'Walk-in Customer' && !data.customerId;

      if (isNewCustomer) {
        // Prevent duplicate customer: check if customer with same phone or name already exists in org
        let existingCust = null;
        const cleanPhone = (data.customerPhone || '').replace(/\s+/g, '');
        if (cleanPhone && cleanPhone !== '+233' && customers && customers.length > 0) {
          existingCust = customers.find(c => c.phone && c.phone.replace(/\s+/g, '') === cleanPhone);
        }
        if (!existingCust && data.customerName && customers && customers.length > 0) {
          existingCust = customers.find(c => c.name?.trim().toLowerCase() === data.customerName.trim().toLowerCase());
        }

        if (existingCust) {
          resolvedCustomerId = existingCust.id;
        } else {
          const { data: newCust, error: custErr } = await supabase.from('customers').insert([{
            name: data.customerName,
            phone: data.customerPhone,
            email: data.customerEmail || '',
            is_contractor: false,
            organization_id: activeOrgId || user?.organization_id,
            created_at: new Date().toISOString()
          }]).select().single();

          if (custErr) throw custErr;
          resolvedCustomerId = newCust.id;
        }
      } else if (resolvedCustomerId && data.customerEmail) {
        const { error: custErr } = await supabase.from('customers').update({
          email: data.customerEmail
        }).eq('id', resolvedCustomerId);

        if (custErr) console.error("Failed to update customer email:", custErr);
      }

      const validItems = [];
      for (const item of (data.items || [])) {
        if (!item.product_id) continue;
        const prod = products.find(p => p.id === parseInt(item.product_id) || p.id === item.product_id);

        if (!data.isDeposit && prod && parseFloat(item.quantity) > prod.stock_quantity) {
          throw new Error(`Insufficient stock for "${prod.name}". Available: ${prod.stock_quantity} ${prod.selling_uom || 'units'}. Requested: ${item.quantity}`);
        }

        validItems.push({
          product_id: prod?.id || item.product_id,
          product_name: item.product_name,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price),
          subtotal: Math.round(parseFloat(item.quantity) * parseFloat(item.unit_price) * 100) / 100
        });
      }

      const status = data.isDeposit ? 'DEPOSIT' : (data.balance <= 0 ? 'PAID' : data.amountPaid > 0 ? 'PARTIAL' : 'UNPAID');

      const newSaleId = await SalesService.recordSaleTransaction({
        p_customer_id: resolvedCustomerId,
        p_customer_name: data.customerName,
        p_total_amount: data.grandTotal,
        p_amount_paid: parseFloat(data.amountPaid) || 0,
        p_payment_method: data.paymentMethod,
        p_payment_status: status,
        p_items: validItems,
        p_recorded_by: user?.email || 'System',
        p_tax_percentage: data.taxPercentage,
        p_tax_inclusive: data.taxInclusive,
        p_credit_used: parseFloat(data.useCredit) || 0,
        p_organization_id: activeOrgId || user?.organization_id
      });

      // Clear draft on success
      localStorage.removeItem("sales_draft");
      setPendingSaleData(null);
      setShowForm(false);
      refetchProducts();
      refetchCustomers();
      refetchSales();

      // Trigger automatic receipt printing if enabled
      const shouldAutoPrint = user?.organizations?.auto_print_receipt !== false;
      if (shouldAutoPrint && !data.isDeposit) {
        const completedSale = {
          id: newSaleId,
          invoice_no: `INV-${String(newSaleId || '000').slice(-6).padStart(3, '0')}`,
          customer_name: data.customerName,
          total_amount: data.grandTotal,
          amount_paid: (parseFloat(data.amountPaid) || 0) + (parseFloat(data.useCredit) || 0),
          balance_due: data.balance,
          payment_method: data.paymentMethod,
          payment_status: status,
          tax_amount: data.taxAmount || 0,
          tax_percentage: data.taxPercentage || 0,
          created_at: new Date().toISOString()
        };

        PrinterService.printSale(completedSale, user?.organizations || {}, validItems).catch(printErr => {
          console.warn("Auto-print thermal ticket notice:", printErr);
        });
      }

      success("Sale recorded successfully!", {
        action: async () => {
          try {
            await SalesService.shareViaWhatsApp({
              id: newSaleId,
              customer_id: resolvedCustomerId,
              customer_name: data.customerName,
              total_amount: data.grandTotal,
              amount_paid: (parseFloat(data.amountPaid) || 0) + (parseFloat(data.useCredit) || 0),
              balance_due: data.balance,
              created_at: new Date().toISOString()
            }, {
              customerPhone: data.customerPhone,
              customerName: data.customerName,
              customers
            });
          } catch (err) {
            showError(err.message);
          }
        },
        actionLabel: "Send WhatsApp Receipt"
      });
    } catch (err) {
      console.error(err);
      showError(err.message || 'Network issue');
      confirm({
        title: "⚠️ Transaction Failed",
        message: `Reason: ${err.message}. Your data is safe in this draft. Please adjust the quantities and try again.`,
        confirmText: "Okay, Let me fix it",
        type: "danger",
        onConfirm: () => {}
      });
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
    return <PageSkeleton title stats={true} table={true} tableRows={8} tableColumns={6} />;
  }

  const currency = user?.organizations?.currency || 'GHS';

  return (
    <div style={{ padding: 24 }}>
      <div className="page-header-row">
        <div>
          <h2 className="section-title">Sales & Orders</h2>
          <p style={{ fontSize: '12.5px', color: '#6b7280' }}>Record transactions and track Momo/Cash payments</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
          {showForm && (
            <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>✓ Draft Auto-saved</span>
              <ActionButton variant="danger" size="sm" onClick={() => { localStorage.removeItem("sales_draft"); window.location.reload(); }}>
                Clear Form
              </ActionButton>
            </div>
          )}
          <ActionButton onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Close Form' : '+ New Sale'}
          </ActionButton>
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
          orgTaxSettings={user?.organizations ? {
            default_tax_rate: user.organizations.default_tax_rate,
            default_tax_inclusive: user.organizations.default_tax_inclusive,
            is_vat_registered: user.organizations.is_vat_registered
          } : {}}
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
        onPrintThermalReceipt={(s) => {
          PrinterService.printSale(s, user?.organizations || {}).catch(err => {
            showError(`Thermal Print Error: ${err.message}`);
          });
        }}
        onShareViaWhatsApp={async (s) => {
          try {
            await SalesService.shareViaWhatsApp(s, { customers });
          } catch (err) {
            showError(err.message);
          }
        }}
      />

      {/* Storekeeper Register Hardware Modal */}
      {showPrinterModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 20
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 14,
            width: '100%',
            maxWidth: 480,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Printer size={20} color="var(--brand-primary, #f15a24)" weight="duotone" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                  Register Printer & Hardware
                </h3>
              </div>
              <button
                onClick={() => setShowPrinterModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 20 }}>
              {/* Active Mode Banner */}
              <div style={{
                background: '#fff7ed',
                border: '1px solid #fed7aa',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 16
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9a3412', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Active Store Configuration
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#431407', marginTop: 3 }}>
                  Roll: {user?.organizations?.receipt_paper_width || '80mm'} • Protocol: {user?.organizations?.receipt_mode?.toUpperCase() || 'BROWSER'}
                </div>
                <div style={{ fontSize: 11.5, color: '#7c2d12', marginTop: 2 }}>
                  Auto-print on sale: {user?.organizations?.auto_print_receipt !== false ? 'Enabled' : 'Disabled'} • Drawer kick: {user?.organizations?.kick_cash_drawer ? 'Enabled' : 'Disabled'}
                </div>
              </div>

              {/* Terminal Connection Status */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                  Terminal Device Status
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#f1f5f9',
                  borderRadius: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: hardwareConfig?.deviceName ? '#10b981' : '#f59e0b',
                      display: 'inline-block'
                    }}></span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                      {hardwareConfig?.deviceName || 'Universal Browser Spooler (Default)'}
                    </span>
                  </div>
                  {hardwareConfig?.deviceName && (
                    <button
                      onClick={() => {
                        PrinterService.forgetPrinter();
                        setHardwareConfig(PrinterService.getLocalHardwareConfig());
                        success("Device disconnected.");
                      }}
                      style={{ background: 'none', border: 'none', fontSize: 11.5, color: '#ef4444', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>

              {/* Hardware Pairing Buttons (WebUSB / Bluetooth) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await PrinterService.pairUsbPrinter();
                      setHardwareConfig(PrinterService.getLocalHardwareConfig());
                      success(`Connected ${res.deviceName}!`);
                    } catch (err) {
                      showError(err.message);
                    }
                  }}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#1e293b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <Usb size={16} weight="bold" color="#0284c7" /> Connect USB
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await PrinterService.pairBluetoothPrinter();
                      setHardwareConfig(PrinterService.getLocalHardwareConfig());
                      success(`Paired ${res.deviceName}!`);
                    } catch (err) {
                      showError(err.message);
                    }
                  }}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: '10px 12px',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#1e293b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <Bluetooth size={16} weight="bold" color="#4f46e5" /> Pair Bluetooth
                </button>
              </div>

              {/* Quick Diagnostic Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  type="button"
                  disabled={hardwareTesting}
                  onClick={async () => {
                    setHardwareTesting(true);
                    try {
                      await PrinterService.testPrint(
                        user?.organizations || {},
                        user?.organizations?.receipt_mode || 'browser',
                        user?.organizations?.receipt_paper_width || '80mm'
                      );
                      success("Test receipt sent to printer!");
                    } catch (err) {
                      showError(`Print Failed: ${err.message}`);
                    } finally {
                      setHardwareTesting(false);
                    }
                  }}
                  style={{
                    background: 'var(--brand-primary, #f15a24)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '11px 16px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                  }}
                >
                  <Printer size={16} weight="bold" />
                  {hardwareTesting ? 'Printing...' : 'Print Test Receipt Ticket'}
                </button>

                <button
                  type="button"
                  disabled={hardwareTesting}
                  onClick={async () => {
                    setHardwareTesting(true);
                    try {
                      await PrinterService.kickCashDrawer('webusb');
                      success("Drawer trigger pulse sent!");
                    } catch (err) {
                      showError(err.message);
                    } finally {
                      setHardwareTesting(false);
                    }
                  }}
                  style={{
                    background: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: '9px 16px',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8
                  }}
                >
                  <Lightning size={16} weight="bold" color="#f59e0b" />
                  Test Cash Drawer Kick
                </button>
              </div>
            </div>
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
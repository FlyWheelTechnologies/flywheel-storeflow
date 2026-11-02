import React from "react";
import { formatCurrency } from "../../services/formatters";
import { ActionButton, Input, Select } from "../ui/FormFields";
import { DownloadSimple, UploadSimple, FilePdf, WhatsappLogo, Printer } from "@phosphor-icons/react";

const SalesTable = ({
  filteredSales,
  paginatedSales,
  itemsToShow,
  setItemsToShow,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  dateFilter,
  setDateFilter,
  onExportCSV,
  onImportCSV,
  onGenerateReceipt,
  onPrintThermalReceipt,
  onShareViaWhatsApp,
  saving = false
}) => {
  return (
    <div className="table-card">
      <div className="table-card__header">
        <h3 className="table-card__title">Recent Transactions</h3>
        <div className="table-card__actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <ActionButton variant="secondary" size="sm" onClick={onExportCSV} disabled={saving} title="Export to CSV">
              <DownloadSimple size={14} weight="bold" /> Export
            </ActionButton>
            <label 
              style={{ 
                cursor: saving ? 'not-allowed' : 'pointer', 
                opacity: saving ? 0.6 : 1,
                pointerEvents: saving ? 'none' : 'auto',
                display: 'flex', 
                alignItems: 'center' 
              }} 
              title="Import from CSV"
            >
              <ActionButton variant="secondary" size="sm" disabled={saving} style={{ pointerEvents: 'none' }}>
                <UploadSimple size={14} weight="bold" /> {saving ? 'Importing...' : 'Import'}
              </ActionButton>
              <input type="file" accept=".csv" onChange={onImportCSV} disabled={saving} style={{ display: 'none' }} />
            </label>
          </div>
          <Input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            style={{ width: 160 }}
          />
          <Select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            options={[
              { value: "All", label: "All Status" },
              { value: "PAID", label: "Paid" },
              { value: "PARTIAL", label: "Partial" },
              { value: "DEPOSIT", label: "Deposits" },
              { value: "UNPAID", label: "Unpaid" }
            ]}
            style={{ width: 140 }}
          />
          <Input
            type="search"
            placeholder="Search customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ minWidth: 200 }}
          />
        </div>
      </div>
      <div className="table-wrapper">
        <table className="stock-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedSales.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: 24 }}>No transactions found.</td>
              </tr>
            ) : paginatedSales.map(s => {
              const totalAmt = parseFloat(s.total_amount || 0);
              let amountPaidDisplay = s.amount_paid !== undefined && s.amount_paid !== null && !isNaN(parseFloat(s.amount_paid))
                ? parseFloat(s.amount_paid)
                : (s.payment_status === 'PAID' ? totalAmt : 0);
              let balanceDueDisplay = s.balance_due !== undefined && s.balance_due !== null && !isNaN(parseFloat(s.balance_due))
                ? parseFloat(s.balance_due)
                : Math.max(0, totalAmt - amountPaidDisplay);
              let changeDisplay = 0;

              if (s.notes) {
                const match = s.notes.match(/Change given:\s*(?:[A-Z]{3}|[^\d\s]+)?\s*([\d.]+)/i);
                if (match) {
                  changeDisplay = parseFloat(match[1]);
                  amountPaidDisplay = totalAmt + changeDisplay;
                  balanceDueDisplay = 0;
                }
              }

              return (
                <tr key={s.id}>
                  <td className="table-code">{s.invoice_no ? s.invoice_no : `#INV-${String(s.id).slice(-6).padStart(3, '0')}`}</td>
                  <td>{new Date(s.created_at).toLocaleDateString()}</td>
                  <td>{s.customer_name}</td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(s.total_amount)}</td>
                  <td>{formatCurrency(amountPaidDisplay)}</td>
                  <td>
                    <span className={`status-pill status-pill--${s.payment_status === 'PAID' ? 'ok' : 'low'}`}>
                      {s.payment_status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        onClick={() => onPrintThermalReceipt && onPrintThermalReceipt(s)}
                        title="Print Thermal POS Receipt"
                      >
                        <Printer size={16} weight="duotone" color="var(--brand-primary, #f15a24)" />
                      </ActionButton>
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        onClick={() => onGenerateReceipt(s)}
                        title="Download PDF Receipt"
                      >
                        <FilePdf size={16} weight="duotone" />
                      </ActionButton>
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        onClick={() => onShareViaWhatsApp(s)}
                        title="Send receipt on WhatsApp"
                      >
                        <WhatsappLogo size={16} weight="duotone" />
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredSales.length > itemsToShow && (
        <div style={{ padding: 20, textAlign: 'center', borderTop: '1px solid #f3f4f6' }}>
          <ActionButton variant="secondary" fullWidth onClick={() => setItemsToShow(prev => prev + 25)}>
            See More Transactions ↓
          </ActionButton>
        </div>
      )}
    </div>
  );
};

export default SalesTable;
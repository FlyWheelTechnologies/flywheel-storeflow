import React from "react";
import { formatCurrency } from "../../services/formatters";
import { ActionButton, Input, Select } from "../ui/FormFields";

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
  onShareViaWhatsApp
}) => {
  return (
    <div className="table-card">
      <div className="table-card__header">
        <h3 className="table-card__title">Recent Transactions</h3>
        <div className="table-card__actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <ActionButton variant="secondary" size="sm" onClick={onExportCSV} title="Export to CSV">
              📤 Export
            </ActionButton>
            <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Import from CSV">
              <ActionButton variant="secondary" size="sm">
                📥 Import
              </ActionButton>
              <input type="file" accept=".csv" onChange={onImportCSV} style={{ display: 'none' }} />
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
              let amountPaidDisplay = parseFloat(s.amount_paid);
              let balanceDueDisplay = parseFloat(s.balance_due);
              let changeDisplay = 0;

              if (s.notes && s.notes.includes('Change given: GHS')) {
                const match = s.notes.match(/Change given: GHS ([\d.]+)/);
                if (match) {
                  changeDisplay = parseFloat(match[1]);
                  amountPaidDisplay = parseFloat(s.total_amount) + changeDisplay;
                  balanceDueDisplay = 0;
                }
              }

              return (
                <tr key={s.id}>
                  <td className="table-code">{s.invoice_no ? s.invoice_no : `#INV-${String(s.id).slice(-6).padStart(3, '0')}`}</td>
                  <td>{new Date(s.created_at).toLocaleDateString()}</td>
                  <td>{s.customer_name}</td>
                  <td style={{ fontWeight: 600 }}>GHS {formatCurrency(s.total_amount)}</td>
                  <td>GHS {formatCurrency(amountPaidDisplay)}</td>
                  <td>
                    <span className={`status-pill status-pill--${s.payment_status === 'PAID' ? 'ok' : 'low'}`}>
                      {s.payment_status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        onClick={() => onGenerateReceipt(s)}
                        title="Download PDF Receipt"
                      >
                        📄
                      </ActionButton>
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        onClick={() => onShareViaWhatsApp(s)}
                        title="Send receipt on WhatsApp"
                      >
                        📱
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
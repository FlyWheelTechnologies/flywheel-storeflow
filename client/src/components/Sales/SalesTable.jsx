import React from "react";
import { formatCurrency } from "../../services/formatters";

const miniInp = { padding:'6px 10px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:12, background:'#f9fafb', outline: 'none' };

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
        <div className="table-card__actions">
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onExportCSV} style={miniInp} title="Export to CSV">📤 Export</button>
            <label style={{ ...miniInp, cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Import from CSV">
              📥 Import
              <input type="file" accept=".csv" onChange={onImportCSV} style={{ display: 'none' }} />
            </label>
          </div>
          <input type="date" style={miniInp} value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
          <select style={miniInp} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="All">All Status</option>
            <option value="PAID">Paid</option>
            <option value="PARTIAL">Partial</option>
            <option value="DEPOSIT">Deposits</option>
            <option value="UNPAID">Unpaid</option>
          </select>
          <input
            type="search"
            className="table-search"
            placeholder="Search customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
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
              <tr><td colSpan="8" style={{textAlign:'center', padding:24}}>No transactions found.</td></tr>
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
                  <td style={{fontWeight:600}}>GHS {formatCurrency(s.total_amount)}</td>
                  <td>GHS {formatCurrency(amountPaidDisplay)}</td>
                  <td>
                    <span className={`status-pill status-pill--${s.payment_status === 'PAID' ? 'ok' : 'low'}`}>
                      {s.payment_status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <button
                        onClick={() => onGenerateReceipt(s)}
                        style={{background:'none', border:'none', cursor:'pointer', fontSize:16, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'}}
                        title="Download PDF Receipt"
                      >
                        📄
                      </button>
                      <button
                        onClick={() => onShareViaWhatsApp(s)}
                        style={{background:'none', border:'none', cursor:'pointer', fontSize:16}}
                        title="Send receipt on WhatsApp"
                      >
                        📱
                      </button>
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
          <button
            onClick={() => setItemsToShow(prev => prev + 25)}
            style={{ width: '100%', padding: '12px', background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 8, color: '#4b5563', fontWeight: 600, cursor: 'pointer' }}
          >
            See More Transactions ↓
          </button>
        </div>
      )}
    </div>
  );
};

export default SalesTable;

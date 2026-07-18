import { useState, useRef, useEffect, useMemo } from "react";
import { supabase } from "../services/supabaseClient";
import "./Dashboard.css";
import { formatCurrency } from "../services/formatters";

const InfoTip = ({ text }) => (
  <span className="info-tip" title={text}>ⓘ
    <span className="info-tip__content">{text}</span>
  </span>
);

const getAccountColor = (type) => {
  const t = type?.toUpperCase();
  if (t === 'REVENUE' || t === 'CASH_IN' || t === 'CASH') return { bg: '#ecfdf5', text: '#059669' }; // Green
  if (t === 'EXPENSE' || t === 'TAX_PAYABLE') return { bg: '#fef2f2', text: '#ef4444' }; // Red
  if (t === 'ACCOUNTS_RECEIVABLE' || t === 'DEBT') return { bg: '#fff7ed', text: '#f97316' }; // Orange
  if (t === 'MOMO' || t === 'BANK' || t === 'CHECKING') return { bg: '#eff6ff', text: '#2563eb' }; // Blue
  if (t === 'CUSTOMER_DEPOSIT' || t === 'INTEREST') return { bg: '#f5f3ff', text: '#7c3aed' }; // Purple
  return { bg: '#f3f4f6', text: '#6b7280' }; // Gray
};

export default function JournalEntries() {
  const [search, setSearch] = useState("");
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const printRef = useRef();

  const [viewMode, setViewMode] = useState("Daily"); // Daily, Monthly, AllTime
  const [accountTypeFilter, setAccountTypeFilter] = useState("All");
  const [itemsToShow, setItemsToShow] = useState(25);
  const [journal, setJournal] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [journalRes, salesRes, expensesRes] = await Promise.all([
      supabase.from('journal_entries').select('*').order('created_at', { ascending: false }),
      supabase.from('sales').select('*'),
      supabase.from('expenses').select('*')
    ]);
    if (journalRes.data) setJournal(journalRes.data);
    if (salesRes.data) setSales(salesRes.data);
    if (expensesRes.data) setExpenses(expensesRes.data);
    setTimeout(() => setLoading(false), 1000);
  };

  useEffect(() => {
    fetchData();
  }, []);
  
  // Filter data based on selected date/mode
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      if (viewMode === 'Daily') return s.created_at.startsWith(selectedDate);
      if (viewMode === 'Monthly') return s.created_at.startsWith(selectedDate.substring(0, 7));
      return true; // All Time
    });
  }, [sales, viewMode, selectedDate]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (viewMode === 'Daily') return e.created_at.startsWith(selectedDate);
      if (viewMode === 'Monthly') return e.created_at.startsWith(selectedDate.substring(0, 7));
      return true;
    });
  }, [expenses, viewMode, selectedDate]);

  // Calculate totals for the summary cards
  const report = useMemo(() => {
    const totalsales = filteredSales.filter(s => s.payment_status !== 'DEPOSIT').reduce((a, s) => a + parseFloat(s.total_amount || 0), 0);
    const totalpaid = filteredSales.reduce((a, s) => a + parseFloat(s.amount_paid || 0), 0);
    const totalexpenses = filteredExpenses.reduce((a, e) => a + parseFloat(e.amount || 0), 0);
    const totaltax = filteredSales.filter(s => s.payment_status !== 'DEPOSIT').reduce((a, s) => a + parseFloat(s.tax_amount || 0), 0);
    const netcash = totalpaid - totalexpenses;
    return { totalsales, totalpaid, totalexpenses, totaltax, netcash };
  }, [filteredSales, filteredExpenses]);

  // Grouping logic for Monthly and All Time
  const currentData = useMemo(() => {
    const grouped = {};
    const source = journal
      .filter(j => {
        if (viewMode === 'Monthly') return j.created_at.startsWith(selectedDate.substring(0, 7));
        if (viewMode === 'AllTime') return true;
        return j.created_at.startsWith(selectedDate);
      })
      .filter(j => accountTypeFilter === 'All' || j.account_type === accountTypeFilter);

    if (viewMode === 'Daily') return source;

    source.forEach(j => {
      const date = j.created_at.split('T')[0];
      if (!grouped[date]) grouped[date] = { date, debit: 0, credit: 0, count: 0, entries: [] };
      grouped[date].debit += j.debit || 0;
      grouped[date].credit += j.credit || 0;
      grouped[date].count += 1;
      grouped[date].entries.push(j);
    });

    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
  }, [journal, viewMode, selectedDate, accountTypeFilter]);

  const paginated = useMemo(() => currentData.slice(0, itemsToShow), [currentData, itemsToShow]);

  const totalDebits = useMemo(() => currentData.reduce((a, j) => a + (j.debit || 0), 0), [currentData]);
  const totalCredits = useMemo(() => currentData.reduce((a, j) => a + (j.credit || 0), 0), [currentData]);

  const handleExportCSV = () => {
    const isExportAll = viewMode === 'Monthly' || viewMode === 'AllTime';
    const exportData = isExportAll ? journal : currentData;
    
    // Headers: Different format for full raw export vs aggregated daily view
    const headers = isExportAll 
      ? ["Date", "Account Type", "Debit (In)", "Credit (Out)", "Description"]
      : ["Date", "Debit", "Credit", "Description/Count"];

    const rows = exportData.map(j => {
      if (isExportAll) {
        // Raw entries export
        return [
          new Date(j.created_at).toLocaleString(),
          j.account_type,
          j.debit?.toFixed(1) || '0',
          j.credit?.toFixed(1) || '0',
          `"${j.description?.replace(/"/g, '""') || ''}"`
        ];
      }
      // Aggregated or Daily view export
      return [
        viewMode === 'Daily' ? new Date(j.created_at).toLocaleString() : j.date,
        j.debit?.toFixed(1),
        j.credit?.toFixed(1),
        viewMode === 'Daily' ? `"${j.description?.replace(/"/g, '""') || ''}"` : `${j.count} entries`
      ];
    });
    
    const csvContent = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.body.appendChild(document.createElement("a"));
    link.href = URL.createObjectURL(blob);
    link.download = isExportAll ? `Accounting_All_Entries_${today}.csv` : `Accounting_${viewMode}_${selectedDate}.csv`;
    link.click();
    document.body.removeChild(link);
  };
  if (loading) {
    return (
      <div className="journal-container" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div className="skeleton" style={{ width: 300, height: 40 }} />
          <div style={{ display:'flex', gap:10 }}>
            <div className="skeleton" style={{ width: 120, height: 40 }} />
            <div className="skeleton" style={{ width: 120, height: 40 }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 16 }} />)}
        </div>
        <div style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div className="skeleton" style={{ height: 45, marginBottom: 20, width: '100%' }} />
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="skeleton" style={{ height: 50, marginBottom: 12, width: '100%' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }} className="journal-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 className="section-title">Accounting Ledger</h2>
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }} className="no-print">
            {['Daily', 'Monthly', 'AllTime'].map(m => (
              <button 
                key={m}
                onClick={() => { setViewMode(m); setItemsToShow(20); }}
                style={{ 
                  padding: '6px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                  background: viewMode === m ? 'var(--brand-primary)' : '#e5e7eb',
                  color: viewMode === m ? '#fff' : '#4b5563'
                }}
              >
                {m === 'AllTime' ? 'See All' : m}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {viewMode !== 'AllTime' && (
            <input 
              type={viewMode === 'Daily' ? "date" : "month"} 
              className="table-search" 
              value={viewMode === 'Daily' ? selectedDate : selectedDate.substring(0, 7)} 
              onChange={e => setSelectedDate(e.target.value)} 
              style={{ width: 160 }}
            />
          )}
          <select 
            className="table-search" 
            value={accountTypeFilter} 
            onChange={e => setAccountTypeFilter(e.target.value)}
            style={{ width: 160 }}
          >
            <option value="All">All Accounts</option>
            {[...new Set(journal.map(j => j.account_type))].sort().map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <button onClick={handleExportCSV} className="action-btn" style={{ background: '#059669', color: '#fff' }}>
            {viewMode === 'Daily' ? 'Audit Export' : 'Export All'}
          </button>
          <button onClick={() => window.print()} className="action-btn" style={{ background: '#333', color: '#fff' }}>
            Print PDF
          </button>
        </div>
      </div>

      <div className="kpi-row" style={{ marginBottom:24 }}>
        <div className="stat-card">
          <div className="stat-card__header"><span className="stat-card__label">Expected Revenue <InfoTip text="Total sales recorded including tax. This is what you should have collected if all sales were paid." /></span></div>
          <div className="stat-card__value">GHS {formatCurrency(report.totalsales)}</div>
          <div style={{fontSize:11, color:'#6b7280', marginTop:4}}>Includes GHS {formatCurrency(report.totaltax)} Tax</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__header"><span className="stat-card__label">Actual Cash In <InfoTip text="Money actually received from customers via cash, momo, or bank deposits." /></span></div>
          <div className="stat-card__value" style={{color:'#059669'}}>GHS {formatCurrency(report.totalpaid)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__header"><span className="stat-card__label">Total Expenses <InfoTip text="All operational costs recorded: utilities, staff, supplies, rent, etc." /></span></div>
          <div className="stat-card__value" style={{color:'#ef4444'}}>GHS {formatCurrency(report.totalexpenses)}</div>
        </div>
        <div className="stat-card" style={{borderLeft:'3px solid var(--brand-primary)'}}>
          <div className="stat-card__header"><span className="stat-card__label">Net Cash Balance <InfoTip text="What you have left after expenses. Calculated as: Actual Cash In - Total Expenses." /></span></div>
          <div className="stat-card__value" style={{color: report.netcash >= 0 ? '#059669' : '#ef4444'}}>GHS {formatCurrency(report.netcash)}</div>
        </div>
      </div>

      <div className="table-card print-section">
        <div className="table-card__header">
          <h3 className="table-card__title">
            {viewMode === 'Daily' ? `Ledger for ${new Date(selectedDate).toDateString()}` : `${viewMode} Financial Summary`}
          </h3>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{fontSize:12, display:'flex', gap:10}} className="no-print">
              <span style={{color:'#059669', fontWeight:700}}>Total Debits: GHS {formatCurrency(totalDebits)}</span>
              <span style={{color:'#ef4444', fontWeight:700}}>Total Credits: GHS {formatCurrency(totalCredits)}</span>
            </div>
          </div>
        </div>
        <div className="table-wrapper">
          <table className="stock-table">
            <thead>
              {viewMode === 'Daily' ? (
                <tr><th>Time</th><th>Account</th><th>Debit (In)</th><th>Credit (Out)</th><th>Description</th></tr>
              ) : (
                <tr><th>Date</th><th>Daily Debit (In)</th><th>Daily Credit (Out)</th><th>Transactions</th><th>Actions</th></tr>
              )}
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan="5" style={{textAlign:'center', padding:24}}>No records found.</td></tr>
              ) : paginated.map((j, idx) => viewMode === 'Daily' ? (
                <tr key={j.id}>
                  <td style={{fontSize:11, color:'#6b7280'}}>{new Date(j.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                  <td>
                    <span style={{
                      background: getAccountColor(j.account_type).bg, 
                      padding: '2px 8px', 
                      borderRadius: 4, 
                      fontSize: 11, 
                      fontWeight: 600, 
                      color: getAccountColor(j.account_type).text
                    }}>
                      {j.account_type}
                    </span>
                  </td>
                  <td style={{fontWeight:600, color: j.debit > 0 ? '#059669' : '#ccc'}}>{j.debit > 0 ? `GHS ${formatCurrency(j.debit)}` : '—'}</td>
                  <td style={{fontWeight:600, color: j.credit > 0 ? '#ef4444' : '#ccc'}}>{j.credit > 0 ? `GHS ${formatCurrency(j.credit)}` : '—'}</td>
                  <td style={{fontSize:13}}>{j.description}</td>
                </tr>
              ) : (
                <tr key={j.date} style={{ cursor: 'pointer' }} onClick={() => { setSelectedDate(j.date); setViewMode('Daily'); }}>
                  <td style={{ fontWeight: 700 }}>{new Date(j.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</td>
                  <td style={{ color: '#059669', fontWeight: 600 }}>GHS {formatCurrency(j.debit)}</td>
                  <td style={{ color: '#ef4444', fontWeight: 600 }}>GHS {formatCurrency(j.credit)}</td>
                  <td style={{ fontSize: 12 }}>{j.count} entries recorded</td>
                  <td><button className="action-btn" style={{ fontSize: 10, padding: '4px 8px' }}>View Day</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {currentData.length > itemsToShow && (
          <div className="no-print" style={{ padding: 20, textAlign: 'center' }}>
            <button 
              onClick={() => setItemsToShow(prev => prev + 25)}
              style={{ width: '100%', padding: '12px', background: '#f3f4f6', border: '1px dashed #d1d5db', borderRadius: 8, color: '#4b5563', fontWeight: 600, cursor: 'pointer' }}
            >
              See More Transactions ↓
            </button>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .no-print, .sidebar, .top-nav { display: none !important; }
          .app-shell { display: block !important; }
          .main-content { margin-left: 0 !important; padding: 0 !important; }
          .table-card { box-shadow: none !important; border: none !important; }
          .print-section { width: 100% !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

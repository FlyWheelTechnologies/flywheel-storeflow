import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { BarChart, Bar, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import "./Dashboard.css";
import { formatCurrency, formatPhone } from "../services/formatters";

const InfoTip = ({ text }) => (
  <span className="info-tip" title={text}>ⓘ
    <span className="info-tip__content">{text}</span>
  </span>
);

/* ─── Stat Card ────────────────────────────────── */
function StatCard({ icon, label, value, trend, accent, children }) {
  return (
    <div className={`stat-card ${accent ? `stat-card--${accent}` : ""}`}>
      <div className="stat-card__header">
        <span className="stat-card__label">{label}</span>
        <span className="stat-card__icon">{icon}</span>
      </div>
      <div className="stat-card__value">{value}</div>
      {children}
    </div>
  );
}

/* ─── MAIN DASHBOARD ───────────────────────────── */
export default function Dashboard() {
  const { user, activeOrg } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [logs, setLogs] = useState([]);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depCustName, setDepCustName] = useState('');
  const [depCustPhone, setDepCustPhone] = useState('+233');
  const [depAmount, setDepAmount] = useState('');
  const [depMethod, setDepMethod] = useState('Cash');
  const [depSaving, setDepSaving] = useState(false);
  const [timeframe, setTimeframe] = useState('7d');
  const [toast, setToast] = useState(null);

  const fetchData = async () => {
    if (!navigator.onLine) return; 
    
    const [productsRes, salesRes, expensesRes, logsRes] = await Promise.all([
      supabase.from('products').select('*'),
      supabase.from('sales').select('*'),
      supabase.from('expenses').select('*'),
      supabase.from('logs').select('*').order('created_at', { ascending: false }).limit(50)
    ]);

    if (productsRes.data) setProducts(productsRes.data);
    if (salesRes.data) setSales(salesRes.data);
    if (expensesRes.data) setExpenses(expensesRes.data);
    if (logsRes.data) setLogs(logsRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePureDeposit = async (e) => {
    e.preventDefault();
    if (!depCustName || !depCustPhone || !depAmount) return setToast({ message: "Please fill all fields", type: "error" });
    setDepSaving(true);
    try {
      const { data, error } = await supabase.rpc('record_pure_deposit', {
        p_customer_name: depCustName,
        p_customer_phone: depCustPhone,
        p_amount: parseFloat(depAmount),
        p_recorded_by: user?.email,
        p_payment_method: depMethod
      });

      if (error) throw error;

      // Success logic
      setShowDepositModal(false);
      setDepCustName('');
      setDepCustPhone('+233');
      setDepAmount('');
      
      setToast({ message: "Deposit recorded successfully!", type: "success" });
      setTimeout(() => setToast(null), 4000);
      
      // Refresh data locally without page reload
      fetchData();
    } catch (err) {
      setToast({ message: "Error: " + err.message, type: "error" });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setDepSaving(false);
    }
  };
  const [showAudit, setShowAudit] = useState(false);

  const generatePDF = () => {
    const orgName = activeOrg?.name || 'StoreFlow';
    const currency = activeOrg?.currency || 'GHS';
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`${orgName} Management Report`, 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    autoTable(doc, {
      startY: 40,
      head: [['Metric', 'Value']],
      body: [
        ['Total Sales Today', `${currency} ${todayRevenue.toFixed(1)}`],
        ['Total Stock Value', `${currency} ${stockValue.toFixed(1)}`],
        ['Low Stock Count', `${lowStockCount} Items`],
      ],
    });

    doc.text('Recent Sales Status', 14, doc.lastAutoTable.finalY + 10);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 15,
      head: [['Product', 'Stock Qty', 'Status']],
      body: products.slice(0, 10).map(p => [p.name, p.stock_quantity, p.stock_quantity < 10 ? 'LOW' : 'OK']),
    });

    const fileSafeName = orgName.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`${fileSafeName}_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Morning";
    if (hour < 17) return "Afternoon";
    return "Evening";
  };

  const { todaySales, todayCashIn, todayRevenue } = useMemo(() => {
    const todayDate = new Date().toDateString();
    const tSales = sales.filter(s => new Date(s.created_at).toDateString() === todayDate);
    const tCashIn = tSales.reduce((a, s) => a + parseFloat(s.amount_paid || 0), 0);
    const tRevenue = tSales
      .filter(s => s.payment_status !== 'DEPOSIT')
      .reduce((a, s) => a + parseFloat(s.total_amount || 0), 0);
    return { todaySales: tSales, todayCashIn: tCashIn, todayRevenue: tRevenue };
  }, [sales]);

  const {
    stockValue,
    totalSalesValue,
    totalProfit,
    profitPercentage,
    lowStockCount,
    depletedCount,
    bestSeller,
    actualGrossMargin
  } = useMemo(() => {
    const sVal = products.reduce((acc, p) => acc + (parseFloat(p.cost_price || 0) * Math.max(0, parseFloat(p.stock_quantity || 0))), 0);
    const tSalesVal = products.reduce((acc, p) => acc + (parseFloat(p.selling_price || 0) * Math.max(0, parseFloat(p.stock_quantity || 0))), 0);
    const tProfit = tSalesVal - sVal;
    const pPct = sVal > 0 ? ((tProfit / sVal) * 100).toFixed(1) : 0;
    const lowStock = products.filter(p => p.stock_quantity > 0 && p.stock_quantity < (p.low_stock_threshold || 10)).length;
    const depleted = products.filter(p => p.stock_quantity <= 0).length;
    const bSeller = products.length > 0 
      ? [...products]
          .sort((a, b) => (b.total_sold || 0) - (a.total_sold || 0))
          .slice(0, 3)
          .map(p => p.name)
      : [];
    const gMargin = tSalesVal > 0 ? ((tProfit / tSalesVal) * 100).toFixed(1) : "0.0";

    return {
      stockValue: sVal,
      totalSalesValue: tSalesVal,
      totalProfit: tProfit,
      profitPercentage: pPct,
      lowStockCount: lowStock,
      depletedCount: depleted,
      bestSeller: bSeller,
      actualGrossMargin: gMargin
    };
  }, [products]);

  const userName = user?.full_name || user?.email?.split('@')[0];

  const chartData = useMemo(() => {
    if (timeframe === '7d' || timeframe === '30d') {
      const days = timeframe === '7d' ? 7 : 30;
      return Array.from({ length: days }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1 - i));
        const dateStr = d.toDateString();
        const daySales = sales.filter(s => new Date(s.created_at).toDateString() === dateStr)
                             .reduce((acc, s) => acc + parseFloat(s.amount_paid || 0), 0);
        const dayExpenses = expenses.filter(e => new Date(e.created_at).toDateString() === dateStr)
                                   .reduce((acc, e) => acc + parseFloat(e.amount || 0), 0);
        return {
          name: days === 7 ? d.toLocaleDateString([], { weekday: 'short' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
          Revenue: daySales,
          Expenses: dayExpenses
        };
      });
    }

    if (timeframe === 'YoY') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const thisYear = new Date().getFullYear();
      const lastYear = thisYear - 1;
      
      return months.map((m, i) => {
        const thisYearSales = sales.filter(s => {
          const d = new Date(s.created_at);
          return d.getFullYear() === thisYear && d.getMonth() === i;
        }).reduce((acc, s) => acc + parseFloat(s.amount_paid || 0), 0);
        
        const lastYearSales = sales.filter(s => {
          const d = new Date(s.created_at);
          return d.getFullYear() === lastYear && d.getMonth() === i;
        }).reduce((acc, s) => acc + parseFloat(s.amount_paid || 0), 0);
        
        return {
          name: m,
          'This Year': thisYearSales,
          'Last Year': lastYearSales
        };
      });
    }
    return [];
  }, [timeframe, sales, expenses]);

  if (loading) {
    return (
      <div className="dashboard-container" style={{ padding: 30 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:30 }}>
          <div className="skeleton" style={{ width: 350, height: 45 }} />
          <div className="skeleton" style={{ width: 140, height: 40 }} />
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginBottom: 32 }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton" style={{ height: 140, borderRadius: 16 }} />
          ))}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          <div className="skeleton" style={{ height: 450, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 450, borderRadius: 16 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="greeting-card__content">
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', marginBottom: 2, letterSpacing: 1.5 }}>Sunyani, Ghana 🇬🇭</div>
            <h1 className="greeting" style={{ marginBottom: 4 }}>Good {getGreeting()}, <span style={{ color: '#f15a24' }}>{user?.full_name?.split(' ')[0] || 'Member'}</span>!</h1>
            <p className="greeting-sub">
              {depletedCount > 0 ? (
                <span style={{ color: '#ef4444', fontWeight: 800 }}>⚠️ {depletedCount} items are completely depleted! </span>
              ) : lowStockCount > 0 ? (
                `You have ${lowStockCount} items running low. `
              ) : (
                'All stock levels are healthy. '
              )}
              {user?.role !== 'storekeeper' && (
                <>Today's revenue is <span style={{ fontWeight: 700, color: '#f15a24' }}>GHS {todayRevenue.toFixed(1)}</span>.</>
              )}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {user?.role !== 'auditor' && (
            <>
              <button className="quick-action-btn" style={{ background: '#6b7280' }} onClick={() => navigate("/expenses", { state: { showForm: true } })}>Record Expense</button>
              <button className="quick-action-btn" style={{ background: '#3b82f6' }} onClick={() => navigate("/deposits", { state: { showForm: true } })}>📥 Record Deposit</button>
              <button className="quick-action-btn" style={{ background: '#4f46e5' }} onClick={() => navigate("/products", { state: { showForm: true } })}>+ Add Product</button>
              <button className="quick-action-btn" style={{ background: '#059669' }} onClick={() => navigate("/sales", { state: { showForm: true } })}>Record Sale</button>
            </>
          )}
        </div>
      </div>

      <div className="kpi-row">
        {user?.role !== 'storekeeper' && (
          <>
            <StatCard
              label={<>Today's Cash In <InfoTip text="Total cash and momo collected today." /></>}
              value={`GHS ${formatCurrency(todayCashIn)}`}
              icon="💰"
            />
            <StatCard
              label={<>Today's Revenue <InfoTip text="Total volume of sales recorded (Paid + Credit)." /></>}
              value={`GHS ${formatCurrency(todayRevenue)}`}
              icon="📈"
              accent="primary"
            />
          </>
        )}
        <StatCard
          label={<>Pending Deposits <InfoTip text="Orders paid in advance awaiting fulfillment." /></>}
          value={`${sales.filter(s => s.payment_status === 'DEPOSIT' || (s.payment_status === 'PARTIAL' && s.balance_due > 0)).length} Orders`}
          accent="primary"
          icon="⏳"
        />
        {user?.role === 'storekeeper' ? (
          <StatCard
            label={<>Total Products <InfoTip text="Total number of unique products." /></>}
            value={`${products.length} Products`}
            icon="📦"
          />
        ) : (
          <>
            <StatCard
              label={<>Stock Value <InfoTip text="Total value of all items currently in warehouse (Cost Price)." /></>}
              value={`GHS ${formatCurrency(stockValue)}`}
              icon="📦"
            />
            <StatCard
              label={<>Sales Value <InfoTip text="Total cash you'll collect if everything sells. The % shows your 'Markup'—how much you added on top of the cost price." /></>}
              value={`GHS ${formatCurrency(totalSalesValue)}`}
              icon="💵"
            >
              {totalProfit > 0 && (
                <div style={{ marginTop: 8, fontSize: 13, color: '#10b981', fontWeight: 600 }}>
                  +GHS {formatCurrency(totalProfit)} (+{profitPercentage}%)
                </div>
              )}
            </StatCard>
          </>
        )}
        <StatCard
          label={<>Low Stock <InfoTip text="Items that have fallen below their minimum threshold." /></>}
          value={`${lowStockCount} Items`}
          accent="warning"
          icon="⚠️"
        />
      </div>

      <div className={`dashboard-grid ${user?.role === 'storekeeper' ? 'dashboard-grid--storekeeper' : ''}`}>
        {user?.role !== 'storekeeper' ? (
          <div className="table-card" style={{ padding: 20, minHeight: 350, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 className="table-card__title" style={{ margin: 0 }}>
                {timeframe === 'YoY' ? 'Year-over-Year Sales' : `Revenue Trend (${timeframe === '7d' ? '7D' : '30D'})`}
              </h3>
              <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 8, padding: 3 }}>
                {['7d', '30d', 'YoY'].map(t => (
                  <button
                    key={t}
                    onClick={() => setTimeframe(t)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: 'none',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: timeframe === t ? '#fff' : 'transparent',
                      color: timeframe === t ? '#f15a24' : '#6b7280',
                      boxShadow: timeframe === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    {t === '7d' ? '7D' : t === '30d' ? '30D' : 'YoY'}
                  </button>
                ))}
              </div>
            </div>
            <div className="chart-container" style={{ height: 350, width: '100%', minWidth: 0 }}>
              {chartData && chartData.length > 0 && (
                <ResponsiveContainer width="100%" height="100%" minHeight={350} minWidth={0} debounce={50}>
                  {timeframe === 'YoY' ? (
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f2f6" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6b7280'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6b7280'}} />
                      <ChartTooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: 10 }} />
                      <Line type="monotone" dataKey="This Year" stroke="#f15a24" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                      <Line type="monotone" dataKey="Last Year" stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 5" dot={{r: 3}} />
                    </LineChart>
                  ) : (
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f15a24" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f15a24" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f2f6" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6b7280'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#6b7280'}} />
                      <ChartTooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: 10 }} />
                      <Area type="monotone" dataKey="Revenue" stroke="#f15a24" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                      <Area type="monotone" dataKey="Expenses" stroke="#6b7280" strokeWidth={2} fillOpacity={0} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </div>
        ) : (
          <div className="table-card" style={{ padding: 20, display:'flex', alignItems:'center', justifyContent:'center', background:'#f9fafb', border:'1px dashed #ddd' }}>
            <div style={{ textAlign:'center', color:'#6b7280' }}>
              <div style={{ fontSize:24, marginBottom:10 }}>📦</div>
              <p style={{ fontWeight:600 }}>Operational Dashboard</p>
              <p style={{ fontSize:12 }}>Financial charts are restricted to Admin/Auditor roles.</p>
            </div>
          </div>
        )}

        <div className="quick-actions" style={{ width: '100%' }}>
          <div className="table-card" style={{ height: '100%', padding: 20 }}>
            <h3 className="table-card__title" style={{ marginBottom: 20 }}>System Tools</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button className="quick-action-btn" style={{ background: '#374151', width: '100%' }} onClick={generatePDF}>
                📄 Download PDF Report
              </button>
              {user?.role === 'admin' && (
                <button className="quick-action-btn" style={{ background: '#4b5563', width: '100%' }} onClick={() => setShowAudit(true)}>
                  🔍 System Audit View
                </button>
              )}
            </div>
            
            {user?.role !== 'storekeeper' && (
              <>
                <h3 className="table-card__title" style={{ marginTop: 30, marginBottom: 15, display: 'flex', alignItems: 'center', gap: 6 }}>✨ Quick Insights</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="summary-card">
                    <div className="summary-card__label">Best Sellers</div>
                    <div className="summary-card__value" style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                      {Array.isArray(bestSeller) && bestSeller.length > 0 ? bestSeller.map((name, idx) => (
                        <div key={idx} style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{idx + 1}. {name}</div>
                      )) : (
                        <div style={{ fontSize: 13, color: '#9ca3af' }}>No sales yet</div>
                      )}
                    </div>
                    <div className="summary-card__sub">Top items by volume</div>
                  </div>
                  <div className="summary-card" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                    <div className="summary-card__label" style={{ color: '#065f46' }}>Gross Margin <InfoTip text="How much of your current sales is actual profit. It shows what percentage of every GHS 1 earned is yours to keep after paying for the products." /></div>
                    <div className="summary-card__value" style={{ color: '#065f46' }}>{actualGrossMargin}%</div>
                    <div className="summary-card__sub" style={{ color: '#047857' }}>Based on current stock pricing</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="table-card" style={{ marginTop: 24 }}>
          <div className="table-card__header">
            <h3 className="table-card__title">Recent Stock Status</h3>
          </div>
          <div className="table-wrapper">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Item Name</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.slice(0, 8).map((p) => (
                  <tr 
                    key={p.id} 
                    onClick={() => navigate("/products")} 
                    style={{ cursor: 'pointer' }}
                    className="clickable-row"
                  >
                    <td className="table-code" style={{ fontSize: '11px', fontWeight: 600 }}>{p.item_code || '---'}</td>
                    <td style={{ fontWeight: 500 }}>{p.name}</td>
                    <td>{p.stock_quantity}</td>
                    <td>{p.selling_uom}</td>
                    <td>
                      {p.stock_quantity <= 0 ? (
                        <span className="status-pill" style={{ background: '#000', color: '#fff', fontSize: '10px' }}>DEPLETED</span>
                      ) : (
                        <span className={`status-pill status-pill--low`}>
                          Low
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      {showAudit && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div className="modal-card" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>System Activity Audit</h3>
              <button className="close-btn" onClick={() => setShowAudit(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table className="stock-table" style={{ fontSize: 12 }}>
                <thead><tr><th>User</th><th>Action</th><th>Details</th><th>Time</th></tr></thead>
                <tbody>
                  {logs.slice(0, 20).map(l => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 600 }}>{l.user_email}</td>
                      <td><span className="status-pill status-pill--ok" style={{ fontSize: 10 }}>{l.action}</span></td>
                      <td>{l.details}</td>
                      <td style={{ color: '#9ca3af' }}>{new Date(l.created_at).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showDepositModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', padding: 32, borderRadius: 20, width: 420, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: '#111827' }}>📥 Record Customer Deposit</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>Add a prepayment to a customer's account balance. This does not affect stock.</p>
            
            <form onSubmit={handlePureDeposit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Customer Name</label>
                <input type="text" value={depCustName} onChange={e => setDepCustName(e.target.value)} placeholder="e.g. John Doe" style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14 }} required />
              </div>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Phone Number</label>
                <input 
                  type="text" 
                  value={depCustPhone} 
                  onChange={e => setDepCustPhone(formatPhone(e.target.value))} 
                  placeholder="+233XXXXXXXXX" 
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14 }} 
                  required 
                />
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Amount (GHS)</label>
                  <input type="number" step="0.1" value={depAmount} onChange={e => setDepAmount(e.target.value)} placeholder="0.0" style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14 }} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Method</label>
                  <select value={depMethod} onChange={e => setDepMethod(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, background: '#fff' }}>
                    <option>Cash</option>
                    <option>Momo</option>
                    <option>Bank</option>
                  </select>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" onClick={() => setShowDepositModal(false)} style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={depSaving} style={{ flex: 2, padding: '14px', borderRadius: 12, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: depSaving ? 0.7 : 1 }}>
                  {depSaving ? 'Recording...' : 'Record Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Status Toasts */}
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
    </div>
  );
}

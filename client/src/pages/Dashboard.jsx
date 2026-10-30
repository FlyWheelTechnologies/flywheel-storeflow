import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../hooks/useProducts";
import { useSales } from "../hooks/useSales";
import { useExpenses } from "../hooks/useExpenses";
import { useToast } from "../context/ToastContext";
import { BarChart, Bar, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Package,
  TrendUp,
  Percent,
  Receipt,
  Warning,
  Tag,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  ShieldCheck,
  ChartLineUp,
  Coins,
  Clock,
  CurrencyCircleDollar,
  HandCoins,
  Plus,
  ShoppingCart
} from "@phosphor-icons/react";
import "./Dashboard.css";
import { formatCurrency, formatPhone } from "../services/formatters";
import { ActionButton, Label, Input, Select } from "../components/ui/FormFields";
import { PageSkeleton } from "../components/LoadingStates";

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
  const { user, activeOrg, activeOrgId, impersonatedOrg } = useAuth();
  const businessName = activeOrg?.name || user?.organizations?.name || (user?.role === 'super_admin' ? 'StoreFlow Admin' : 'StoreFlow');
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  // If a Super Admin enters /dashboard directly without actively impersonating a store, route them to /admin
  useEffect(() => {
    if (user?.role === 'super_admin' && !impersonatedOrg) {
      navigate("/admin", { replace: true });
    }
  }, [user, impersonatedOrg, navigate]);

  const { products, loading: productsLoading, refetch: refetchProducts } = useProducts();
  const { sales, loading: salesLoading, refetch: refetchSales } = useSales();
  const { expenses, loading: expensesLoading, refetch: refetchExpenses } = useExpenses();

  const [logs, setLogs] = useState([]);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depCustName, setDepCustName] = useState('');
  const [depCustPhone, setDepCustPhone] = useState('+233');
  const [depAmount, setDepAmount] = useState('');
  const [depMethod, setDepMethod] = useState('Cash');
  const [depSaving, setDepSaving] = useState(false);
  const [timeframe, setTimeframe] = useState('7d');
  const [showAudit, setShowAudit] = useState(false);

  const loading = productsLoading || salesLoading || expensesLoading;

  const fetchLogs = useCallback(async () => {
    if (!activeOrgId) return;
    const { data } = await supabase
      .from('logs')
      .select('*')
      .eq('organization_id', activeOrgId)
      .order('created_at', { ascending: false })
      .limit(50);
    setLogs(data || []);
  }, [activeOrgId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handlePureDeposit = async (e) => {
    e.preventDefault();
    if (!depCustName || !depCustPhone || !depAmount) return showError("Please fill all fields");
    setDepSaving(true);
    try {
      const { data, error } = await supabase.rpc('record_pure_deposit', {
        p_customer_name: depCustName,
        p_customer_phone: depCustPhone,
        p_amount: parseFloat(depAmount),
        p_recorded_by: user?.email || 'System',
        p_payment_method: depMethod,
        p_organization_id: activeOrgId || null
      });

      if (error) throw error;

      setShowDepositModal(false);
      setDepCustName('');
      setDepCustPhone('+233');
      setDepAmount('');

      success("Deposit recorded successfully!");
      refetchProducts();
      refetchSales();
      fetchLogs();
    } catch (err) {
      showError("Error: " + err.message);
    } finally {
      setDepSaving(false);
    }
  };

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

  const todayExpenses = useMemo(() => {
    const todayDate = new Date().toDateString();
    return expenses
      .filter(e => new Date(e.created_at).toDateString() === todayDate)
      .reduce((acc, e) => acc + parseFloat(e.amount || 0), 0);
  }, [expenses]);

  const pendingOrdersCount = useMemo(() => {
    return sales.filter(s => s.payment_status === 'DEPOSIT' || (s.payment_status === 'PARTIAL' && s.balance_due > 0)).length;
  }, [sales]);

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

  const currency = user?.organizations?.currency || 'GHS';

  if (loading) {
    return <PageSkeleton title stats={true} table={false} />;
  }

  const locationString = activeOrg?.address || activeOrg?.city || user?.organizations?.address || 'SUNYANI, GHANA';
  const firstName = userName ? userName.split(' ')[0] : 'Godwin';

  return (
    <div className="page-wrapper" style={{ padding: 24 }}>
      {/* ─── Top Header with Main Action Buttons on the Top Right Corner ─── */}
      <div className="dash-header-row">
        <div className="dash-header-left">
          <div className="dash-header-location">
            {locationString.toUpperCase()} <span className="dash-header-country">GH</span>
          </div>
          <h1 className="dash-header-title">
            Good {getGreeting()}, <span className="dash-header-name">{firstName}!</span>
          </h1>
          {depletedCount > 0 ? (
            <div className="dash-header-alert">
              <span className="dash-header-alert-icon">⚠️</span>{" "}
              <strong>{depletedCount} item{depletedCount > 1 ? 's are' : ' is'} completely depleted!</strong> Today's revenue is {formatCurrency(todayRevenue, currency)}.
            </div>
          ) : (
            <div className="dash-header-subtitle">
              Today's revenue is <strong>{formatCurrency(todayRevenue, currency)}</strong>.
            </div>
          )}
        </div>

        {user?.role !== 'auditor' && (
          <div className="dash-header-actions">
            <button
              type="button"
              className="dash-action-btn dash-action-btn--expense"
              onClick={() => navigate("/expenses", { state: { showForm: true } })}
            >
              Record Expense
            </button>

            <button
              type="button"
              className="dash-action-btn dash-action-btn--deposit"
              onClick={() => setShowDepositModal(true)}
            >
              Record Deposit
            </button>

            <button
              type="button"
              className="dash-action-btn dash-action-btn--product"
              onClick={() => navigate("/products", { state: { showAddProduct: true } })}
            >
              + Add Product
            </button>

            <button
              type="button"
              className="dash-action-btn dash-action-btn--sale"
              onClick={() => navigate("/sales")}
            >
              Record Sale
            </button>
          </div>
        )}
      </div>

      {/* ─── Executive KPI Cards Grid ─── */}
      <div className="kpi-row">
        {user?.role !== 'storekeeper' ? (
          <>
            <StatCard
              label={<>Today's Cash In <InfoTip text="Money collected from customer payments today." /></>}
              value={`${formatCurrency(todayCashIn, currency)}`}
              icon={<Coins size={18} weight="duotone" />}
            />
            <StatCard
              label={<>Today's Revenue <InfoTip text="Total value of sales recorded today." /></>}
              value={`${formatCurrency(todayRevenue, currency)}`}
              icon={<TrendUp size={18} weight="duotone" />}
            />
            <StatCard
              label={<>Pending Deposits <InfoTip text="Orders with outstanding balance or customer advance deposits awaiting fulfillment." /></>}
              value={`${pendingOrdersCount} Orders`}
              icon={<Clock size={18} weight="duotone" />}
            />
            <StatCard
              label={<>Stock Value <InfoTip text="Total warehouse inventory value at cost price." /></>}
              value={`${formatCurrency(stockValue, currency)}`}
              icon={<Package size={18} weight="duotone" />}
            />
            <StatCard
              label={<>Sales Value <InfoTip text="Estimated cash collection if all inventory sells at current prices." /></>}
              value={`${formatCurrency(totalSalesValue, currency)}`}
              icon={<CurrencyCircleDollar size={18} weight="duotone" />}
            >
              {totalProfit > 0 && (
                <div style={{ marginTop: 4, fontSize: 11.5, color: '#059669', fontWeight: 600 }}>
                  +{formatCurrency(totalProfit, currency)} (+{profitPercentage}%)
                </div>
              )}
            </StatCard>
            <StatCard
              label={<>Low Stock <InfoTip text="Items that have fallen below their minimum restock threshold." /></>}
              value={`${lowStockCount} Items`}
              accent={lowStockCount > 0 ? "warning" : ""}
              icon={<Warning size={18} weight="duotone" />}
            >
              {depletedCount > 0 && (
                <div style={{ marginTop: 4, fontSize: 11.5, color: '#dc2626', fontWeight: 600 }}>
                  {depletedCount} completely depleted
                </div>
              )}
            </StatCard>
          </>
        ) : (
          <>
            <StatCard
              label={<>Total Products <InfoTip text="Total number of unique catalog products." /></>}
              value={`${products.length} Products`}
              icon={<Package size={18} weight="duotone" />}
            />
            <StatCard
              label={<>Low Stock <InfoTip text="Items that have fallen below their minimum restock threshold." /></>}
              value={`${lowStockCount} Items`}
              accent={lowStockCount > 0 ? "warning" : ""}
              icon={<Warning size={18} weight="duotone" />}
            />
          </>
        )}
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
                  <ActionButton
                    key={t}
                    variant={timeframe === t ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => setTimeframe(t)}
                    style={{ padding: '4px 10px', fontSize: 11, height: 'auto' }}
                  >
                    {t === '7d' ? '7D' : t === '30d' ? '30D' : 'YoY'}
                  </ActionButton>
                ))}
              </div>
            </div>
            <div className="chart-container" style={{ height: 350, width: '100%', minWidth: 0, minHeight: 350, position: 'relative' }}>
              {chartData && chartData.length > 0 && (
                <ResponsiveContainer width="100%" height={350}>
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
            <h3 className="table-card__title" style={{ marginBottom: 16 }}>System Tools</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ActionButton variant="secondary" fullWidth onClick={generatePDF}>
                <FileText size={15} weight="bold" /> Download PDF Report
              </ActionButton>
              {user?.role === 'admin' && (
                <ActionButton variant="secondary" fullWidth onClick={() => setShowAudit(true)}>
                  <ShieldCheck size={15} weight="bold" /> System Audit View
                </ActionButton>
              )}
            </div>

            {user?.role !== 'storekeeper' && (
              <>
                <h3 className="table-card__title" style={{ marginTop: 24, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <ChartLineUp size={16} weight="bold" />
                  Quick Insights
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                  <div className="summary-card">
                    <div className="summary-card__label">Gross Margin <InfoTip text="Profit retained after product inventory cost." /></div>
                    <div className="summary-card__value">{actualGrossMargin}%</div>
                    <div className="summary-card__sub">Based on current stock pricing</div>
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
                        <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: 600 }}>Out of Stock</span>
                      ) : p.stock_quantity < (p.low_stock_threshold || 10) ? (
                        <span style={{ color: '#d97706', fontSize: '12px', fontWeight: 600 }}>
                          Low Stock ({p.stock_quantity})
                        </span>
                      ) : (
                        <span style={{ color: '#059669', fontSize: '12px', fontWeight: 500 }}>
                          In Stock
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
              <button aria-label="Close dialog" className="close-btn" onClick={() => setShowAudit(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table className="stock-table" style={{ fontSize: 12 }}>
                <thead><tr><th>User</th><th>Action</th><th>Details</th><th>Time</th></tr></thead>
                <tbody>
                  {logs.slice(0, 20).map(l => (
                    <tr key={l.id}>
                      <td style={{ fontWeight: 600 }}>{l.user_email}</td>
                      <td><span style={{ fontSize: 12, fontWeight: 600, color: '#334155', fontFamily: 'monospace' }}>{l.action}</span></td>
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
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: '#111827' }}>Record Customer Deposit</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>Add a prepayment to a customer's account balance. This does not affect stock.</p>

            <form onSubmit={handlePureDeposit}>
              <div style={{ marginBottom: 16 }}>
                <Label required>Customer Name</Label>
                <Input value={depCustName} onChange={e => setDepCustName(e.target.value)} placeholder="e.g. John Doe" required />
              </div>

              <div style={{ marginBottom: 16 }}>
                <Label required>Phone Number</Label>
                <Input
                  value={depCustPhone}
                  onChange={e => setDepCustPhone(formatPhone(e.target.value))}
                  placeholder="+233XXXXXXXXX"
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                <div style={{ flex: 1 }}>
                  <Label required>Amount ({currency})</Label>
                  <Input type="number" step="0.1" value={depAmount} onChange={e => setDepAmount(e.target.value)} placeholder="0.0" required />
                </div>
                <div style={{ flex: 1 }}>
                  <Label required>Method</Label>
                  <Select value={depMethod} onChange={e => setDepMethod(e.target.value)} options={[
                    { value: 'Cash', label: 'Cash' },
                    { value: 'Momo', label: 'Momo' },
                    { value: 'Bank', label: 'Bank' }
                  ]} required />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <ActionButton variant="secondary" fullWidth onClick={() => setShowDepositModal(false)}>
                  Cancel
                </ActionButton>
                <ActionButton type="submit" fullWidth disabled={depSaving}>
                  {depSaving ? 'Recording...' : 'Record Deposit'}
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
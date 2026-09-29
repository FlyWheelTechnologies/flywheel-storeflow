import { describe, it, expect } from 'vitest';

/**
 * Unit tests verifying dashboard analytics aggregation algorithms
 */

function aggregateChartData(timeframe, sales, expenses) {
  if (timeframe === '7d' || timeframe === '30d') {
    const days = timeframe === '7d' ? 7 : 30;

    const salesByDate = new Map();
    for (let i = 0; i < sales.length; i++) {
      const s = sales[i];
      if (!s.created_at) continue;
      const dStr = new Date(s.created_at).toDateString();
      const amt = parseFloat(s.amount_paid || 0);
      salesByDate.set(dStr, (salesByDate.get(dStr) || 0) + amt);
    }

    const expensesByDate = new Map();
    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      if (!e.created_at) continue;
      const dStr = new Date(e.created_at).toDateString();
      const amt = parseFloat(e.amount || 0);
      expensesByDate.set(dStr, (expensesByDate.get(dStr) || 0) + amt);
    }

    return Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const dateStr = d.toDateString();
      return {
        name: days === 7 ? d.toLocaleDateString([], { weekday: 'short' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        Revenue: salesByDate.get(dateStr) || 0,
        Expenses: expensesByDate.get(dateStr) || 0
      };
    });
  }

  if (timeframe === 'YoY') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const thisYear = new Date().getFullYear();
    const lastYear = thisYear - 1;

    const salesByYearMonth = new Map();
    for (let i = 0; i < sales.length; i++) {
      const s = sales[i];
      if (!s.created_at) continue;
      const d = new Date(s.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const amt = parseFloat(s.amount_paid || 0);
      salesByYearMonth.set(key, (salesByYearMonth.get(key) || 0) + amt);
    }

    return months.map((m, i) => ({
      name: m,
      'This Year': salesByYearMonth.get(`${thisYear}-${i}`) || 0,
      'Last Year': salesByYearMonth.get(`${lastYear}-${i}`) || 0
    }));
  }

  return [];
}

function calculateProductMetrics(products) {
  let sVal = 0;
  let tSalesVal = 0;
  let lowStock = 0;
  let depleted = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const qty = Math.max(0, parseFloat(p.stock_quantity || 0));
    sVal += parseFloat(p.cost_price || 0) * qty;
    tSalesVal += parseFloat(p.selling_price || 0) * qty;

    if (p.stock_quantity <= 0) {
      depleted++;
    } else if (p.stock_quantity < (p.low_stock_threshold || 10)) {
      lowStock++;
    }
  }

  const tProfit = tSalesVal - sVal;
  const pPct = sVal > 0 ? ((tProfit / sVal) * 100).toFixed(1) : 0;

  return {
    stockValue: sVal,
    totalSalesValue: tSalesVal,
    totalProfit: tProfit,
    profitPercentage: pPct,
    lowStockCount: lowStock,
    depletedCount: depleted
  };
}

describe('Dashboard Analytics Aggregations', () => {
  const todayStr = new Date().toISOString();

  const mockSales = [
    { created_at: todayStr, amount_paid: '150.00' },
    { created_at: todayStr, amount_paid: '50.00' }
  ];

  const mockExpenses = [
    { created_at: todayStr, amount: '30.00' }
  ];

  const mockProducts = [
    { id: '1', name: 'Product A', stock_quantity: 5, low_stock_threshold: 10, cost_price: 10, selling_price: 20 },
    { id: '2', name: 'Product B', stock_quantity: 0, low_stock_threshold: 10, cost_price: 15, selling_price: 25 },
    { id: '3', name: 'Product C', stock_quantity: 50, low_stock_threshold: 10, cost_price: 100, selling_price: 150 }
  ];

  it('aggregates 7d chart revenue and expenses correctly', () => {
    const data = aggregateChartData('7d', mockSales, mockExpenses);
    expect(data.length).toBe(7);
    const todayChartEntry = data[data.length - 1];
    expect(todayChartEntry.Revenue).toBe(200);
    expect(todayChartEntry.Expenses).toBe(30);
  });

  it('aggregates 30d chart revenue and expenses correctly', () => {
    const data = aggregateChartData('30d', mockSales, mockExpenses);
    expect(data.length).toBe(30);
    const todayChartEntry = data[data.length - 1];
    expect(todayChartEntry.Revenue).toBe(200);
    expect(todayChartEntry.Expenses).toBe(30);
  });

  it('aggregates YoY chart revenue correctly for current month', () => {
    const data = aggregateChartData('YoY', mockSales, mockExpenses);
    expect(data.length).toBe(12);
    const currentMonth = new Date().getMonth();
    expect(data[currentMonth]['This Year']).toBe(200);
    expect(data[currentMonth]['Last Year']).toBe(0);
  });

  it('calculates product stock and valuation metrics accurately in a single pass', () => {
    const metrics = calculateProductMetrics(mockProducts);
    expect(metrics.stockValue).toBe(5 * 10 + 0 * 15 + 50 * 100); // 5050
    expect(metrics.totalSalesValue).toBe(5 * 20 + 0 * 25 + 50 * 150); // 7600
    expect(metrics.lowStockCount).toBe(1); // Product A
    expect(metrics.depletedCount).toBe(1); // Product B
  });
});

import { describe, test, expect } from 'vitest';

// Function mirroring the optimized chart aggregation logic from Dashboard.jsx
function computeChartData(timeframe, sales, expenses) {
  if (timeframe === '7d' || timeframe === '30d') {
    const days = timeframe === '7d' ? 7 : 30;

    const salesByDate = new Map();
    for (let i = 0; i < sales.length; i++) {
      const s = sales[i];
      if (!s.created_at) continue;
      const dStr = new Date(s.created_at).toDateString();
      salesByDate.set(dStr, (salesByDate.get(dStr) || 0) + parseFloat(s.amount_paid || 0));
    }

    const expensesByDate = new Map();
    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      if (!e.created_at) continue;
      const dStr = new Date(e.created_at).toDateString();
      expensesByDate.set(dStr, (expensesByDate.get(dStr) || 0) + parseFloat(e.amount || 0));
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
      const yr = d.getFullYear();
      if (yr === thisYear || yr === lastYear) {
        const key = `${yr}-${d.getMonth()}`;
        salesByYearMonth.set(key, (salesByYearMonth.get(key) || 0) + parseFloat(s.amount_paid || 0));
      }
    }

    return months.map((m, i) => ({
      name: m,
      'This Year': salesByYearMonth.get(`${thisYear}-${i}`) || 0,
      'Last Year': salesByYearMonth.get(`${lastYear}-${i}`) || 0
    }));
  }
  return [];
}

describe('Dashboard Chart Aggregation (Bolt Optimization)', () => {
  test('correctly aggregates 7d revenue and expenses', () => {
    const today = new Date().toISOString();
    const sales = [
      { created_at: today, amount_paid: '150.50' },
      { created_at: today, amount_paid: '49.50' }
    ];
    const expenses = [
      { created_at: today, amount: '30.00' }
    ];

    const chartData = computeChartData('7d', sales, expenses);

    expect(chartData).toHaveLength(7);
    const lastDay = chartData[6]; // Today is the last entry in 7d chart
    expect(lastDay.Revenue).toBe(200);
    expect(lastDay.Expenses).toBe(30);
  });

  test('correctly aggregates 30d timeframe', () => {
    const sales = [];
    const expenses = [];
    const chartData = computeChartData('30d', sales, expenses);

    expect(chartData).toHaveLength(30);
    expect(chartData[0].Revenue).toBe(0);
    expect(chartData[0].Expenses).toBe(0);
  });

  test('correctly aggregates YoY sales for current and last year', () => {
    const thisYear = new Date().getFullYear();
    const lastYear = thisYear - 1;

    const sales = [
      { created_at: `${thisYear}-01-15T12:00:00Z`, amount_paid: '500' },
      { created_at: `${lastYear}-01-20T12:00:00Z`, amount_paid: '300' }
    ];

    const chartData = computeChartData('YoY', sales, []);

    expect(chartData).toHaveLength(12);
    // Jan is index 0
    expect(chartData[0].name).toBe('Jan');
    expect(chartData[0]['This Year']).toBe(500);
    expect(chartData[0]['Last Year']).toBe(300);
  });

  test('handles empty or invalid inputs gracefully', () => {
    const sales = [{ amount_paid: '100' }]; // missing created_at
    const chartData = computeChartData('7d', sales, []);
    expect(chartData).toHaveLength(7);
    expect(chartData[6].Revenue).toBe(0);
  });
});

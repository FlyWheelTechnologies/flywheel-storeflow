import { describe, it, expect } from 'vitest';

// Pure helper function reproducing the chartData calculation logic from Dashboard.jsx
function computeChartData(timeframe, sales, expenses) {
  if (timeframe === '7d' || timeframe === '30d') {
    const days = timeframe === '7d' ? 7 : 30;
    // Bolt Optimization: Pre-aggregate sales and expenses into Map lookups O(N + M)
    const salesByDate = new Map();
    for (const s of sales) {
      const k = new Date(s.created_at).toDateString();
      salesByDate.set(k, (salesByDate.get(k) || 0) + parseFloat(s.amount_paid || 0));
    }

    const expensesByDate = new Map();
    for (const e of expenses) {
      const k = new Date(e.created_at).toDateString();
      expensesByDate.set(k, (expensesByDate.get(k) || 0) + parseFloat(e.amount || 0));
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

    // Bolt Optimization: Single-pass O(N) bucketing into month slots instead of 24 full array filter passes
    const thisYearSalesByMonth = new Array(12).fill(0);
    const lastYearSalesByMonth = new Array(12).fill(0);

    for (const s of sales) {
      const d = new Date(s.created_at);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      const amt = parseFloat(s.amount_paid || 0);
      if (yr === thisYear) {
        thisYearSalesByMonth[mo] += amt;
      } else if (yr === lastYear) {
        lastYearSalesByMonth[mo] += amt;
      }
    }

    return months.map((m, i) => ({
      name: m,
      'This Year': thisYearSalesByMonth[i],
      'Last Year': lastYearSalesByMonth[i]
    }));
  }
  return [];
}

describe('Dashboard chartData optimization', () => {
  it('correctly aggregates 7d sales and expenses', () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const sales = [
      { created_at: today.toISOString(), amount_paid: 100 },
      { created_at: today.toISOString(), amount_paid: '50' },
      { created_at: yesterday.toISOString(), amount_paid: 80 }
    ];
    const expenses = [
      { created_at: today.toISOString(), amount: '30' }
    ];

    const data = computeChartData('7d', sales, expenses);
    expect(data).toHaveLength(7);

    // Last element is today
    const todayEntry = data[6];
    expect(todayEntry.Revenue).toBe(150);
    expect(todayEntry.Expenses).toBe(30);

    // Second to last is yesterday
    const yesterdayEntry = data[5];
    expect(yesterdayEntry.Revenue).toBe(80);
    expect(yesterdayEntry.Expenses).toBe(0);
  });

  it('correctly aggregates 30d timeframe length', () => {
    const data = computeChartData('30d', [], []);
    expect(data).toHaveLength(30);
    expect(data[0].Revenue).toBe(0);
    expect(data[0].Expenses).toBe(0);
  });

  it('correctly buckets YoY sales across months and years', () => {
    const currentYear = new Date().getFullYear();
    const sales = [
      { created_at: new Date(currentYear, 0, 15).toISOString(), amount_paid: 200 },
      { created_at: new Date(currentYear, 0, 20).toISOString(), amount_paid: 100 },
      { created_at: new Date(currentYear - 1, 0, 10).toISOString(), amount_paid: 150 },
      { created_at: new Date(currentYear - 1, 5, 1).toISOString(), amount_paid: 75 },
      // Irrelevant older year
      { created_at: new Date(currentYear - 2, 0, 1).toISOString(), amount_paid: 999 }
    ];

    const data = computeChartData('YoY', sales, []);
    expect(data).toHaveLength(12);

    // January (index 0)
    expect(data[0].name).toBe('Jan');
    expect(data[0]['This Year']).toBe(300);
    expect(data[0]['Last Year']).toBe(150);

    // June (index 5)
    expect(data[5].name).toBe('Jun');
    expect(data[5]['This Year']).toBe(0);
    expect(data[5]['Last Year']).toBe(75);
  });

  it('handles empty datasets without error', () => {
    expect(computeChartData('7d', [], [])).toHaveLength(7);
    expect(computeChartData('30d', [], [])).toHaveLength(30);
    expect(computeChartData('YoY', [], [])).toHaveLength(12);
    expect(computeChartData('unknown', [], [])).toEqual([]);
  });
});

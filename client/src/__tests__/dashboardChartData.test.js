import { describe, it, expect } from 'vitest';

// Function mirroring the optimized chart aggregation in Dashboard.jsx
function aggregateChartData(timeframe, sales, expenses) {
  if (timeframe === '7d' || timeframe === '30d') {
    const days = timeframe === '7d' ? 7 : 30;
    const salesByDate = new Map();
    for (const s of sales) {
      if (!s.created_at) continue;
      const key = new Date(s.created_at).toDateString();
      salesByDate.set(key, (salesByDate.get(key) || 0) + (parseFloat(s.amount_paid) || 0));
    }

    const expensesByDate = new Map();
    for (const e of expenses) {
      if (!e.created_at) continue;
      const key = new Date(e.created_at).toDateString();
      expensesByDate.set(key, (expensesByDate.get(key) || 0) + (parseFloat(e.amount) || 0));
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
    const thisYearTotals = new Float64Array(12);
    const lastYearTotals = new Float64Array(12);

    for (const s of sales) {
      if (!s.created_at) continue;
      const d = new Date(s.created_at);
      const yr = d.getFullYear();
      if (yr === thisYear) {
        thisYearTotals[d.getMonth()] += parseFloat(s.amount_paid) || 0;
      } else if (yr === lastYear) {
        lastYearTotals[d.getMonth()] += parseFloat(s.amount_paid) || 0;
      }
    }

    return months.map((m, i) => ({
      name: m,
      'This Year': thisYearTotals[i],
      'Last Year': lastYearTotals[i]
    }));
  }
  return [];
}

describe('Dashboard chart aggregation', () => {
  it('correctly aggregates 7d revenue and expenses', () => {
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();

    const sales = [
      { created_at: today, amount_paid: '50.5' },
      { created_at: today, amount_paid: '49.5' },
      { created_at: yesterday, amount_paid: '20' }
    ];
    const expenses = [
      { created_at: today, amount: '15' }
    ];

    const data = aggregateChartData('7d', sales, expenses);
    expect(data).toHaveLength(7);

    // Today is the last item
    const lastItem = data[data.length - 1];
    expect(lastItem.Revenue).toBe(100);
    expect(lastItem.Expenses).toBe(15);

    // Yesterday is the second-to-last item
    const prevItem = data[data.length - 2];
    expect(prevItem.Revenue).toBe(20);
    expect(prevItem.Expenses).toBe(0);
  });

  it('correctly aggregates YoY revenue across months', () => {
    const currentYear = new Date().getFullYear();
    const sales = [
      { created_at: `${currentYear}-01-15T12:00:00Z`, amount_paid: 200 },
      { created_at: `${currentYear}-01-20T12:00:00Z`, amount_paid: 100 },
      { created_at: `${currentYear - 1}-01-10T12:00:00Z`, amount_paid: 150 }
    ];

    const data = aggregateChartData('YoY', sales, []);
    expect(data).toHaveLength(12);
    expect(data[0].name).toBe('Jan');
    expect(data[0]['This Year']).toBe(300);
    expect(data[0]['Last Year']).toBe(150);
    expect(data[1]['This Year']).toBe(0);
  });

  it('handles empty or invalid records gracefully', () => {
    const sales = [{ created_at: null, amount_paid: '50' }, { amount_paid: '10' }];
    const data = aggregateChartData('7d', sales, []);
    expect(data).toHaveLength(7);
    const lastItem = data[data.length - 1];
    expect(lastItem.Revenue).toBe(0);
  });
});

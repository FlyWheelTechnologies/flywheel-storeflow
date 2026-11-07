import { describe, it, expect } from 'vitest';

// Function mirroring Dashboard.jsx chartData logic for direct unit verification
function computeChartData(timeframe, sales, expenses) {
  if (timeframe === '7d' || timeframe === '30d') {
    const days = timeframe === '7d' ? 7 : 30;

    const salesByDay = {};
    for (let i = 0; i < sales.length; i++) {
      const s = sales[i];
      const dateStr = new Date(s.created_at).toDateString();
      salesByDay[dateStr] = (salesByDay[dateStr] || 0) + parseFloat(s.amount_paid || 0);
    }

    const expensesByDay = {};
    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      const dateStr = new Date(e.created_at).toDateString();
      expensesByDay[dateStr] = (expensesByDay[dateStr] || 0) + parseFloat(e.amount || 0);
    }

    return Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const dateStr = d.toDateString();
      return {
        name: days === 7 ? d.toLocaleDateString([], { weekday: 'short' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        Revenue: salesByDay[dateStr] || 0,
        Expenses: expensesByDay[dateStr] || 0
      };
    });
  }

  if (timeframe === 'YoY') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const thisYear = new Date().getFullYear();
    const lastYear = thisYear - 1;

    const thisYearSales = new Array(12).fill(0);
    const lastYearSales = new Array(12).fill(0);

    for (let i = 0; i < sales.length; i++) {
      const s = sales[i];
      const d = new Date(s.created_at);
      const yr = d.getFullYear();
      if (yr === thisYear) {
        thisYearSales[d.getMonth()] += parseFloat(s.amount_paid || 0);
      } else if (yr === lastYear) {
        lastYearSales[d.getMonth()] += parseFloat(s.amount_paid || 0);
      }
    }

    return months.map((m, i) => ({
      name: m,
      'This Year': thisYearSales[i],
      'Last Year': lastYearSales[i]
    }));
  }
  return [];
}

describe('Dashboard chartData aggregation optimization', () => {
  it('correctly aggregates 7d revenue and expenses', () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const sales = [
      { created_at: today.toISOString(), amount_paid: 100 },
      { created_at: today.toISOString(), amount_paid: 50 },
      { created_at: yesterday.toISOString(), amount_paid: 75 }
    ];

    const expenses = [
      { created_at: today.toISOString(), amount: 30 },
      { created_at: yesterday.toISOString(), amount: 20 }
    ];

    const result = computeChartData('7d', sales, expenses);
    expect(result).toHaveLength(7);

    // Today is the last item
    const todayResult = result[result.length - 1];
    expect(todayResult.Revenue).toBe(150);
    expect(todayResult.Expenses).toBe(30);

    // Yesterday is second-to-last item
    const yesterdayResult = result[result.length - 2];
    expect(yesterdayResult.Revenue).toBe(75);
    expect(yesterdayResult.Expenses).toBe(20);
  });

  it('correctly aggregates 30d revenue with empty dates defaulting to 0', () => {
    const result = computeChartData('30d', [], []);
    expect(result).toHaveLength(30);
    result.forEach(day => {
      expect(day.Revenue).toBe(0);
      expect(day.Expenses).toBe(0);
    });
  });

  it('correctly aggregates YoY multi-year comparisons', () => {
    const thisYear = new Date().getFullYear();
    const lastYear = thisYear - 1;

    const sales = [
      { created_at: new Date(thisYear, 0, 15).toISOString(), amount_paid: 500 }, // Jan this year
      { created_at: new Date(thisYear, 0, 20).toISOString(), amount_paid: 250 }, // Jan this year
      { created_at: new Date(lastYear, 0, 10).toISOString(), amount_paid: 300 }, // Jan last year
      { created_at: new Date(thisYear, 5, 1).toISOString(), amount_paid: 1000 }, // Jun this year
      { created_at: new Date(lastYear - 1, 0, 1).toISOString(), amount_paid: 999 } // 2 years ago (ignored)
    ];

    const result = computeChartData('YoY', sales, []);
    expect(result).toHaveLength(12);

    // Jan (index 0)
    expect(result[0].name).toBe('Jan');
    expect(result[0]['This Year']).toBe(750);
    expect(result[0]['Last Year']).toBe(300);

    // Jun (index 5)
    expect(result[5].name).toBe('Jun');
    expect(result[5]['This Year']).toBe(1000);
    expect(result[5]['Last Year']).toBe(0);

    // Feb (index 1)
    expect(result[1]['This Year']).toBe(0);
    expect(result[1]['Last Year']).toBe(0);
  });
});

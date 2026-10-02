/**
 * Helper service for financial reporting calculations
 */
export const ReportService = {
  /**
   * Calculates daily totals from journal entries.
   * Optimization: Single-pass O(N) aggregation reduces array allocations
   * and date object instantiations compared to chained filter/reduce calls.
   */
  calculateDailySummary(journalEntries, selectedDate) {
    let sales = 0;
    let cashIn = 0;
    let expenses = 0;

    if (!Array.isArray(journalEntries)) {
      return { sales: 0, cashIn: 0, expenses: 0, net: 0 };
    }

    for (let i = 0; i < journalEntries.length; i++) {
      const j = journalEntries[i];
      if (!j || !j.created_at) continue;

      // Extract YYYY-MM-DD from ISO timestamp string directly if available,
      // falling back to Date object only when necessary.
      const dateStr = typeof j.created_at === 'string'
        ? j.created_at.slice(0, 10)
        : new Date(j.created_at).toISOString().slice(0, 10);

      if (dateStr === selectedDate) {
        if (j.account_type === 'SALES') {
          sales += (j.debit || 0);
        } else if (j.account_type === 'CASH_IN') {
          cashIn += (j.debit || 0);
        } else if (j.account_type === 'EXPENSE') {
          expenses += (j.credit || 0);
        }
      }
    }

    return {
      sales,
      cashIn,
      expenses,
      net: cashIn - expenses
    };
  }
};

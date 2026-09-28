/**
 * Helper service for financial reporting calculations
 */
export const ReportService = {
  /**
   * Calculates daily totals from journal entries in a single pass O(N) loop
   * avoiding 4x array iterations and redundant Date object instantiations.
   */
  calculateDailySummary(journalEntries, selectedDate) {
    let sales = 0;
    let cashIn = 0;
    let expenses = 0;

    for (let i = 0; i < journalEntries.length; i++) {
      const j = journalEntries[i];
      if (!j || !j.created_at) continue;

      // Fast-path ISO date string comparison (YYYY-MM-DD) without Date allocation
      const entryDate = typeof j.created_at === 'string' && j.created_at.length >= 10 && (j.created_at[10] === 'T' || j.created_at[10] === ' ')
        ? j.created_at.slice(0, 10)
        : new Date(j.created_at).toISOString().slice(0, 10);

      if (entryDate === selectedDate) {
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

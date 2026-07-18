/**
 * Helper service for financial reporting calculations
 */
export const ReportService = {
  /**
   * Calculates daily totals from journal entries
   */
  calculateDailySummary(journalEntries, selectedDate) {
    const dailyEntries = journalEntries.filter(j => 
      new Date(j.created_at).toISOString().split('T')[0] === selectedDate
    );

    const sales = dailyEntries
      .filter(j => j.account_type === 'SALES')
      .reduce((a, b) => a + (b.debit || 0), 0);

    const cashIn = dailyEntries
      .filter(j => j.account_type === 'CASH_IN')
      .reduce((a, b) => a + (b.debit || 0), 0);

    const expenses = dailyEntries
      .filter(j => j.account_type === 'EXPENSE')
      .reduce((a, b) => a + (b.credit || 0), 0);

    return {
      sales,
      cashIn,
      expenses,
      net: cashIn - expenses
    };
  }
};

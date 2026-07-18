import { describe, it, expect } from 'vitest';
import { ReportService } from '../services/ReportService';

describe('ReportService', () => {
  it('should correctly calculate daily summary totals', () => {
    const mockDate = '2026-05-11';
    const journalEntries = [
      { account_type: 'SALES', debit: 500, credit: 0, created_at: '2026-05-11T10:00:00Z' },
      { account_type: 'CASH_IN', debit: 300, credit: 0, created_at: '2026-05-11T11:00:00Z' },
      { account_type: 'EXPENSE', debit: 0, credit: 100, created_at: '2026-05-11T12:00:00Z' },
      { account_type: 'SALES', debit: 200, credit: 0, created_at: '2026-05-11T13:00:00Z' },
      // Other date (should be ignored)
      { account_type: 'SALES', debit: 1000, credit: 0, created_at: '2026-05-10T10:00:00Z' }
    ];

    const result = ReportService.calculateDailySummary(journalEntries, mockDate);

    expect(result.sales).toBe(700); // 500 + 200
    expect(result.cashIn).toBe(300);
    expect(result.expenses).toBe(100);
    expect(result.net).toBe(200); // 300 - 100
  });

  it('should return zeros if no entries for the selected date', () => {
    const result = ReportService.calculateDailySummary([], '2026-05-11');
    expect(result.sales).toBe(0);
    expect(result.expenses).toBe(0);
  });
});

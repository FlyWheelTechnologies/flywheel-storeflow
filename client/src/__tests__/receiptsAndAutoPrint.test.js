import { describe, it, expect, beforeEach } from 'vitest';
import { PrinterService } from '../services/PrinterService';

describe('Receipts Balance Due & Auto-Print Configuration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Auto-Print Hardware Configuration', () => {
    it('defaults autoPrint to null when unconfigured', () => {
      const config = PrinterService.getLocalHardwareConfig();
      expect(config.autoPrint).toBeNull();
    });

    it('persists autoPrint: false when cashier unchecks it', () => {
      PrinterService.saveLocalHardwareConfig({ autoPrint: false });
      const updated = PrinterService.getLocalHardwareConfig();
      expect(updated.autoPrint).toBe(false);
    });

    it('persists autoPrint: true when cashier enables it', () => {
      PrinterService.saveLocalHardwareConfig({ autoPrint: true });
      const updated = PrinterService.getLocalHardwareConfig();
      expect(updated.autoPrint).toBe(true);
    });
  });

  describe('ESC/POS Receipt Totals & Balance Calculations', () => {
    const decoder = new TextDecoder();

    it('computes exact zero balance due when paid in full', () => {
      const sale = {
        total_amount: 100,
        amount_paid: 100,
        balance_due: 0,
        payment_status: 'PAID'
      };
      const bytes = PrinterService.buildEscPos({ org: { currency: 'GHS' }, sale, items: [] });
      const text = decoder.decode(bytes);

      expect(text).toContain('TOTAL:');
      expect(text).toContain('Amount Paid:');
      expect(text).toContain('GHS 100.00');
      expect(text).not.toContain('Balance Due:');
    });

    it('computes correct balance due on partial payment', () => {
      const sale = {
        total_amount: 100,
        amount_paid: 40,
        balance_due: 60,
        payment_status: 'PARTIAL'
      };
      const bytes = PrinterService.buildEscPos({ org: { currency: 'GHS' }, sale, items: [] });
      const text = decoder.decode(bytes);

      expect(text).toMatch(/Amount Paid:\s+GHS 40\.00/);
      expect(text).toMatch(/Balance Due:\s+GHS 60\.00/);
    });

    it('computes correct balance due on credit (unpaid) sales without falsely showing total as paid', () => {
      const sale = {
        total_amount: 150,
        amount_paid: 0,
        balance_due: 150,
        payment_status: 'UNPAID'
      };
      const bytes = PrinterService.buildEscPos({ org: { currency: 'GHS' }, sale, items: [] });
      const text = decoder.decode(bytes);

      expect(text).toMatch(/Amount Paid:\s+GHS 0\.00/);
      expect(text).toMatch(/Balance Due:\s+GHS 150\.00/);
    });

    it('displays Amount Tendered and Change when customer overpays', () => {
      const sale = {
        total_amount: 70,
        amount_paid: 70,
        balance_due: 0,
        notes: 'Change given: GHS 30.00',
        payment_status: 'PAID'
      };
      const bytes = PrinterService.buildEscPos({ org: { currency: 'GHS' }, sale, items: [] });
      const text = decoder.decode(bytes);

      expect(text).toMatch(/Amount Tendered:\s+GHS 100\.00/);
      expect(text).toMatch(/Change:\s+GHS 30\.00/);
      expect(text).not.toContain('Balance Due:');
    });

    it('displays Deposit Paid and Balance on Delivery for order deposits', () => {
      const sale = {
        total_amount: 500,
        amount_paid: 200,
        balance_due: 300,
        payment_status: 'DEPOSIT'
      };
      const bytes = PrinterService.buildEscPos({ org: { currency: 'GHS' }, sale, items: [] });
      const text = decoder.decode(bytes);

      expect(text).toMatch(/Deposit Paid:\s+GHS 200\.00/);
      expect(text).toMatch(/Balance on Delivery:\s+GHS 300\.00/);
    });
  });
});

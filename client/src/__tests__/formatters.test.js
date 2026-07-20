import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPhone } from '../services/formatters';

describe('formatters', () => {
  describe('formatCurrency', () => {
    it('should format numbers with exactly 1 decimal digit', () => {
      expect(formatCurrency(100)).toBe('100.0');
      expect(formatCurrency(55.55)).toBe('55.6');
      expect(formatCurrency(12.34)).toBe('12.3');
    });

    it('should return 0.0 for null or undefined values', () => {
      expect(formatCurrency(null)).toBe('0.0');
      expect(formatCurrency(undefined)).toBe('0.0');
    });
  });

  describe('formatPhone', () => {
    it('should return +233 by default if no value is provided', () => {
      expect(formatPhone(null)).toBe('+233');
      expect(formatPhone(undefined)).toBe('+233');
      expect(formatPhone('')).toBe('+233');
    });

    it('should prefix 0-starting numbers with +233 and drop the leading 0', () => {
      expect(formatPhone('0244123456')).toBe('+233244123456');
    });

    it('should add +233 prefix if it does not start with + or 0', () => {
      expect(formatPhone('244123456')).toBe('+233244123456');
    });

    it('should return the original value if it already starts with +', () => {
      expect(formatPhone('+233244123456')).toBe('+233244123456');
      expect(formatPhone('+123456789')).toBe('+123456789');
    });
  });
});

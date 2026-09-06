import { describe, it, expect } from 'vitest';
import {
  calculateStockoutForecast,
  identifyDeadStock,
  calculateCashflowRunrate,
  detectAccountingAnomalies,
  generateStoreCopilotResponse
} from '../services/aiAnalyticsService';

describe('StoreFlow AI Analytics Engine', () => {
  const mockProducts = [
    { id: 'p1', name: 'Cement 50kg', stock_quantity: 5, cost_price: 80, selling_price: 100 },
    { id: 'p2', name: 'Iron Rods 12mm', stock_quantity: 50, cost_price: 50, selling_price: 70 },
    { id: 'p3', name: 'Paint Bucket 20L', stock_quantity: 12, cost_price: 150, selling_price: 220 },
    { id: 'p4', name: 'Obsolete Wire', stock_quantity: 20, cost_price: 30, selling_price: 45 }
  ];

  const mockSales = [
    { id: 's1', invoice_no: 'INV-001', total_amount: 500, amount_paid: 500, payment_method: 'momo', customer_name: 'Kwame Mensah', created_at: new Date().toISOString() },
    { id: 's2', invoice_no: 'INV-002', total_amount: 300, amount_paid: 200, payment_method: 'cash', customer_name: 'Walk-in Customer', created_at: new Date().toISOString() }
  ];

  const mockSaleItems = [
    { sale_id: 's1', product_id: 'p1', product_name: 'Cement 50kg', quantity: 60, unit_price: 100 }, // 2/day
    { sale_id: 's2', product_id: 'p2', product_name: 'Iron Rods 12mm', quantity: 15, unit_price: 70 }  // 0.5/day
  ];

  it('calculates stockout forecasting and flags critical stock accurately', () => {
    const forecast = calculateStockoutForecast(mockProducts, mockSales, mockSaleItems);
    expect(forecast).toBeDefined();
    expect(forecast.length).toBe(4);

    const cement = forecast.find(f => f.name === 'Cement 50kg');
    expect(cement).toBeDefined();
    // 60 units over 30 days = 2 units/day. Current stock = 5 units. Days remaining = ~3 days (critical)
    expect(cement.daily_velocity).toBe(2);
    expect(cement.risk_level).toBe('critical');
    expect(cement.suggested_reorder).toBeGreaterThan(0);
  });

  it('identifies dead stock with trapped capital', () => {
    const dead = identifyDeadStock(mockProducts, mockSales, mockSaleItems);
    // Paint Bucket (p3) and Obsolete Wire (p4) have had 0 sales
    expect(dead.length).toBe(2);
    const obsolete = dead.find(d => d.name === 'Obsolete Wire');
    expect(obsolete).toBeDefined();
    expect(obsolete.capital_locked).toBe(600); // 20 * 30
  });

  it('calculates cashflow run-rate and payment method breakdown', () => {
    const cashflow = calculateCashflowRunrate(mockSales, [{ amount: 150 }]);
    expect(cashflow.totalRevenue).toBe(800);
    expect(cashflow.totalUncollected).toBe(100);
    expect(cashflow.methodTotals.momo).toBe(500);
    expect(cashflow.methodTotals.cash).toBe(200);
    expect(cashflow.netOperatingCash).toBe(550); // 700 collected - 150 expenses
  });

  it('detects accounting anomalies like anonymous credit sales', () => {
    const anomalies = detectAccountingAnomalies(mockSales, [], mockProducts);
    expect(anomalies.length).toBeGreaterThan(0);
    const creditAnomaly = anomalies.find(a => a.type === 'Anonymous Credit Sale');
    expect(creditAnomaly).toBeDefined();
  });

  it('generates context-aware copilot responses for reorder prompts', () => {
    const forecast = calculateStockoutForecast(mockProducts, mockSales, mockSaleItems);
    const response = generateStoreCopilotResponse('What should I reorder today?', {
      products: mockProducts,
      forecast
    });
    expect(response.actionType).toBe('reorder_list');
    expect(response.text).toContain('Cement 50kg');
  });
});

/**
 * StoreFlow AI Intelligence Engine
 * Advanced analytical forecasting, anomaly detection, and natural language copilot
 */

export function calculateStockoutForecast(products = [], sales = [], saleItems = []) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 1. Group sales items by product_id or product_name over last 30 days
  const velocityMap = {};

  saleItems.forEach(item => {
    const saleDate = item.created_at ? new Date(item.created_at) : null;
    // If sale date is within 30 days (or if no created_at, treat as recent sample)
    const isRecent = !saleDate || saleDate >= thirtyDaysAgo;
    if (isRecent) {
      const key = item.product_id || item.product_name;
      if (!velocityMap[key]) {
        velocityMap[key] = {
          totalQty: 0,
          revenue: 0,
          name: item.product_name
        };
      }
      velocityMap[key].totalQty += Number(item.quantity || 0);
      velocityMap[key].revenue += Number(item.quantity || 0) * Number(item.unit_price || 0);
    }
  });

  // 2. Map across all products to compute run-rate, days to stockout, and reorder suggestion
  const forecast = products.map(prod => {
    const key = prod.id || prod.name;
    const stats = velocityMap[key] || velocityMap[prod.name] || { totalQty: 0, revenue: 0 };
    
    // Average units sold per day over 30 days (minimum 1 day divisor)
    const dailyVelocity = stats.totalQty > 0 ? (stats.totalQty / 30) : 0;
    const currentStock = Number(prod.stock_quantity || 0);

    let daysRemaining = 999;
    let riskLevel = 'healthy'; // 'critical', 'warning', 'healthy', 'overstock'

    if (currentStock <= 0) {
      daysRemaining = 0;
      riskLevel = 'critical';
    } else if (dailyVelocity > 0) {
      daysRemaining = Math.round(currentStock / dailyVelocity);
      if (daysRemaining <= 3) {
        riskLevel = 'critical';
      } else if (daysRemaining <= 7) {
        riskLevel = 'warning';
      } else if (daysRemaining > 60) {
        riskLevel = 'overstock';
      } else {
        riskLevel = 'healthy';
      }
    } else {
      // 0 sales
      riskLevel = currentStock > 0 ? 'stagnant' : 'critical';
      daysRemaining = currentStock > 0 ? 999 : 0;
    }

    // Recommended reorder to cover 14 days safety stock
    const targetStock = Math.ceil(dailyVelocity * 14);
    const suggestedReorder = Math.max(0, targetStock - currentStock);
    const estimatedReorderCost = suggestedReorder * Number(prod.cost_price || prod.selling_price * 0.7);

    return {
      id: prod.id,
      name: prod.name,
      item_code: prod.item_code,
      current_stock: currentStock,
      cost_price: Number(prod.cost_price || 0),
      selling_price: Number(prod.selling_price || 0),
      daily_velocity: Number(dailyVelocity.toFixed(2)),
      monthly_sold: stats.totalQty,
      days_remaining: daysRemaining,
      risk_level: riskLevel,
      suggested_reorder: suggestedReorder,
      estimated_reorder_cost: Number(estimatedReorderCost.toFixed(2))
    };
  });

  // Sort critical and warning first
  return forecast.sort((a, b) => {
    const order = { critical: 0, warning: 1, stagnant: 2, healthy: 3, overstock: 4 };
    return (order[a.risk_level] ?? 5) - (order[b.risk_level] ?? 5) || a.days_remaining - b.days_remaining;
  });
}

export function identifyDeadStock(products = [], sales = [], saleItems = []) {
  const soldProductIds = new Set();
  const soldProductNames = new Set();

  saleItems.forEach(item => {
    if (item.product_id) soldProductIds.add(item.product_id);
    if (item.product_name) soldProductNames.add(item.product_name.toLowerCase().trim());
  });

  return products
    .filter(p => {
      const hasStock = Number(p.stock_quantity || 0) > 0;
      const isSold = soldProductIds.has(p.id) || soldProductNames.has((p.name || '').toLowerCase().trim());
      return hasStock && !isSold;
    })
    .map(p => {
      const stock = Number(p.stock_quantity || 0);
      const cost = Number(p.cost_price || p.selling_price * 0.7 || 0);
      const capitalLocked = stock * cost;

      return {
        id: p.id,
        name: p.name,
        stock_quantity: stock,
        cost_price: cost,
        selling_price: Number(p.selling_price || 0),
        capital_locked: Number(capitalLocked.toFixed(2)),
        recommended_action: stock > 10 ? 'Flash 15% Clearance Discount' : 'Bundle as Freebie with high-margin items'
      };
    })
    .sort((a, b) => b.capital_locked - a.capital_locked);
}

export function calculateCashflowRunrate(sales = [], expenses = []) {
  const methodTotals = { cash: 0, momo: 0, bank: 0, credit: 0 };
  let totalRevenue = 0;
  let totalUncollected = 0;

  sales.forEach(s => {
    const amt = Number(s.total_amount || 0);
    const paid = Number(s.amount_paid || 0);
    const uncollected = Math.max(0, amt - paid);
    const method = (s.payment_method || 'cash').toLowerCase();

    totalRevenue += amt;
    totalUncollected += uncollected;

    if (method.includes('momo') || method.includes('mobile')) {
      methodTotals.momo += paid;
    } else if (method.includes('bank') || method.includes('card')) {
      methodTotals.bank += paid;
    } else if (method.includes('credit')) {
      methodTotals.credit += amt;
    } else {
      methodTotals.cash += paid;
    }
  });

  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netOperatingCash = (methodTotals.cash + methodTotals.momo + methodTotals.bank) - totalExpense;

  // Projected 7-day run rate (based on average daily sales over the sample)
  const salesCount = sales.length || 1;
  const avgTicket = totalRevenue / salesCount;
  const projectedWeeklyRevenue = avgTicket * Math.max(7, salesCount * 0.5);

  return {
    totalRevenue,
    totalExpense,
    netOperatingCash,
    totalUncollected,
    methodTotals,
    projectedWeeklyRevenue: Number(projectedWeeklyRevenue.toFixed(2))
  };
}

export function detectAccountingAnomalies(sales = [], logs = [], products = []) {
  const anomalies = [];

  // 1. Check for negative or zero-priced sales
  sales.forEach(s => {
    if (Number(s.total_amount || 0) <= 0) {
      anomalies.push({
        type: 'Zero/Negative Amount Sale',
        severity: 'high',
        reference: s.invoice_no || s.id,
        details: `Sale recorded with GHS ${s.total_amount || 0} by ${s.recorded_by || 'Unknown'}`,
        timestamp: s.created_at
      });
    }

    // 2. Large uncollected credit with no customer phone/name
    if (Number(s.amount_paid || 0) < Number(s.total_amount || 0) && (!s.customer_name || s.customer_name === 'Walk-in Customer')) {
      anomalies.push({
        type: 'Anonymous Credit Sale',
        severity: 'critical',
        reference: s.invoice_no || s.id,
        details: `Credit of GHS ${(Number(s.total_amount) - Number(s.amount_paid)).toFixed(2)} granted to unnamed customer`,
        timestamp: s.created_at
      });
    }
  });

  // 3. Products with negative stock
  products.forEach(p => {
    if (Number(p.stock_quantity || 0) < 0) {
      anomalies.push({
        type: 'Negative Inventory Balance',
        severity: 'warning',
        reference: p.name,
        details: `Stock count is currently ${p.stock_quantity}. Sales recorded exceeding physical count.`,
        timestamp: new Date().toISOString()
      });
    }
  });

  return anomalies;
}

/**
 * Intelligent Conversational Retail Copilot
 * Context-aware NLP responder that extracts semantic answers from live shop data
 */
export function generateStoreCopilotResponse(query, context = {}) {
  const q = query.toLowerCase();
  const { products = [], sales = [], expenses = [], forecast = [], deadStock = [], cashflow = {} } = context;

  // 1. Reorder / stock questions
  if (q.includes('reorder') || q.includes('buy') || q.includes('out of stock') || q.includes('stockout') || q.includes('market')) {
    const critical = forecast.filter(f => f.risk_level === 'critical' || f.risk_level === 'warning');
    if (critical.length === 0) {
      return {
        text: "Great news! None of your products are in immediate danger of stocking out based on recent sales velocity. All items have adequate buffer.",
        actionType: 'stock_ok'
      };
    }

    const itemsList = critical.slice(0, 5).map(c => 
      `• **${c.name}** (Current: ${c.current_stock} left | Velocity: ${c.daily_velocity} units/day | Reorder: **+${c.suggested_reorder} units** ~ GHS ${c.estimated_reorder_cost})`
    ).join('\n');

    const totalEstCost = critical.reduce((sum, c) => sum + c.estimated_reorder_cost, 0);

    return {
      text: `Based on your sales velocity over the past 30 days, here are the **top ${critical.length} items** you need to reorder:\n\n${itemsList}\n\n📦 **Estimated Reorder Budget:** GHS ${totalEstCost.toLocaleString('en-US', { minimumFractionDigits: 2 })} to maintain 14-day safe stock buffer.`,
      actionType: 'reorder_list',
      data: critical
    };
  }

  // 2. Dead stock / Slow moving
  if (q.includes('dead') || q.includes('slow') || q.includes('stagnant') || q.includes('clearance')) {
    if (deadStock.length === 0) {
      return {
        text: "Your inventory is turning over well! You have no stagnant items with zero sales in the active monitoring window.",
        actionType: 'deadstock_ok'
      };
    }

    const totalLocked = deadStock.reduce((sum, d) => sum + d.capital_locked, 0);
    const topDead = deadStock.slice(0, 5).map(d => 
      `• **${d.name}** (${d.stock_quantity} units | GHS ${d.capital_locked.toLocaleString()} locked)`
    ).join('\n');

    return {
      text: `You have **${deadStock.length} stagnant products** with **GHS ${totalLocked.toLocaleString('en-US', { minimumFractionDigits: 2 })}** locked in dead inventory:\n\n${topDead}\n\n💡 **AI Recommendation:** Run a 15% markdown or bundle these items with high-velocity bestsellers to liberate operating capital.`,
      actionType: 'dead_stock',
      data: deadStock
    };
  }

  // 3. Sales / Revenue / Performance
  if (q.includes('sales') || q.includes('revenue') || q.includes('performance') || q.includes('today') || q.includes('how much')) {
    const totalRev = cashflow.totalRevenue || sales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    const momoRatio = cashflow.methodTotals ? ((cashflow.methodTotals.momo / (totalRev || 1)) * 100).toFixed(0) : 0;
    const cashRatio = cashflow.methodTotals ? ((cashflow.methodTotals.cash / (totalRev || 1)) * 100).toFixed(0) : 0;

    return {
      text: `📊 **Store Revenue Summary:**\n\n• **Total Sales Recorded:** GHS ${totalRev.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n• **Cash Payments:** GHS ${(cashflow.methodTotals?.cash || 0).toLocaleString()} (${cashRatio}%)\n• **MoMo Payments:** GHS ${(cashflow.methodTotals?.momo || 0).toLocaleString()} (${momoRatio}%)\n• **Uncollected Customer Credit:** GHS ${(cashflow.totalUncollected || 0).toLocaleString()}\n• **Projected 7-Day Run-Rate:** GHS ${(cashflow.projectedWeeklyRevenue || 0).toLocaleString()}`,
      actionType: 'sales_summary'
    };
  }

  // 4. Profit / Margin / Best items
  if (q.includes('profit') || q.includes('top') || q.includes('best') || q.includes('bestseller')) {
    const sorted = [...products].sort((a, b) => {
      const marginA = (Number(a.selling_price || 0) - Number(a.cost_price || 0));
      const marginB = (Number(b.selling_price || 0) - Number(b.cost_price || 0));
      return marginB - marginA;
    }).slice(0, 5);

    const list = sorted.map(p => {
      const margin = (Number(p.selling_price || 0) - Number(p.cost_price || 0)).toFixed(2);
      const pct = p.cost_price > 0 ? (((p.selling_price - p.cost_price) / p.cost_price) * 100).toFixed(0) : 100;
      return `• **${p.name}** — Margin: GHS ${margin} (+${pct}%)`;
    }).join('\n');

    return {
      text: `🏆 **Top Highest Margin Products:**\n\n${list}\n\n💡 **AI Tip:** Keep these items prominently positioned on the counter or front display!`,
      actionType: 'profit_summary'
    };
  }

  // Default fallback
  return {
    text: `I've analyzed your store's live catalog (${products.length} products, ${sales.length} sales). You can ask me:\n\n1. *"What should I reorder from the market today?"*\n2. *"Which products are dead stock and tying up cash?"*\n3. *"Give me a breakdown of today's sales and payment methods."*\n4. *"Show my top highest-margin products."*`,
    actionType: 'help'
  };
}

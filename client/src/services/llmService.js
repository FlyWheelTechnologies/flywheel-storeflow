/**
 * StoreFlow RAG & Universal LLM Gateway
 * Allows plugging in any free/cheap AI model via OpenRouter or OpenAI-compatible endpoint,
 * grounded in real-time store telemetry (RAG).
 */

import { generateStoreCopilotResponse, cleanAIMessageText } from "./aiAnalyticsService.js";

export const CURATED_MODELS = [
  {
    id: "liquid/lfm-2.5-2.6b:free",
    name: "Liquid LFM 2.6B (Free)",
    badge: "Free",
    provider: "LiquidAI / OpenRouter",
    desc: "Ultra-fast retail intelligence, zero latency, 100% free"
  },
  {
    id: "google/gemma-4-26b-a4b-it:free",
    name: "Google Gemma 4 26B (Free)",
    badge: "Free",
    provider: "Google / OpenRouter",
    desc: "Intelligent analytics and financial summarization"
  },
  {
    id: "liquid/lfm-3-1.7b:free",
    name: "Liquid LFM 3 1.7B (Free)",
    badge: "Light Free",
    provider: "LiquidAI / OpenRouter",
    desc: "Ultra lightweight free model"
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    name: "NVIDIA Nemotron 3.5 (Free)",
    badge: "Free",
    provider: "NVIDIA / OpenRouter",
    desc: "1M context window, high capacity problem-solving"
  },
  {
    id: "storeflow-offline",
    name: "StoreFlow On-Device Engine",
    badge: "Offline",
    provider: "Local Client",
    desc: "Deterministic rule-based analytics with zero latency"
  }
];

const STORAGE_KEYS = {
  MODEL: "storeflow_ai_selected_model",
  API_KEY: "storeflow_openrouter_key",
  TEMPERATURE: "storeflow_ai_temperature"
};

export function getStoredApiKey() {
  return (
    (typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEYS.API_KEY) : null) ||
    import.meta.env?.VITE_OPENROUTER_API_KEY ||
    ""
  );
}

export function setStoredApiKey(key) {
  if (!key) {
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
  } else {
    localStorage.setItem(STORAGE_KEYS.API_KEY, key.trim());
  }
}

export function getCurrentModel() {
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEYS.MODEL) : null;
  const validIds = CURATED_MODELS.map((m) => m.id);
  // Auto-migrate old/retired model slugs like llama-3.3-70b:free or mistral-7b:free to active free model
  if (saved && validIds.includes(saved)) {
    return saved;
  }
  const defaultModel = "liquid/lfm-2.5-2.6b:free";
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.MODEL, defaultModel);
  }
  return defaultModel;
}

export function setCurrentModel(modelId) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.MODEL, modelId);
  }
}

export function getTemperature() {
  const val = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEYS.TEMPERATURE) : null;
  return val ? parseFloat(val) : 0.7; // 0.7 for creative non-deterministic retail answers
}

export function setTemperature(val) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.TEMPERATURE, String(val));
  }
}

/**
 * Builds a structured RAG Context packet from real-time store data.
 * Keeps tokens lean while injecting rich grounding facts.
 */
export function buildStoreRAGContext(storeData = {}, userQuery = "") {
  const {
    products = [],
    sales = [],
    expenses = [],
    forecast = [],
    deadStock = [],
    cashflow = {},
    activeOrg = null
  } = storeData;

  const totalRev =
    cashflow.totalRevenue ||
    sales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
  const totalUncollected = cashflow.totalUncollected || 0;
  const cashPaid = cashflow.methodTotals?.cash || 0;
  const momoPaid = cashflow.methodTotals?.momo || 0;
  const bankPaid = cashflow.methodTotals?.bank || 0;

  // Filter critical and warning reorder items
  const criticalReorders = (forecast || [])
    .filter((f) => f.risk_level === "critical" || f.risk_level === "warning")
    .slice(0, 10);

  // Dead stock items
  const topDeadStock = (deadStock || []).slice(0, 8);

  // Top selling products by velocity
  const topSellers = [...(forecast || [])]
    .filter((f) => f.daily_velocity > 0)
    .sort((a, b) => b.daily_velocity - a.daily_velocity)
    .slice(0, 6);

  // High margin products
  const topMargin = [...products]
    .sort(
      (a, b) =>
        Number(b.selling_price || 0) -
        Number(b.cost_price || 0) -
        (Number(a.selling_price || 0) - Number(a.cost_price || 0))
    )
    .slice(0, 5);

  // Entity search in query for specific product queries
  const qLower = (userQuery || "").toLowerCase();
  let matchedProducts = [];
  if (qLower) {
    matchedProducts = products
      .filter((p) => qLower.includes((p.name || "").toLowerCase()) || (p.item_code && qLower.includes(p.item_code.toLowerCase())))
      .slice(0, 5);
  }

  const contextLines = [
    `=== STOREFLOW LIVE GROUNDING TELEMETRY (RAG) ===`,
    `Store: ${activeOrg?.name || "Retail Shop"} | Currency: GHS`,
    `Timestamp: ${new Date().toLocaleString()}`,
    `Total Catalog Count: ${products.length} products`,
    `Recent Transactions Sampled: ${sales.length} sales`,
    "",
    `--- REVENUE & FINANCIAL SUMMARY ---`,
    `Total Revenue Recorded: GHS ${totalRev.toLocaleString()}`,
    `Payment Method Breakdown: Cash: GHS ${cashPaid.toLocaleString()} | MoMo: GHS ${momoPaid.toLocaleString()} | Bank: GHS ${bankPaid.toLocaleString()}`,
    `Uncollected Customer Credit (Debt): GHS ${totalUncollected.toLocaleString()}`,
    `Total Operating Expenses: GHS ${(cashflow.totalExpense || 0).toLocaleString()}`,
    `Net Operating Cash: GHS ${(cashflow.netOperatingCash || 0).toLocaleString()}`,
    `Projected 7-Day Run-Rate: GHS ${(cashflow.projectedWeeklyRevenue || 0).toLocaleString()}`,
    "",
    `--- CRITICAL REORDER REQUIREMENTS (Low Stock Risk) ---`,
    criticalReorders.length === 0
      ? "None currently. Stock buffers are adequate."
      : criticalReorders
          .map(
            (c) =>
              `- ${c.name}: Current Stock: ${c.current_stock} units | Velocity: ${c.daily_velocity}/day | Need Reorder: +${c.suggested_reorder} units (Est Cost: GHS ${c.estimated_reorder_cost})`
          )
          .join("\n"),
    "",
    `--- DEAD STOCK (Stagnant Capital) ---`,
    topDeadStock.length === 0
      ? "No stagnant zero-sale inventory detected."
      : topDeadStock
          .map(
            (d) =>
              `- ${d.name}: ${d.stock_quantity} units sitting idle | Trapped Capital: GHS ${d.capital_locked.toLocaleString()} | Action: ${d.recommended_action}`
          )
          .join("\n"),
    "",
    `--- TOP VELOCITY BESTSELLERS ---`,
    topSellers.length === 0
      ? "No velocity sales recorded yet."
      : topSellers
          .map(
            (s) =>
              `- ${s.name}: ${s.daily_velocity} units/day sold | Days Left: ${s.days_remaining === 999 ? "Plenty" : s.days_remaining + "d"}`
          )
          .join("\n"),
    "",
    `--- TOP MARGIN PRODUCTS ---`,
    topMargin
      .map(
        (m) =>
          `- ${m.name}: Cost GHS ${m.cost_price || 0} -> Sell GHS ${m.selling_price || 0} (Margin: GHS ${(Number(m.selling_price || 0) - Number(m.cost_price || 0)).toFixed(2)})`
      )
      .join("\n")
  ];

  if (matchedProducts.length > 0) {
    contextLines.push(
      "",
      `--- SPECIFIC MATCHED INVENTORY ITEMS FOR USER INQUIRY ---`,
      matchedProducts
        .map(
          (p) =>
            `- ${p.name} [Code: ${p.item_code || "N/A"}]: Stock: ${p.stock_quantity}, Cost: GHS ${p.cost_price}, Price: GHS ${p.selling_price}`
        )
        .join("\n")
    );
  }

  contextLines.push(`=== END GROUNDING TELEMETRY ===`);
  return contextLines.join("\n");
}

/**
 * Universal Store Query Method
 * Sends grounding RAG context to free OpenRouter endpoint.
 * Seamlessly retries fallback free model or local engine if offline.
 */
export async function queryStoreLLM({
  query,
  storeData,
  chatHistory = [],
  modelId = null,
  apiKey = null,
  temperature = null
}) {
  const cleanQ = (query || "").trim();
  if (!cleanQ) return { text: "Please enter a question about your store.", source: "local" };

  const chosenModel = modelId || getCurrentModel();
  const effectiveApiKey = apiKey || getStoredApiKey();
  const effectiveTemp = temperature !== null ? temperature : getTemperature();

  // If user selected offline engine
  if (chosenModel === "storeflow-offline") {
    const localRes = generateStoreCopilotResponse(cleanQ, storeData || {});
    return {
      text: cleanAIMessageText(localRes.text),
      source: "local-engine",
      modelName: "StoreFlow On-Device Engine"
    };
  }

  // Build RAG Grounding packet
  const ragContext = buildStoreRAGContext(storeData, cleanQ);

  const systemPrompt = `You are StoreFlow Retail Copilot, an elite business intelligence and inventory analyst for retail shops in Ghana and West Africa.
You have real-time access to the store's grounded telemetry provided below.
Rules:
1. Ground your answers strictly in the provided live store facts and numbers.
2. CRITICAL FORMATTING MANDATE: NEVER use markdown asterisks (such as **bold** or *italic*). The user explicitly dislikes asterisks. Use clean line breaks, uppercase tags or clean bullet dashes (- ) instead.
3. Be non-deterministic, thoughtful, conversational, and direct. Offer proactive business insights (e.g. cash flow advice, reordering priorities, clearance tactics).
4. If asked about prices or totals, quote them in Ghanaian Cedis (GHS).

${ragContext}`;

  // Assemble recent conversation turns
  const messages = [
    { role: "system", content: systemPrompt },
    ...chatHistory.slice(-6).map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: cleanAIMessageText(m.text)
    })),
    { role: "user", content: cleanQ }
  ];

  // If no OpenRouter API key is configured, query the zero-key free online endpoint
  if (!effectiveApiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const pollRes = await fetch("https://text.pollinations.ai/openai/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai",
          messages,
          temperature: effectiveTemp
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (pollRes.ok) {
        const pollData = await pollRes.json();
        const pollText = pollData?.choices?.[0]?.message?.content;
        if (pollText) {
          return {
            text: cleanAIMessageText(pollText),
            source: "live-llm",
            modelName: "Free Online Gateway"
          };
        }
      }
    } catch (pollErr) {
      console.warn("Zero-key free endpoint fallback warning:", pollErr.message);
    }

    // Fall back to local on-device engine
    const localRes = generateStoreCopilotResponse(cleanQ, storeData || {});
    return {
      text: cleanAIMessageText(localRes.text),
      source: "local-engine",
      modelName: "StoreFlow On-Device Engine"
    };
  }

  const callOpenRouter = async (model) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${effectiveApiKey}`,
        "HTTP-Referer": "https://storeflow.app",
        "X-Title": "StoreFlow AI Retail Copilot"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: effectiveTemp,
        max_tokens: 650
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return res;
  };

  try {
    let res = await callOpenRouter(chosenModel);

    // If primary model failed (404/429/500) and wasn't already liquid-lfm, retry with fallback free model
    if (!res.ok && chosenModel !== "liquid/lfm-2.5-2.6b:free") {
      console.warn(`Primary model ${chosenModel} returned status ${res.status}. Retrying with liquid/lfm-2.5-2.6b:free...`);
      try {
        res = await callOpenRouter("liquid/lfm-2.5-2.6b:free");
      } catch (retryErr) {
        console.warn("Fallback model retry failed:", retryErr.message);
      }
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.warn("OpenRouter API error, falling back to local engine:", errBody);
      const localRes = generateStoreCopilotResponse(cleanQ, storeData || {});
      return {
        text: cleanAIMessageText(localRes.text),
        source: "fallback-local",
        modelName: "StoreFlow Fast Engine (API unavailable)",
        error: errBody?.error?.message || `HTTP ${res.status}`
      };
    }

    const data = await res.json();
    const rawAnswer = data?.choices?.[0]?.message?.content || "";
    const cleanAnswer = cleanAIMessageText(rawAnswer);

    return {
      text: cleanAnswer,
      source: "live-llm",
      modelName: data?.model || chosenModel
    };
  } catch (err) {
    console.warn("LLM fetch failed, using local engine fallback:", err.message);
    const localRes = generateStoreCopilotResponse(cleanQ, storeData || {});
    return {
      text: cleanAIMessageText(localRes.text),
      source: "fallback-local",
      modelName: "StoreFlow Fast Engine",
      error: err.message
    };
  }
}

/**
 * Platform Super-Admin RAG Query
 * Connects cross-tenant platform telemetry to the free online LLM.
 */
export async function queryPlatformLLM({
  query,
  platformData = {},
  chatHistory = []
}) {
  const cleanQ = (query || "").trim();
  if (!cleanQ) return { text: "Please enter a question regarding platform operations.", source: "local" };

  const effectiveApiKey = getStoredApiKey();
  const {
    telemetry = {},
    organizations = [],
    sales = [],
    products = [],
    logs = []
  } = platformData;

  const totalGMV = telemetry.totalGMV || sales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
  const totalCollected = telemetry.totalCollected || sales.reduce((sum, s) => sum + Number(s.amount_paid || 0), 0);
  const platformMRR = telemetry.platformMRR || 0;
  const activeTenants = telemetry.activeTenants || organizations.filter((o) => o.status !== "suspended").length;

  const ragContext = `=== STOREFLOW PLATFORM MULTI-TENANT TELEMETRY (RAG) ===
Scope: Super-Admin Cross-Tenant Intelligence
Timestamp: ${new Date().toLocaleString()}
Currency: GHS
Total Registered Businesses: ${organizations.length}
Active Tenants: ${activeTenants}
Estimated Platform MRR: GHS ${platformMRR.toLocaleString()}
Total Gross Merchandise Value (GMV): GHS ${totalGMV.toLocaleString()}
Total Cash & Digital Collected: GHS ${totalCollected.toLocaleString()}
MoMo Volume: GHS ${(telemetry.methods?.momo || 0).toLocaleString()}
Physical Cash Volume: GHS ${(telemetry.methods?.cash || 0).toLocaleString()}
Identified Ledger Anomalies: ${telemetry.anomalies?.length || 0}

--- ACTIVE TENANTS SAMPLE ---
${organizations.slice(0, 10).map((o) => `- ${o.name} (Plan: ${o.plan || "starter"}, Status: ${o.status || "active"}, Monthly: GHS ${o.monthly_price || 120})`).join("\n")}

--- ACTIVE AUDIT ALERTS ---
${(telemetry.anomalies || []).length === 0 ? "No critical anomalies detected." : (telemetry.anomalies || []).slice(0, 5).map((a) => `- [${(a.severity || "info").toUpperCase()}] ${a.type}: ${a.desc}`).join("\n")}
=== END PLATFORM TELEMETRY ===`;

  const systemPrompt = `You are StoreFlow Platform Intelligence for the Super Admin console.
You have real-time visibility across all registered stores and multi-tenant telemetry.
Rules:
1. Ground your answers strictly in the platform telemetry facts and GHS figures provided.
2. CRITICAL FORMATTING MANDATE: NEVER use markdown asterisks (such as **bold** or *italic*). Use clean line breaks, uppercase tags or clean bullet dashes (- ) instead.
3. Be professional, analytical, concise, and direct. Offer executive-level insights on SaaS MRR, transaction volume, and operational anomalies.
4. Quote all monetary figures in Ghanaian Cedis (GHS).

${ragContext}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...chatHistory.slice(-6).map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: cleanAIMessageText(m.text)
    })),
    { role: "user", content: cleanQ }
  ];

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const endpoint = effectiveApiKey
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://text.pollinations.ai/openai/chat/completions";

    const headers = { "Content-Type": "application/json" };
    if (effectiveApiKey) {
      headers["Authorization"] = `Bearer ${effectiveApiKey}`;
      headers["HTTP-Referer"] = "https://storeflow.app";
      headers["X-Title"] = "StoreFlow Platform AI";
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: effectiveApiKey ? "liquid/lfm-2.5-2.6b:free" : "openai",
        messages,
        temperature: 0.5,
        max_tokens: 600
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawAnswer = data?.choices?.[0]?.message?.content || "";
    return {
      text: cleanAIMessageText(rawAnswer),
      source: "live-llm",
      modelName: effectiveApiKey ? "Liquid LFM 2.6B (Free)" : "Free Online Gateway"
    };
  } catch (err) {
    console.warn("Platform LLM fetch fallback:", err.message);
    // Intelligent rule-based fallback if offline
    let reply = "";
    const q = cleanQ.toLowerCase();
    if (q.includes("mrr") || q.includes("revenue") || q.includes("billing") || q.includes("gmv")) {
      reply = `Platform Financial Summary:\n- Total Cross-Tenant GMV: GHS ${totalGMV.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n- Estimated Platform MRR: GHS ${platformMRR.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n- Total Collections: GHS ${totalCollected.toLocaleString("en-US", { minimumFractionDigits: 2 })}\n- Active Businesses: ${activeTenants} organizations actively processing orders.`;
    } else if (q.includes("momo") || q.includes("cash") || q.includes("payment")) {
      const momoShare = totalCollected > 0 ? (((telemetry.methods?.momo || 0) / totalCollected) * 100).toFixed(1) : 0;
      const cashShare = totalCollected > 0 ? (((telemetry.methods?.cash || 0) / totalCollected) * 100).toFixed(1) : 0;
      reply = `Payment Infrastructure Breakdown:\n- MoMo Volume: GHS ${(telemetry.methods?.momo || 0).toLocaleString()} (${momoShare}%)\n- Physical Cash: GHS ${(telemetry.methods?.cash || 0).toLocaleString()} (${cashShare}%)\n- Insight: Digital payment adoption is strong across Ghanaian retail merchants on StoreFlow.`;
    } else if (q.includes("anomal") || q.includes("risk") || q.includes("fraud") || q.includes("audit")) {
      reply = `Security & Ledger Anomaly Report:\n- Total anomalies flagged: ${telemetry.anomalies?.length || 0}\n${(telemetry.anomalies || []).slice(0, 4).map((a) => `- [${a.severity.toUpperCase()}] ${a.type}: ${a.desc}`).join("\n") || "- No critical ledger anomalies detected."}`;
    } else {
      reply = `StoreFlow Platform Intelligence:\nPlatform health is normal across ${organizations.length} registered organizations. Active MRR stands at GHS ${platformMRR.toLocaleString()} with total GMV of GHS ${totalGMV.toLocaleString()}.`;
    }
    return {
      text: reply,
      source: "local-engine",
      modelName: "StoreFlow Platform Engine"
    };
  }
}

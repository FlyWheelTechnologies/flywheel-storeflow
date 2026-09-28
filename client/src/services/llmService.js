/**
 * StoreFlow RAG & Universal LLM Gateway
 * Allows plugging in any free/cheap AI model via OpenRouter or OpenAI-compatible endpoint,
 * grounded in real-time store telemetry (RAG).
 */

import { generateStoreCopilotResponse, cleanAIMessageText } from "./aiAnalyticsService";

export const CURATED_MODELS = [
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B (Free)",
    badge: "Free",
    provider: "Meta / OpenRouter",
    desc: "Highly intelligent, full context, free tier"
  },
  {
    id: "google/gemini-2.0-flash-lite-001",
    name: "Gemini 2.0 Flash Lite",
    badge: "Ultra Fast",
    provider: "Google / OpenRouter",
    desc: "Instant responses, negligible cost"
  },
  {
    id: "mistralai/mistral-7b-instruct:free",
    name: "Mistral 7B Instruct (Free)",
    badge: "Free",
    provider: "Mistral / OpenRouter",
    desc: "Fast, concise retail answers"
  },
  {
    id: "deepseek/deepseek-r1:free",
    name: "DeepSeek R1 (Free)",
    badge: "Reasoning",
    provider: "DeepSeek / OpenRouter",
    desc: "Deep inventory problem-solving"
  },
  {
    id: "qwen/qwen-2.5-72b-instruct:free",
    name: "Qwen 2.5 72B (Free)",
    badge: "Free",
    provider: "Alibaba / OpenRouter",
    desc: "Top multilingual and analytics accuracy"
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
    localStorage.getItem(STORAGE_KEYS.API_KEY) ||
    import.meta.env.VITE_OPENROUTER_API_KEY ||
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
  return (
    localStorage.getItem(STORAGE_KEYS.MODEL) ||
    "meta-llama/llama-3.3-70b-instruct:free"
  );
}

export function setCurrentModel(modelId) {
  localStorage.setItem(STORAGE_KEYS.MODEL, modelId);
}

export function getTemperature() {
  const val = localStorage.getItem(STORAGE_KEYS.TEMPERATURE);
  return val ? parseFloat(val) : 0.7; // 0.7 for creative non-deterministic retail answers
}

export function setTemperature(val) {
  localStorage.setItem(STORAGE_KEYS.TEMPERATURE, String(val));
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
 * Sends grounding RAG context to OpenRouter or free model.
 * Seamlessly falls back to local engine if offline or unconfigured.
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

  // If user selected offline engine or no API key is available
  if (chosenModel === "storeflow-offline" || !effectiveApiKey) {
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

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${effectiveApiKey}`,
        "HTTP-Referer": "https://storeflow.app",
        "X-Title": "StoreFlow AI Retail Copilot"
      },
      body: JSON.stringify({
        model: chosenModel,
        messages,
        temperature: effectiveTemp,
        max_tokens: 650
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.warn("OpenRouter API error, falling back to local engine:", errBody);
      // Fallback to local
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
      modelName: chosenModel
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

import { locusRequest } from "./client";

// orderId is kept for callsite compatibility; in Foundry it carries a commissionId
// and is only used by the caller to correlate logs. No-op here.
export async function callWrappedApi<T = unknown>(params: {
  provider: string;
  endpoint: string;
  body: Record<string, unknown>;
  orderId: string;
  estimatedCost?: number;
}): Promise<T> {
  const { provider, endpoint, body } = params;
  const path = `/wrapped/${provider}/${endpoint}`;
  return locusRequest<T>(path, { method: "POST", body });
}

// ── Exa Search ──

export async function exaSearch(
  query: string,
  orderId: string,
  numResults = 10
) {
  return callWrappedApi<{
    results: Array<{
      title: string;
      url: string;
      text?: string;
      highlights?: string[];
      publishedDate?: string;
    }>;
  }>({
    provider: "exa",
    endpoint: "search",
    body: {
      query,
      numResults,
      type: "neural",
      useAutoprompt: true,
      contents: {
        text: { maxCharacters: 2000 },
        highlights: { numSentences: 3 },
      },
    },
    orderId,
    estimatedCost: 0.01,
  });
}

// ── Firecrawl Scrape ──

export async function firecrawlScrape(url: string, orderId: string) {
  return callWrappedApi<{
    markdown?: string;
    metadata?: { title?: string; description?: string };
  }>({
    provider: "firecrawl",
    endpoint: "scrape",
    body: {
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      timeout: 30000,
    },
    orderId,
    estimatedCost: 0.005,
  });
}

// ── Gemini Chat ──

export async function geminiChat(
  systemPrompt: string,
  userMessage: string,
  orderId: string,
  options?: { jsonMode?: boolean; maxTokens?: number }
) {
  return callWrappedApi<{
    text?: string;
    content?: string;
    candidates?: Array<{
      content: { parts: Array<{ text: string }> };
    }>;
  }>({
    provider: "gemini",
    endpoint: "chat",
    body: {
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      maxOutputTokens: options?.maxTokens || 8192,
      temperature: 0.7,
      ...(options?.jsonMode && { responseMimeType: "application/json" }),
    },
    orderId,
    estimatedCost: 0.01,
  });
}

// ── CoinGecko ──

export async function coinGeckoPrice(ids: string, orderId: string) {
  return callWrappedApi<Record<string, { usd: number; usd_market_cap?: number; usd_24h_change?: number }>>({
    provider: "coingecko",
    endpoint: "simple-price",
    body: { ids, vs_currencies: "usd", include_market_cap: true, include_24hr_change: true },
    orderId,
    estimatedCost: 0.06,
  });
}

export async function coinGeckoMarkets(orderId: string, category?: string) {
  return callWrappedApi<Array<{
    id: string; symbol: string; name: string; current_price: number;
    market_cap: number; price_change_percentage_24h: number;
  }>>({
    provider: "coingecko",
    endpoint: "coins-markets",
    body: { vs_currency: "usd", order: "market_cap_desc", per_page: 10, ...(category && { category }) },
    orderId,
    estimatedCost: 0.06,
  });
}

// ── Alpha Vantage ──

export async function alphaVantageQuote(symbol: string, orderId: string) {
  return callWrappedApi<{ "Global Quote": Record<string, string> }>({
    provider: "alphavantage",
    endpoint: "global-quote",
    body: { symbol },
    orderId,
    estimatedCost: 0.008,
  });
}

export async function alphaVantageOverview(symbol: string, orderId: string) {
  return callWrappedApi<Record<string, string>>({
    provider: "alphavantage",
    endpoint: "company-overview",
    body: { symbol },
    orderId,
    estimatedCost: 0.008,
  });
}

// ── Apollo ──

export async function apolloOrgEnrichment(domain: string, orderId: string) {
  return callWrappedApi<{ organization: Record<string, unknown> }>({
    provider: "apollo",
    endpoint: "org-enrichment",
    body: { domain },
    orderId,
    estimatedCost: 0.008,
  });
}

// ── EDGAR SEC ──

export async function edgarFilings(cik: string, orderId: string) {
  return callWrappedApi<{
    cik: string; name: string; tickers: string[];
    filings: { recent: { form: string[]; filingDate: string[]; primaryDocument: string[] } };
  }>({
    provider: "edgar",
    endpoint: "company-submissions",
    body: { cik },
    orderId,
    estimatedCost: 0.008,
  });
}

// ── Perplexity ──

export async function perplexityChat(query: string, orderId: string) {
  return callWrappedApi<{
    choices: Array<{ message: { content: string } }>;
    citations?: string[];
  }>({
    provider: "perplexity",
    endpoint: "chat",
    body: {
      model: "sonar",
      messages: [{ role: "user", content: query }],
      max_tokens: 2000,
    },
    orderId,
    estimatedCost: 0.005,
  });
}

// ── Brave Search ──

export async function braveWebSearch(query: string, orderId: string) {
  return callWrappedApi<{
    web?: { results: Array<{ title: string; url: string; description: string }> };
  }>({
    provider: "brave",
    endpoint: "web-search",
    body: { q: query, count: 10 },
    orderId,
    estimatedCost: 0.035,
  });
}

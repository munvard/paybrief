import { locusRequest } from "./client";
import { logApiCost } from "../db/queries";

export async function callWrappedApi<T = unknown>(params: {
  provider: string;
  endpoint: string;
  body: Record<string, unknown>;
  orderId: string;
  estimatedCost?: number;
}): Promise<T> {
  const { provider, endpoint, body, orderId, estimatedCost } = params;
  const path = `/wrapped/${provider}/${endpoint}`;

  const result = await locusRequest<T>(path, { method: "POST", body });

  await logApiCost({
    orderId,
    provider,
    endpoint,
    costUsdc: estimatedCost || 0.01,
  });

  return result;
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
  orderId: string
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
      maxOutputTokens: 8192,
      temperature: 0.7,
    },
    orderId,
    estimatedCost: 0.01,
  });
}

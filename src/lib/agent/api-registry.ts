export interface ApiDefinition {
  provider: string;
  endpoint: string;
  description: string;
  estimatedCost: number;
  capabilities: string[];
}

export const API_REGISTRY: Record<string, ApiDefinition> = {
  exa_search: {
    provider: "exa",
    endpoint: "search",
    description: "AI-native web search with semantic understanding",
    estimatedCost: 0.01,
    capabilities: ["web_search", "news", "company_info", "general_research"],
  },
  firecrawl_scrape: {
    provider: "firecrawl",
    endpoint: "scrape",
    description: "Scrape and extract content from web pages",
    estimatedCost: 0.005,
    capabilities: ["web_scraping", "page_content", "pricing_pages"],
  },
  coingecko_price: {
    provider: "coingecko",
    endpoint: "simple-price",
    description: "Real-time cryptocurrency prices and market data",
    estimatedCost: 0.06,
    capabilities: ["crypto_prices", "market_data", "token_info"],
  },
  coingecko_markets: {
    provider: "coingecko",
    endpoint: "coins-markets",
    description: "Detailed crypto market data with rankings",
    estimatedCost: 0.06,
    capabilities: ["crypto_markets", "rankings", "volume"],
  },
  alphavantage_quote: {
    provider: "alphavantage",
    endpoint: "global-quote",
    description: "Real-time stock price quotes",
    estimatedCost: 0.008,
    capabilities: ["stock_price", "market_data"],
  },
  alphavantage_overview: {
    provider: "alphavantage",
    endpoint: "company-overview",
    description: "Company fundamentals, financials, and description",
    estimatedCost: 0.008,
    capabilities: ["company_financials", "fundamentals", "description"],
  },
  apollo_org: {
    provider: "apollo",
    endpoint: "org-enrichment",
    description: "Company enrichment with employee count, industry, tech stack",
    estimatedCost: 0.008,
    capabilities: ["company_enrichment", "employee_data", "industry"],
  },
  edgar_filings: {
    provider: "edgar",
    endpoint: "company-submissions",
    description: "SEC filings, 10-K, 10-Q reports for public companies",
    estimatedCost: 0.008,
    capabilities: ["sec_filings", "financial_reports", "regulatory"],
  },
  perplexity_chat: {
    provider: "perplexity",
    endpoint: "chat",
    description: "AI search with real-time web access and citations",
    estimatedCost: 0.005,
    capabilities: ["ai_search", "citations", "synthesis", "current_events"],
  },
  brave_search: {
    provider: "brave",
    endpoint: "web-search",
    description: "Independent web search engine",
    estimatedCost: 0.035,
    capabilities: ["web_search", "news", "general_research"],
  },
  gemini_chat: {
    provider: "gemini",
    endpoint: "chat",
    description: "Gemini LLM for analysis and synthesis",
    estimatedCost: 0.01,
    capabilities: ["synthesis", "analysis", "writing"],
  },
};

export type TaskType =
  | "crypto"
  | "public_company"
  | "startup"
  | "person"
  | "general";

export interface TaskTypeConfig {
  label: string;
  requiredApis: string[];
  optionalApis: string[];
  estimatedCostRange: [number, number];
}

export const TASK_TYPE_CONFIGS: Record<TaskType, TaskTypeConfig> = {
  crypto: {
    label: "Cryptocurrency Analysis",
    requiredApis: ["coingecko_price", "exa_search"],
    optionalApis: ["perplexity_chat", "brave_search"],
    estimatedCostRange: [0.07, 0.12],
  },
  public_company: {
    label: "Public Company Analysis",
    requiredApis: ["alphavantage_quote", "alphavantage_overview", "exa_search"],
    optionalApis: ["edgar_filings", "apollo_org", "firecrawl_scrape"],
    estimatedCostRange: [0.03, 0.08],
  },
  startup: {
    label: "Startup / Private Company",
    requiredApis: ["exa_search", "apollo_org"],
    optionalApis: ["firecrawl_scrape", "perplexity_chat", "brave_search"],
    estimatedCostRange: [0.02, 0.06],
  },
  person: {
    label: "Person Research",
    requiredApis: ["exa_search", "perplexity_chat"],
    optionalApis: ["apollo_org", "brave_search"],
    estimatedCostRange: [0.02, 0.05],
  },
  general: {
    label: "General Research",
    requiredApis: ["exa_search", "perplexity_chat"],
    optionalApis: ["firecrawl_scrape", "brave_search"],
    estimatedCostRange: [0.02, 0.05],
  },
};

export function getApiDef(key: string): ApiDefinition | undefined {
  return API_REGISTRY[key];
}

export function getRegistryPrompt(): string {
  return Object.entries(API_REGISTRY)
    .map(
      ([key, api]) =>
        `- ${key}: ${api.description} (${api.provider}/${api.endpoint}, $${api.estimatedCost})`
    )
    .join("\n");
}

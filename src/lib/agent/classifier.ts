import { geminiChat } from "../locus/wrapped";
import { getRegistryPrompt, type TaskType } from "./api-registry";

export interface ApiPlan {
  provider: string;
  endpoint: string;
  reason: string;
  estimatedCost: number;
  priority: "required" | "optional";
  callParams: Record<string, unknown>;
}

export interface TaskClassification {
  taskType: TaskType;
  entities: string[];
  searchQueries: string[];
  recommendedApis: ApiPlan[];
  estimatedCost: number;
  reasoning: string;
}

const CLASSIFIER_SYSTEM_PROMPT = `You are Agent Zero's task classification engine. Given a user's research task, analyze it and output a structured JSON execution plan.

You have access to these paid APIs (each costs real USDC from your wallet):

${getRegistryPrompt()}

## Task Types and Routing Rules

- **crypto**: Anything about cryptocurrencies, tokens, DeFi, blockchain projects. Use coingecko + exa.
- **public_company**: Publicly traded companies (have stock tickers). Use alphavantage + exa. Optionally edgar for SEC filings, apollo for enrichment.
- **startup**: Private companies, startups, SaaS products. Use exa + apollo. Optionally firecrawl for their website.
- **person**: Research about a specific person (CEO, founder, etc). Use exa + perplexity.
- **general**: Anything else — markets, industries, trends, concepts. Use exa + perplexity.

## Output Rules

- Always include gemini_chat as the LAST api in recommendedApis (for final synthesis) — but DO NOT include it in the cost estimate since it's always used.
- For callParams: include the exact parameters each API needs:
  - exa_search: { "query": "search query here", "numResults": 8 }
  - firecrawl_scrape: { "url": "specific url to scrape" } — only if you know a specific URL
  - coingecko_price: { "ids": "bitcoin,ethereum" } — use coingecko IDs (lowercase, hyphens)
  - coingecko_markets: {} or { "category": "..." }
  - alphavantage_quote: { "symbol": "AAPL" } — stock ticker
  - alphavantage_overview: { "symbol": "AAPL" }
  - apollo_org: { "domain": "stripe.com" } — company website domain
  - edgar_filings: { "cik": "320193" } — SEC CIK number (look up if you know it, otherwise skip)
  - perplexity_chat: { "query": "detailed question" }
  - brave_search: { "q": "search query" }
- Keep total cost reasonable ($0.03-0.15)
- Be decisive — pick the best 2-4 APIs, not all of them
- searchQueries: 2-3 search queries for exa_search if included

Respond with ONLY valid JSON matching this schema:
{
  "taskType": "crypto|public_company|startup|person|general",
  "entities": ["entity names extracted"],
  "searchQueries": ["query 1", "query 2"],
  "recommendedApis": [
    {
      "provider": "provider_slug",
      "endpoint": "endpoint_name",
      "reason": "why this API",
      "estimatedCost": 0.01,
      "priority": "required|optional",
      "callParams": {}
    }
  ],
  "estimatedCost": 0.08,
  "reasoning": "One paragraph explaining the plan"
}`;

export async function classifyTask(
  taskDescription: string,
  orderId: string
): Promise<TaskClassification> {
  const result = await geminiChat(
    CLASSIFIER_SYSTEM_PROMPT,
    `Classify and plan this task: "${taskDescription}"`,
    orderId,
    { jsonMode: true, maxTokens: 1024 }
  );

  const text =
    result.text ||
    result.content ||
    result.candidates?.[0]?.content?.parts?.[0]?.text ||
    "";

  try {
    const parsed = JSON.parse(text) as TaskClassification;

    // Validate required fields
    if (!parsed.taskType || !parsed.recommendedApis || !parsed.reasoning) {
      throw new Error("Missing required classification fields");
    }

    return parsed;
  } catch (err) {
    // Fallback classification if JSON parse fails
    console.error("Classifier JSON parse failed, using fallback:", err);
    return {
      taskType: "general",
      entities: [taskDescription.split(" ").slice(0, 3).join(" ")],
      searchQueries: [taskDescription, `${taskDescription} analysis`],
      recommendedApis: [
        {
          provider: "exa",
          endpoint: "search",
          reason: "General web search for the topic",
          estimatedCost: 0.01,
          priority: "required",
          callParams: { query: taskDescription, numResults: 8 },
        },
        {
          provider: "perplexity",
          endpoint: "chat",
          reason: "AI-powered search with citations",
          estimatedCost: 0.005,
          priority: "required",
          callParams: { query: taskDescription },
        },
        {
          provider: "gemini",
          endpoint: "chat",
          reason: "Final synthesis",
          estimatedCost: 0.01,
          priority: "required",
          callParams: {},
        },
      ],
      estimatedCost: 0.025,
      reasoning: `Fallback classification for: ${taskDescription}`,
    };
  }
}

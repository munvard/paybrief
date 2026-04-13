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

- **crypto**: Cryptocurrencies, tokens, DeFi, blockchain projects, exchanges. Examples: Bitcoin, Ethereum, Solana, Uniswap, DeFi, NFT. Use coingecko + exa.
- **public_company**: Publicly traded companies with stock tickers. Examples: Apple (AAPL), Tesla (TSLA), Google (GOOGL), Amazon (AMZN), Microsoft (MSFT), NVIDIA (NVDA), Meta (META), Adyen. Use alphavantage + exa. Optionally edgar + apollo.
- **startup**: Private companies, startups, SaaS products, tech companies without public stock. Examples: Stripe, Cursor, OpenAI, Anthropic, SpaceX, Figma, Linear, Notion, Vercel. Use exa + apollo. Optionally firecrawl.
- **person**: Research about a specific person. Examples: Jensen Huang, Sam Altman, Elon Musk. Use exa + perplexity.
- **general**: ONLY for broad topics, trends, industries, or concepts that are NOT about a specific entity. Examples: "AI chip market overview", "future of remote work", "climate tech trends". Use exa + perplexity.

IMPORTANT: Only classify as "general" if the task is truly about a broad topic. If ANY specific company, person, or token is mentioned, use the appropriate specific type.

## Common Identifiers (use in callParams)
Stock tickers: AAPL (Apple), TSLA (Tesla), MSFT (Microsoft), AMZN (Amazon), GOOGL (Google), NVDA (NVIDIA), META (Meta)
SEC CIK numbers: Apple=320193, Tesla=1318605, Microsoft=789019, Amazon=1018724, Google=1652044, Meta=1326801, NVIDIA=1045810
Crypto IDs: bitcoin, ethereum, solana, cardano, polkadot, avalanche-2, chainlink, uniswap
Domains: stripe.com, openai.com, anthropic.com, linear.app, notion.so, figma.com, vercel.com

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
    // Try to extract JSON from response (may have markdown wrapping)
    let jsonText = text.trim();
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonText = jsonMatch[0];

    const parsed = JSON.parse(jsonText) as TaskClassification;

    // Validate required fields
    if (!parsed.taskType || !parsed.recommendedApis || !parsed.reasoning) {
      throw new Error("Missing required classification fields");
    }

    return parsed;
  } catch (err) {
    // Fallback classification if JSON parse fails
    console.error("Classifier JSON parse failed, using fallback. Raw text:", text.slice(0, 200), err);
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

// ── Multi-Round: Plan Next Research Round ──

export interface RoundPlan {
  shouldContinue: boolean;
  reasoning: string;
  researchGoal: string;
  apis: ApiPlan[];
}

const ROUND_PLANNER_PROMPT = `You are Agent Zero's research decision engine. You've completed a round of research and need to decide what to do next.

Available APIs for deeper research:
${getRegistryPrompt()}

## Your Job
1. Review what was found so far
2. Identify GAPS — what important data is missing?
3. Decide if another round of research is needed
4. If yes, specify EXACTLY which APIs to call with precise callParams

## Rules for callParams (CRITICAL — extract from findings):
- apollo/org-enrichment: Extract company domain from findings (e.g., {"domain": "stripe.com"})
- alphavantage/global-quote: Extract stock ticker (e.g., {"symbol": "AAPL"})
- alphavantage/company-overview: Extract stock ticker (e.g., {"symbol": "AAPL"})
- edgar/company-submissions: Extract CIK (e.g., {"cik": "320193"}) — common CIKs: Apple=320193, Tesla=1318605, Microsoft=789019, NVIDIA=1045810
- firecrawl/scrape: Extract a specific URL found in search results (e.g., {"url": "https://stripe.com/pricing"})
- exa/search: New targeted query (e.g., {"query": "Stripe revenue 2025", "numResults": 5})
- coingecko/simple-price: Extract coin IDs (e.g., {"ids": "ethereum,solana"})
- perplexity/chat: Specific follow-up question (e.g., {"query": "What is Stripe's current valuation?"})

## When to STOP (shouldContinue: false):
- We already have data from 3+ different source types
- The task is simple and Round 1 data is sufficient
- We've already done 2 rounds of deep research

## When to CONTINUE (shouldContinue: true):
- Found company names but no company enrichment data yet → call Apollo
- Found stock tickers but no financial data yet → call Alpha Vantage
- Found important URLs but haven't scraped them → call Firecrawl
- Missing competitive comparison data
- Missing financial/pricing data

Respond with ONLY valid JSON:
{
  "shouldContinue": true,
  "reasoning": "Why we should continue or stop",
  "researchGoal": "What this next round aims to discover",
  "apis": [{ "provider": "...", "endpoint": "...", "reason": "...", "estimatedCost": 0.01, "priority": "required", "callParams": {} }]
}`;

export async function planNextRound(
  taskDescription: string,
  taskType: TaskType,
  priorResults: Array<{ provider: string; summary: string }>,
  orderId: string
): Promise<RoundPlan> {
  const findingsSummary = priorResults
    .map((r) => `- ${r.provider}: ${r.summary}`)
    .join("\n");

  const result = await geminiChat(
    ROUND_PLANNER_PROMPT,
    `Task: "${taskDescription}"
Task type: ${taskType}

## Findings so far:
${findingsSummary}

Decide: should we do another round of research? If yes, which APIs?`,
    orderId,
    { jsonMode: true, maxTokens: 1024 }
  );

  const text =
    result.text ||
    result.content ||
    result.candidates?.[0]?.content?.parts?.[0]?.text ||
    "";

  try {
    let jsonText = text.trim();
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonText = jsonMatch[0];

    const parsed = JSON.parse(jsonText) as RoundPlan;
    if (typeof parsed.shouldContinue !== "boolean") {
      throw new Error("Invalid round plan");
    }
    return parsed;
  } catch (err) {
    console.error("planNextRound parse failed. Raw:", text.slice(0, 200), err);
    return { shouldContinue: false, reasoning: "Analysis complete — proceeding to synthesis", researchGoal: "", apis: [] };
  }
}

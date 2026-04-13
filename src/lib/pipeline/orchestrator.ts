import {
  exaSearch,
  firecrawlScrape,
  geminiChat,
  coinGeckoPrice,
  coinGeckoMarkets,
  alphaVantageQuote,
  alphaVantageOverview,
  apolloOrgEnrichment,
  edgarFilings,
  perplexityChat,
  braveWebSearch,
} from "../locus/wrapped";
import {
  updateOrderStatus,
  createReport,
  getCostsByOrderId,
  logDecision,
  updateOrderClassification,
} from "../db/queries";
import { classifyTask, planNextRound, type ApiPlan, type TaskClassification } from "../agent/classifier";
import { TASK_TYPE_CONFIGS } from "../agent/api-registry";

const MAX_ROUNDS = 3;
const TIME_BUDGET_MS = 95_000; // 95s budget, leaves margin for synthesis under 120s

interface PipelineResult {
  reportId: string;
  totalCost: number;
}

export async function runAgentPipeline(
  orderId: string,
  taskDescription: string
): Promise<PipelineResult> {
  let stepCounter = 0;
  const startTime = Date.now();
  const allApiResults: Array<{ provider: string; endpoint: string; data: unknown; round: number }> = [];
  const roundSummaries: Array<{ provider: string; summary: string }> = [];

  try {
    // ── Step 1: Classify ──
    await updateOrderStatus(orderId, "CLASSIFYING");
    await logDecision({
      orderId, step: stepCounter++, round: 0, action: "classify",
      reasoning: `Analyzing task: "${taskDescription.slice(0, 100)}"`,
      status: "running",
    });

    const classification = await classifyTask(taskDescription, orderId);
    const config = TASK_TYPE_CONFIGS[classification.taskType];

    await updateOrderClassification(orderId, classification.taskType, JSON.stringify(classification));

    await logDecision({
      orderId, step: stepCounter++, round: 0, action: "plan",
      reasoning: classification.reasoning,
      resultSummary: `Type: ${config?.label || classification.taskType} | APIs: ${classification.recommendedApis.map((a) => a.provider).join(", ")} | Est: $${classification.estimatedCost.toFixed(3)}`,
      costUsdc: 0.01,
    });

    // ── Step 2: Multi-Round Research Loop ──
    await updateOrderStatus(orderId, "EXECUTING");
    let currentRound = 0;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      currentRound = round;

      // Time check before each round (except round 0)
      if (round > 0 && Date.now() - startTime > TIME_BUDGET_MS) {
        await logDecision({
          orderId, step: stepCounter++, round, action: "analyze",
          reasoning: `Time budget reached (${Math.round((Date.now() - startTime) / 1000)}s). Proceeding to synthesis with data collected so far.`,
          status: "success",
        });
        break;
      }

      let apisForRound: ApiPlan[];

      if (round === 0) {
        // Round 0: Use initial classification plan
        apisForRound = classification.recommendedApis.filter(a => a.provider !== "gemini");
      } else {
        // Round 1+: Ask Gemini what to research next based on findings
        await logDecision({
          orderId, step: stepCounter++, round, action: "analyze",
          reasoning: `Analyzing ${roundSummaries.length} findings from round ${round}. Looking for gaps and deeper research opportunities...`,
          status: "running",
        });

        const nextPlan = await planNextRound(taskDescription, classification.taskType, roundSummaries, orderId);

        await logDecision({
          orderId, step: stepCounter++, round, action: "analyze",
          reasoning: nextPlan.reasoning,
          resultSummary: nextPlan.shouldContinue
            ? `Deep diving: ${nextPlan.researchGoal}`
            : "Sufficient data collected — proceeding to synthesis",
          costUsdc: 0.01,
          status: "success",
        });

        if (!nextPlan.shouldContinue || nextPlan.apis.length === 0) break;
        apisForRound = nextPlan.apis.filter(a => a.provider !== "gemini");
      }

      // Execute APIs for this round
      for (const apiPlan of apisForRound) {
        // Time check before each API call
        if (Date.now() - startTime > TIME_BUDGET_MS) break;

        await logDecision({
          orderId, step: stepCounter++, round, action: "call_api",
          provider: apiPlan.provider,
          reasoning: apiPlan.reason,
          status: "running",
        });

        const callStart = Date.now();

        try {
          const data = await callApiByPlan(apiPlan, orderId);
          const duration = Date.now() - callStart;
          const summary = summarizeApiResult(apiPlan.provider, data);

          allApiResults.push({ provider: apiPlan.provider, endpoint: apiPlan.endpoint, data, round });
          roundSummaries.push({ provider: apiPlan.provider, summary });

          await logDecision({
            orderId, step: stepCounter - 1, round, action: "call_api",
            provider: apiPlan.provider,
            reasoning: apiPlan.reason,
            resultSummary: summary,
            costUsdc: apiPlan.estimatedCost,
            durationMs: duration,
            status: "success",
          });
        } catch (err) {
          const duration = Date.now() - callStart;
          const errorMsg = err instanceof Error ? err.message : "API call failed";

          await logDecision({
            orderId, step: stepCounter - 1, round, action: "call_api",
            provider: apiPlan.provider,
            reasoning: apiPlan.reason,
            resultSummary: `FAILED: ${errorMsg}`,
            durationMs: duration,
            status: apiPlan.priority === "required" ? "failed" : "skipped",
          });

          if (apiPlan.priority === "required") {
            console.error(`Required API ${apiPlan.provider} failed:`, errorMsg);
          }
        }
      }
    }

    if (allApiResults.length === 0) {
      throw new Error("All API calls failed — cannot generate report");
    }

    // ── Step 3: Synthesize ALL Results ──
    await updateOrderStatus(orderId, "SYNTHESIZING");
    await logDecision({
      orderId, step: stepCounter++, round: currentRound, action: "synthesize",
      reasoning: `Synthesizing ${allApiResults.length} data sources from ${currentRound + 1} round(s) into final report`,
      status: "running",
    });

    const synthesisPrompt = buildSynthesisPrompt(taskDescription, classification, allApiResults, currentRound + 1);
    const geminiResult = await geminiChat(
      getSynthesisSystemPrompt(classification.taskType),
      synthesisPrompt,
      orderId
    );

    const reportText = extractGeminiText(geminiResult);
    if (!reportText) throw new Error("Synthesis returned empty response");

    const durationMs = Date.now() - startTime;

    await logDecision({
      orderId, step: stepCounter - 1, round: currentRound, action: "synthesize",
      reasoning: "Report synthesized successfully",
      resultSummary: `Generated ${reportText.length} character report from ${allApiResults.length} sources`,
      costUsdc: 0.01,
      status: "success",
    });

    // ── Step 4: Save Report ──
    const sources = extractSources(allApiResults);
    const costs = await getCostsByOrderId(orderId);
    const totalCost = costs.reduce((sum, c) => sum + c.costUsdc, 0);

    const contentJson = JSON.stringify({
      taskDescription,
      taskType: classification.taskType,
      entities: classification.entities,
      generatedAt: new Date().toISOString(),
      apisCalled: [...new Set(allApiResults.map((r) => r.provider))],
      roundCount: currentRound + 1,
      durationMs,
      totalApiCalls: allApiResults.length,
      sections: parseBriefSections(reportText),
    });

    const reportId = await createReport({
      orderId,
      contentJson,
      contentMarkdown: reportText,
      sources: JSON.stringify(sources),
      researchCostUsdc: totalCost,
    });

    await logDecision({
      orderId, step: stepCounter++, round: currentRound, action: "deliver",
      reasoning: `Job complete in ${(durationMs / 1000).toFixed(0)}s | ${currentRound + 1} rounds | ${allApiResults.length} API calls | Cost: $${totalCost.toFixed(4)} | Profit: $${(3 - totalCost).toFixed(4)}`,
      resultSummary: `Report ID: ${reportId}`,
      status: "success",
    });

    await updateOrderStatus(orderId, "COMPLETED", {
      completedAt: new Date().toISOString(),
    });

    return { reportId, totalCost };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown pipeline error";
    console.error(`Agent pipeline failed for ${orderId}:`, message);
    await logDecision({
      orderId, step: stepCounter++, round: 0, action: "deliver",
      reasoning: `Pipeline failed: ${message}`,
      status: "failed",
    });
    await updateOrderStatus(orderId, "FAILED", { errorMessage: message });
    throw error;
  }
}

// ── API Dispatcher ──

async function callApiByPlan(plan: ApiPlan, orderId: string): Promise<unknown> {
  const p = plan.callParams;
  // Normalize: classifier may return "exa_search"/"exa_search/search"/"exa/search" — all should work
  const rawKey = plan.endpoint
    ? `${plan.provider}/${plan.endpoint}`
    : plan.provider;
  // Strip duplicate suffixes like "exa_search/search" → "exa/search"
  const key = rawKey
    .replace(/^(\w+)_(\w+)\/\2$/, "$1/$2")  // exa_search/search → exa/search
    .replace(/^(\w+)_(\w+)$/, "$1/$2");       // exa_search → exa/search

  switch (key) {
    case "exa/search":
    case "exa_search":
      return exaSearch(p.query as string || plan.provider, orderId, (p.numResults as number) || 8);
    case "firecrawl/scrape":
    case "firecrawl_scrape":
      return firecrawlScrape(p.url as string, orderId);
    case "coingecko/simple-price":
    case "coingecko/price":
    case "coingecko_price":
      return coinGeckoPrice(p.ids as string, orderId);
    case "coingecko/coins-markets":
    case "coingecko_markets":
      return coinGeckoMarkets(orderId, p.category as string | undefined);
    case "alphavantage/global-quote":
    case "alphavantage_quote":
      return alphaVantageQuote(p.symbol as string, orderId);
    case "alphavantage/company-overview":
    case "alphavantage_overview":
      return alphaVantageOverview(p.symbol as string, orderId);
    case "apollo/org-enrichment":
    case "apollo_org":
      return apolloOrgEnrichment(p.domain as string, orderId);
    case "edgar/company-submissions":
    case "edgar_filings":
      return edgarFilings(p.cik as string, orderId);
    case "perplexity/chat":
    case "perplexity_chat":
      return perplexityChat(p.query as string || plan.provider, orderId);
    case "brave/web-search":
    case "brave/search":
    case "brave_search":
      return braveWebSearch((p.q || p.query) as string, orderId);
    case "gemini/chat":
    case "gemini_chat":
      // Skip gemini in API execution — it's used only in synthesis
      return { skipped: true };
    default:
      console.error(`Unknown API key: ${key} (raw: ${rawKey}, provider=${plan.provider}, endpoint=${plan.endpoint})`);
      throw new Error(`Unknown API: ${key}`);
  }
}

// ── Rich Result Summarizers ──

function summarizeApiResult(provider: string, data: unknown): string {
  try {
    const d = data as Record<string, unknown>;
    switch (provider) {
      case "exa": {
        const results = (d.results as Array<{ title?: string; url?: string }>) || [];
        const titles = results.slice(0, 3).map(r => r.title || "Untitled").join("', '");
        return `Found ${results.length} results: '${titles}'${results.length > 3 ? "..." : ""}`;
      }
      case "firecrawl": {
        const md = (d.markdown as string) || "";
        const meta = d.metadata as Record<string, string> | undefined;
        const title = meta?.title || "page";
        const preview = md.slice(0, 120).replace(/\n/g, " ").trim();
        return `Scraped ${title} (${md.length.toLocaleString()} chars) — "${preview}..."`;
      }
      case "coingecko": {
        const keys = Object.keys(d);
        if (keys.length > 0 && typeof d[keys[0]] === "object") {
          const entries = keys.map(k => {
            const v = d[k] as Record<string, number>;
            const change = v.usd_24h_change;
            const changeStr = change ? ` (${change > 0 ? "+" : ""}${change.toFixed(1)}%)` : "";
            const mcap = v.usd_market_cap ? ` | MCap: $${(v.usd_market_cap / 1e9).toFixed(1)}B` : "";
            return `${k.toUpperCase()}: $${v.usd?.toLocaleString()}${changeStr}${mcap}`;
          });
          return entries.join(" | ");
        }
        if (Array.isArray(d)) {
          const coins = d as Array<{ name?: string; current_price?: number }>;
          return `Top coins: ${coins.slice(0, 3).map(c => `${c.name}: $${c.current_price?.toLocaleString()}`).join(", ")}`;
        }
        return "Got market data";
      }
      case "alphavantage": {
        const quote = d["Global Quote"] as Record<string, string> | undefined;
        if (quote) {
          const sym = quote["01. symbol"];
          const price = quote["05. price"];
          const change = quote["10. change percent"];
          const vol = Number(quote["06. volume"]);
          const volStr = vol > 1e6 ? `${(vol / 1e6).toFixed(1)}M` : vol.toLocaleString();
          return `${sym}: $${price} (${change}) | Vol: ${volStr}`;
        }
        const name = d["Name"] as string;
        if (name) {
          const pe = d["PERatio"] as string;
          const rev = Number(d["RevenueTTM"] as string);
          const mcap = Number(d["MarketCapitalization"] as string);
          const revStr = rev > 1e9 ? `$${(rev / 1e9).toFixed(1)}B` : `$${(rev / 1e6).toFixed(0)}M`;
          const mcapStr = mcap > 1e12 ? `$${(mcap / 1e12).toFixed(2)}T` : `$${(mcap / 1e9).toFixed(1)}B`;
          return `${name} | P/E: ${pe} | Rev: ${revStr} | MCap: ${mcapStr}`;
        }
        return "Got financial data";
      }
      case "apollo": {
        const org = d.organization as Record<string, unknown> | undefined;
        if (!org) return "Got org data";
        const name = org.name || "Unknown";
        const emp = org.estimated_num_employees || "?";
        const industry = org.industry || "";
        const founded = org.founded_year || "";
        const funding = org.total_funding ? `$${(Number(org.total_funding) / 1e6).toFixed(0)}M raised` : "";
        return `${name} — ${emp} employees | ${industry}${founded ? ` | Founded ${founded}` : ""}${funding ? ` | ${funding}` : ""}`;
      }
      case "edgar": {
        const name = d.name as string || "Company";
        const tickers = (d.tickers as string[]) || [];
        const filings = d.filings as Record<string, unknown> | undefined;
        const recent = filings?.recent as Record<string, string[]> | undefined;
        const formCount = recent?.form?.length || 0;
        const latestForm = recent?.form?.[0];
        const latestDate = recent?.filingDate?.[0];
        const tickerStr = tickers.length > 0 ? ` (${tickers[0]})` : "";
        return `${name}${tickerStr} | Latest: ${latestForm || "?"} filed ${latestDate || "?"} | ${formCount} total filings`;
      }
      case "perplexity": {
        const choices = (d.choices as Array<{ message?: { content?: string } }>) || [];
        const citations = (d.citations as string[]) || [];
        const content = choices[0]?.message?.content || "";
        const preview = content.slice(0, 100).replace(/\n/g, " ").trim();
        const sources = citations.slice(0, 3).map(u => {
          try { return new URL(u).hostname.replace("www.", ""); } catch { return u; }
        });
        return `"${preview}..." (${citations.length} citations from ${sources.join(", ")})`;
      }
      case "brave": {
        const web = d.web as Record<string, unknown> | undefined;
        const results = (web?.results as Array<{ title?: string }>) || [];
        const titles = results.slice(0, 3).map(r => r.title || "Untitled").join("', '");
        return `Found ${results.length} results: '${titles}'${results.length > 3 ? "..." : ""}`;
      }
      default:
        return "Data received";
    }
  } catch {
    return "Data received";
  }
}

function extractSources(apiResults: Array<{ provider: string; data: unknown }>): string[] {
  const urls: string[] = [];
  for (const r of apiResults) {
    try {
      const d = r.data as Record<string, unknown>;
      if (r.provider === "exa") {
        const results = (d.results as Array<{ url: string }>) || [];
        urls.push(...results.map((x) => x.url));
      } else if (r.provider === "brave") {
        const web = d.web as Record<string, unknown> | undefined;
        const results = (web?.results as Array<{ url: string }>) || [];
        urls.push(...results.map((x) => x.url));
      } else if (r.provider === "perplexity") {
        const citations = (d.citations as string[]) || [];
        urls.push(...citations);
      }
    } catch { /* skip */ }
  }
  return [...new Set(urls)];
}

// ── Synthesis ──

function getSynthesisSystemPrompt(taskType: string): string {
  const typeHints: Record<string, string> = {
    crypto: "Focus on price action, market metrics, ecosystem analysis, and competitive positioning. Reference specific prices and market caps from CoinGecko data.",
    public_company: "Focus on financial performance, stock analysis, SEC filings, and competitive positioning. Reference specific P/E ratios, revenue figures, and stock prices from Alpha Vantage and EDGAR data.",
    startup: "Focus on product-market fit, competitive landscape, team size, funding, and growth trajectory. Reference specific employee counts and company data from Apollo enrichment.",
    person: "Focus on professional background, key achievements, current role, and industry influence.",
    general: "Provide a comprehensive, well-structured overview of the topic.",
  };

  return `You are Agent Zero, an autonomous AI research agent with access to premium paid data sources. Generate a professional research report.

${typeHints[taskType] || typeHints.general}

IMPORTANT: Reference the SPECIFIC data you received from paid APIs (prices, employee counts, P/E ratios, filing dates, etc). This data is what makes your report valuable — it comes from premium sources like Apollo (company database), Alpha Vantage (financial data), EDGAR (SEC filings), and CoinGecko (crypto markets) that are not freely available.

Output in clean markdown with these sections:
## Executive Summary
## Key Findings
## Detailed Analysis
## Data Points
## Takeaways

Be specific with data points, numbers, and sources. Use bullet points for clarity.
The report should be 1000-2000 words.`;
}

function buildSynthesisPrompt(
  taskDescription: string,
  classification: TaskClassification,
  apiResults: Array<{ provider: string; endpoint: string; data: unknown; round: number }>,
  roundCount: number
): string {
  const dataSections = apiResults
    .map((r) => {
      const summary = JSON.stringify(r.data, null, 2).slice(0, 4000);
      return `### [Round ${r.round + 1}] Data from ${r.provider} (${r.endpoint})\n\`\`\`json\n${summary}\n\`\`\``;
    })
    .join("\n\n");

  return `Task: "${taskDescription}"
Classification: ${classification.taskType} — ${classification.reasoning}
Entities: ${classification.entities.join(", ")}
Research rounds completed: ${roundCount}
Total API calls: ${apiResults.length}

## Research Data Collected

${dataSections}

Generate a comprehensive report based on ALL the data above. Reference specific numbers and data points from the paid API sources.`;
}

function extractGeminiText(result: {
  text?: string;
  content?: string;
  candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
}): string {
  if (result.text) return result.text;
  if (result.content) return result.content;
  if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
    return result.candidates[0].content.parts[0].text;
  }
  return "";
}

function parseBriefSections(markdown: string): Array<{ title: string; content: string }> {
  const sections: Array<{ title: string; content: string }> = [];
  const parts = markdown.split(/^## /gm).filter(Boolean);
  for (const part of parts) {
    const lines = part.split("\n");
    const title = lines[0]?.trim() || "Section";
    const content = lines.slice(1).join("\n").trim();
    sections.push({ title, content });
  }
  return sections.length > 0 ? sections : [{ title: "Report", content: markdown }];
}

export { runAgentPipeline as runResearchPipeline };

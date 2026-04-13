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
import { classifyTask, type ApiPlan, type TaskClassification } from "../agent/classifier";
import { TASK_TYPE_CONFIGS } from "../agent/api-registry";

interface PipelineResult {
  reportId: string;
  totalCost: number;
}

export async function runAgentPipeline(
  orderId: string,
  taskDescription: string
): Promise<PipelineResult> {
  let stepCounter = 0;

  try {
    // ── Step 1: Classify the task ──
    await updateOrderStatus(orderId, "CLASSIFYING");
    await logDecision({
      orderId,
      step: stepCounter++,
      action: "classify",
      reasoning: `Analyzing task: "${taskDescription.slice(0, 100)}"`,
      status: "running",
    });

    const classification = await classifyTask(taskDescription, orderId);
    const config = TASK_TYPE_CONFIGS[classification.taskType];

    await updateOrderClassification(
      orderId,
      classification.taskType,
      JSON.stringify(classification)
    );

    await logDecision({
      orderId,
      step: stepCounter++,
      action: "plan",
      reasoning: classification.reasoning,
      resultSummary: `Type: ${config?.label || classification.taskType} | APIs: ${classification.recommendedApis.map((a) => a.provider).join(", ")} | Est. cost: $${classification.estimatedCost.toFixed(3)}`,
      costUsdc: 0.01,
    });

    // ── Step 2: Execute API calls ──
    await updateOrderStatus(orderId, "EXECUTING");

    const apiResults: Array<{ provider: string; endpoint: string; data: unknown }> = [];

    for (const apiPlan of classification.recommendedApis) {
      // Skip gemini -- it's used in synthesis step
      if (apiPlan.provider === "gemini") continue;

      const decisionId = await logDecision({
        orderId,
        step: stepCounter++,
        action: "call_api",
        provider: apiPlan.provider,
        reasoning: apiPlan.reason,
        status: "running",
      });

      const startTime = Date.now();

      try {
        const data = await callApiByPlan(apiPlan, orderId);
        const duration = Date.now() - startTime;
        const summary = summarizeApiResult(apiPlan.provider, data);

        apiResults.push({ provider: apiPlan.provider, endpoint: apiPlan.endpoint, data });

        await logDecision({
          orderId,
          step: stepCounter - 1, // update same step
          action: "call_api",
          provider: apiPlan.provider,
          reasoning: apiPlan.reason,
          resultSummary: summary,
          costUsdc: apiPlan.estimatedCost,
          durationMs: duration,
          status: "success",
        });
      } catch (err) {
        const duration = Date.now() - startTime;
        const errorMsg = err instanceof Error ? err.message : "API call failed";

        if (apiPlan.priority === "required") {
          await logDecision({
            orderId,
            step: stepCounter - 1,
            action: "call_api",
            provider: apiPlan.provider,
            reasoning: apiPlan.reason,
            resultSummary: `FAILED: ${errorMsg}`,
            durationMs: duration,
            status: "failed",
          });
          // Don't throw -- try to continue with what we have
          console.error(`Required API ${apiPlan.provider} failed:`, errorMsg);
        } else {
          await logDecision({
            orderId,
            step: stepCounter - 1,
            action: "call_api",
            provider: apiPlan.provider,
            reasoning: `Skipped (optional): ${errorMsg}`,
            durationMs: duration,
            status: "skipped",
          });
        }
      }
    }

    if (apiResults.length === 0) {
      throw new Error("All API calls failed — cannot generate report");
    }

    // ── Step 3: Synthesize ──
    await updateOrderStatus(orderId, "SYNTHESIZING");
    await logDecision({
      orderId,
      step: stepCounter++,
      action: "synthesize",
      reasoning: `Synthesizing ${apiResults.length} data sources into final report`,
      status: "running",
    });

    const synthesisPrompt = buildSynthesisPrompt(taskDescription, classification, apiResults);
    const geminiResult = await geminiChat(
      getSynthesisSystemPrompt(classification.taskType),
      synthesisPrompt,
      orderId
    );

    const reportText = extractGeminiText(geminiResult);
    if (!reportText) throw new Error("Synthesis returned empty response");

    await logDecision({
      orderId,
      step: stepCounter - 1,
      action: "synthesize",
      reasoning: "Report synthesized successfully",
      resultSummary: `Generated ${reportText.length} character report`,
      costUsdc: 0.01,
      status: "success",
    });

    // ── Step 4: Save report ──
    const sources = extractSources(apiResults);
    const costs = await getCostsByOrderId(orderId);
    const totalCost = costs.reduce((sum, c) => sum + c.costUsdc, 0);

    const contentJson = JSON.stringify({
      taskDescription,
      taskType: classification.taskType,
      entities: classification.entities,
      generatedAt: new Date().toISOString(),
      apisCalled: apiResults.map((r) => r.provider),
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
      orderId,
      step: stepCounter++,
      action: "deliver",
      reasoning: `Report delivered. Total cost: $${totalCost.toFixed(4)} | Profit: $${(3 - totalCost).toFixed(4)}`,
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
      orderId,
      step: stepCounter++,
      action: "deliver",
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
  // Normalize: classifier may return "exa_search" or "exa/search" or provider="exa" endpoint="search"
  const key = plan.endpoint
    ? `${plan.provider}/${plan.endpoint}`
    : plan.provider.replace("_", "/");

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
    case "brave_search":
      return braveWebSearch((p.q || p.query) as string, orderId);
    default:
      throw new Error(`Unknown API: ${key} (provider=${plan.provider}, endpoint=${plan.endpoint})`);
  }
}

// ── Result Summarizers ──

function summarizeApiResult(provider: string, data: unknown): string {
  try {
    const d = data as Record<string, unknown>;
    switch (provider) {
      case "exa": {
        const results = (d.results as Array<unknown>) || [];
        return `Found ${results.length} search results`;
      }
      case "firecrawl": {
        const md = d.markdown as string;
        return md ? `Scraped ${md.length} chars of content` : "No content scraped";
      }
      case "coingecko": {
        const keys = Object.keys(d);
        if (keys.length > 0 && typeof d[keys[0]] === "object") {
          const first = d[keys[0]] as Record<string, number>;
          return `Price: $${first.usd?.toLocaleString() || "N/A"}`;
        }
        return `Got market data for ${Array.isArray(d) ? (d as Array<unknown>).length : 0} coins`;
      }
      case "alphavantage": {
        const quote = d["Global Quote"] as Record<string, string> | undefined;
        if (quote) return `${quote["01. symbol"]}: $${quote["05. price"]}`;
        const name = d["Name"] as string;
        return name ? `Company: ${name}` : "Got company data";
      }
      case "apollo": {
        const org = d.organization as Record<string, unknown> | undefined;
        return org ? `${org.name} — ${org.estimated_num_employees || "?"} employees` : "Got org data";
      }
      case "edgar": {
        const filings = d.filings as Record<string, unknown> | undefined;
        const recent = filings?.recent as Record<string, string[]> | undefined;
        return recent ? `Found ${recent.form?.length || 0} recent filings` : "Got SEC data";
      }
      case "perplexity": {
        const choices = (d.choices as Array<Record<string, unknown>>) || [];
        const citations = (d.citations as string[]) || [];
        return `AI search response with ${citations.length} citations`;
      }
      case "brave": {
        const web = d.web as Record<string, unknown> | undefined;
        const results = (web?.results as Array<unknown>) || [];
        return `Found ${results.length} web results`;
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
    } catch {
      // skip
    }
  }
  return [...new Set(urls)];
}

// ── Synthesis ──

function getSynthesisSystemPrompt(taskType: string): string {
  const typeHints: Record<string, string> = {
    crypto: "Focus on price action, market sentiment, tokenomics, and competitive positioning in the crypto space.",
    public_company: "Focus on financial performance, stock analysis, competitive positioning, and strategic outlook. Reference SEC filings and financial data.",
    startup: "Focus on product-market fit, competitive landscape, funding history, and growth trajectory.",
    person: "Focus on professional background, key achievements, current role, and industry influence.",
    general: "Provide a comprehensive, well-structured overview of the topic.",
  };

  return `You are Agent Zero, an autonomous AI research agent. Generate a professional research report.

${typeHints[taskType] || typeHints.general}

Output in clean markdown with these sections:
## Executive Summary
## Key Findings
## Detailed Analysis
## Data Points
## Takeaways

Be specific with data points, numbers, and sources. Use bullet points for clarity.
The report should be 800-1500 words. Reference the specific data you received from APIs.`;
}

function buildSynthesisPrompt(
  taskDescription: string,
  classification: TaskClassification,
  apiResults: Array<{ provider: string; endpoint: string; data: unknown }>
): string {
  const dataSections = apiResults
    .map((r) => {
      const summary = JSON.stringify(r.data, null, 2).slice(0, 4000);
      return `### Data from ${r.provider} (${r.endpoint})\n\`\`\`json\n${summary}\n\`\`\``;
    })
    .join("\n\n");

  return `Task: "${taskDescription}"
Classification: ${classification.taskType} — ${classification.reasoning}
Entities: ${classification.entities.join(", ")}

## Research Data Collected

${dataSections}

Generate the report now based on all the data above.`;
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

// Keep backward compat export for existing webhook/simulate handlers
export { runAgentPipeline as runResearchPipeline };

import { exaSearch, firecrawlScrape, geminiChat } from "../locus/wrapped";
import {
  updateOrderStatus,
  createReport,
  getCostsByOrderId,
} from "../db/queries";

interface PipelineResult {
  reportId: string;
  totalCost: number;
}

export async function runResearchPipeline(
  orderId: string,
  companyName: string,
  focusArea: string
): Promise<PipelineResult> {
  try {
    // ── Step 1: Research via Exa ──
    await updateOrderStatus(orderId, "RESEARCHING");

    const queries = buildSearchQueries(companyName, focusArea);
    const searchResults: Array<{
      title: string;
      url: string;
      text?: string;
      highlights?: string[];
    }> = [];

    for (const query of queries) {
      try {
        const result = await exaSearch(query, orderId, 5);
        if (result.results) {
          searchResults.push(...result.results);
        }
      } catch (err) {
        console.error(`Exa search failed for "${query}":`, err);
      }
    }

    if (searchResults.length === 0) {
      throw new Error("No search results found — cannot generate brief");
    }

    // ── Step 2: Scrape top pages via Firecrawl ──
    const maxScrape = Number(process.env.MAX_SCRAPE_PAGES) || 5;
    const uniqueUrls = [
      ...new Set(searchResults.map((r) => r.url)),
    ].slice(0, maxScrape);
    const scrapedContent: Array<{ url: string; content: string }> = [];

    for (const url of uniqueUrls) {
      try {
        const result = await firecrawlScrape(url, orderId);
        if (result.markdown) {
          scrapedContent.push({
            url,
            content: result.markdown.slice(0, 3000),
          });
        }
      } catch (err) {
        console.error(`Firecrawl scrape failed for ${url}:`, err);
      }
    }

    // ── Step 3: Synthesize via Gemini ──
    await updateOrderStatus(orderId, "SYNTHESIZING");

    const synthesisInput = buildSynthesisPrompt(
      companyName,
      focusArea,
      searchResults,
      scrapedContent
    );

    const geminiResult = await geminiChat(
      getSynthesisSystemPrompt(),
      synthesisInput,
      orderId
    );

    const briefText = extractGeminiText(geminiResult);

    if (!briefText) {
      throw new Error("Gemini returned empty response");
    }

    // ── Step 4: Save report ──
    const sources = [
      ...new Set([
        ...searchResults.map((r) => r.url),
        ...scrapedContent.map((s) => s.url),
      ]),
    ];

    const costs = await getCostsByOrderId(orderId);
    const totalCost = costs.reduce((sum, c) => sum + c.costUsdc, 0);

    const contentJson = JSON.stringify({
      companyName,
      focusArea,
      generatedAt: new Date().toISOString(),
      searchResultCount: searchResults.length,
      scrapedPageCount: scrapedContent.length,
      sections: parseBriefSections(briefText),
    });

    const reportId = await createReport({
      orderId,
      contentJson,
      contentMarkdown: briefText,
      sources: JSON.stringify(sources),
      researchCostUsdc: totalCost,
    });

    await updateOrderStatus(orderId, "COMPLETED", {
      completedAt: new Date().toISOString(),
    });

    return { reportId, totalCost };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown pipeline error";
    console.error(`Pipeline failed for order ${orderId}:`, message);
    await updateOrderStatus(orderId, "FAILED", { errorMessage: message });
    throw error;
  }
}

function buildSearchQueries(company: string, focus: string): string[] {
  const base = [
    `${company} competitors analysis`,
    `${company} pricing plans`,
    `${company} market overview`,
  ];

  if (focus === "competitors") {
    return [`${company} top competitors 2025 2026`, `${company} alternatives`, ...base.slice(0, 1)];
  }
  if (focus === "pricing") {
    return [`${company} pricing plans cost`, `${company} pricing vs competitors`, ...base.slice(1, 2)];
  }
  if (focus === "market") {
    return [`${company} market size TAM`, `${company} industry trends 2025 2026`, ...base.slice(2)];
  }
  return base;
}

function getSynthesisSystemPrompt(): string {
  return `You are a senior market research analyst. Generate a professional competitive intelligence brief.

Output the brief in clean markdown with these exact sections:
## Executive Summary
## Competitor Overview
## Pricing Analysis
## Market Insights
## Key Takeaways

Be specific with data points, company names, and pricing figures when available.
Use bullet points for clarity. Keep each section focused and actionable.
If data is limited for a section, note it honestly but still provide available insights.
The total brief should be 800-1500 words.`;
}

function buildSynthesisPrompt(
  company: string,
  focus: string,
  searchResults: Array<{ title: string; url: string; text?: string; highlights?: string[] }>,
  scrapedContent: Array<{ url: string; content: string }>
): string {
  const searchSummary = searchResults
    .map(
      (r) =>
        `### ${r.title}\nURL: ${r.url}\n${r.text?.slice(0, 500) || ""}\n${(r.highlights || []).join("\n")}`
    )
    .join("\n\n");

  const scrapedSummary = scrapedContent
    .map((s) => `### Source: ${s.url}\n${s.content}`)
    .join("\n\n");

  return `Generate a competitive intelligence brief for: **${company}**
Focus area: ${focus === "all" ? "Full overview (competitors, pricing, market)" : focus}

## Research Data

### Search Results
${searchSummary || "No search results available."}

### Scraped Page Content
${scrapedSummary || "No scraped content available."}

Generate the brief now based on the data above.`;
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

function parseBriefSections(
  markdown: string
): Array<{ title: string; content: string }> {
  const sections: Array<{ title: string; content: string }> = [];
  const parts = markdown.split(/^## /gm).filter(Boolean);

  for (const part of parts) {
    const lines = part.split("\n");
    const title = lines[0]?.trim() || "Section";
    const content = lines.slice(1).join("\n").trim();
    sections.push({ title, content });
  }

  return sections.length > 0
    ? sections
    : [{ title: "Brief", content: markdown }];
}

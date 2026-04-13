# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Agent Zero — an autonomous AI research council. Three specialist agents (Researcher, Data Analyst, Investigator) research independently using 9 premium APIs, debate findings, and deliver comprehensive reports. Users pay via Locus Checkout (USDC on Base chain). The agent has its own wallet, manages costs, and tracks P&L. Built for the Locus Paygentic Hackathon (Week 1).

## Tech Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS v4 (Sora + JetBrains Mono fonts)
- Drizzle ORM with Turso (libSQL) for database, local SQLite for dev
- Locus Checkout (embedded iframe) for USDC payments
- 9 Locus Wrapped APIs: Exa, Firecrawl, Gemini, CoinGecko, Alpha Vantage, Apollo, EDGAR SEC, Perplexity, Brave Search
- npm as package manager, deployed on Vercel

## Commands

```bash
npm run dev       # Start dev server (port 3000)
npm run build     # Production build
npm run lint      # ESLint
```

## Architecture

### Multi-Agent Research Council

Three specialist agents + a moderator coordinate research:

- **Researcher** (`src/lib/agent/specialists.ts`) — Exa, Perplexity, Brave. Broad market intelligence.
- **Data Analyst** — CoinGecko, Alpha Vantage, Apollo, EDGAR. Hard numbers and financials.
- **Investigator** — Firecrawl, Exa, Brave. Scrapes primary sources, reads fine print.
- **Moderator** — Classifies tasks, orchestrates debates, synthesizes final reports.

### Self-Chaining Pipeline (`src/lib/pipeline/orchestrator.ts`)

The pipeline runs in ~60-80s segments on Vercel serverless. Each segment:
1. Reads `PipelineState` from `orders.pipelineState` (JSON)
2. Executes one phase (classify/research/analysis/debate/expand/synthesize)
3. Saves updated state to DB, exits
4. Status endpoint detects pause (>10s since update), triggers next segment via `POST /api/orders/[id]/run-pipeline`

This enables indefinite research duration — Quick (~1 min), Standard (5-10 min), Deep Dive (2-3+ hours).

**Entry points:**
- `runPipelineSegment(orderId, taskDescription)` — runs ONE segment, returns `{ done: boolean }`
- `runResearchPipeline(orderId, taskDescription)` — backward-compat sync wrapper (loops segments, used by `/api/agent/hire`)

### Phase Types

- **classify** — Gemini classifies task type, assembles specialist council
- **research** — Specialists make API calls based on classification or planNextRound
- **analysis** — Each specialist writes a brief analyzing their findings
- **debate** — Moderator feeds all briefs to Gemini, identifies disagreements and gaps
- **expand** — Deep Dive: research entities discovered in prior phases (tree expansion)
- **synthesize** — Final report from all accumulated data across all phases

### Pipeline State (`src/lib/agent/pipeline-state.ts`)

Tracks: tier, currentPhase, phaseType, specialists, entityQueue, researchedEntities, debateCount, allResults, specialistBriefs, debateConclusions, nextResearchPlan, classification.

Key functions: `createInitialState()`, `shouldDebate()`, `shouldAnalyze()`, `isComplete()`.

### Cost Budgets

Quick: $0.50, Standard: $2.00, Deep: $8.00. Pipeline auto-synthesizes when budget reached.

### Key Tables

- `orders` — lifecycle + `taskDescription`, `taskType`, `classificationJson`, `pipelineTier`, `pipelinePhase`, `pipelineState`
- `agent_decisions` — per-step log with `round`, `specialist`, `action`, `provider`, `reasoning`, `resultSummary`, `costUsdc`
- `reports` — markdown + JSON content with sources
- `api_costs` — per-call cost tracking
- `webhook_events` — payment audit trail

### API Routes

- `POST /api/orders` — create order with taskDescription + pipelineTier
- `GET /api/orders/[id]/status` — polls checkout + triggers pipeline segments
- `GET /api/orders/[id]/decisions` — real-time decision log for frontend
- `POST /api/orders/[id]/run-pipeline` — execute one pipeline segment (maxDuration: 120)
- `POST /api/agent/hire` — agent-to-agent commerce endpoint
- `GET /api/agent/stats` — wallet balance, jobs, revenue, profit, margin
- `POST /api/checkout/create-session` — create Locus checkout session
- `POST /api/webhooks/locus` — payment webhook handler

### Wrapped API Wrappers (`src/lib/locus/wrapped.ts`)

All use `callWrappedApi()` → `POST /api/wrapped/{provider}/{endpoint}`. Provider slugs: `exa`, `firecrawl`, `gemini`, `coingecko`, `alphavantage`, `apollo`, `edgar`, `perplexity`, `brave`.

### Classifier (`src/lib/agent/classifier.ts`)

- `classifyTask()` — Gemini JSON output: taskType, entities, recommendedApis with callParams
- `planNextRound()` — Gemini decides next research APIs based on accumulated findings
- Task types: crypto, public_company, startup, person, general

## Locus Integration

- **API Base:** `https://beta-api.paywithlocus.com/api`
- **Auth:** `Authorization: Bearer {LOCUS_API_KEY}` (prefix: `claw_`)
- **Checkout:** `POST /api/checkout/sessions` → embed iframe
- **Wrapped APIs:** `POST /api/wrapped/{provider}/{endpoint}`
- **No webhook secret** — payment detection via server-side session polling

## Conventions

- Order IDs use ULIDs (URL-safe, sortable, unguessable)
- No user auth — security through unguessable IDs
- Tier pricing: Quick $0.50, Standard $2.00, Deep Dive $3.00
- All API calls logged to `api_costs`, all decisions to `agent_decisions`
- Entity expansion filtered for relevance (no generic terms)
- Cost budget enforced per tier to prevent wallet drain

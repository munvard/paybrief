# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Agent Zero — an autonomous AI agent that runs its own freelance research business. Users submit free-text research tasks, pay 3 USDC via Locus Checkout, and the agent autonomously classifies the task, decides which paid APIs to use, executes the research, and delivers a report. The agent has its own wallet, tracks its own P&L, and logs every decision visibly. Built for the Locus Paygentic Hackathon (Week 1).

## Tech Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS v4
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

### Core Flow

1. User submits free-text task → `POST /api/orders` creates order with `taskDescription`
2. Redirect to `/checkout/[orderId]` → Locus Checkout iframe renders
3. Checkout page polls `/api/orders/[id]/status` every 3s to detect payment
4. On payment detected → status endpoint triggers `POST /api/orders/[id]/run-pipeline`
5. Pipeline: Gemini classifies task type → selects APIs → executes calls → synthesizes report
6. Status page polls `/api/orders/[id]/decisions` to stream agent reasoning in real-time
7. On completion → redirects to `/report/[reportId]`

### Agent Decision Engine (`src/lib/agent/`)

The core differentiator. The agent uses Gemini to classify each task and select which APIs to call:

- `classifier.ts` — Gemini call that takes free-text and returns `TaskClassification` (taskType, entities, recommendedApis with callParams)
- `api-registry.ts` — Static registry of all 9 APIs with costs, capabilities, and task-type-to-API mappings

Task types: `crypto` (CoinGecko), `public_company` (Alpha Vantage + EDGAR), `startup` (Apollo + Exa), `person` (Exa + Perplexity), `general` (Exa + Perplexity). All end with Gemini synthesis.

### Dynamic Pipeline (`src/lib/pipeline/orchestrator.ts`)

`runAgentPipeline(orderId, taskDescription)` — replaces the old fixed pipeline. Flow:
1. CLASSIFYING → calls classifier, logs plan to `agent_decisions` table
2. EXECUTING → loops through `recommendedApis`, calls each via `callApiByPlan()` dispatcher
3. SYNTHESIZING → feeds all collected data into Gemini for final report
4. Saves report, logs delivery with cost/profit summary

The dispatcher (`callApiByPlan`) maps `provider/endpoint` strings to typed wrapper functions. Handles both `exa/search` and `exa_search` formats (classifier output varies).

### Key Tables

- `orders` — lifecycle tracking with `taskDescription`, `taskType`, `classificationJson` fields. Status flow: `CREATED → PAYING → PAID → CLASSIFYING → EXECUTING → SYNTHESIZING → COMPLETED/FAILED`
- `agent_decisions` — per-step decision log (step, action, provider, reasoning, resultSummary, costUsdc, status). Polled by frontend for real-time display.
- `reports` — markdown + JSON content with sources and cost
- `api_costs` — per-API-call cost tracking for margin calculations
- `webhook_events` — audit trail for Locus payment webhooks

### Wrapped API Wrappers (`src/lib/locus/wrapped.ts`)

All use `callWrappedApi()` which hits `POST /api/wrapped/{provider}/{endpoint}` with Bearer auth and logs cost to `api_costs`. Provider slugs (verified): `exa`, `firecrawl`, `gemini`, `coingecko`, `alphavantage`, `apollo`, `edgar`, `perplexity`, `brave`.

### Vercel Serverless Considerations

- Pipeline runs in `/api/orders/[id]/run-pipeline` with `maxDuration: 120` to avoid timeout
- Status endpoint triggers pipeline via non-blocking `fetch()` to the run-pipeline endpoint
- Stuck orders (CLASSIFYING/EXECUTING >90s) are auto-retried by the status endpoint
- DB connection uses lazy Proxy to avoid initialization at build time (Turso URL not available during static generation)

## Locus Integration

- **API Base:** `https://beta-api.paywithlocus.com/api`
- **Auth:** `Authorization: Bearer {LOCUS_API_KEY}` (prefix: `claw_`)
- **Checkout:** `POST /api/checkout/sessions` → embed `https://beta-checkout.paywithlocus.com/{sessionId}?embed=true`
- **Wrapped APIs:** `POST /api/wrapped/{provider}/{endpoint}` — payment auto-deducted from wallet
- **No webhook secret available** — payment detection uses server-side polling of `GET /api/checkout/sessions/{id}` instead

## Conventions

- Order IDs use ULIDs (URL-safe, sortable, unguessable)
- No user authentication — security through unguessable IDs
- Admin/dev routes protected by `ADMIN_SECRET` query param
- Price is 3 USDC per task (env: `BRIEF_PRICE_USDC`)
- All Locus API calls logged to `api_costs` table for margin tracking
- Agent decisions logged to `agent_decisions` table for real-time UI display

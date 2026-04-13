# Multi-Agent Research Council — Design Spec

## Problem

Agent Zero currently calls 2-3 APIs in a single pass and synthesizes a report in 30 seconds. This feels like a basic wrapper that ChatGPT can replicate for free. The agent needs to do genuinely deep, multi-perspective research that takes real time and produces results no single-pass tool can match.

## Solution

Replace the single-pass pipeline with a **Multi-Agent Research Council** — three specialist agents that research independently, debate their findings, and iteratively expand their research tree across multiple rounds. Support three tiers: Quick (1 min), Standard (5-10 min), and Deep Dive (2-3+ hours).

## Tier System

| Tier | Price | Duration | Specialists | Research Rounds | Debate Rounds | Est. API Calls |
|------|-------|----------|-------------|-----------------|---------------|----------------|
| Quick | $0.50 | ~1 min | 2 | 1 | 0 | 4-6 |
| Standard | $2.00 | 5-10 min | 3 | 3 | 1 | 15-25 |
| Deep Dive | $3.00 | 2-3+ hours | 3 | 15-30+ | 5-8+ | 50-150+ |

Deep Dive intentionally spends more than $3 on API calls. It's a loss leader that demonstrates the agent's full capability.

## Architecture: Self-Chaining Pipeline

### Why Self-Chaining

Vercel serverless functions timeout at 60-120 seconds. A 2-hour task cannot run in a single function. Instead, the pipeline runs in **segments** of ~60-90 seconds each, saves state to DB after each segment, and the status polling endpoint triggers the next segment.

### Flow

```
Client polls GET /api/orders/{id}/status every 3s
  ↓
Status endpoint detects: order is in EXECUTING state but pipeline isn't running
  ↓
Triggers POST /api/orders/{id}/run-pipeline
  ↓
Pipeline reads pipelineState from DB (JSON with accumulated results, current phase)
  ↓
Executes one segment of work (~60-90s):
  - 2-4 API calls
  - 1 Gemini analysis
  - Logs decisions to agent_decisions table
  ↓
Saves updated pipelineState to DB
  ↓  
If more work needed: sets status to EXECUTING, exits
If done: sets status to SYNTHESIZING or COMPLETED, exits
  ↓
Status endpoint detects EXECUTING again → triggers next segment
```

### Pipeline State (stored as JSON in orders.pipelineState)

```typescript
interface PipelineState {
  tier: "quick" | "standard" | "deep";
  currentPhase: number;          // which segment we're on
  totalPhases: number;           // estimated total (grows for deep)
  specialists: {
    researcher: { findings: string[]; apiCalls: number };
    dataAnalyst: { findings: string[]; apiCalls: number };
    investigator: { findings: string[]; apiCalls: number };
  };
  entityQueue: string[];          // entities discovered but not yet researched
  researchedEntities: string[];   // entities already researched (avoid duplicates)
  debateCount: number;            // debates completed so far
  allApiResults: Array<{ provider: string; endpoint: string; summary: string; round: number }>;
  roundSummaries: Array<{ specialist: string; summary: string; round: number }>;
  lastDebateAt: number;           // timestamp of last debate
}
```

## Specialist Agents

Each specialist is a Gemini call with a unique system prompt that defines their expertise and personality.

### Researcher (Market Intelligence)
- **Personality:** Broad thinker, connects dots across industries
- **APIs:** Exa Search, Perplexity, Brave Search
- **Role:** Find market context, news, trends, competitive landscape
- **Behavior:** Searches broadly, identifies entities and relationships

### Data Analyst (Hard Numbers)
- **Personality:** Data-driven, skeptical of claims without numbers
- **APIs:** CoinGecko, Alpha Vantage, Apollo, EDGAR
- **Role:** Get verifiable financial data, company metrics, filings
- **Behavior:** Enriches every entity with hard data, questions unsupported claims

### Investigator (Product & Pricing Deep Dive)
- **Personality:** Detail-oriented, reads the fine print
- **APIs:** Firecrawl, targeted Exa Search, Brave Search
- **Role:** Scrape actual product/pricing pages, find specific details
- **Behavior:** Goes to primary sources, scrapes actual pages, finds details others miss

## Phase Types

### 1. CLASSIFY Phase (once, at start)
- Moderator classifies task type and assembles the council
- Determines which specialists are relevant
- Creates initial entity queue

### 2. RESEARCH Phase (repeats)
- Each assigned specialist makes 1-3 API calls
- Results logged to decision log with specialist attribution
- New entities discovered are added to entityQueue

### 3. SPECIALIST_ANALYSIS Phase (after research)
- Each specialist writes a brief analysis of their findings so far
- This is a Gemini call per specialist with their accumulated data
- Logged to decision log as specialist takes

### 4. DEBATE Phase (every 15-20 min for Standard/Deep)
- All specialist analyses are fed to Gemini as a "debate"
- Gemini identifies disagreements, gaps, and areas needing more research
- Outputs: resolved points, disputed points, new research directions
- Updates entityQueue with newly identified research targets

### 5. EXPAND Phase (Deep Dive only)
- For each entity in entityQueue:
  - Classify it (company? person? product? market?)
  - Assign to relevant specialist
  - Research it (Apollo, Firecrawl, etc.)
- This is what makes Deep Dive take hours — the tree keeps expanding

### 6. SYNTHESIZE Phase (once, at end)
- All findings from all specialists across all rounds
- All debate conclusions
- Final comprehensive report with multiple perspectives
- Disagreements flagged as "perspectives differ"

## Segment Allocation By Tier

### Quick (1 segment, ~60s)
```
Segment 1: CLASSIFY → RESEARCH (all specialists, 1 round) → SYNTHESIZE
```

### Standard (5-8 segments, ~5-10 min)
```
Segment 1: CLASSIFY → RESEARCH round 1 (Researcher + Data Analyst)
Segment 2: RESEARCH round 1 (Investigator) → SPECIALIST_ANALYSIS
Segment 3: RESEARCH round 2 (deeper, targeted)
Segment 4: DEBATE → identify gaps
Segment 5: RESEARCH round 3 (fill gaps)
Segment 6: SYNTHESIZE
```

### Deep Dive (20-60+ segments, 2-3+ hours)
```
Segments 1-3:   CLASSIFY → Initial RESEARCH (all specialists)
Segment 4:      SPECIALIST_ANALYSIS
Segments 5-8:   EXPAND entity queue (research each competitor/entity found)
Segment 9:      DEBATE #1
Segments 10-15: More EXPAND (research entities of entities)
Segment 16:     DEBATE #2
Segments 17-25: Even deeper EXPAND (research their competitors too)
Segment 26:     DEBATE #3
...continues until entityQueue is empty or max rounds reached...
Segment N-1:    Final DEBATE
Segment N:      SYNTHESIZE (massive report from all data)
```

## Database Changes

### orders table — add columns:
```sql
ALTER TABLE orders ADD COLUMN pipeline_tier TEXT DEFAULT 'quick';
ALTER TABLE orders ADD COLUMN pipeline_phase INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN pipeline_state TEXT;  -- JSON PipelineState
```

### agent_decisions table — add column:
```sql
ALTER TABLE agent_decisions ADD COLUMN specialist TEXT;  -- researcher/data_analyst/investigator/moderator
```

## UI Changes

### Order Form
- Add tier selector: Quick ($0.50) | Standard ($2) | Deep Dive ($3)
- Adjust button text based on tier

### Decision Log
- Show specialist name and icon per decision entry
- Group by phase (RESEARCH / ANALYSIS / DEBATE / EXPAND)
- Show phase count: "Phase 4 of ~6" or "Phase 12 of ~30+"
- Debate entries styled distinctly (conversation format)

### Status Page
- Show estimated remaining time based on tier and current phase
- Show progress: "Phase 4/6" for Standard, "Phase 12 of ~30" for Deep
- For Deep Dive: show entity tree being explored

### Report Page
- For Standard/Deep: show "Research Council Summary" at top
  - Which specialists contributed
  - Number of debates
  - Disputed vs consensus findings
  - Total entities researched

## Status Endpoint Changes

The status endpoint needs to detect "pipeline paused between segments" and trigger the next segment:

```typescript
// If EXECUTING and pipeline isn't actively running
// (check: updatedAt is >15s ago, meaning the last segment finished)
if (order.status === "EXECUTING" && order.updatedAt) {
  const timeSinceUpdate = Date.now() - new Date(order.updatedAt).getTime();
  if (timeSinceUpdate > 15_000) {
    // Trigger next segment
    fetch(`${appUrl}/api/orders/${id}/run-pipeline`, { method: "POST" });
  }
}
```

## Files to Modify/Create

### New files:
- `src/lib/agent/specialists.ts` — Specialist system prompts and personalities
- `src/lib/agent/debate.ts` — Debate orchestration logic
- `src/lib/agent/pipeline-state.ts` — PipelineState type and helpers

### Modified files:
- `src/lib/pipeline/orchestrator.ts` — Major refactor: segmented execution, state management, specialist routing
- `src/lib/agent/classifier.ts` — Update for entity extraction + specialist assignment
- `src/lib/db/schema.ts` — Add columns to orders + agent_decisions
- `src/lib/db/queries.ts` — Add pipeline state queries
- `src/components/order-form.tsx` — Tier selector
- `src/components/decision-log.tsx` — Specialist attribution, phase grouping, debate styling
- `src/app/order/[orderId]/status/page.tsx` — Phase progress, time estimate
- `src/app/api/orders/[id]/status/route.ts` — Trigger next segment logic
- `src/app/api/orders/[id]/run-pipeline/route.ts` — Read/write pipeline state, segmented execution
- `src/app/report/[reportId]/page.tsx` — Council summary header

### Bug fixes included:
- Fix PayBrief branding in admin/costs page
- Fix classifier falling to "general"
- Fix remaining PayBrief references in db paths
- Fix unused imports

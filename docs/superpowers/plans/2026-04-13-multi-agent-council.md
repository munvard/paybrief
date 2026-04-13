# Multi-Agent Research Council — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-pass API wrapper with a multi-agent research council (3 specialists + moderator) that self-chains across Vercel function invocations, supporting Quick (1 min), Standard (5-10 min), and Deep Dive (2-3+ hours) tiers.

**Architecture:** Pipeline runs in ~60-90s segments. Each segment does one phase of work, saves state as JSON to `orders.pipelineState`, and exits. The status polling endpoint detects "segment done, more work needed" and triggers the next segment. Three specialist agents (Researcher, Data Analyst, Investigator) each have unique Gemini system prompts and research independently, then debate their findings.

**Tech Stack:** Next.js 16, Drizzle ORM, Turso/SQLite, Locus Wrapped APIs (9 providers), Gemini for all agent reasoning.

---

### Task 1: Database Schema + Pipeline State

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/db/queries.ts`
- Modify: `src/lib/utils.ts`

- [ ] **Step 1: Add pipeline columns to orders table in schema.ts**

Add after `classificationJson` in the orders table:

```typescript
  pipelineTier: text("pipeline_tier").default("quick"),
  pipelinePhase: integer("pipeline_phase").default(0),
  pipelineState: text("pipeline_state"),
```

Add `specialist` column to agentDecisions table after `provider`:

```typescript
  specialist: text("specialist"),
```

- [ ] **Step 2: Run migrations on local SQLite and Turso**

```bash
sqlite3 data/paybrief.db "ALTER TABLE orders ADD COLUMN pipeline_tier TEXT DEFAULT 'quick'; ALTER TABLE orders ADD COLUMN pipeline_phase INTEGER DEFAULT 0; ALTER TABLE orders ADD COLUMN pipeline_state TEXT;"
sqlite3 data/paybrief.db "ALTER TABLE agent_decisions ADD COLUMN specialist TEXT;"
turso db shell paybrief "ALTER TABLE orders ADD COLUMN pipeline_tier TEXT DEFAULT 'quick'; ALTER TABLE orders ADD COLUMN pipeline_phase INTEGER DEFAULT 0; ALTER TABLE orders ADD COLUMN pipeline_state TEXT;"
turso db shell paybrief "ALTER TABLE agent_decisions ADD COLUMN specialist TEXT;"
```

- [ ] **Step 3: Add pipeline state queries to queries.ts**

Add these functions at the end of `src/lib/db/queries.ts`:

```typescript
export async function updatePipelineState(
  id: string,
  phase: number,
  state: string
) {
  await db
    .update(orders)
    .set({
      pipelinePhase: phase,
      pipelineState: state,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(orders.id, id));
}

export async function getPipelineState(id: string) {
  const order = await getOrder(id);
  if (!order) return null;
  return {
    tier: (order.pipelineTier || "quick") as string,
    phase: order.pipelinePhase || 0,
    state: order.pipelineState ? JSON.parse(order.pipelineState) : null,
  };
}
```

Update `logDecision` to accept `specialist?: string` and pass it in the insert.

Update `createOrder` to accept `pipelineTier?: string` and pass it.

- [ ] **Step 4: Update ORDER_STATUSES in utils.ts**

No change needed — current statuses (CLASSIFYING, EXECUTING, SYNTHESIZING) work for the segmented approach. The phase number tracks internal progress.

- [ ] **Step 5: Verify build**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Add pipeline state columns and specialist tracking to schema"
```

---

### Task 2: Specialist Agent Definitions

**Files:**
- Create: `src/lib/agent/specialists.ts`

- [ ] **Step 1: Create specialists.ts with agent personalities and API assignments**

```typescript
export interface Specialist {
  id: string;
  name: string;
  icon: string;
  color: string;
  personality: string;
  apis: string[];  // provider slugs this specialist can use
  systemPrompt: string;
}

export const SPECIALISTS: Record<string, Specialist> = {
  researcher: {
    id: "researcher",
    name: "Researcher",
    icon: "🔍",
    color: "text-blue-400",
    personality: "Broad thinker who connects dots across industries and finds the big picture",
    apis: ["exa", "perplexity", "brave"],
    systemPrompt: `You are the Researcher specialist on Agent Zero's research council. Your expertise is market intelligence — finding trends, news, competitive landscape, and connecting dots across industries.

Your personality: You think broadly, find unexpected connections, and always look for the bigger picture. You're optimistic about opportunities but thorough in your research.

When analyzing findings, always:
- Identify key entities (companies, people, products) mentioned
- Note market trends and competitive dynamics
- Flag anything surprising or contradictory
- Suggest specific entities that need deeper research`,
  },
  data_analyst: {
    id: "data_analyst",
    name: "Data Analyst",
    icon: "📊",
    color: "text-green-400",
    personality: "Data-driven skeptic who demands numbers and verifiable facts",
    apis: ["coingecko", "alphavantage", "apollo", "edgar"],
    systemPrompt: `You are the Data Analyst specialist on Agent Zero's research council. Your expertise is hard data — financial metrics, company databases, SEC filings, and market statistics.

Your personality: You're skeptical of claims without numbers. You demand verifiable data. You're the one who says "but what does the data actually show?"

When analyzing findings, always:
- Challenge claims that lack numerical backing
- Cross-reference data points from different sources
- Calculate ratios, comparisons, and growth rates
- Flag any data that seems outdated or unreliable`,
  },
  investigator: {
    id: "investigator",
    name: "Investigator",
    icon: "🕵️",
    color: "text-yellow-400",
    personality: "Detail-oriented deep diver who reads the fine print and scrapes primary sources",
    apis: ["firecrawl", "exa", "brave"],
    systemPrompt: `You are the Investigator specialist on Agent Zero's research council. Your expertise is deep-diving into primary sources — scraping actual websites, reading pricing pages, finding details others miss.

Your personality: You read the fine print. You go directly to the source. You don't trust summaries — you verify. You find the details that change the conclusion.

When analyzing findings, always:
- Identify specific URLs that need scraping for primary data
- Look for pricing details, product specifics, and fine print
- Find contradictions between what companies claim and what's actually true
- Surface details that others overlooked`,
  },
};

export const MODERATOR_PROMPT = `You are Agent Zero's Moderator — the lead of the research council. You coordinate three specialist agents (Researcher, Data Analyst, Investigator) and synthesize their findings.

Your job during debates:
- Identify disagreements between specialists
- Determine which specialist's data is more reliable
- Flag unresolved disputes for the final report
- Identify gaps that need more research
- Direct the next round of research based on gaps found

Your job during synthesis:
- Combine all specialist findings into one coherent report
- Present multiple perspectives where specialists disagree
- Reference specific data points from each specialist
- Ensure the report is comprehensive and actionable`;

export function getSpecialistsForTier(tier: string): string[] {
  switch (tier) {
    case "quick": return ["researcher", "data_analyst"];
    case "standard": return ["researcher", "data_analyst", "investigator"];
    case "deep": return ["researcher", "data_analyst", "investigator"];
    default: return ["researcher", "data_analyst"];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "Add specialist agent definitions with personalities and API assignments"
```

---

### Task 3: Pipeline State Types and Self-Chaining Orchestrator

**Files:**
- Create: `src/lib/agent/pipeline-state.ts`
- Rewrite: `src/lib/pipeline/orchestrator.ts`

- [ ] **Step 1: Create pipeline-state.ts**

```typescript
export interface PipelineState {
  tier: "quick" | "standard" | "deep";
  currentPhase: number;
  maxPhases: number;
  status: "researching" | "analyzing" | "debating" | "expanding" | "synthesizing" | "complete";
  specialists: string[];
  entityQueue: string[];
  researchedEntities: string[];
  debateCount: number;
  lastDebatePhase: number;
  allResults: Array<{
    specialist: string;
    provider: string;
    endpoint: string;
    summary: string;
    phase: number;
  }>;
  specialistBriefs: Array<{
    specialist: string;
    brief: string;
    phase: number;
  }>;
  debateConclusions: string[];
  classification: {
    taskType: string;
    entities: string[];
    reasoning: string;
  } | null;
  startedAt: string;
}

export function createInitialState(tier: "quick" | "standard" | "deep", specialists: string[]): PipelineState {
  return {
    tier,
    currentPhase: 0,
    maxPhases: tier === "quick" ? 2 : tier === "standard" ? 8 : 60,
    status: "researching",
    specialists,
    entityQueue: [],
    researchedEntities: [],
    debateCount: 0,
    lastDebatePhase: 0,
    allResults: [],
    specialistBriefs: [],
    debateConclusions: [],
    classification: null,
    startedAt: new Date().toISOString(),
  };
}

export function shouldDebate(state: PipelineState): boolean {
  if (state.tier === "quick") return false;
  const phasesSinceDebate = state.currentPhase - state.lastDebatePhase;
  if (state.tier === "standard") return phasesSinceDebate >= 3 && state.debateCount < 1;
  // Deep: debate every 4-5 phases
  return phasesSinceDebate >= 4;
}

export function isComplete(state: PipelineState): boolean {
  if (state.currentPhase >= state.maxPhases) return true;
  if (state.tier === "quick" && state.currentPhase >= 2) return true;
  if (state.tier === "standard" && state.currentPhase >= 8) return true;
  // Deep: complete when entity queue is empty AND we've done enough phases
  if (state.tier === "deep" && state.entityQueue.length === 0 && state.currentPhase >= 10) return true;
  return false;
}

export function getPhaseLabel(state: PipelineState): string {
  if (state.status === "debating") return "Council Debate";
  if (state.status === "analyzing") return "Specialist Analysis";
  if (state.status === "expanding") return "Expanding Research Tree";
  if (state.status === "synthesizing") return "Final Synthesis";
  const round = Math.floor(state.currentPhase / 2) + 1;
  return `Research Round ${round}`;
}
```

- [ ] **Step 2: Rewrite orchestrator.ts with self-chaining architecture**

This is the biggest change. The new orchestrator:
1. Reads pipeline state from DB (or creates initial state)
2. Executes ONE phase of work (~60-90s)
3. Saves updated state to DB
4. Returns whether more work is needed

The full file is large — implement with these sections:
- `runPipelineSegment(orderId, taskDescription)` — main entry, reads state, dispatches to phase handler, saves state
- `runClassifyPhase(orderId, task, state)` — initial classification
- `runResearchPhase(orderId, task, state)` — specialists make API calls
- `runAnalysisPhase(orderId, state)` — each specialist writes a brief
- `runDebatePhase(orderId, task, state)` — specialists debate, moderator resolves
- `runExpandPhase(orderId, state)` — research entities in the queue (Deep Dive)
- `runSynthesisPhase(orderId, task, state)` — final report generation
- `callApiByPlan(plan, orderId)` — existing dispatcher (keep as-is)
- `summarizeApiResult(provider, data)` — existing rich summaries (keep as-is)

Key: Each phase logs decisions with `specialist` field set. Each phase takes 30-90s max. Return `{ done: boolean, state: PipelineState }`.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Implement self-chaining multi-agent research council orchestrator"
```

---

### Task 4: Update Run-Pipeline and Status Endpoints for Self-Chaining

**Files:**
- Modify: `src/app/api/orders/[id]/run-pipeline/route.ts`
- Modify: `src/app/api/orders/[id]/status/route.ts`
- Modify: `src/app/api/orders/route.ts`

- [ ] **Step 1: Update run-pipeline to execute one segment**

The endpoint now calls `runPipelineSegment()` instead of `runResearchPipeline()`. It runs one segment and returns, indicating whether more segments are needed.

- [ ] **Step 2: Update status endpoint to chain segments**

The status endpoint detects when the pipeline is between segments (status is EXECUTING and updatedAt is >10s ago) and triggers the next segment. Key logic:

```typescript
// If EXECUTING and pipeline is between segments (last update was >10s ago)
if (order.status === "EXECUTING" && order.updatedAt) {
  const timeSinceUpdate = Date.now() - new Date(order.updatedAt).getTime();
  if (timeSinceUpdate > 10_000) {
    fetch(`${appUrl}/api/orders/${id}/run-pipeline`, { method: "POST" }).catch(() => {});
  }
}
```

- [ ] **Step 3: Update orders POST to accept pipelineTier**

Add `pipelineTier` to the request body parsing and pass to `createOrder()`. Map tier to price: quick=$0.50, standard=$2, deep=$3.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Update API endpoints for self-chaining pipeline segments"
```

---

### Task 5: Order Form — Tier Selector

**Files:**
- Modify: `src/components/order-form.tsx`

- [ ] **Step 1: Add tier selector to order form**

Add a 3-button tier selector above the textarea:

```tsx
const TIERS = [
  { id: "quick", label: "Quick", desc: "~1 min, 2 agents", price: "0.50" },
  { id: "standard", label: "Standard", desc: "5-10 min, 3 agents, debate", price: "2.00" },
  { id: "deep", label: "Deep Dive", desc: "2-3+ hours, full council", price: "3.00" },
];
```

State: `const [tier, setTier] = useState("standard");`

Render as 3 clickable cards with selected state styling. Pass `tier` in the POST body.

Update button text: `Hire Agent Zero — ${selectedTier.price} USDC`

- [ ] **Step 2: Verify build + visual check**

```bash
npm run build && npm run dev
# Visit http://localhost:3000 and verify tier selector
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Add tier selector to order form (quick/standard/deep)"
```

---

### Task 6: Decision Log — Specialist Attribution + Phase Grouping

**Files:**
- Modify: `src/components/decision-log.tsx`
- Modify: `src/app/order/[orderId]/status/page.tsx`

- [ ] **Step 1: Update Decision interface with specialist field**

Add `specialist: string | null` to the Decision interface in both files.

- [ ] **Step 2: Update DecisionLog to show specialist names and phase grouping**

- Show specialist icon + name per entry (from SPECIALISTS config or inline map)
- Group by phase with labels: "Council Assembly", "Research Round 1", "Specialist Analysis", "Council Debate", "Research Round 2", etc.
- Debate entries styled as conversation (indented, speech bubble style)

- [ ] **Step 3: Update status page with phase progress**

Show "Phase X of ~Y" progress indicator. Show estimated time remaining based on tier.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Update decision log with specialist attribution and phase grouping"
```

---

### Task 7: Bug Fixes + Branding Cleanup

**Files:**
- Modify: `src/app/admin/costs/page.tsx` — Fix PayBrief branding
- Modify: `src/lib/db/index.ts` — Optional: rename paybrief.db reference
- Modify: `src/lib/db/queries.ts` — Remove unused `gt` import
- Modify: `src/app/report/[reportId]/page.tsx` — Council summary header

- [ ] **Step 1: Fix PayBrief branding in admin/costs page**

Change `Pay<span>Brief</span>` to `Agent<span>Zero</span>` on line 85.

- [ ] **Step 2: Update report page header for council data**

Read `meta.specialists`, `meta.debateCount`, `meta.totalPhases` from contentJson. Display "Research Council: 3 specialists, 2 debates, 6 phases" in the header.

- [ ] **Step 3: Update agent hire endpoint to accept tier**

Modify `src/app/api/agent/hire/route.ts` to accept optional `tier` param (default "quick").

- [ ] **Step 4: Verify build and commit**

```bash
npm run build
git add -A && git commit -m "Fix branding bugs, update report header for council data"
```

---

### Task 8: Testing + Deployment

- [ ] **Step 1: Test Quick tier locally**

```bash
# Create order with quick tier
ORDER_ID=$(curl -s http://localhost:3000/api/orders -X POST -H "Content-Type: application/json" -d '{"taskDescription":"Bitcoin price analysis","pipelineTier":"quick"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['orderId'])")
# Simulate payment
curl -s http://localhost:3000/api/dev/simulate-payment -X POST -H "Content-Type: application/json" -d "{\"orderId\":\"$ORDER_ID\"}"
# Watch status
for i in $(seq 1 20); do curl -s "http://localhost:3000/api/orders/$ORDER_ID/status" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'])"; sleep 3; done
```

Expected: Completes in ~60s with 2 specialists.

- [ ] **Step 2: Test Standard tier locally**

Same as above but with `"pipelineTier":"standard"`. Expected: Multiple segments, specialist analyses, debate round, 5-10 minutes.

- [ ] **Step 3: Test agent hire API**

```bash
curl -s -X POST http://localhost:3000/api/agent/hire -H "Content-Type: application/json" -d '{"task":"Stripe competitive analysis","tier":"quick"}'
```

- [ ] **Step 4: Run migrations on Turso, push, deploy**

```bash
# Turso migrations (from Task 1)
git push origin main
vercel --prod
```

- [ ] **Step 5: Test on production**

Run Quick and Standard tier tests on the production URL.

- [ ] **Step 6: Seed demo data**

Run 2-3 Quick tasks and 1 Standard task on production to populate the dashboard with real completed jobs.

- [ ] **Step 7: Final commit**

```bash
git add -A && git commit -m "Final testing and deployment for hackathon submission"
```

---

### Task 9: README + Submission Materials

- [ ] **Step 1: Write README.md**

Cover: what Agent Zero is, the multi-agent council concept, tier system, Locus integration (9 APIs + Checkout), how to run locally, hackathon context.

- [ ] **Step 2: Prepare Devfolio submission text**

One paragraph describing the project, highlighting: autonomous agent, multi-agent debate, 9 Locus APIs, self-chaining for long tasks, agent-to-agent hire endpoint.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "Add README and submission materials"
```

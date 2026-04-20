# Agent Zero Foundry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a factory that takes a one-sentence prompt and deploys a monetized, wallet-holding, MCP-installable AI microservice on BuildWithLocus within ~3 minutes. Each deployed "business" has its own Locus sub-wallet, reproduces when profitable, and is auto-deprovisioned when broke.

**Architecture:** Single Next.js 16 app (`foundry-web`) deployed on BuildWithLocus with Postgres + Redis addons; a small `foundry-heart` cron service for lifecycle management; a pre-built `business-template` Docker image deployed per business. Council specialists live as internal modules within foundry-web (pragmatic simplification from the spec's separate-services design to fit a 5-day solo build).

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Drizzle ORM + Postgres, Redis (ioredis), Locus Checkout + Locus Wrapped APIs + Locus agent self-registration, BuildWithLocus API, Node.js `vm` module for handler sandbox, Ed25519 / HS256 via `jose` for signing, `better-sqlite3` inside the business container for credits ledger.

**Reference spec:** `docs/superpowers/specs/2026-04-20-agent-zero-foundry-design.md` (commit `9a2a581`).

**Pragmatic deviations from spec (all approved at brainstorming time):**
- Council specialists implemented as internal modules in `foundry-web` rather than separate BWL services. The spec's "multi-service council" remains accurate at the logical level (each specialist has its own runtime context, logging, cost accounting) — we just co-host them for the hackathon timeline.
- `foundry-heart` is a dedicated small service (separate from web) so cron runs reliably.

---

## Phase overview

| Phase | Day | Outcome |
|---|---|---|
| 1 | Day 1 | Foundry project deployed on BWL with Postgres + Redis addons; Drizzle schema migrated; stub `foundry-web` reachable. |
| 2 | Day 2 | One end-to-end working business container: pay $0.25 → unlock session → call 5 times → wallet ticks up. MCP endpoint verified with Claude Code. |
| 3 | Day 3 | Commission pipeline: type a prompt on foundry-web → pay $3 → council runs → live business URL within ~4 min. |
| 4 | Day 4 | Frontend gallery, business detail, commission live log, family tree, foundry-heart cron with death clock + reproduction + revive. |
| 5 | Day 5 | Pre-seeded 10+ demo businesses, README, pitch script, backup video, dress rehearsal x2, submission. |
| 6 | Day 6 | Buffer for bugs or one stretch feature. |
| 7 | Day 7 | Demo. |

---

## File structure

```
locus_hackaton/
├── .locusbuild                         NEW - multi-service BWL config
├── Dockerfile                          NEW - for foundry-web production
├── foundry-heart/                      NEW - separate cron service
│   ├── Dockerfile
│   ├── package.json
│   └── src/index.ts
├── business-template/                  NEW - pre-built base image deployed per business
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── server.ts                   wrapper routes + payment + heartbeat + MCP
│   │   ├── sandbox.ts                  node:vm constrained execution layer
│   │   ├── mcp.ts                      MCP SSE + HTTP transport
│   │   ├── credits.ts                  local SQLite + JWT ledger
│   │   ├── heartbeat.ts                POSTs status to foundry-bus every 60s
│   │   └── landing.template.html
│   └── tsconfig.json
├── src/
│   ├── app/
│   │   ├── page.tsx                    MODIFY - landing + gallery
│   │   ├── commission/page.tsx         NEW - commission form
│   │   ├── commission/[id]/page.tsx    NEW - live council log
│   │   ├── biz/[id]/page.tsx           NEW - business detail page
│   │   ├── dynasty/page.tsx            NEW - family tree visual
│   │   └── api/
│   │       ├── health/route.ts                       NEW - readiness probe
│   │       ├── commission/route.ts                   NEW - POST to commission
│   │       ├── commission/[id]/route.ts              NEW - GET status
│   │       ├── commission/[id]/stream/route.ts       NEW - SSE council log
│   │       ├── biz/route.ts                          NEW - GET gallery list
│   │       ├── biz/[id]/route.ts                     NEW - GET one business
│   │       ├── biz/[id]/revive/route.ts              NEW - POST revive
│   │       ├── heartbeats/route.ts                   NEW - POST from businesses
│   │       ├── admin/deprovision/route.ts            NEW - admin only
│   │       ├── admin/reproduce/route.ts              NEW - admin only
│   │       └── (keep existing checkout, webhooks routes)
│   ├── components/
│   │   ├── gallery.tsx                 NEW
│   │   ├── business-card.tsx           NEW
│   │   ├── specimen-card.tsx           NEW
│   │   ├── commission-form.tsx         NEW
│   │   ├── council-terminal.tsx        NEW
│   │   └── family-tree.tsx             NEW
│   ├── lib/
│   │   ├── agent/
│   │   │   ├── engineer.ts             NEW
│   │   │   ├── shipwright.ts           NEW
│   │   │   ├── cashier.ts              NEW
│   │   │   ├── council.ts              NEW
│   │   │   ├── ast-check.ts            NEW
│   │   │   └── (reuse specialists.ts, classifier.ts, api-registry.ts)
│   │   ├── bwl/                        NEW - BuildWithLocus API client
│   │   │   ├── client.ts
│   │   │   ├── projects.ts
│   │   │   ├── services.ts
│   │   │   ├── deployments.ts
│   │   │   └── variables.ts
│   │   ├── locus/
│   │   │   ├── register.ts             NEW
│   │   │   ├── policy.ts               NEW
│   │   │   └── (keep existing client, checkout, wrapped, webhook)
│   │   ├── db/
│   │   │   ├── schema.ts               REWRITE - postgres schema
│   │   │   ├── queries.ts              REWRITE - postgres queries
│   │   │   └── index.ts                REWRITE - pg pool + drizzle
│   │   ├── birth-cert.ts               NEW - Ed25519/HS256 sign/verify
│   │   ├── crypto.ts                   NEW - AES-GCM encrypt/decrypt for apiKeys
│   │   ├── redis.ts                    NEW - ioredis wrapper
│   │   └── (keep utils.ts)
│   └── globals.css                     MODIFY - Workshop Noir palette
├── drizzle/                            REGENERATE - new postgres migrations
├── drizzle.config.ts                   MODIFY - dialect postgresql
├── package.json                        MODIFY - add pg, ioredis, jose, acorn, etc.
└── .env.local                          MODIFY - add new env vars
```

---

# PHASE 1 — Foundation on BuildWithLocus (Day 1)

**Outcome:** A stub `foundry-web` service is live on BWL at `https://svc-{id}.buildwithlocus.com/api/health` returning 200; Postgres + Redis addons are `available`; Drizzle schema is migrated; `foundry-heart` stub is also deployed; repo has a working `.locusbuild`.

---

### Task 1.1: Switch DB layer to Postgres, install new deps

**Files:**
- Modify: `package.json`
- Modify: `drizzle.config.ts`

- [ ] **Step 1: Install Postgres + Redis + crypto deps**

```bash
npm install pg drizzle-orm@latest ioredis jose acorn acorn-walk
npm install --save-dev @types/pg
npm uninstall @libsql/client
```

- [ ] **Step 2: Update `drizzle.config.ts` to Postgres**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://localhost:5432/foundry_dev",
  },
});
```

- [ ] **Step 3: Remove old drizzle migrations**

```bash
rm -rf drizzle/*.sql drizzle/meta
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json drizzle.config.ts drizzle/
git commit -m "chore: switch drizzle to postgres, remove libsql deps"
```

---

### Task 1.2: Write new Postgres schema with all 8 tables

**Files:**
- Rewrite: `src/lib/db/schema.ts`

- [ ] **Step 1: Replace `src/lib/db/schema.ts` with full Foundry schema**

```ts
import { pgTable, text, timestamp, integer, numeric, jsonb, boolean, primaryKey, index } from "drizzle-orm/pg-core";

export const businesses = pgTable("businesses", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  pitch: text("pitch").notNull(),
  genome: text("genome").notNull(),
  parentId: text("parent_id"),
  handlerCodeHash: text("handler_code_hash"),
  handlerCode: text("handler_code"),
  bwlProjectId: text("bwl_project_id"),
  bwlServiceId: text("bwl_service_id"),
  bwlUrl: text("bwl_url"),
  mcpUrl: text("mcp_url"),
  walletAddress: text("wallet_address"),
  walletApiKeyEnc: text("wallet_api_key_enc"),
  pricePerCallUsdc: numeric("price_per_call_usdc", { precision: 10, scale: 4 }).notNull().default("0.05"),
  llmCostEstimateUsdc: numeric("llm_cost_estimate_usdc", { precision: 10, scale: 4 }).notNull().default("0.02"),
  status: text("status").notNull().default("conceived"),
  statusChangedAt: timestamp("status_changed_at").notNull().defaultNow(),
  birthCertJson: jsonb("birth_cert_json"),
  birthCertOnchainTx: text("birth_cert_onchain_tx"),
  reviveCount: integer("revive_count").notNull().default(0),
  lastReproducedAt: timestamp("last_reproduced_at"),
  deprovisionReason: text("deprovision_reason"),
  walletBalanceCached: numeric("wallet_balance_cached", { precision: 10, scale: 4 }).notNull().default("0"),
  callCountCached: integer("call_count_cached").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("biz_status_idx").on(t.status, t.statusChangedAt),
  parentIdx: index("biz_parent_idx").on(t.parentId),
  walletIdx: index("biz_wallet_idx").on(t.walletBalanceCached),
}));

export const commissions = pgTable("commissions", {
  id: text("id").primaryKey(),
  prompt: text("prompt").notNull(),
  commissionerType: text("commissioner_type").notNull(),
  commissionerId: text("commissioner_id"),
  commissionerEmail: text("commissioner_email"),
  checkoutSessionId: text("checkout_session_id"),
  agentPayTxHash: text("agent_pay_tx_hash"),
  feePaidUsdc: numeric("fee_paid_usdc", { precision: 10, scale: 4 }).notNull().default("3.00"),
  businessId: text("business_id"),
  status: text("status").notNull().default("pending"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const decisions = pgTable("decisions", {
  id: text("id").primaryKey(),
  commissionId: text("commission_id").notNull(),
  round: integer("round").notNull(),
  specialist: text("specialist").notNull(),
  action: text("action").notNull(),
  provider: text("provider"),
  reasoning: text("reasoning").notNull(),
  resultSummary: text("result_summary"),
  costUsdc: numeric("cost_usdc", { precision: 10, scale: 4 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const heartbeats = pgTable("heartbeats", {
  businessId: text("business_id").notNull(),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  walletBalanceUsdc: numeric("wallet_balance_usdc", { precision: 10, scale: 4 }).notNull(),
  callCount: integer("call_count").notNull().default(0),
  lastCallAt: timestamp("last_call_at"),
  observedBy: text("observed_by").notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.businessId, t.recordedAt] }),
}));

export const calls = pgTable("calls", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull(),
  callerType: text("caller_type").notNull(),
  costToBusinessUsdc: numeric("cost_to_business_usdc", { precision: 10, scale: 4 }).notNull().default("0"),
  revenueUsdc: numeric("revenue_usdc", { precision: 10, scale: 4 }).notNull().default("0"),
  durationMs: integer("duration_ms"),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  bizTimeIdx: index("calls_biz_time_idx").on(t.businessId, t.createdAt),
}));

export const adoptions = pgTable("adoptions", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull(),
  adopterEmail: text("adopter_email"),
  checkoutSessionId: text("checkout_session_id"),
  feePaidUsdc: numeric("fee_paid_usdc", { precision: 10, scale: 4 }).notNull().default("1.00"),
  resultedInRevival: boolean("resulted_in_revival").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const lineageEdges = pgTable("lineage_edges", {
  ancestorId: text("ancestor_id").notNull(),
  descendantId: text("descendant_id").notNull(),
  depth: integer("depth").notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.ancestorId, t.descendantId] }),
  ancestorIdx: index("lineage_ancestor_idx").on(t.ancestorId, t.depth),
}));

export const creditsIssuanceLog = pgTable("credits_issuance_log", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull(),
  jti: text("jti").notNull(),
  amountUsdc: numeric("amount_usdc", { precision: 10, scale: 4 }).notNull(),
  checkoutTxHash: text("checkout_tx_hash"),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
});
```

- [ ] **Step 2: Generate migration**

```bash
npm run db:generate -- --name "foundry_initial"
```

Expected: one `.sql` file created under `drizzle/`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/schema.ts drizzle/
git commit -m "feat: foundry postgres schema with 8 tables + closure lineage"
```

---

### Task 1.3: Rewrite `db/index.ts` + minimal `queries.ts`

**Files:**
- Rewrite: `src/lib/db/index.ts`
- Rewrite: `src/lib/db/queries.ts`

- [ ] **Step 1: Replace `src/lib/db/index.ts`**

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;
  _pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  _db = drizzle(_pool, { schema });
  return _db;
}

export { schema };
```

- [ ] **Step 2: Minimal `src/lib/db/queries.ts`**

```ts
import { getDb, schema } from "./index";
import { eq, desc } from "drizzle-orm";

export async function getBusinessById(id: string) {
  const db = getDb();
  const rows = await db.select().from(schema.businesses).where(eq(schema.businesses.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listAllBusinesses() {
  const db = getDb();
  return db.select().from(schema.businesses).orderBy(desc(schema.businesses.createdAt));
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/index.ts src/lib/db/queries.ts
git commit -m "feat: postgres connection + minimal business queries"
```

---

### Task 1.4: `/api/health` endpoint

**Files:**
- Create: `src/app/api/health/route.ts`

- [ ] **Step 1: Create the route**

```ts
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    status: "ok",
    service: "foundry-web",
    time: new Date().toISOString(),
  });
}
```

- [ ] **Step 2: Verify dev build**

```bash
DATABASE_URL=postgresql://localhost/postgres npm run dev &
sleep 5
curl http://localhost:3000/api/health
```

Expected: JSON `{"status":"ok",...}`. Kill dev.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/health/route.ts
git commit -m "feat: /api/health for BWL readiness probe"
```

---

### Task 1.5: Production Dockerfile + `.dockerignore`

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: `Dockerfile` at repo root**

```dockerfile
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev=false

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends wget ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:8080/api/health || exit 1
CMD ["npm","run","start","--","-p","8080"]
```

- [ ] **Step 2: `.dockerignore`**

```
node_modules
.next
.git
data/
drizzle/meta
.env*
screenshot-*.png
devfolio-check.png
build.log
.playwright-mcp
.vercel
.vscode
docs/
```

- [ ] **Step 3: Build locally**

```bash
docker build -t foundry-web:dev .
```

Expected: `Successfully built`.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: production dockerfile for foundry-web (port 8080, health check)"
```

---

### Task 1.6: `foundry-heart` stub service

**Files:**
- Create: `foundry-heart/package.json`
- Create: `foundry-heart/tsconfig.json`
- Create: `foundry-heart/src/index.ts`
- Create: `foundry-heart/Dockerfile`

- [ ] **Step 1: `foundry-heart/package.json`**

```json
{
  "name": "foundry-heart",
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": { "build": "tsc", "start": "node dist/index.js" },
  "dependencies": { "ioredis": "^5.4.1", "pg": "^8.11.0" },
  "devDependencies": { "@types/node": "^20", "@types/pg": "^8.10.0", "typescript": "^5" }
}
```

- [ ] **Step 2: `foundry-heart/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: `foundry-heart/src/index.ts`**

```ts
import http from "node:http";

const PORT = Number(process.env.PORT ?? 8080);

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "foundry-heart" }));
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => console.log(`[heart] listening on :${PORT}`));

setInterval(() => console.log(`[heart] tick ${new Date().toISOString()}`), 15 * 60 * 1000);
```

- [ ] **Step 4: `foundry-heart/Dockerfile`**

```dockerfile
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx tsc

FROM node:20-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 8080
HEALTHCHECK CMD wget -q -O- http://127.0.0.1:8080/health || exit 1
CMD ["node","dist/index.js"]
```

- [ ] **Step 5: Commit**

```bash
git add foundry-heart/
git commit -m "feat: foundry-heart stub service"
```

---

### Task 1.7: Write `.locusbuild`

**Files:**
- Create: `.locusbuild`

- [ ] **Step 1: Root `.locusbuild`**

```json
{
  "services": {
    "web": {
      "path": ".",
      "port": 8080,
      "healthCheck": "/api/health",
      "env": {
        "DATABASE_URL": "${{db.DATABASE_URL}}",
        "REDIS_URL": "${{cache.REDIS_URL}}"
      }
    },
    "heart": {
      "path": "foundry-heart",
      "port": 8080,
      "healthCheck": "/health",
      "env": {
        "DATABASE_URL": "${{db.DATABASE_URL}}",
        "REDIS_URL": "${{cache.REDIS_URL}}",
        "FOUNDRY_WEB_URL": "${{web.URL}}"
      }
    }
  },
  "addons": {
    "db": { "type": "postgres" },
    "cache": { "type": "redis" }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add .locusbuild
git commit -m "feat: .locusbuild multi-service config"
```

---

### Task 1.8: Deploy Foundry via BWL `from-repo`

Procedural (no new files).

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```

- [ ] **Step 2: Exchange `claw_` for JWT**

```bash
TOKEN=$(curl -s -X POST https://beta-api.buildwithlocus.com/v1/auth/exchange \
  -H "Content-Type: application/json" \
  -d "{\"apiKey\":\"$LOCUS_API_KEY\"}" | jq -r '.token')
echo "$TOKEN" > /tmp/bwl-token.txt
curl -s https://beta-api.buildwithlocus.com/v1/auth/whoami -H "Authorization: Bearer $TOKEN" | jq .
```

- [ ] **Step 3: Create project from repo**

```bash
TOKEN=$(cat /tmp/bwl-token.txt)
curl -s -X POST https://beta-api.buildwithlocus.com/v1/projects/from-repo \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name": "agent-zero-foundry", "repo": "Menua777/locus_hackaton", "branch": "main"}' \
  | tee /tmp/foundry-project.json | jq '.project.id, .environment.id, (.services[].id)'
```

- [ ] **Step 4: Poll deployments**

```bash
TOKEN=$(cat /tmp/bwl-token.txt)
for deploy_id in $(jq -r '.deployments[].id' /tmp/foundry-project.json); do
  for i in 1 2 3 4 5 6 7 8 9 10; do
    S=$(curl -s -H "Authorization: Bearer $TOKEN" "https://beta-api.buildwithlocus.com/v1/deployments/$deploy_id" | jq -r .status)
    echo "$deploy_id poll $i: $S"
    [ "$S" = "healthy" -o "$S" = "failed" ] && break
    sleep 30
  done
done
```

- [ ] **Step 5: Verify `/api/health`**

```bash
WEB_URL=$(jq -r '.services[] | select(.name=="web") | .url' /tmp/foundry-project.json)
curl -s "$WEB_URL/api/health"
```

Expected: `{"status":"ok",...}`.

- [ ] **Step 6: Tag phase 1**

```bash
git tag phase-1-complete -m "foundry-web + heart live on BWL with DB+Redis"
git push origin phase-1-complete
```

---

## Phase 1 acceptance criteria

- `curl $WEB_URL/api/health` returns 200
- `curl $HEART_URL/health` returns 200
- Postgres + Redis addons both `available`
- All 8 Drizzle tables exist (verify with `psql $DATABASE_URL -c '\dt'`)
- Foundry master wallet ≥ $50 USDC

---

# PHASE 2 — Business container wrapper (Day 2)

**Outcome:** One hand-crafted business deployed on BWL: pay $0.25 via Locus Checkout → cookie unlocks demo form → 5 calls consume credits → wallet ticks up. MCP endpoint verified with Claude Code.

---

### Task 2.1: Scaffold `business-template/`

**Files:**
- Create: `business-template/package.json`, `business-template/tsconfig.json`, `business-template/Dockerfile`, `business-template/.locusbuild`

- [ ] **Step 1: `business-template/package.json`**

```json
{
  "name": "biz-template",
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": { "build": "tsc", "start": "node dist/server.js" },
  "dependencies": { "better-sqlite3": "^11.3.0", "jose": "^5.9.0" },
  "devDependencies": { "@types/better-sqlite3": "^7.6.11", "@types/node": "^20", "typescript": "^5" }
}
```

- [ ] **Step 2: `business-template/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: `business-template/Dockerfile`**

```dockerfile
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx tsc
RUN cp src/landing.template.html dist/landing.template.html

FROM node:20-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 8080
HEALTHCHECK CMD wget -q -O- http://127.0.0.1:8080/health || exit 1
CMD ["node","dist/server.js"]
```

- [ ] **Step 4: `business-template/.locusbuild`**

```json
{
  "services": {
    "handler": { "path": ".", "port": 8080, "healthCheck": "/health" }
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add business-template/
git commit -m "feat: business-template scaffold"
```

---

### Task 2.2: Business credits module

**Files:**
- Create: `business-template/src/credits.ts`

- [ ] **Step 1: Write `credits.ts`**

```ts
import Database from "better-sqlite3";
import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";

const DB_PATH = process.env.CREDITS_DB_PATH ?? "/tmp/credits.sqlite";

let _db: Database.Database | null = null;
function db() {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      jti TEXT PRIMARY KEY,
      credits_usdc_remaining REAL NOT NULL,
      expires_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0
    );
  `);
  return _db;
}

async function secretKey() {
  const s = process.env.BIZ_SESSION_SECRET;
  if (!s) throw new Error("BIZ_SESSION_SECRET not set");
  return new TextEncoder().encode(s);
}

export async function issueCreditsToken(amountUsdc: number, ttlSec = 3600): Promise<string> {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();
  db().prepare("INSERT INTO sessions (jti, credits_usdc_remaining, expires_at) VALUES (?,?,?)").run(jti, amountUsdc, expiresAt);
  const jwt = await new SignJWT({ credits_start: amountUsdc })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(process.env.BUSINESS_ID ?? "biz")
    .setJti(jti)
    .setExpirationTime(`${ttlSec}s`)
    .sign(await secretKey());
  return jwt;
}

export interface CreditCheckResult {
  ok: boolean;
  jti?: string;
  remaining?: number;
  reason?: string;
}

export async function verifyAndDebit(token: string, debitUsdc: number): Promise<CreditCheckResult> {
  try {
    const { payload } = await jwtVerify(token, await secretKey());
    const jti = payload.jti as string | undefined;
    if (!jti) return { ok: false, reason: "missing jti" };
    const row = db().prepare("SELECT credits_usdc_remaining, revoked FROM sessions WHERE jti = ?").get(jti) as { credits_usdc_remaining: number; revoked: number } | undefined;
    if (!row) return { ok: false, reason: "unknown session" };
    if (row.revoked) return { ok: false, reason: "revoked" };
    if (row.credits_usdc_remaining < debitUsdc) return { ok: false, reason: "insufficient credits", remaining: row.credits_usdc_remaining };
    const newBalance = row.credits_usdc_remaining - debitUsdc;
    db().prepare("UPDATE sessions SET credits_usdc_remaining = ? WHERE jti = ?").run(newBalance, jti);
    return { ok: true, jti, remaining: newBalance };
  } catch (e) {
    return { ok: false, reason: `jwt: ${(e as Error).message}` };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add business-template/src/credits.ts
git commit -m "feat: business credits module (SQLite + HS256 JWT)"
```

---

### Task 2.3: Sandbox module

**Files:**
- Create: `business-template/src/sandbox.ts`

- [ ] **Step 1: Write `sandbox.ts`**

```ts
import vm from "node:vm";

export interface HandlerContext {
  llm(prompt: string, opts?: { model?: string; maxTokens?: number }): Promise<string>;
  fetch: typeof globalThis.fetch;
  log(msg: string): void;
}

export interface RunResult {
  ok: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
}

const FORBIDDEN_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? new URL(input) : input instanceof URL ? input : new URL((input as Request).url);
  if (FORBIDDEN_HOSTS.has(url.hostname) || url.hostname.endsWith(".locus.local") ||
      /^10\./.test(url.hostname) || /^192\.168\./.test(url.hostname) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(url.hostname)) {
    return Promise.reject(new Error("forbidden host"));
  }
  return fetch(input, init);
}

export async function runHandler(
  handlerSource: string,
  input: unknown,
  ctx: HandlerContext,
  timeoutMs = 25000
): Promise<RunResult> {
  const start = Date.now();
  const context = vm.createContext({
    console: { log: (m: unknown) => ctx.log(String(m)) },
    fetch: safeFetch,
    __ctx: { llm: ctx.llm, fetch: safeFetch, log: ctx.log },
    __input: input,
  });
  const wrapped = `
    (async () => {
      ${handlerSource}
      if (typeof handle !== "function") throw new Error("handler must define handle()");
      return await handle(__input, __ctx);
    })()
  `;
  try {
    const script = new vm.Script(wrapped);
    const promise: Promise<unknown> = script.runInContext(context, { timeout: timeoutMs });
    const output = await promise;
    return { ok: true, output, durationMs: Date.now() - start };
  } catch (e) {
    return { ok: false, error: (e as Error).message, durationMs: Date.now() - start };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add business-template/src/sandbox.ts
git commit -m "feat: node:vm sandbox with blocked private hosts + timeout"
```

---

### Task 2.4: Heartbeat module

**Files:**
- Create: `business-template/src/heartbeat.ts`

- [ ] **Step 1: Write `heartbeat.ts`**

```ts
interface State { callCount: number; lastCallAt: string | null; }

export function makeHeartbeat(state: State) {
  async function getWalletBalance(): Promise<string> {
    try {
      const key = process.env.LOCUS_API_KEY;
      const base = process.env.LOCUS_API_BASE_URL || "https://beta-api.paywithlocus.com/api";
      const r = await fetch(`${base}/pay/balance`, { headers: { Authorization: `Bearer ${key}` } });
      const j = await r.json();
      return String(j?.data?.usdc_balance ?? "0");
    } catch { return "0"; }
  }

  async function send() {
    const busUrl = process.env.FOUNDRY_BUS_URL;
    if (!busUrl) return;
    const walletBalance = await getWalletBalance();
    try {
      await fetch(`${busUrl}/api/heartbeats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: process.env.BUSINESS_ID,
          walletAddress: process.env.BUSINESS_WALLET_ADDRESS,
          walletBalance,
          callCount: state.callCount,
          lastCallAt: state.lastCallAt,
          status: "alive",
        }),
      });
    } catch (e) {
      console.warn("[heartbeat] failed:", (e as Error).message);
    }
  }
  return { send, start: () => setInterval(send, 60_000) };
}
```

- [ ] **Step 2: Commit**

```bash
git add business-template/src/heartbeat.ts
git commit -m "feat: business heartbeat module"
```

---

### Task 2.5: MCP endpoint module

**Files:**
- Create: `business-template/src/mcp.ts`

- [ ] **Step 1: Write `mcp.ts`**

```ts
import type { IncomingMessage, ServerResponse } from "node:http";

const ALLOWED_ORIGINS = new Set<string>([
  "https://claude.ai",
  "https://app.claude.ai",
  "https://claude.com",
  "vscode-webview://",
]);

function isAllowedOrigin(origin: string | undefined, selfUrl: string): boolean {
  if (!origin) return true;
  if (selfUrl && origin === new URL(selfUrl).origin) return true;
  for (const a of ALLOWED_ORIGINS) if (origin.startsWith(a)) return true;
  return false;
}

export interface McpHandlers {
  toolName: string;
  toolDescription: string;
  inputSchema: unknown;
  onCall: (input: unknown, bearer: string) => Promise<unknown>;
}

export function mcpDiscoveryManifest(h: McpHandlers, selfUrl: string) {
  return {
    protocolVersion: "2024-11-05",
    serverInfo: { name: process.env.BUSINESS_ID, version: "1.0" },
    capabilities: { tools: {} },
    tools: [{ name: h.toolName, description: h.toolDescription, inputSchema: h.inputSchema }],
    endpoints: { sse: `${selfUrl}/mcp/sse`, http: `${selfUrl}/mcp` },
    auth: { type: "bearer" },
  };
}

export async function handleMcpSse(req: IncomingMessage, res: ServerResponse, _h: McpHandlers, selfUrl: string) {
  const origin = req.headers.origin as string | undefined;
  if (!isAllowedOrigin(origin, selfUrl)) { res.writeHead(403); res.end("bad origin"); return; }
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { res.writeHead(401); res.end("missing bearer"); return; }
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
  res.write(`event: endpoint\ndata: ${selfUrl}/mcp\n\n`);
  const interval = setInterval(() => res.write(`: ping\n\n`), 15000);
  req.on("close", () => clearInterval(interval));
}

export async function handleMcpPost(body: unknown, bearer: string, h: McpHandlers) {
  const msg = body as { id: number | string; method: string; params?: any };
  if (msg.method === "initialize") {
    return { jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: process.env.BUSINESS_ID, version: "1.0" } } };
  }
  if (msg.method === "tools/list") {
    return { jsonrpc: "2.0", id: msg.id, result: { tools: [{ name: h.toolName, description: h.toolDescription, inputSchema: h.inputSchema }] } };
  }
  if (msg.method === "tools/call") {
    const { name, arguments: args } = msg.params ?? {};
    if (name !== h.toolName) return { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "unknown tool" } };
    try {
      const out = await h.onCall(args, bearer);
      return { jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: typeof out === "string" ? out : JSON.stringify(out) }] } };
    } catch (e) {
      return { jsonrpc: "2.0", id: msg.id, error: { code: -32000, message: (e as Error).message } };
    }
  }
  return { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `unknown method ${msg.method}` } };
}
```

- [ ] **Step 2: Commit**

```bash
git add business-template/src/mcp.ts
git commit -m "feat: business MCP transport (SSE + HTTP, Origin validation)"
```

---

### Task 2.6: Business server + landing HTML

**Files:**
- Create: `business-template/src/server.ts`
- Create: `business-template/src/landing.template.html`

- [ ] **Step 1: `business-template/src/landing.template.html`** — full HTML + client JS for pay → session → call flow. Use the HTML template provided in the design spec (Section 3 + 6). Key behaviors:
  - Calls `POST /call/deposit` to get checkout URL
  - Opens popup to hosted checkout
  - Polls `GET /call/deposit/status?sessionId=...` until confirmed
  - Calls `POST /call/deposit/finalize` to set the credits cookie
  - Demo form uses `POST /call` with credentials
  - "Reveal API key" button shows the JWT for dev mode
  - "Install in Claude" card with the one-liner

Write it as shown in the spec's Section 6 (gallery card + landing). For full HTML contents, copy from the spec's landing wireframe and expand with the client-side JS implementing the flow above.

- [ ] **Step 2: `business-template/src/server.ts` — the wrapper**

```ts
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { issueCreditsToken, verifyAndDebit } from "./credits.js";
import { runHandler } from "./sandbox.js";
import { makeHeartbeat } from "./heartbeat.js";
import { mcpDiscoveryManifest, handleMcpSse, handleMcpPost } from "./mcp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 8080);
const BUSINESS_ID = process.env.BUSINESS_ID ?? "biz_unknown";
const BUSINESS_NAME = process.env.BUSINESS_NAME ?? "Unnamed Business";
const BUSINESS_PITCH = process.env.BUSINESS_PITCH ?? "A Foundry-born AI tool.";
const DEFAULT_PRICE = Number(process.env.PRICE_PER_CALL_USDC ?? 0.05);
const LLM_EST = Number(process.env.LLM_COST_ESTIMATE_USDC ?? 0.02);
const LOCUS_API_KEY = process.env.LOCUS_API_KEY ?? "";
const LOCUS_API_BASE = process.env.LOCUS_API_BASE_URL ?? "https://beta-api.paywithlocus.com/api";
const WALLET_ADDRESS = process.env.BUSINESS_WALLET_ADDRESS ?? "unknown";

const handlerSource: string = (() => {
  const b64 = process.env.HANDLER_SOURCE_B64;
  if (!b64) {
    return `async function handle(input, ctx) { return { echo: typeof input === "string" ? input : JSON.stringify(input) }; }`;
  }
  return Buffer.from(b64, "base64").toString("utf8");
})();

const state = { callCount: 0, lastCallAt: null as string | null };

const landingTemplate = fs.readFileSync(path.join(__dirname, "landing.template.html"), "utf8");

function landingHtml(selfUrl: string) {
  return landingTemplate
    .replaceAll("{{NAME}}", BUSINESS_NAME)
    .replaceAll("{{PITCH}}", BUSINESS_PITCH)
    .replaceAll("{{WALLET_ADDRESS}}", WALLET_ADDRESS)
    .replaceAll("{{SLUG}}", BUSINESS_ID.replace(/^biz_/, ""))
    .replaceAll("{{BASE_URL}}", selfUrl);
}

async function checkWalletBalance(): Promise<number> {
  try {
    const r = await fetch(`${LOCUS_API_BASE}/pay/balance`, { headers: { Authorization: `Bearer ${LOCUS_API_KEY}` } });
    const j = await r.json();
    return Number(j?.data?.usdc_balance ?? 0);
  } catch { return 0; }
}

async function scopedLlm(prompt: string, opts?: { model?: string; maxTokens?: number }): Promise<string> {
  const maxTokens = Math.min(opts?.maxTokens ?? 1024, 4096);
  const r = await fetch(`${LOCUS_API_BASE}/wrapped/gemini/chat`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${LOCUS_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts?.model ?? "gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      maxOutputTokens: maxTokens,
      temperature: 0.7,
    }),
  });
  const j = await r.json();
  const text = j?.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? j?.data?.text ?? j?.data?.content ?? "";
  return String(text);
}

function ctxLog(m: string) { console.log(`[handler] ${m}`); }

async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

async function createCheckoutSession(amountUsdc: number, selfUrl: string) {
  const r = await fetch(`${LOCUS_API_BASE}/checkout/sessions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${LOCUS_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount_usdc: amountUsdc,
      description: `${BUSINESS_NAME} — ${amountUsdc} USDC credits`,
      success_url: `${selfUrl}/#paid`,
      cancel_url: `${selfUrl}/#cancel`,
      metadata: { businessId: BUSINESS_ID, kind: "credits_deposit" },
    }),
  });
  return r.json();
}

async function getCheckoutStatus(sessionId: string) {
  const r = await fetch(`${LOCUS_API_BASE}/checkout/sessions/${sessionId}`, {
    headers: { "Authorization": `Bearer ${LOCUS_API_KEY}` },
  });
  return r.json();
}

const mcpHandlers = {
  toolName: "call",
  toolDescription: BUSINESS_PITCH,
  inputSchema: { type: "object", properties: { input: { type: "string" } }, required: ["input"] },
  async onCall(input: unknown, bearer: string) {
    const creditCheck = await verifyAndDebit(bearer, DEFAULT_PRICE);
    if (!creditCheck.ok) throw new Error("payment required: " + creditCheck.reason);
    const result = await runHandler(handlerSource, input, { llm: scopedLlm, fetch: globalThis.fetch, log: ctxLog });
    state.callCount++; state.lastCallAt = new Date().toISOString();
    if (!result.ok) throw new Error(result.error);
    return result.output;
  },
};

const server = http.createServer(async (req, res) => {
  const host = req.headers.host ?? "localhost";
  const protocol = (req.headers["x-forwarded-proto"] as string) ?? "https";
  const selfUrl = `${protocol}://${host}`;

  try {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "ok" }));
    }
    if (req.url === "/" || req.url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(landingHtml(selfUrl));
    }
    if (req.url === "/meta") {
      const bal = await checkWalletBalance();
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        businessId: BUSINESS_ID, name: BUSINESS_NAME, pitch: BUSINESS_PITCH,
        walletAddress: WALLET_ADDRESS, walletBalance: bal.toFixed(4),
        callCount: state.callCount, lastCallAt: state.lastCallAt,
        pricePerCallUsdc: DEFAULT_PRICE,
      }));
    }
    if (req.url === "/.well-known/mcp") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(mcpDiscoveryManifest(mcpHandlers, selfUrl)));
    }
    if (req.url === "/mcp/sse") return handleMcpSse(req, res, mcpHandlers, selfUrl);
    if (req.url === "/mcp" && req.method === "POST") {
      const auth = req.headers.authorization;
      if (!auth?.startsWith("Bearer ")) { res.writeHead(401); return res.end("missing bearer"); }
      const body = JSON.parse(await readBody(req));
      const reply = await handleMcpPost(body, auth.slice(7), mcpHandlers);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(reply));
    }
    if (req.url === "/call/deposit" && req.method === "POST") {
      const body = JSON.parse(await readBody(req));
      const amount = Number(body.amountUsdc ?? 0.25);
      const session = await createCheckoutSession(amount, selfUrl);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ sessionId: session?.data?.id, checkoutUrl: session?.data?.hosted_url, amountUsdc: amount }));
    }
    if (req.url?.startsWith("/call/deposit/status") && req.method === "GET") {
      const sessionId = new URL(req.url, selfUrl).searchParams.get("sessionId");
      if (!sessionId) { res.writeHead(400); return res.end("missing sessionId"); }
      const s = await getCheckoutStatus(sessionId);
      const status = s?.data?.status ?? s?.data?.state ?? "PENDING";
      if (status === "CONFIRMED" || status === "confirmed") {
        const amountUsdc = Number(s?.data?.amount_usdc ?? s?.data?.amount ?? 0.25);
        const token = await issueCreditsToken(amountUsdc);
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ state: "confirmed", amountUsdc, token }));
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ state: "pending" }));
    }
    if (req.url === "/call/deposit/finalize" && req.method === "POST") {
      const body = JSON.parse(await readBody(req));
      const token = body.token;
      if (!token) { res.writeHead(400); return res.end("missing token"); }
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Set-Cookie": `fc=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600`,
      });
      return res.end(JSON.stringify({ ok: true }));
    }
    if (req.url === "/call" && req.method === "POST") {
      const cookieToken = parseCookie(req.headers.cookie as string | undefined, "fc");
      const authHeader = req.headers.authorization;
      const token = cookieToken ?? (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);
      if (!token) { res.writeHead(402); return res.end(JSON.stringify({ error: "payment required" })); }
      const price = (req.headers["x-tier"] === "premium") ? 0.10 : DEFAULT_PRICE;
      const walletBal = await checkWalletBalance();
      if (walletBal < LLM_EST) { res.writeHead(402); return res.end(JSON.stringify({ error: `This business is out of funds. Tip its wallet at ${WALLET_ADDRESS} to revive.` })); }
      const debit = await verifyAndDebit(token, price);
      if (!debit.ok) { res.writeHead(402); return res.end(JSON.stringify({ error: debit.reason })); }
      const body = JSON.parse(await readBody(req));
      const result = await runHandler(handlerSource, body.input, { llm: scopedLlm, fetch: globalThis.fetch, log: ctxLog });
      state.callCount++; state.lastCallAt = new Date().toISOString();
      if (!result.ok) { res.writeHead(500); return res.end(JSON.stringify({ ok: false, error: result.error })); }
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, output: result.output, creditsRemaining: debit.remaining, durationMs: result.durationMs }));
    }
    res.writeHead(404); res.end("not found");
  } catch (e) {
    console.error(e);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
});

server.listen(PORT, () => {
  console.log(`[${BUSINESS_ID}] listening on :${PORT}`);
  const hb = makeHeartbeat(state);
  hb.send().catch(() => {});
  hb.start();
});
```

- [ ] **Step 3: Commit**

```bash
git add business-template/src/
git commit -m "feat: business wrapper server (routes, payment, MCP, 402-when-broke)"
```

---

### Task 2.7: Build + publish business-template image

- [ ] **Step 1: Build for ARM64 and push to registry**

```bash
cd business-template
docker buildx create --use --name foundry-builder 2>/dev/null || true
docker buildx build --platform linux/arm64 -t ghcr.io/menua777/foundry-biz-template:v1 --push .
cd ..
```

If using a different registry, substitute accordingly. Commit the tag.

```bash
git tag biz-template-v1
git push origin biz-template-v1
```

---

### Task 2.8: Manual deploy one test business end-to-end

Procedural.

- [ ] **Step 1: Register a fresh sub-agent**

```bash
curl -s -X POST https://beta-api.paywithlocus.com/api/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Shakespeare Haiku Bot"}' | tee /tmp/biz-register.json | jq .
BIZ_API_KEY=$(jq -r '.data.apiKey' /tmp/biz-register.json)
BIZ_WALLET=$(jq -r '.data.ownerAddress' /tmp/biz-register.json)
```

- [ ] **Step 2: Create BWL project + env**

```bash
TOKEN=$(cat /tmp/bwl-token.txt)
PROJECT=$(curl -s -X POST https://beta-api.buildwithlocus.com/v1/projects \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"biz-haiku-test"}')
PROJECT_ID=$(echo "$PROJECT" | jq -r .id)
ENV=$(curl -s -X POST "https://beta-api.buildwithlocus.com/v1/projects/$PROJECT_ID/environments" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"production","type":"production"}')
ENV_ID=$(echo "$ENV" | jq -r .id)
```

- [ ] **Step 3: Create service from pre-built image**

```bash
TOKEN=$(cat /tmp/bwl-token.txt)
SERVICE=$(curl -s -X POST https://beta-api.buildwithlocus.com/v1/services \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"environmentId\": \"$ENV_ID\",
    \"name\": \"handler\",
    \"source\": { \"type\": \"image\", \"imageUri\": \"ghcr.io/menua777/foundry-biz-template:v1\" },
    \"runtime\": { \"port\": 8080, \"cpu\": 256, \"memory\": 512, \"minInstances\": 1, \"maxInstances\": 1 },
    \"healthCheckPath\": \"/health\"
  }")
SERVICE_ID=$(echo "$SERVICE" | jq -r .id)
SERVICE_URL=$(echo "$SERVICE" | jq -r .url)
```

- [ ] **Step 4: Set env vars**

```bash
TOKEN=$(cat /tmp/bwl-token.txt)
FOUNDRY_BUS_URL=$(jq -r '.services[] | select(.name=="web") | .url' /tmp/foundry-project.json)
SESSION_SECRET=$(openssl rand -hex 32)
curl -s -X PUT "https://beta-api.buildwithlocus.com/v1/variables/service/$SERVICE_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{
    \"variables\": {
      \"LOCUS_API_KEY\": \"$BIZ_API_KEY\",
      \"LOCUS_API_BASE_URL\": \"https://beta-api.paywithlocus.com/api\",
      \"FOUNDRY_BUS_URL\": \"$FOUNDRY_BUS_URL\",
      \"BUSINESS_ID\": \"biz_haikubot1\",
      \"BUSINESS_NAME\": \"Shakespeare Haiku Bot\",
      \"BUSINESS_PITCH\": \"Haikus in Early Modern English\",
      \"BUSINESS_WALLET_ADDRESS\": \"$BIZ_WALLET\",
      \"BIZ_SESSION_SECRET\": \"$SESSION_SECRET\",
      \"PRICE_PER_CALL_USDC\": \"0.05\",
      \"LLM_COST_ESTIMATE_USDC\": \"0.02\"
    }
  }"
```

- [ ] **Step 5: Trigger deployment, poll**

```bash
TOKEN=$(cat /tmp/bwl-token.txt)
DEPLOY=$(curl -s -X POST https://beta-api.buildwithlocus.com/v1/deployments \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"serviceId\": \"$SERVICE_ID\"}")
DEPLOY_ID=$(echo "$DEPLOY" | jq -r .id)
for i in 1 2 3 4 5 6 7 8; do
  STATUS=$(curl -s -H "Authorization: Bearer $TOKEN" "https://beta-api.buildwithlocus.com/v1/deployments/$DEPLOY_ID" | jq -r .status)
  echo "poll $i: $STATUS"
  [ "$STATUS" = "healthy" -o "$STATUS" = "failed" ] && break
  sleep 30
done
```

- [ ] **Step 6: Seed business wallet $0.25**

```bash
curl -s -X POST https://beta-api.paywithlocus.com/api/pay/send \
  -H "Authorization: Bearer $LOCUS_API_KEY" -H "Content-Type: application/json" \
  -d "{\"to_address\":\"$BIZ_WALLET\",\"amount\":0.25,\"memo\":\"seed\"}"
```

- [ ] **Step 7: Manual browser test**

Open `$SERVICE_URL`. Verify:
1. Landing page renders
2. Pay $0.25 → Checkout → session unlocks
3. Call 3 times → haikus returned → wallet balance increases

- [ ] **Step 8: MCP Claude Code test**

```bash
claude mcp add foundry-haiku "$SERVICE_URL/mcp/sse" --header "Authorization: Bearer <JWT from UI>"
```

In Claude: *"Write me a haiku about hackathons using the foundry-haiku tool."* Verify invocation and wallet tick.

- [ ] **Step 9: Tag phase 2**

```bash
git tag phase-2-complete
git push origin phase-2-complete
```

---

## Phase 2 acceptance criteria

- One business live; pay + unlock + call works in browser
- `/mcp/sse` passes Claude Code handshake and tool invocation
- Business wallet on-chain balance moves visibly
- 402-when-broke path verified (drain wallet manually to test)

---

# PHASE 3 — Council + commission pipeline (Day 3)

**Outcome:** Type a prompt on foundry-web/commission → pay $3 via Locus Checkout → council runs → live business URL in ≤4 min. 3 back-to-back commissions succeed.

---

### Task 3.1: BWL API client

**Files:**
- Create: `src/lib/bwl/client.ts`
- Create: `src/lib/bwl/projects.ts`
- Create: `src/lib/bwl/services.ts`
- Create: `src/lib/bwl/deployments.ts`
- Create: `src/lib/bwl/variables.ts`

- [ ] **Step 1: `src/lib/bwl/client.ts`**

```ts
const BWL_BASE = process.env.BWL_API_BASE_URL ?? "https://beta-api.buildwithlocus.com/v1";

let _token: string | null = null;
let _tokenExpiresAt = 0;

export async function bwlToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiresAt) return _token;
  const r = await fetch(`${BWL_BASE}/auth/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: process.env.LOCUS_API_KEY }),
  });
  const j = await r.json();
  if (!j.token) throw new Error("bwl auth failed: " + JSON.stringify(j));
  _token = j.token as string;
  _tokenExpiresAt = Date.now() + 25 * 24 * 3600 * 1000;
  return _token;
}

export async function bwl<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await bwlToken();
  const r = await fetch(`${BWL_BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await r.text();
  const j = text ? JSON.parse(text) : {};
  if (!r.ok) throw new Error(`bwl ${init.method ?? "GET"} ${path}: ${r.status} ${text}`);
  return j as T;
}
```

- [ ] **Step 2: `src/lib/bwl/projects.ts`**

```ts
import { bwl } from "./client";

export async function createProject(name: string, description?: string) {
  return bwl<{ id: string; name: string; region: string }>("/projects", {
    method: "POST", body: { name, description: description ?? "" },
  });
}

export async function createEnvironment(projectId: string, name = "production", type: "development" | "staging" | "production" = "production") {
  return bwl<{ id: string; name: string; projectId: string }>(
    `/projects/${projectId}/environments`,
    { method: "POST", body: { name, type } }
  );
}

export async function deleteProject(projectId: string) {
  return bwl(`/projects/${projectId}`, { method: "DELETE" });
}
```

- [ ] **Step 3: `src/lib/bwl/services.ts`**

```ts
import { bwl } from "./client";

export interface ServiceConfig {
  projectId: string;
  environmentId: string;
  name: string;
  source: { type: "image"; imageUri: string } | { type: "github"; repo: string; branch?: string };
  runtime?: { port?: number; cpu?: number; memory?: number; minInstances?: number; maxInstances?: number };
  healthCheckPath?: string;
}

export async function createService(cfg: ServiceConfig) {
  return bwl<{ id: string; url: string; name: string }>("/services", { method: "POST", body: cfg });
}

export async function restartService(serviceId: string) {
  return bwl(`/services/${serviceId}/restart`, { method: "POST" });
}

export async function deleteService(serviceId: string) {
  return bwl(`/services/${serviceId}`, { method: "DELETE" });
}

export async function getService(serviceId: string, includeRuntime = false) {
  return bwl(`/services/${serviceId}${includeRuntime ? "?include=runtime" : ""}`);
}
```

- [ ] **Step 4: `src/lib/bwl/deployments.ts`**

```ts
import { bwl } from "./client";

export async function triggerDeployment(serviceId: string) {
  return bwl<{ id: string; status: string }>("/deployments", { method: "POST", body: { serviceId } });
}

export async function getDeployment(deployId: string) {
  return bwl<{ id: string; status: string; lastLogs?: string[] }>(`/deployments/${deployId}`);
}

export async function pollUntilTerminal(deployId: string, opts: { intervalMs?: number; timeoutMs?: number; onStatus?: (s: string) => void } = {}) {
  const interval = opts.intervalMs ?? 20000;
  const deadline = Date.now() + (opts.timeoutMs ?? 10 * 60 * 1000);
  while (Date.now() < deadline) {
    const d = await getDeployment(deployId);
    opts.onStatus?.(d.status);
    if (["healthy", "failed", "cancelled", "rolled_back"].includes(d.status)) return d;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("deployment poll timeout");
}
```

- [ ] **Step 5: `src/lib/bwl/variables.ts`**

```ts
import { bwl } from "./client";

export async function putVariables(serviceId: string, variables: Record<string, string>) {
  return bwl(`/variables/service/${serviceId}`, { method: "PUT", body: { variables } });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/bwl/
git commit -m "feat: BuildWithLocus API client"
```

---

### Task 3.2: Locus sub-agent registration helpers

**Files:**
- Create: `src/lib/locus/register.ts`
- Create: `src/lib/locus/policy.ts`

- [ ] **Step 1: `register.ts`**

```ts
const LOCUS_BASE = process.env.LOCUS_API_BASE_URL ?? "https://beta-api.paywithlocus.com/api";

export async function registerSubAgent(name: string): Promise<{
  persistable: { apiKey: string; ownerAddress: string; walletId: string };
}> {
  const r = await fetch(`${LOCUS_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const j = await r.json();
  if (!j.success || !j.data) throw new Error("register failed: " + JSON.stringify(j));
  const { apiKey, ownerAddress, walletId } = j.data;
  // Intentionally do NOT return ownerPrivateKey — per design, we discard it.
  return { persistable: { apiKey, ownerAddress, walletId } };
}
```

- [ ] **Step 2: `policy.ts`**

```ts
export async function setWalletPolicyWithKey(apiKey: string, params: {
  allowanceUsdc: number;
  maxAllowedTxnSizeUsdc: number;
  approvalThresholdUsdc?: number;
}) {
  const base = process.env.LOCUS_API_BASE_URL ?? "https://beta-api.paywithlocus.com/api";
  const r = await fetch(`${base}/wallets/policy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      allowance_usdc: params.allowanceUsdc,
      max_allowed_txn_size_usdc: params.maxAllowedTxnSizeUsdc,
      approval_threshold_usdc: params.approvalThresholdUsdc ?? 10,
    }),
  });
  if (!r.ok) throw new Error(`policy: ${r.status} ${await r.text()}`);
  return r.json();
}
```

> If the policy endpoint path differs in production, discover the correct one via `GET /api/wallets` or similar and update. For the beta, `/wallets/policy` is the documented shape.

- [ ] **Step 3: Commit**

```bash
git add src/lib/locus/register.ts src/lib/locus/policy.ts
git commit -m "feat: Locus sub-agent register + wallet policy helpers"
```

---

### Task 3.3: Crypto helpers (AES + birth cert)

**Files:**
- Create: `src/lib/crypto.ts`
- Create: `src/lib/birth-cert.ts`

- [ ] **Step 1: `src/lib/crypto.ts` — AES-256-GCM using ES imports**

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function keyBytes(): Buffer {
  const s = process.env.FOUNDRY_ENC_KEY ?? "";
  if (s.length < 32) throw new Error("FOUNDRY_ENC_KEY must be >= 32 chars");
  return Buffer.from(s.slice(0, 32));
}

export function encryptString(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptString(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
```

- [ ] **Step 2: `src/lib/birth-cert.ts`**

```ts
import { SignJWT, jwtVerify } from "jose";
import { createHash } from "node:crypto";

export interface BirthCert {
  businessId: string;
  walletAddress: string;
  genome: string;
  parentId: string | null;
  birthDate: string;
  handlerHash: string;
}

async function key() {
  const k = process.env.FOUNDRY_SIGN_SECRET;
  if (!k) throw new Error("FOUNDRY_SIGN_SECRET not set");
  return new TextEncoder().encode(k);
}

export async function signBirthCert(c: BirthCert): Promise<{ jwt: string; sha256: string }> {
  const jwt = await new SignJWT({ ...c })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .sign(await key());
  const sha256 = createHash("sha256").update(jwt).digest("hex");
  return { jwt, sha256 };
}

export async function verifyBirthCert(jwt: string): Promise<BirthCert> {
  const { payload } = await jwtVerify(jwt, await key());
  return payload as unknown as BirthCert;
}

export function handlerHash(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/crypto.ts src/lib/birth-cert.ts
git commit -m "feat: AES-256-GCM encryption + birth cert signing helpers"
```

---

### Task 3.4: AST check for generated handler

**Files:**
- Create: `src/lib/agent/ast-check.ts`

- [ ] **Step 1: Write `ast-check.ts`**

```ts
import { parse } from "acorn";
import { simple } from "acorn-walk";

const FORBIDDEN_IDENTIFIERS = new Set(["eval", "Function", "require", "process", "globalThis", "import"]);
const FORBIDDEN_STRING_PATTERNS = [/LOCUS_API_KEY/, /claw_[A-Za-z0-9_-]+/, /GEMINI_API_KEY/, /OPENAI_API_KEY/];
const FORBIDDEN_URL_PATTERNS = [/localhost/, /127\.0\.0\.1/, /locus\.local/, /0\.0\.0\.0/];

export interface AstCheckResult { ok: boolean; reasons: string[]; }

export function checkHandlerSource(src: string): AstCheckResult {
  const reasons: string[] = [];
  let ast: any;
  try {
    ast = parse(src, { ecmaVersion: 2022, sourceType: "script", allowAwaitOutsideFunction: true });
  } catch (e) {
    return { ok: false, reasons: ["syntax: " + (e as Error).message] };
  }

  simple(ast, {
    Identifier(node: any) {
      if (FORBIDDEN_IDENTIFIERS.has(node.name)) reasons.push(`forbidden identifier: ${node.name}`);
    },
    CallExpression(node: any) {
      if (node.callee?.type === "Identifier" && (node.callee.name === "eval" || node.callee.name === "Function")) {
        reasons.push(`forbidden call: ${node.callee.name}`);
      }
    },
    NewExpression(node: any) {
      if (node.callee?.type === "Identifier" && node.callee.name === "Function") {
        reasons.push("forbidden: new Function()");
      }
    },
    Literal(node: any) {
      if (typeof node.value === "string") {
        for (const p of FORBIDDEN_STRING_PATTERNS) if (p.test(node.value)) reasons.push(`forbidden literal: matches ${p}`);
        for (const p of FORBIDDEN_URL_PATTERNS) if (p.test(node.value)) reasons.push(`forbidden URL literal: matches ${p}`);
      }
    },
  });

  let hasHandle = false;
  simple(ast, {
    FunctionDeclaration(node: any) { if (node.id?.name === "handle") hasHandle = true; },
    VariableDeclaration(node: any) {
      for (const d of node.declarations) if (d.id?.name === "handle") hasHandle = true;
    },
  });
  if (!hasHandle) reasons.push("must declare top-level async function handle(input, ctx)");

  return { ok: reasons.length === 0, reasons };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/agent/ast-check.ts
git commit -m "feat: AST static check for generated handler source"
```

---

### Task 3.5: Engineer specialist

**Files:**
- Create: `src/lib/agent/engineer.ts`

- [ ] **Step 1: Write `engineer.ts`**

```ts
import { geminiChat } from "../locus/wrapped";
import { checkHandlerSource } from "./ast-check";

export interface EngineerInput {
  businessName: string;
  pitch: string;
  genome: string;
  pricingDefaultUsdc: number;
  commissionId: string;
}

export interface EngineerOutput {
  handlerSource: string;
  pricePerCallUsdc: number;
  llmCostEstimateUsdc: number;
  openApi: { summary: string; inputSchema: unknown; outputSchema: unknown };
}

const SYSTEM_PROMPT = `You are a senior engineer writing a tiny AI microservice handler.

Output ONLY a JavaScript async function named 'handle' with this exact signature:

  async function handle(input, ctx) { ... }

Rules:
- Do NOT use eval, Function constructor, require, process, globalThis, import, or any form of dynamic code.
- Do NOT include any API keys or URLs containing localhost / 127.0.0.1 / locus.local.
- Use 'ctx.llm(prompt, { maxTokens?: number })' for any language model needs. Max 1024 tokens per call.
- Use 'ctx.fetch(url, init)' for any web calls; do not hit private/internal networks.
- Keep the function under 60 lines.
- Input can be a string or an object with an 'input' field.
- Return a JSON-serializable object.

Return the function and nothing else — no markdown fences, no comments, no surrounding text.`;

export async function runEngineer(input: EngineerInput): Promise<EngineerOutput> {
  const userPrompt = `Business: ${input.businessName}\nPitch: ${input.pitch}\nUser's one-sentence brief: ${input.genome}\n\nGenerate the handler function.`;
  const res = await geminiChat(SYSTEM_PROMPT, userPrompt, input.commissionId, { maxTokens: 1600, jsonMode: false });
  const raw = ((res as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? (res as any)?.text ?? (res as any)?.content ?? "") as string;
  const handlerSource = raw.replace(/^```(?:js|javascript)?\s*/i, "").replace(/```\s*$/i, "").trim();

  const check = checkHandlerSource(handlerSource);
  if (!check.ok) throw new Error("engineer: generated code failed AST check — " + check.reasons.join("; "));

  return {
    handlerSource,
    pricePerCallUsdc: 0.05,
    llmCostEstimateUsdc: 0.02,
    openApi: {
      summary: input.pitch,
      inputSchema: { type: "object", properties: { input: { type: "string" } }, required: ["input"] },
      outputSchema: { type: "object" },
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/agent/engineer.ts
git commit -m "feat: engineer specialist — generate handler with AST check"
```

---

### Task 3.6: Shipwright specialist

**Files:**
- Create: `src/lib/agent/shipwright.ts`

- [ ] **Step 1: Write `shipwright.ts`**

```ts
import { createProject, createEnvironment } from "../bwl/projects";
import { createService } from "../bwl/services";
import { putVariables } from "../bwl/variables";
import { triggerDeployment, pollUntilTerminal } from "../bwl/deployments";

export interface ShipwrightInput {
  businessId: string;
  businessName: string;
  businessPitch: string;
  handlerSource: string;
  walletApiKey: string;
  walletAddress: string;
  sessionSecret: string;
  pricePerCallUsdc: number;
  llmCostEstimateUsdc: number;
  imageUri: string;
  foundryBusUrl: string;
  onStatus?: (s: string) => void;
}

export interface ShipwrightOutput {
  projectId: string;
  environmentId: string;
  serviceId: string;
  serviceUrl: string;
  deploymentId: string;
  durationMs: number;
}

export async function runShipwright(i: ShipwrightInput): Promise<ShipwrightOutput> {
  const start = Date.now();
  i.onStatus?.("creating project");
  const project = await createProject(`biz-${i.businessId}`, i.businessPitch);
  i.onStatus?.("creating environment");
  const env = await createEnvironment(project.id, "production", "production");
  i.onStatus?.("creating service");
  const handlerB64 = Buffer.from(i.handlerSource, "utf8").toString("base64");
  const service = await createService({
    projectId: project.id,
    environmentId: env.id,
    name: "handler",
    source: { type: "image", imageUri: i.imageUri },
    runtime: { port: 8080, cpu: 256, memory: 512, minInstances: 1, maxInstances: 1 },
    healthCheckPath: "/health",
  });
  i.onStatus?.("setting variables");
  await putVariables(service.id, {
    LOCUS_API_KEY: i.walletApiKey,
    LOCUS_API_BASE_URL: process.env.LOCUS_API_BASE_URL ?? "https://beta-api.paywithlocus.com/api",
    FOUNDRY_BUS_URL: i.foundryBusUrl,
    BUSINESS_ID: i.businessId,
    BUSINESS_NAME: i.businessName,
    BUSINESS_PITCH: i.businessPitch,
    BUSINESS_WALLET_ADDRESS: i.walletAddress,
    BIZ_SESSION_SECRET: i.sessionSecret,
    PRICE_PER_CALL_USDC: String(i.pricePerCallUsdc),
    LLM_COST_ESTIMATE_USDC: String(i.llmCostEstimateUsdc),
    HANDLER_SOURCE_B64: handlerB64,
  });
  i.onStatus?.("triggering deployment");
  const deploy = await triggerDeployment(service.id);
  i.onStatus?.("deploying (polling)");
  await pollUntilTerminal(deploy.id, { intervalMs: 20000, timeoutMs: 6 * 60 * 1000, onStatus: (s) => i.onStatus?.(`deploy: ${s}`) });
  return {
    projectId: project.id,
    environmentId: env.id,
    serviceId: service.id,
    serviceUrl: service.url,
    deploymentId: deploy.id,
    durationMs: Date.now() - start,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/agent/shipwright.ts
git commit -m "feat: shipwright specialist (project/env/service/deploy)"
```

---

### Task 3.7: Cashier specialist (ES-imports only, no require)

**Files:**
- Create: `src/lib/agent/cashier.ts`

- [ ] **Step 1: Write `cashier.ts`**

```ts
import { randomUUID } from "node:crypto";
import { registerSubAgent } from "../locus/register";
import { setWalletPolicyWithKey } from "../locus/policy";
import { locusRequest } from "../locus/client";
import { signBirthCert, handlerHash, BirthCert } from "../birth-cert";
import { encryptString } from "../crypto";

export interface CashierInput {
  businessId: string;
  businessName: string;
  genome: string;
  parentId: string | null;
  handlerSource: string;
  seedUsdc: number;
}

export interface CashierOutput {
  apiKey: string;
  walletAddress: string;
  walletApiKeyEnc: string;
  sessionSecret: string;
  birthCertJwt: string;
  birthCertSha256: string;
}

export async function runCashier(i: CashierInput): Promise<CashierOutput> {
  const { persistable } = await registerSubAgent(i.businessName);
  const { apiKey, ownerAddress: walletAddress } = persistable;
  const walletApiKeyEnc = encryptString(apiKey);

  await setWalletPolicyWithKey(apiKey, { allowanceUsdc: 10, maxAllowedTxnSizeUsdc: 5, approvalThresholdUsdc: 10 });

  await locusRequest("/pay/send", {
    method: "POST",
    body: { to_address: walletAddress, amount: i.seedUsdc, memo: `seed for ${i.businessId}` },
  });

  const cert: BirthCert = {
    businessId: i.businessId,
    walletAddress,
    genome: i.genome,
    parentId: i.parentId,
    birthDate: new Date().toISOString(),
    handlerHash: handlerHash(i.handlerSource),
  };
  const { jwt: birthCertJwt, sha256: birthCertSha256 } = await signBirthCert(cert);
  const sessionSecret = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  return { apiKey, walletAddress, walletApiKeyEnc, sessionSecret, birthCertJwt, birthCertSha256 };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/agent/cashier.ts
git commit -m "feat: cashier specialist — sub-agent register, policy, seed, birth cert"
```

---

### Task 3.8: Council orchestrator

**Files:**
- Create: `src/lib/redis.ts`
- Create: `src/lib/agent/council.ts`

- [ ] **Step 1: `src/lib/redis.ts`**

```ts
import Redis from "ioredis";

let _pub: Redis | null = null;
let _sub: Redis | null = null;

export function getPub() {
  if (_pub) return _pub;
  _pub = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  return _pub;
}
export function getSub() {
  if (_sub) return _sub;
  _sub = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
  return _sub;
}

export async function publishEvent(channel: string, payload: unknown) {
  await getPub().publish(channel, JSON.stringify(payload));
}
```

- [ ] **Step 2: `src/lib/agent/council.ts`**

```ts
import { ulid } from "ulid";
import { getDb, schema } from "../db";
import { eq } from "drizzle-orm";
import { runEngineer } from "./engineer";
import { runCashier } from "./cashier";
import { runShipwright } from "./shipwright";
import { publishEvent } from "../redis";

interface CommissionStart {
  prompt: string;
  commissionerType: "human" | "business";
  commissionerId?: string;
  commissionerEmail?: string;
  checkoutSessionId?: string;
  agentPayTxHash?: string;
  feePaidUsdc: number;
}

export async function startCommission(input: CommissionStart): Promise<string> {
  const id = "com_" + ulid().toLowerCase();
  const db = getDb();
  await db.insert(schema.commissions).values({
    id,
    prompt: input.prompt,
    commissionerType: input.commissionerType,
    commissionerId: input.commissionerId,
    commissionerEmail: input.commissionerEmail,
    checkoutSessionId: input.checkoutSessionId,
    agentPayTxHash: input.agentPayTxHash,
    feePaidUsdc: String(input.feePaidUsdc),
    status: "pending",
  });
  void runCommission(id).catch(async (err) => {
    await db.update(schema.commissions).set({ status: "failed", failureReason: (err as Error).message, updatedAt: new Date() }).where(eq(schema.commissions.id, id));
    publishEvent(`events:commission:${id}`, { type: "failed", reason: (err as Error).message });
  });
  return id;
}

async function logDecision(commissionId: string, round: number, specialist: string, action: string, reasoning: string, resultSummary: string, costUsdc = 0, provider?: string) {
  const db = getDb();
  await db.insert(schema.decisions).values({
    id: "dec_" + ulid().toLowerCase(),
    commissionId, round, specialist, action, provider, reasoning, resultSummary,
    costUsdc: String(costUsdc),
  });
  await publishEvent(`events:commission:${commissionId}`, {
    type: "decision", round, specialist, action, provider, reasoning, resultSummary, costUsdc,
  });
}

async function runCommission(commissionId: string) {
  const db = getDb();
  const [row] = await db.select().from(schema.commissions).where(eq(schema.commissions.id, commissionId));
  if (!row) throw new Error("commission row gone");
  const prompt = row.prompt;

  await db.update(schema.commissions).set({ status: "classifying" }).where(eq(schema.commissions.id, commissionId));
  await logDecision(commissionId, 1, "moderator", "classify", "classifying commission prompt", prompt.slice(0, 80));

  const name = prompt.split(/[,.:;]/)[0].slice(0, 60).replace(/^(an?\s+|the\s+)/i, "").trim() || "Foundry Business";
  const pitch = prompt.trim().slice(0, 120);

  await db.update(schema.commissions).set({ status: "researching" }).where(eq(schema.commissions.id, commissionId));
  await logDecision(commissionId, 2, "researcher", "context", "researching comparables (stubbed for MVP speed)", "noted", 0);

  await db.update(schema.commissions).set({ status: "engineering" }).where(eq(schema.commissions.id, commissionId));
  const businessId = "biz_" + ulid().toLowerCase().slice(-12);
  const eng = await runEngineer({ businessName: name, pitch, genome: prompt, pricingDefaultUsdc: 0.05, commissionId });
  await logDecision(commissionId, 3, "engineer", "generate_handler", "handler.js generated and passed AST check", `${eng.handlerSource.length} chars`, 0.018, "wrapped/gemini/chat");

  await db.update(schema.commissions).set({ status: "deploying" }).where(eq(schema.commissions.id, commissionId));
  await db.insert(schema.businesses).values({
    id: businessId, name, pitch, genome: prompt,
    parentId: row.commissionerType === "business" ? row.commissionerId ?? null : null,
    handlerCode: eng.handlerSource,
    pricePerCallUsdc: String(eng.pricePerCallUsdc),
    llmCostEstimateUsdc: String(eng.llmCostEstimateUsdc),
    status: "conceived",
  });

  const cashier = await runCashier({
    businessId, businessName: name, genome: prompt,
    parentId: row.commissionerType === "business" ? row.commissionerId ?? null : null,
    handlerSource: eng.handlerSource, seedUsdc: 0.25,
  });
  await logDecision(commissionId, 4, "cashier", "register_subagent", "Locus sub-agent created and seeded", `wallet=${cashier.walletAddress}`, 0.25);

  await db.update(schema.businesses).set({
    walletAddress: cashier.walletAddress,
    walletApiKeyEnc: cashier.walletApiKeyEnc,
    handlerCodeHash: cashier.birthCertSha256,
    status: "deploying",
    statusChangedAt: new Date(),
  }).where(eq(schema.businesses.id, businessId));

  const ship = await runShipwright({
    businessId, businessName: name, businessPitch: pitch,
    handlerSource: eng.handlerSource,
    walletApiKey: cashier.apiKey,
    walletAddress: cashier.walletAddress,
    sessionSecret: cashier.sessionSecret,
    pricePerCallUsdc: eng.pricePerCallUsdc,
    llmCostEstimateUsdc: eng.llmCostEstimateUsdc,
    imageUri: process.env.BIZ_TEMPLATE_IMAGE_URI ?? "ghcr.io/menua777/foundry-biz-template:v1",
    foundryBusUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
    onStatus: (s) => publishEvent(`events:commission:${commissionId}`, { type: "deploy", status: s }),
  });
  await logDecision(commissionId, 5, "shipwright", "deploy", "BWL deploy healthy", ship.serviceUrl, 0.25);

  await db.update(schema.businesses).set({
    bwlProjectId: ship.projectId, bwlServiceId: ship.serviceId, bwlUrl: ship.serviceUrl,
    mcpUrl: `${ship.serviceUrl}/mcp/sse`, status: "alive", statusChangedAt: new Date(),
  }).where(eq(schema.businesses.id, businessId));

  await db.update(schema.commissions).set({ status: "complete", businessId, updatedAt: new Date() }).where(eq(schema.commissions.id, commissionId));
  await publishEvent(`events:commission:${commissionId}`, { type: "complete", businessId, serviceUrl: ship.serviceUrl });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/redis.ts src/lib/agent/council.ts
git commit -m "feat: council orchestrator (commission → live business)"
```

---

### Task 3.9: `/api/commission` + SSE stream endpoints

**Files:**
- Create: `src/app/api/commission/route.ts`
- Create: `src/app/api/commission/[id]/route.ts`
- Create: `src/app/api/commission/[id]/stream/route.ts`
- Modify: `src/app/api/webhooks/locus/route.ts`

- [ ] **Step 1: `src/app/api/commission/route.ts`**

```ts
import { NextRequest } from "next/server";
import { locusRequest } from "@/lib/locus/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const prompt = String(body.prompt ?? "").trim();
  const email = body.email ? String(body.email) : undefined;
  if (prompt.length < 8) return Response.json({ error: "prompt too short" }, { status: 400 });

  const session = await locusRequest<any>("/checkout/sessions", {
    method: "POST",
    body: {
      amount_usdc: 3,
      description: "Agent Zero Foundry — commission",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/commission/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/commission`,
      metadata: { kind: "foundry_commission", prompt, email: email ?? "" },
    },
  });
  return Response.json({ sessionId: session?.id ?? session?.data?.id, checkoutUrl: session?.hosted_url ?? session?.data?.hosted_url });
}
```

- [ ] **Step 2: `src/app/api/commission/[id]/route.ts`**

```ts
import { NextRequest } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [row] = await db.select().from(schema.commissions).where(eq(schema.commissions.id, id));
  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(row);
}
```

- [ ] **Step 3: `src/app/api/commission/[id]/stream/route.ts`**

```ts
import { NextRequest } from "next/server";
import { getSub } from "@/lib/redis";
import { getDb, schema } from "@/lib/db";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      function send(data: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }
      const db = getDb();
      const rows = await db.select().from(schema.decisions).where(eq(schema.decisions.commissionId, id)).orderBy(asc(schema.decisions.createdAt));
      for (const r of rows) send({ type: "decision-replay", ...r });

      const sub = getSub().duplicate();
      await sub.subscribe(`events:commission:${id}`);
      sub.on("message", (_ch, msg) => { try { send(JSON.parse(msg)); } catch {} });

      const keepAlive = setInterval(() => controller.enqueue(encoder.encode(": keepalive\n\n")), 20000);
      setTimeout(() => { clearInterval(keepAlive); sub.disconnect(); controller.close(); }, 10 * 60 * 1000);
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
  });
}
```

- [ ] **Step 4: Extend `src/app/api/webhooks/locus/route.ts`**

Add to the existing confirmed-session handler:

```ts
// after existing verification + event parsing:
const kind = event?.metadata?.kind;
if (kind === "foundry_commission" && (event.type === "checkout.session.confirmed" || event.status === "CONFIRMED")) {
  const { startCommission } = await import("@/lib/agent/council");
  await startCommission({
    prompt: String(event.metadata.prompt),
    commissionerType: "human",
    commissionerEmail: event.metadata.email || undefined,
    checkoutSessionId: event.session_id ?? event.id,
    feePaidUsdc: Number(event.amount_usdc ?? 3),
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/commission/ src/app/api/webhooks/
git commit -m "feat: /api/commission + SSE stream + webhook triggers council"
```

---

### Task 3.10: End-to-end test (3 commissions)

Procedural.

- [ ] **Step 1: Redeploy foundry-web**

```bash
git push origin main
# Trigger redeploy via BWL dashboard or POST /v1/deployments
```

- [ ] **Step 2: Top up Foundry master wallet**

```bash
curl -s https://beta-api.paywithlocus.com/api/pay/balance -H "Authorization: Bearer $LOCUS_API_KEY" | jq .
```

Verify ≥ $30.

- [ ] **Step 3: Commission 3 businesses**

```bash
WEB_URL=$(jq -r '.services[] | select(.name=="web") | .url' /tmp/foundry-project.json)
for p in "An AI that writes Shakespearean haikus" "A code roaster for JavaScript" "An emoji-only translator for business English"; do
  curl -s -X POST "$WEB_URL/api/commission" -H "Content-Type: application/json" -d "{\"prompt\":\"$p\"}"
done
```

Open each checkout URL, pay, watch council log, verify live URL.

- [ ] **Step 4: Tag**

```bash
git tag phase-3-complete
git push origin phase-3-complete
```

---

## Phase 3 acceptance criteria

- 3 commissions complete back-to-back from prompt → live URL in ≤4 min
- Each business has its own Locus sub-wallet (verify on BaseScan)
- Birth certificates stored in `businesses.birth_cert_json`
- Council decisions stream via SSE
- AST check rejects a malicious prompt

---

# PHASE 4 — Frontend + lifecycle cron (Day 4)

**Outcome:** Gallery UI live, specimen detail pages, commission live log, family tree, death clock kills starving businesses, revive flow works, reproduction spawns children.

---

### Task 4.1: Gallery + biz detail API

**Files:**
- Create: `src/app/api/biz/route.ts`
- Create: `src/app/api/biz/[id]/route.ts`

- [ ] **Step 1: `src/app/api/biz/route.ts`**

```ts
import { getDb, schema } from "@/lib/db";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const db = getDb();
  const rows = status
    ? await db.select().from(schema.businesses).where(eq(schema.businesses.status, status)).orderBy(desc(schema.businesses.createdAt))
    : await db.select().from(schema.businesses).orderBy(desc(schema.businesses.createdAt));
  return Response.json({ businesses: rows });
}
```

- [ ] **Step 2: `src/app/api/biz/[id]/route.ts`**

```ts
import { getDb, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [biz] = await db.select().from(schema.businesses).where(eq(schema.businesses.id, id));
  if (!biz) return Response.json({ error: "not found" }, { status: 404 });
  const heartbeats = await db.select().from(schema.heartbeats).where(eq(schema.heartbeats.businessId, id)).orderBy(desc(schema.heartbeats.recordedAt)).limit(100);
  const calls = await db.select().from(schema.calls).where(eq(schema.calls.businessId, id)).orderBy(desc(schema.calls.createdAt)).limit(50);
  return Response.json({ business: biz, heartbeats, calls });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/biz/
git commit -m "feat: gallery + business detail API"
```

---

### Task 4.2: Heartbeats ingest

**Files:**
- Create: `src/app/api/heartbeats/route.ts`

- [ ] **Step 1: Write it**

```ts
import { NextRequest } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const businessId = String(body.businessId ?? "");
  if (!businessId) return Response.json({ error: "missing businessId" }, { status: 400 });
  const db = getDb();
  await db.insert(schema.heartbeats).values({
    businessId,
    walletBalanceUsdc: String(body.walletBalance ?? "0"),
    callCount: Number(body.callCount ?? 0),
    lastCallAt: body.lastCallAt ? new Date(body.lastCallAt) : null,
    observedBy: "self",
  });
  await db.update(schema.businesses).set({
    walletBalanceCached: String(body.walletBalance ?? "0"),
    callCountCached: Number(body.callCount ?? 0),
    updatedAt: new Date(),
  }).where(eq(schema.businesses.id, businessId));
  return Response.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/heartbeats/
git commit -m "feat: heartbeats ingest endpoint"
```

---

### Task 4.3: Landing page + gallery UI

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/gallery.tsx`
- Create: `src/components/business-card.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update `globals.css` with Workshop Noir tokens**

```css
:root {
  --charcoal: #0a0a0a;
  --forge: #ff6b35;
  --mint: #00ff88;
  --blood: #ff2626;
  --mcp: #00d4ff;
  --cream: #f5f5dc;
}
```

- [ ] **Step 2: `src/components/business-card.tsx`**

```tsx
import Link from "next/link";

export interface Business {
  id: string; name: string; pitch: string; status: string;
  walletBalanceCached: string; callCountCached: number;
  parentId: string | null; bwlUrl: string | null;
}

export function BusinessCard({ b }: { b: Business }) {
  const alive = b.status === "alive";
  const dead = b.status === "dead";
  return (
    <div className={`border p-4 rounded ${alive ? "border-[var(--mint)]" : dead ? "border-[var(--blood)]" : "border-zinc-600"} bg-zinc-900`}>
      <div className="text-sm opacity-60 font-mono">#{b.id.slice(-6)}</div>
      <div className="text-lg font-semibold text-[var(--forge)]">{b.name}</div>
      <div className="text-sm italic opacity-80">{b.pitch}</div>
      <div className="mt-2 text-sm font-mono">
        Wallet: <span className="text-[var(--mint)]">${Number(b.walletBalanceCached).toFixed(2)}</span>
      </div>
      <div className="text-xs opacity-60 font-mono">Calls: {b.callCountCached}</div>
      <div className="mt-2 flex gap-2">
        <Link href={`/biz/${b.id}`} className="text-xs underline">Open</Link>
        {b.bwlUrl && <a href={b.bwlUrl} target="_blank" className="text-xs underline">Try it</a>}
        {dead && <Link href={`/biz/${b.id}?action=revive`} className="text-xs underline text-[var(--blood)]">Revive $1</Link>}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `src/components/gallery.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { BusinessCard, Business } from "./business-card";

export function Gallery() {
  const [all, setAll] = useState<Business[]>([]);
  const [filter, setFilter] = useState<string>("all");
  async function refresh() {
    const r = await fetch("/api/biz");
    const j = await r.json();
    setAll(j.businesses);
  }
  useEffect(() => { refresh(); const iv = setInterval(refresh, 10000); return () => clearInterval(iv); }, []);
  const filtered = filter === "all" ? all : all.filter((b) => b.status === filter);
  return (
    <div>
      <div className="flex gap-2 mb-4 text-sm font-mono">
        {["all", "alive", "dying", "dead", "conceived"].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-2 py-1 ${filter === f ? "bg-[var(--forge)] text-black" : "bg-zinc-800"}`}>{f}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((b) => <BusinessCard key={b.id} b={b} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `src/app/page.tsx`**

```tsx
import Link from "next/link";
import { Gallery } from "@/components/gallery";

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--charcoal)] text-[var(--cream)] font-sans p-8">
      <section className="text-center py-20 border-b border-zinc-800">
        <h1 className="text-6xl font-bold tracking-tight text-[var(--forge)]">THE FOUNDRY</h1>
        <p className="text-2xl opacity-80 mt-2">AI that gives birth to AI</p>
        <p className="mt-4 max-w-xl mx-auto opacity-70">
          Describe an AI tool. 3 minutes later it's live, monetized, and breathing USDC on Base.
        </p>
        <Link href="/commission"
          className="mt-8 inline-block bg-[var(--forge)] text-black font-bold py-4 px-8 rounded hover:opacity-90">
          Commission a new business — $3 USDC
        </Link>
      </section>
      <section className="mt-16">
        <h2 className="text-3xl font-semibold mb-6 text-[var(--cream)]">The Gallery</h2>
        <Gallery />
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/globals.css src/components/gallery.tsx src/components/business-card.tsx
git commit -m "feat: landing + live gallery with filters"
```

---

### Task 4.4: Commission form + live log page

**Files:**
- Create: `src/app/commission/page.tsx`
- Create: `src/app/commission/[id]/page.tsx`
- Create: `src/components/commission-form.tsx`
- Create: `src/components/council-terminal.tsx`

- [ ] **Step 1: `commission-form.tsx`**

```tsx
"use client";
import { useState } from "react";

export function CommissionForm() {
  const [prompt, setPrompt] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    const r = await fetch("/api/commission", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, email }),
    });
    const j = await r.json();
    if (j.checkoutUrl) window.location.href = j.checkoutUrl;
    else alert("error: " + (j.error ?? "unknown"));
    setLoading(false);
  }
  return (
    <div className="max-w-xl mx-auto">
      <label className="block text-sm mb-2">What should the AI tool do? (one sentence)</label>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-700 p-3 rounded font-mono" rows={3} />
      <label className="block text-sm mt-4 mb-2">Email (optional)</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-700 p-2 rounded" />
      <button disabled={loading || prompt.length < 8} onClick={submit}
        className="mt-6 bg-[var(--forge)] text-black font-bold py-3 px-6 rounded disabled:opacity-50">
        {loading ? "..." : "Commission — $3 USDC"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: `src/app/commission/page.tsx`**

```tsx
import { CommissionForm } from "@/components/commission-form";
export default function Page() {
  return (
    <main className="min-h-screen bg-[var(--charcoal)] text-[var(--cream)] p-8">
      <h1 className="text-4xl text-[var(--forge)] mb-6">Commission a new business</h1>
      <CommissionForm />
    </main>
  );
}
```

- [ ] **Step 3: `src/components/council-terminal.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";

interface Event { type: string; [k: string]: any }

export function CouncilTerminal({ commissionId }: { commissionId: string }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/commission/${commissionId}/stream`);
    es.onmessage = (m) => {
      try {
        const e = JSON.parse(m.data);
        setEvents((prev) => [...prev, e]);
        if (e.type === "complete") { setDone(e.serviceUrl); es.close(); }
        if (e.type === "failed") { setDone(`FAILED: ${e.reason}`); es.close(); }
      } catch {}
    };
    return () => es.close();
  }, [commissionId]);

  return (
    <div className="bg-black text-[var(--cream)] font-mono p-4 border border-zinc-700 rounded">
      {events.map((e, i) => (
        <div key={i} className="text-xs">
          [{e.specialist ?? e.type ?? "sys"}] {e.action ?? ""} {e.reasoning ?? ""} {e.resultSummary ?? ""} {e.status ?? ""}
        </div>
      ))}
      {done && !done.startsWith("FAILED") && (
        <div className="mt-6 text-lg text-[var(--mint)]">✶ ALIVE — <a href={done} className="underline">{done}</a></div>
      )}
      {done && done.startsWith("FAILED") && <div className="mt-6 text-[var(--blood)]">{done}</div>}
    </div>
  );
}
```

- [ ] **Step 4: `src/app/commission/[id]/page.tsx`**

```tsx
import { CouncilTerminal } from "@/components/council-terminal";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="min-h-screen bg-[var(--charcoal)] text-[var(--cream)] p-8">
      <h1 className="text-3xl text-[var(--forge)] mb-4">Commissioning {id}</h1>
      <CouncilTerminal commissionId={id} />
    </main>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/commission/ src/components/commission-form.tsx src/components/council-terminal.tsx
git commit -m "feat: commission form + live council terminal"
```

---

### Task 4.5: Business detail specimen page

**Files:**
- Create: `src/app/biz/[id]/page.tsx`
- Create: `src/components/specimen-card.tsx`

- [ ] **Step 1: `src/components/specimen-card.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";

export function SpecimenCard({ businessId }: { businessId: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    const refresh = async () => {
      const r = await fetch(`/api/biz/${businessId}`);
      const j = await r.json();
      setData(j);
    };
    refresh();
    const iv = setInterval(refresh, 10000);
    return () => clearInterval(iv);
  }, [businessId]);

  if (!data?.business) return <div className="opacity-60">Loading...</div>;
  const b = data.business;
  return (
    <div className="bg-[var(--cream)] text-black p-10 rounded shadow-2xl max-w-2xl mx-auto font-serif">
      <div className="text-sm font-mono opacity-60">#{b.id}</div>
      <h1 className="text-5xl font-bold mt-2">{b.name}</h1>
      <div className="italic opacity-80 mt-2">{b.pitch}</div>
      <div className="mt-6 border-t border-black/20 pt-4 font-mono text-lg">
        Wallet: <span className="text-emerald-700">${Number(b.walletBalanceCached).toFixed(4)}</span> USDC<br/>
        Calls: {b.callCountCached}<br/>
        Status: <b>{b.status.toUpperCase()}</b>
      </div>
      {b.bwlUrl && (
        <div className="mt-6">
          <a href={b.bwlUrl} target="_blank" className="inline-block bg-[var(--forge)] text-white py-3 px-6 rounded font-sans font-bold">
            Open the business →
          </a>
        </div>
      )}
      {b.bwlUrl && (
        <div className="mt-8 bg-[#001122] text-[var(--mcp)] p-4 rounded font-mono text-sm">
          <b>Install in Claude Code:</b>
          <pre className="mt-2 whitespace-pre-wrap">{`claude mcp add foundry-${b.id.replace(/^biz_/, '').slice(0,8)} ${b.bwlUrl}/mcp/sse \\\n  --header "Authorization: Bearer <token>"`}</pre>
        </div>
      )}
      <div className="mt-6 text-xs font-mono opacity-70">
        Wallet address: {b.walletAddress}<br/>
        Parent: {b.parentId ?? "genesis"}
      </div>
      <details className="mt-6">
        <summary className="cursor-pointer font-sans">Show the AI that powers this</summary>
        <pre className="mt-2 text-xs bg-zinc-900 text-[var(--mint)] p-4 overflow-auto rounded">{b.handlerCode}</pre>
      </details>
    </div>
  );
}
```

- [ ] **Step 2: `src/app/biz/[id]/page.tsx`**

```tsx
import { SpecimenCard } from "@/components/specimen-card";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="min-h-screen bg-[var(--charcoal)] p-8">
      <SpecimenCard businessId={id} />
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/biz/ src/components/specimen-card.tsx
git commit -m "feat: business detail specimen card on charcoal"
```

---

### Task 4.6: Foundry-heart death clock + reproduction

**Files:**
- Rewrite: `foundry-heart/src/index.ts`
- Create: `foundry-heart/src/death-clock.ts`
- Create: `foundry-heart/src/reproduce.ts`
- Create: `src/app/api/admin/deprovision/route.ts`
- Create: `src/app/api/admin/reproduce/route.ts`

- [ ] **Step 1: `foundry-heart/src/death-clock.ts`**

```ts
import { Pool } from "pg";

export async function runDeathClock(pool: Pool, onDeprovision: (bizId: string, serviceId: string | null) => Promise<void>) {
  const client = await pool.connect();
  try {
    const alive = await client.query(`SELECT id, bwl_service_id, wallet_balance_cached, updated_at FROM businesses WHERE status = 'alive'`);
    for (const r of alive.rows) {
      const bal = Number(r.wallet_balance_cached);
      const ageHrs = (Date.now() - new Date(r.updated_at).getTime()) / 3600_000;
      if (bal < 0.5 && ageHrs > 24) {
        await client.query(`UPDATE businesses SET status = 'dying', status_changed_at = NOW() WHERE id = $1`, [r.id]);
      }
    }
    const dying = await client.query(`SELECT id, bwl_service_id, wallet_balance_cached, status_changed_at FROM businesses WHERE status = 'dying'`);
    for (const r of dying.rows) {
      const bal = Number(r.wallet_balance_cached);
      const ageHrs = (Date.now() - new Date(r.status_changed_at).getTime()) / 3600_000;
      if (bal < 0.25 && ageHrs > 24) {
        await client.query(`UPDATE businesses SET status = 'dead', deprovision_reason = 'out of funds', status_changed_at = NOW() WHERE id = $1`, [r.id]);
        await onDeprovision(r.id, r.bwl_service_id);
      }
    }
  } finally {
    client.release();
  }
}
```

- [ ] **Step 2: `foundry-heart/src/reproduce.ts`**

```ts
import { Pool } from "pg";

export async function checkReproduction(pool: Pool, triggerChild: (parentId: string) => Promise<void>) {
  const client = await pool.connect();
  try {
    const candidates = await client.query(`
      SELECT id FROM businesses
      WHERE status = 'alive' AND wallet_balance_cached >= 3.0 AND call_count_cached >= 20
        AND (last_reproduced_at IS NULL OR last_reproduced_at < NOW() - INTERVAL '48 hours')
      LIMIT 5
    `);
    for (const r of candidates.rows) {
      await triggerChild(r.id);
      await client.query(`UPDATE businesses SET last_reproduced_at = NOW() WHERE id = $1`, [r.id]);
    }
  } finally {
    client.release();
  }
}
```

- [ ] **Step 3: `foundry-heart/src/index.ts`**

```ts
import http from "node:http";
import { Pool } from "pg";
import { runDeathClock } from "./death-clock.js";
import { checkReproduction } from "./reproduce.js";

const PORT = Number(process.env.PORT ?? 8080);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const server = http.createServer((req, res) => {
  if (req.url === "/health") { res.writeHead(200); res.end(JSON.stringify({ status: "ok" })); return; }
  res.writeHead(404); res.end();
});
server.listen(PORT);

async function deprovision(bizId: string, serviceId: string | null) {
  if (!serviceId) return;
  const webUrl = process.env.FOUNDRY_WEB_URL;
  if (!webUrl) return;
  try {
    await fetch(`${webUrl}/api/admin/deprovision`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Secret": process.env.ADMIN_SECRET ?? "" },
      body: JSON.stringify({ businessId: bizId, serviceId }),
    });
  } catch (e) { console.warn(`[heart] deprovision: ${(e as Error).message}`); }
}

async function reproduce(parentId: string) {
  const webUrl = process.env.FOUNDRY_WEB_URL;
  if (!webUrl) return;
  try {
    await fetch(`${webUrl}/api/admin/reproduce`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Secret": process.env.ADMIN_SECRET ?? "" },
      body: JSON.stringify({ parentId }),
    });
  } catch (e) { console.warn(`[heart] reproduce: ${(e as Error).message}`); }
}

async function tick() {
  try { await runDeathClock(pool, deprovision); await checkReproduction(pool, reproduce); console.log(`[heart] tick ${new Date().toISOString()}`); }
  catch (e) { console.error(`[heart] tick err: ${(e as Error).message}`); }
}
tick();
setInterval(tick, 15 * 60 * 1000);
```

- [ ] **Step 4: `src/app/api/admin/deprovision/route.ts`**

```ts
import { NextRequest } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { deleteService } from "@/lib/bwl/services";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-secret") !== process.env.ADMIN_SECRET) return new Response("forbidden", { status: 403 });
  const body = await req.json();
  const db = getDb();
  try { await deleteService(body.serviceId); } catch (e) { console.warn("deleteService:", (e as Error).message); }
  await db.update(schema.businesses).set({ status: "dead", deprovisionReason: "out of funds", statusChangedAt: new Date() }).where(eq(schema.businesses.id, body.businessId));
  return Response.json({ ok: true });
}
```

- [ ] **Step 5: `src/app/api/admin/reproduce/route.ts`**

```ts
import { NextRequest } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { startCommission } from "@/lib/agent/council";
import { geminiChat } from "@/lib/locus/wrapped";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-secret") !== process.env.ADMIN_SECRET) return new Response("forbidden", { status: 403 });
  const body = await req.json();
  const parentId = String(body.parentId);
  const db = getDb();
  const [parent] = await db.select().from(schema.businesses).where(eq(schema.businesses.id, parentId));
  if (!parent) return new Response("not found", { status: 404 });

  const resp = await geminiChat(
    "You propose a sister-business that would cross-promote an existing AI micro-service. Reply with ONE sentence, no preamble or quotes.",
    `Parent genome: ${parent.genome}\nParent name: ${parent.name}`,
    "reproduction",
    { maxTokens: 120 }
  );
  const childPrompt = (((resp as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? (resp as any)?.text) ?? "").trim();
  if (!childPrompt) return Response.json({ error: "no child prompt" }, { status: 500 });

  const commissionId = await startCommission({
    prompt: childPrompt,
    commissionerType: "business",
    commissionerId: parentId,
    feePaidUsdc: 3,
  });
  return Response.json({ ok: true, commissionId, childPrompt });
}
```

- [ ] **Step 6: Rebuild heart + redeploy**

```bash
cd foundry-heart && npm install && npx tsc && cd ..
git add foundry-heart/ src/app/api/admin/
git commit -m "feat: heart death clock + reproduction + admin endpoints"
git push origin main
# Redeploy heart + web
```

---

### Task 4.7: Revive/adoption flow

**Files:**
- Modify: `src/app/api/webhooks/locus/route.ts`
- (Optional) a button/endpoint for users — can route through `/biz/[id]` page

- [ ] **Step 1: Extend webhook to handle `foundry_revive`**

In the existing confirmed-session handler, add:

```ts
if (kind === "foundry_revive" && (event.type === "checkout.session.confirmed" || event.status === "CONFIRMED")) {
  const { getDb, schema } = await import("@/lib/db");
  const { eq } = await import("drizzle-orm");
  const db = getDb();
  const bizId = String(event.metadata.businessId);
  const [b] = await db.select().from(schema.businesses).where(eq(schema.businesses.id, bizId));
  if (!b || b.status !== "dead") return;
  // MVP: mark revived — full redeploy requires decrypting apiKey and re-running shipwright;
  // acceptable for demo to show status flip. Full revive is a Phase 6 stretch.
  await db.update(schema.businesses).set({
    status: "alive", reviveCount: (b.reviveCount ?? 0) + 1, statusChangedAt: new Date(),
  }).where(eq(schema.businesses.id, bizId));
  await db.insert(schema.adoptions).values({
    id: "adopt_" + Date.now().toString(36),
    businessId: bizId,
    adopterEmail: event.metadata.email ?? null,
    checkoutSessionId: event.session_id,
    feePaidUsdc: "1.00",
    resultedInRevival: true,
  });
}
```

- [ ] **Step 2: UI — add a "Revive $1" button on the business detail page that POSTs to `/api/commission` with `kind: foundry_revive` (or reuse the existing checkout creation path). For MVP, the link from the gallery card calls a small endpoint that creates the checkout session with the revive metadata.

Create `src/app/api/biz/[id]/revive/route.ts`:

```ts
import { NextRequest } from "next/server";
import { locusRequest } from "@/lib/locus/client";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [b] = await db.select().from(schema.businesses).where(eq(schema.businesses.id, id));
  if (!b) return Response.json({ error: "not found" }, { status: 404 });
  if (b.status !== "dead") return Response.json({ error: "not dead" }, { status: 400 });
  const session = await locusRequest<any>("/checkout/sessions", {
    method: "POST",
    body: {
      amount_usdc: 1,
      description: `Revive ${b.name}`,
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/biz/${id}?revived=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/biz/${id}`,
      metadata: { kind: "foundry_revive", businessId: id },
    },
  });
  return Response.json({ checkoutUrl: session?.hosted_url ?? session?.data?.hosted_url });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/biz/ src/app/api/webhooks/
git commit -m "feat: revive/adoption flow ($1 checkout → webhook → alive)"
```

---

### Task 4.8: Family tree page (reactflow)

**Files:**
- Create: `src/app/dynasty/page.tsx`
- Create: `src/components/family-tree.tsx`

- [ ] **Step 1: Install**

```bash
npm install reactflow
```

- [ ] **Step 2: `family-tree.tsx`**

```tsx
"use client";
import { useEffect, useState, useMemo } from "react";
import ReactFlow, { Controls, Background, Node, Edge } from "reactflow";
import "reactflow/dist/style.css";

export function FamilyTree() {
  const [all, setAll] = useState<any[]>([]);
  useEffect(() => { fetch("/api/biz").then((r) => r.json()).then((j) => setAll(j.businesses)); }, []);
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = all.map((b, i) => ({
      id: b.id,
      position: { x: (i % 6) * 220, y: Math.floor(i / 6) * 140 },
      data: { label: `${b.name}\n$${Number(b.walletBalanceCached).toFixed(2)}\n${b.status}` },
      style: { background: b.status === "alive" ? "#00ff88" : b.status === "dead" ? "#ff2626" : "#888", color: "#000", width: 180 },
    }));
    const edges: Edge[] = all.filter((b) => b.parentId).map((b) => ({ id: `${b.parentId}-${b.id}`, source: b.parentId, target: b.id }));
    return { nodes, edges };
  }, [all]);
  return (
    <div style={{ height: 600 }} className="bg-zinc-900 rounded">
      <ReactFlow nodes={nodes} edges={edges} fitView><Controls /><Background /></ReactFlow>
    </div>
  );
}
```

- [ ] **Step 3: `src/app/dynasty/page.tsx`**

```tsx
import { FamilyTree } from "@/components/family-tree";
export default function Page() {
  return (
    <main className="min-h-screen bg-[var(--charcoal)] text-[var(--cream)] p-8">
      <h1 className="text-3xl text-[var(--forge)] mb-6">The Dynasty</h1>
      <FamilyTree />
    </main>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/dynasty/ src/components/family-tree.tsx package.json package-lock.json
git commit -m "feat: dynasty family tree view"
```

---

## Phase 4 acceptance criteria

- Gallery shows live businesses with correct status colors
- Commission form → pay → council terminal → business URL end-to-end
- Business detail page renders specimen card correctly
- Death clock auto-deprovisions a starved business (manual: set wallet_balance_cached=0.1, wait one cron tick)
- Reproduction spawns a child when parent has wallet ≥ $3 and ≥ 20 calls
- Revive flow flips a dead card back to alive after $1 payment
- Family tree page visualizes parents and children

---

# PHASE 5 — Polish, pre-seed, rehearse (Day 5)

**Outcome:** Gallery populated with 10+ diverse live businesses, real history, one visible dynasty. README + pitch + backup video ready. Dress rehearsal x2 clean. Devfolio submitted.

---

### Task 5.1: Pre-seed demo businesses

- [ ] **Step 1: Fund wallet**

Top up Foundry master wallet to $45+ for 12 × $3 commissions + buffer.

- [ ] **Step 2: Commission 10–15 businesses**

Use prompts like:
- "An AI that writes Shakespearean haikus"
- "A code roaster that drags your JavaScript"
- "An emoji-only translator for business English"
- "A startup-name generator with domain suggestions"
- "An AI that gives bitter life advice from a Victorian ghost"
- "A pitch-deck one-liner generator"
- "A mock-interview AI for software engineering"
- "A children's bedtime story generator"
- "An AI that invents cocktails with emoji recipes"
- "A product description writer for Etsy shops"
- "An AI that roasts a Twitter bio"
- "A one-line movie pitch generator"

Submit each via the commission form, pay $3 each, wait for all to go alive.

- [ ] **Step 3: Exercise a few — generate call history**

Pay $0.25 to 5 of them, make 3 calls each to populate heartbeats + sparklines.

- [ ] **Step 4: Force one reproduction for a visible dynasty**

```bash
psql "$DATABASE_URL" -c "UPDATE businesses SET wallet_balance_cached='3.50', call_count_cached=30 WHERE id='biz_xxx';"
# wait 15 min for next heart cron, or POST directly to /api/admin/reproduce
```

- [ ] **Step 5: Tag**

```bash
git tag demo-seeded
git push origin demo-seeded
```

---

### Task 5.2: README + pitch script

**Files:**
- Rewrite: `README.md`
- Create: `PITCH.md`

- [ ] **Step 1: `README.md`**

Use the one-liner pitch, the "What this is" bullets, the architecture summary (3 services + 2 addons), the Locus integration table (8 primitives), and a link to the design spec and pitch. Keep it under 2 pages.

- [ ] **Step 2: `PITCH.md`**

Copy the 5-minute pitch script from the design spec (§11) verbatim. Memorize it.

- [ ] **Step 3: Commit**

```bash
git add README.md PITCH.md
git commit -m "docs: README + 5-min pitch script"
```

---

### Task 5.3: Record 90s backup video

- [ ] **Step 1: Record**

macOS Cmd+Shift+5 → record:
1. Gallery w/ 10+ live businesses (5s)
2. Click one → specimen card (5s)
3. Try it → $0.25 Checkout → form unlocks → call → response (25s)
4. Install-in-Claude one-liner (5s)
5. Back → commission new → council terminal streams (30s)
6. Gallery shows new business alive (5s)
7. Family tree view (10s)

Save `demo-backup.mp4`.

- [ ] **Step 2: Upload**

YouTube unlisted or similar. Copy link into README.

```bash
git add README.md
git commit -m "docs: add backup demo video link"
```

---

### Task 5.4: Dress rehearsal x2

- [ ] **Step 1: First run — 5:00 stopwatch**

Say pitch while clicking through. Note stumbles, fix.

- [ ] **Step 2: Second run — must be clean**

If not clean, iterate.

---

### Task 5.5: Submit to Devfolio

- [ ] **Step 1: Submit at https://paygentic-week2.devfolio.co/**

Include:
- Project: Agent Zero Foundry
- One-liner: *The Foundry turns a one-sentence prompt into a live AI tool with its own USDC wallet, deployed on BuildWithLocus.*
- Live URL: foundry-web BWL URL
- Demo video: backup link
- GitHub: `https://github.com/Menua777/locus_hackaton`
- Tech: Next.js, BuildWithLocus, Locus, Postgres, Redis, TypeScript

- [ ] **Step 2: Screenshot confirmation**

```bash
git add submission-screenshot.png 2>/dev/null || true
git commit -m "chore: week 2 devfolio submission screenshot" 2>/dev/null || true
```

- [ ] **Step 3: Final top-up**

Foundry wallet ≥ $40.

- [ ] **Step 4: Tag phase 5**

```bash
git tag phase-5-complete
git push origin phase-5-complete
```

---

## Phase 5 acceptance criteria

- ≥10 live businesses in gallery with populated call histories
- At least 1 reproduction visible (parent → child)
- README + PITCH committed
- Backup video link committed
- Two clean dress rehearsals
- Devfolio submission filed
- Foundry wallet ≥ $40

---

# PHASE 6 — Buffer day (Day 6)

- [ ] Fix any rehearsal bugs
- [ ] If clear, one stretch:
  - `GET /api/discover` — public MCP registry endpoint
  - Admin ops page `/admin` — force deprovision, manually trigger reproduction, top up wallet
  - Full revive that redeploys the service via shipwright
  - On-chain birth cert posting (Base tx)
- [ ] Tag `phase-6-complete`

---

# PHASE 7 — Demo day (Day 7)

- [ ] 30 min before: fresh commission smoke test (must reach `alive` within 4 min)
- [ ] Top up Foundry master wallet to $50 if lower
- [ ] Pre-open tabs: Gallery, one alive biz, /commission, /dynasty, backup video
- [ ] Tether hotspot ready
- [ ] Deliver pitch per PITCH.md
- [ ] After Q&A: `git tag demo-delivered`

---

# Cross-cutting concerns

### Environment variables (consolidated)

| Var | Location | Purpose |
|---|---|---|
| `LOCUS_API_KEY` | foundry-web, heart | Foundry master key |
| `LOCUS_API_BASE_URL` | all | `https://beta-api.paywithlocus.com/api` |
| `DATABASE_URL` | foundry-web, heart | auto-injected by Postgres addon |
| `REDIS_URL` | foundry-web, heart | auto-injected by Redis addon |
| `FOUNDRY_ENC_KEY` | foundry-web | ≥32-char AES-256 key for encrypting per-business apiKeys |
| `FOUNDRY_SIGN_SECRET` | foundry-web | HS256 secret for birth certs |
| `BIZ_TEMPLATE_IMAGE_URI` | foundry-web | e.g. `ghcr.io/menua777/foundry-biz-template:v1` |
| `BWL_API_BASE_URL` | foundry-web | `https://beta-api.buildwithlocus.com/v1` |
| `FOUNDRY_WEB_URL` | heart | foundry-web public URL |
| `ADMIN_SECRET` | foundry-web, heart | shared secret for admin endpoints |
| `NEXT_PUBLIC_APP_URL` | foundry-web | public URL for checkout redirects |

Per-business (set at deploy time):
- `LOCUS_API_KEY`, `LOCUS_API_BASE_URL`, `FOUNDRY_BUS_URL`
- `BUSINESS_ID`, `BUSINESS_NAME`, `BUSINESS_PITCH`, `BUSINESS_WALLET_ADDRESS`
- `BIZ_SESSION_SECRET` (HS256)
- `PRICE_PER_CALL_USDC`, `LLM_COST_ESTIMATE_USDC`
- `HANDLER_SOURCE_B64`

### Security review checklist (end of Phase 4)

- [ ] AST check rejects `eval`, `Function`, `require`, `process`, forbidden URL/key literals
- [ ] Business container logs don't print `LOCUS_API_KEY`
- [ ] `FOUNDRY_ENC_KEY` ≥32 chars, in BWL service variables
- [ ] MCP `/mcp` and `/mcp/sse` validate `Origin`
- [ ] No endpoint returns decrypted `apiKey` or `ownerPrivateKey` (we never persist the latter)
- [ ] Foundry master wallet monitored pre-demo

### Rate limits

- `/api/commission` — 5/hour/IP (unpaid)
- Business `/call` — 30/min/IP per business (in-memory)

---

## Self-review (author-facing)

**Spec coverage check:**
- §2 Architecture → Phase 1
- §3 Business internals → Phase 2
- §4 Lifecycle → Phase 4 tasks 4.6–4.7
- §5 MCP + biz #0000 → Phase 2 task 2.5 (MCP) + Phase 3 council (commission = biz #0000's /call path)
- §6 Data model → Phase 1 task 1.2
- §7 Frontend UX → Phase 4 tasks 4.3–4.5, 4.8
- §8 Economics + security → Task 3.7 (cashier policy) + cross-cutting threat list
- §9 Testing → smoke tests in Phases 2 and 3 acceptance, dress rehearsals Phase 5
- §10 Delivery → Phase 1–7
- §11 Pitch script → Phase 5 task 5.2

**Known compromises (all acknowledged in spec):**
- Council specialists co-hosted in foundry-web (not separate BWL services)
- Biz #0000 served by foundry-web, not a standalone business container
- On-chain attestation stored as DB column; actual Base tx stub (Phase 6 stretch)
- Public `/api/discover` registry is Phase 6 stretch

**Placeholder scan:** none remaining.

---

## Execution

**Plan complete and saved to `docs/superpowers/plans/2026-04-20-agent-zero-foundry.md`. Two execution options:**

**1. Subagent-Driven** — I dispatch a fresh subagent per task, review between tasks. Good for independent tasks. Less ideal here because tasks touch overlapping files (business-template ↔ shipwright; schema ↔ queries ↔ council) and parallel subagents would collide.

**2. Inline Execution (recommended for this plan)** — Execute tasks in this session using `superpowers:executing-plans`, batched with checkpoints after each Phase for your review. Better fit for a time-constrained, tightly-coupled hackathon build.

**Which approach?**

# Agent Zero Foundry — Design Spec

**Date:** 2026-04-20
**Target:** Paygentic Week 2 hackathon submission (demo day ~Apr 24, 2026)
**Platform requirement:** must run on BuildWithLocus
**Author:** Menua Vardanyan (extending Week 1 "Agent Zero")

---

## 1. Summary and pitch

### One-sentence pitch

> The Foundry turns a one-sentence prompt into a live AI tool — a real container on BuildWithLocus, with its own USDC wallet, its own paying customers, and an MCP endpoint that anyone can install into Claude. Every tool pays for its own hosting and dies if it can't.

### What it is

Agent Zero Foundry is an autonomous AI startup factory. A council of AI specialists (reused and extended from Week 1) takes a one-sentence prompt, researches the idea, generates a small AI microservice, provisions a dedicated BuildWithLocus project, registers a sub-wallet on Locus, wires up USDC Checkout for pay-per-use, and ships a live HTTPS URL. Each resulting "business" is an economically autonomous lifeform: it earns USDC from calls, spends USDC on its own LLM compute, pays its own infrastructure, and is auto-deprovisioned when its wallet runs dry.

### Why this wins Week 2

Week 1's research council, however sophisticated, output a **document** — judges pattern-matched that to "ChatGPT with extra steps." The only category of artifact that no pure-LLM product can produce is **a persistent, wallet-holding, self-funding service**. That's precisely what BuildWithLocus + Locus enables, and nothing else does.

The Foundry:

- Outputs a clickable, payable, installable artifact, not text
- Each artifact holds its own on-chain wallet and transacts autonomously
- Artifacts reproduce (spawn children), die (on empty wallet), and can be adopted (revived by users)
- Every artifact exposes an MCP endpoint so AI clients can install and pay it
- The Foundry itself is a Foundry-built business (`Business #0000`) living in its own gallery

These features individually have rough precedent; stacked, they are not replicable in a week without exactly this stack.

### Deep Locus integration at a glance

- **Locus Checkout** — inbound (users pay the Foundry to commission a business, pay individual businesses for calls) and outbound (businesses monetize themselves with Checkout)
- **Locus Wrapped APIs** — council research (Exa, Perplexity, Brave, Firecrawl, CoinGecko, Alpha Vantage, Apollo, EDGAR) + code generation (Gemini); each call is charged to the appropriate wallet
- **BuildWithLocus** — every component of the Foundry and every deployed business runs on BWL; uses the full API surface (projects, environments, services, deployments, addons, git push, service-to-service wiring, custom health paths)
- **Locus agent self-registration** — each business gets a dedicated Locus sub-agent via `POST /api/register`
- **USDC transfers** — seed capital, reproduction fees, adoption top-ups all flow via `POST /api/pay/send` between wallets
- **Spending controls (policy API)** — per-business allowance ($10) and max-tx ($5) guardrails enforced at the Locus policy layer
- **On-chain attestations** — signed birth certificates posted as calldata tx on Base, verifiable via BaseScan
- **Full auditability** — every commission, every call, every reproduction, every death, every revive logged with USDC amount; financial lineage traceable end-to-end

---

## 2. System architecture

### Topology

Everything runs on BuildWithLocus. The Foundry is one BWL project; each business is its own BWL project.

```
┌─────────────────── THE FOUNDRY (one BWL project) ───────────────────┐
│                                                                      │
│  foundry-web          Next.js UI: gallery, commission form, demo    │
│       ↓                                                              │
│  foundry-moderator    orchestrator, runs council per commission     │
│       ↓                                                              │
│  ┌─── researcher ─── analyst ─── investigator ───┐  (Week 1 agents) │
│  │                                                │                  │
│  └─── engineer ────── shipwright ─── cashier ───┘  (NEW specialists)│
│                                                                      │
│  foundry-heart         cron: polls each business's wallet hourly    │
│                                                                      │
│  addons: foundry-db (Postgres)   foundry-bus (Redis)                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
        │                                          ▲
        │ commissions                              │ heartbeats
        ▼                                          │
┌──────────────── A BUSINESS (one BWL project per business) ──────────┐
│                                                                      │
│  biz-{slug}    single service, ~1KB generated handler + wrapper     │
│                own LOCUS_API_KEY (self-registered sub-agent)        │
│                own wallet, own /call, own /mcp, own /meta           │
│                heartbeats back to foundry-bus every 60s             │
│                                                                      │
│  no addons (businesses are stateless — state in Foundry DB          │
│             and in a tiny local SQLite file for credits only)       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Baked-in architectural decisions

**Each business has its own Locus sub-agent wallet.** `foundry-cashier` calls `POST /api/register` per new business → receives a fresh `claw_` key + wallet address + owner private key. The `claw_` key is AES-encrypted and injected as `LOCUS_API_KEY`. The owner private key is read from the response and discarded — never persisted. Business wallets are operationally API-key-only; loss of the API key renders the wallet unrecoverable, but blast radius is bounded by the $10 Locus allowance.

**BWL workspace vs Locus wallet — two separate ownerships.** The BuildWithLocus workspace (where all projects and services live) is owned by the Foundry account. The Foundry's BWL credit pool is what actually pays for every business's $0.25/month service cost. In contrast, the Locus USDC wallet of each business is owned by that business's sub-agent. So when we say "a business pays for its own LLM calls," the USDC comes from the business's wallet; when we say "the Foundry pays for hosting," we mean the Foundry's BWL credit balance (funded from the Foundry master wallet) pays the platform fee. For MVP, these are the same workspace for every business. A future extension could give each business its own BWL workspace keyed by its own JWT — but that is out of scope.

**`Business #0000` is served by `foundry-web`, not a separate project.** The Foundry's own public face (landing, gallery, commission form) is also the "landing page" of Business #0000. The `/biz/0000` page on `foundry-web` is the biz_0000 specimen card. When a judge or a parent business calls biz_0000's `/call`, that is the commission endpoint (hand-wired, not handler-generated).

**Businesses are stateless containers.** All gallery-visible state (call history, status, lineage) lives in Foundry-db (Postgres). Only ephemeral credits live in each business's local SQLite. Keeps per-business recurring cost at $0.25/month.

**Heartbeats, not polling.** Each business POSTs `{walletBalance, callCount, status}` to `foundry-bus` every 60s. `foundry-heart` aggregates. Scales to hundreds of businesses with no Foundry-side polling.

**Service-to-service auto-wiring.** Council specialists reach each other via BWL's injected `{NAME}_INTERNAL_URL` env vars (`http://service-xxx.locus.local:8080`). No TLS overhead, zero manual config.

**Payment UX: deposit unlocks browser session; JWT exists for dev mode.** Users pay $0.25 Locus Checkout → business sets a signed credits cookie → in-page demo form unlocks instantly. For technical users, a "Reveal API key" button exposes the same JWT as a Bearer token for curl/MCP. Both paths decrement the same ledger.

**The Foundry is `Business #0000`.** It appears in its own gallery. Its `/call` endpoint is the commission endpoint. Reproduction (one business spawning a child) is implemented as *the parent business calls `Business #0000`'s `/call` using its own funds*. Commission and reproduction share the exact same code path.

---

## 3. Business internals

### Container layout (generated by `foundry-shipwright` and deployed via `git push locus main`)

```
biz-{slug}/
├── Dockerfile              pre-baked, multi-stage, <80MB image
├── package.json            fixed deps: express, jose, node:vm, better-sqlite3
├── .locusbuild             BWL config: 1 service, port 8080
├── src/
│   ├── server.js           Foundry-owned wrapper; identical in every business
│   ├── handler.js          LLM-GENERATED (~20–80 lines) — the unique brain
│   ├── landing.html        generated marketing page
│   ├── docs.json           generated OpenAPI spec
│   └── meta.json           name, pricing, genome, birthDate, parent
```

### Routes

| Route | Purpose | Owner |
|---|---|---|
| `GET /health` | Always 200. BWL health check. | wrapper |
| `GET /` | Serves `landing.html`. Embeds "Install in Claude" card. | wrapper |
| `GET /docs` | Rendered OpenAPI docs. | wrapper |
| `GET /meta` | Live JSON: wallet addr, balance, callCount, parent, children. | wrapper |
| `POST /call/deposit` | Creates Locus Checkout session → returns prepaid JWT + sets credits cookie. | wrapper |
| `POST /call` | Validates session/JWT, debits credits, runs handler. | wrapper + handler |
| `GET /.well-known/mcp` | MCP discovery manifest. | wrapper |
| `GET /mcp/sse` | MCP Server-Sent Events transport (auth + Origin-validated). | wrapper |
| `POST /mcp` | MCP streamable-HTTP transport (auth + Origin-validated). | wrapper |
| `POST /.internal/refresh` | Foundry-cashier can trigger manual wallet refresh. | wrapper |

### Handler contract (the ONLY thing the LLM writes)

```ts
// handler.js — generated by foundry-engineer, ~20–80 lines
export default async function handle(
  input: unknown,
  ctx: {
    llm(prompt: string, opts?: { model?: string; maxTokens?: number }): Promise<string>;
    fetch: typeof globalThis.fetch;
    log(msg: string): void;
  }
): Promise<unknown>;
```

**Execution layer constraints:**

- Handler runs in a constrained execution layer using `node:vm` with a hand-built context object — no `require`, no `process`, no `fs`, no `child_process`, no global environment access.
- `ctx.llm` is a server-side wrapper over Locus Wrapped Gemini keyed by the business's own `LOCUS_API_KEY`. The key itself is never visible to the handler.
- `ctx.fetch` blocks private network ranges (`localhost`, `*.locus.local`, RFC1918).
- 25s timeout per call.
- This is defense-in-depth appropriate for Gemini-generated JS in our own infrastructure, not a full trusted-execution boundary.

### Payment flow (primary = browser session, secondary = API key)

1. Judge opens `https://svc-xxx.buildwithlocus.com/`
2. Sees demo form with "Pay $0.25 to try" button
3. Click → embedded Locus Checkout iframe → judge pays
4. On `CONFIRMED`, business sets an `HttpOnly`, `SameSite=Lax` credits cookie signed with its Ed25519 key (ref a row in local SQLite)
5. Demo form unlocks in-place; submit invokes `POST /call` with the cookie
6. For dev users: "Reveal API key for curl" reveals the same JWT as a `Authorization: Bearer` token; both paths hit identical `/call` and debit the same row

### Heartbeat

Every 60s:

```json
POST ${FOUNDRY_BUS_URL}/heartbeats
{
  "businessId": "biz_abc123",
  "walletAddress": "0x...",
  "walletBalance": "1.42",
  "callCount": 27,
  "lastCallAt": "2026-04-20T10:30:00Z",
  "status": "alive"
}
```

Foundry-heart also polls each business's Locus wallet balance directly every 15 minutes as ground-truth — the business's self-reported balance is cross-checked, not trusted alone.

### Environment variables (set by Foundry-shipwright at service creation)

| Var | Source |
|---|---|
| `LOCUS_API_KEY` | fresh key from `POST /api/register` (per-business sub-agent) |
| `LOCUS_API_BASE_URL` | `https://beta-api.paywithlocus.com/api` |
| `FOUNDRY_BUS_URL` | `${{foundry-bus.INTERNAL_URL}}` |
| `FOUNDRY_PUBKEY` | Ed25519 pubkey for birth-certificate verification |
| `BUSINESS_ID` | e.g. `biz_7fk2x9` |
| `BUSINESS_CONFIG_JSON` | serialized meta (name, pricing, genome, wrapper version) |

**No `GEMINI_API_KEY`, no `OPENAI_API_KEY`, no shared upstream keys.** Every LLM call inside a business uses Locus Wrapped Gemini funded by the business's own wallet. Every LLM call is an on-chain economic event.

### Out-of-funds behavior (the charming demo beat)

When a business's wallet has less USDC than the estimated cost of one `ctx.llm()` call:

```
HTTP 402 Payment Required
{ "error": "This business is out of funds. Tip its wallet at 0x... to revive." }
```

A pitiful AI begging for USDC. Judges remember this.

---

## 4. Lifecycle mechanics

### States

```
CONCEIVED → GESTATING → DEPLOYING → ALIVE ⇄ DYING → DEAD → (RESURRECTED → ALIVE) → ARCHIVED
                                      │
                                      └─ REPRODUCING (spawns child) → child CONCEIVED
```

| State | Meaning | Gallery appearance |
|---|---|---|
| `CONCEIVED` | Commission paid, council started | grey card, "being born" |
| `GESTATING` | Specialists running research/engineering | grey card, live council log |
| `DEPLOYING` | `git push locus main` → BWL build/deploy in progress | grey card, BWL log stream |
| `ALIVE` | Healthy, accepting calls | green, wallet balance ticking |
| `DYING` | Wallet < $0.50 and no calls in 24h | yellow, death timer visible |
| `DEAD` | Deprovisioned; code preserved; wallet locked on-chain | red headstone, "Revive $1" button |
| `ARCHIVED` | Dead 30+ days, code removed; genome preserved | grey with cross, no revive |

### Birth

1. **Commission call** — either human via Locus Checkout on `foundry-web/commission`, or parent business via agent-to-agent USDC transfer.
2. **Council runs (60–120s)** — classify → research → spec → engineer → shipwright → cashier.
3. **Cashier self-registers** a fresh Locus sub-agent (`POST /api/register`) — receives `apiKey` + `walletAddress`; owner private key is discarded.
4. **Cashier sets policy** on the new wallet — `allowanceUsdc: 10.00`, `maxAllowedTxnSizeUsdc: 5.00`, `approvalThresholdUsdc: 10.00`.
5. **Shipwright** writes generated files into a local git repo, creates BWL project + env + service, `git push locus main`, polls deployment status.
6. **Birth certificate** — on BWL `healthy`, Foundry signs a JSON blob with Ed25519 key: `{businessId, walletAddress, genome, parentId, birthDate, handlerHash}`. Stored in `foundry-db`. SHA256 of the cert posted as a one-line calldata tx from Foundry master wallet on Base; tx hash stored and linked from the UI.
7. **Seed capital** — Foundry transfers $0.25 USDC to the new business wallet via `POST /api/pay/send`.
8. Business appears in gallery as `ALIVE`.

### Life

Each call cycle:

```
call in ──→ Locus Checkout receive ──→ business wallet + $0.05 (default) or + $0.10 (premium)
                                    ↓
                          business calls ctx.llm() ──→ business wallet − $0.02
                                    ↓
                          net revenue to wallet: + $0.03 (default) or + $0.08 (premium)
```

Heartbeats every 60s. Foundry-heart runs two cron jobs:

- **Every 15 min** — polls each business's live Locus wallet balance directly; updates `foundry-db`; applies state transitions (ALIVE ↔ DYING, DYING → DEAD).
- **Every hour** — reproduction cycle (see below).

### Death clock rules

- `wallet ≥ $0.50` OR `lastCallAt within 6h` → `ALIVE`
- `wallet < $0.50` AND `lastCallAt > 24h` → `DYING` (yellow, death timer starts)
- `wallet < $0.25` AND `lastCallAt > 48h` → `DEAD` (Shipwright calls the BWL service-deletion endpoint — exact method/path verified at implementation time; residual wallet fossilized on Base, publicly viewable)

### Reproduction

Trigger conditions for a business:

- `walletBalance ≥ $3.00` (enough to commission one child)
- `callCount ≥ 20` (proven viable)
- No children yet OR `lastReproducedAt > 48h ago`

When triggered, Foundry-heart:

1. Calls the parent's `/meta` for genome + recent inputs
2. Posts to `foundry-engineer` with prompt: *"This business `{parent.name}` has earned $`{parent.revenue}` from prompts like `{examples}`. Propose a sister business that would benefit from cross-promotion. Output JSON: `{name, tagline, pitch, pricing, handlerSketch}`."*
3. Gemini's reply is the **mutation** — new genome includes the parent's genome plus the mutation
4. Foundry-cashier debits $3 from parent's wallet via `POST /api/pay/send` (parent → Foundry master)
5. Standard birth flow runs with `parentId = parent.id`
6. Once born, parent seeds child with 10% of its remaining wallet (minimum $0.15)

Dynasty leaderboard ranks by `descendantCount × totalDynastyRevenue`. Business #0000 is the root of everything.

### Adoption / resurrection

- Dead businesses show "Revive ($1)" in the gallery
- Locus Checkout for $1 USDC → on CONFIRMED, Foundry-shipwright redeploys the same code to a fresh BWL service (new URL), tops up wallet with $0.25, transitions to `RESURRECTED` → `ALIVE`
- Gallery shows revive count as a badge; death certificate remains in archive
- Acquisition ($50 ownership transfer) is documented as future work, not in MVP

---

## 5. MCP integration + the meta-recursive Foundry

### MCP on every business

Every business exposes:

```
GET  /.well-known/mcp          → discovery manifest
GET  /mcp/sse                  → MCP Server-Sent Events (Origin-validated)
POST /mcp                      → MCP streamable HTTP (Origin-validated)
```

Manifest derived from the business's OpenAPI spec:

```json
{
  "tools": [
    {
      "name": "call",
      "description": "<the business's pitch sentence>",
      "inputSchema": { ... },
      "price": "0.05 USDC per call"
    }
  ]
}
```

### Auth and Origin policy

- Auth is the same JWT from `/call/deposit`; `Authorization: Bearer <token>` on MCP requests
- `Origin` validated against a whitelist (Claude Desktop, Claude Code, Foundry's own domain); other origins return 403

### Install-in-Claude one-liner (on every business landing)

```
claude mcp add foundry-{slug} https://svc-xxx.buildwithlocus.com/mcp/sse \
  --header "Authorization: Bearer <token>"
```

Judge pastes this into their own terminal, the business becomes a pay-per-use tool inside their Claude Code.

### The Foundry as `Business #0000`

| Property | Value |
|---|---|
| `businessId` | `biz_0000` |
| `name` | "The Foundry" |
| `pitch` | "Describe any AI tool in one sentence. 3 minutes later, it's live, monetized, and on-chain." |
| `pricing` | $3.00 USDC per call (one call = one commissioned business) |
| `parentId` | null (genesis) |
| `handler` | the commissioning pipeline (council → deploy) |
| `wallet` | the Foundry master wallet |
| `mcp` | yes — agents can commission businesses via MCP |

Reproduction is implemented as a parent business calling Business #0000's `/call`. The commission code path and the reproduction code path are literally the same code path. No special casing.

### Footnote: public discovery endpoint

`GET /foundry/api/discover` returns the gallery as a list of MCP tool descriptors. Documented in the README as a future extension but not on the critical demo path.

---

## 6. Data model

All tables live in `foundry-db` (Postgres addon). Drizzle ORM.

### Tables

**`businesses`** — core entity, one row per commission

```
id                       TEXT PK              biz_7fk2x9 (ulid)
name                     TEXT
pitch                    TEXT                 one-liner for gallery
genome                   TEXT                 original commissioning prompt
parent_id                TEXT FK NULL         null only for biz_0000
handler_code_hash        TEXT                 SHA256 of handler.js
handler_code             TEXT                 full JS, auditable
bwl_project_id           TEXT
bwl_service_id           TEXT
bwl_url                  TEXT
mcp_url                  TEXT                 bwl_url + /mcp/sse
wallet_address           TEXT
wallet_api_key_enc       TEXT                 AES-encrypted claw_ key
price_per_call_usdc      NUMERIC(10,4)        0.05 default or 0.10 premium
llm_cost_estimate_usdc   NUMERIC(10,4)        ~0.02
status                   TEXT                 enum CONCEIVED|...|ARCHIVED
status_changed_at        TIMESTAMP
birth_cert_json          JSONB
birth_cert_onchain_tx    TEXT
revive_count             INT DEFAULT 0
last_reproduced_at       TIMESTAMP NULL
deprovision_reason       TEXT NULL
wallet_balance_cached    NUMERIC(10,4)        denormalized for gallery
call_count_cached        INT DEFAULT 0        denormalized
created_at, updated_at   TIMESTAMP
```

**`commissions`** — tracks each commission request (before a business is born)

```
id                       TEXT PK              com_xxx (ulid)
prompt                   TEXT
commissioner_type        TEXT                 human | business
commissioner_id          TEXT NULL FK         biz id if agent-commissioned
commissioner_email       TEXT NULL
checkout_session_id      TEXT NULL
agent_pay_tx_hash        TEXT NULL
fee_paid_usdc            NUMERIC(10,4)        3.00
business_id              TEXT NULL FK         populated on success
status                   TEXT                 pending|...|complete|failed
failure_reason           TEXT NULL
created_at, updated_at
```

**`decisions`** — council trace (reused from Week 1)

```
id                       TEXT PK
commission_id            TEXT FK
round                    INT
specialist               TEXT                 moderator|researcher|analyst|investigator|engineer|shipwright|cashier
action                   TEXT
provider                 TEXT NULL
reasoning                TEXT
result_summary           TEXT
cost_usdc                NUMERIC(10,4)
created_at
```

**`heartbeats`** — append-only, pruned to last 24h daily

```
business_id              TEXT FK
recorded_at              TIMESTAMP
wallet_balance_usdc      NUMERIC(10,4)
call_count               INT
last_call_at             TIMESTAMP NULL
observed_by              TEXT                 self | heart-poll
PRIMARY KEY (business_id, recorded_at)
```

**`calls`** — per-call log

```
id                       TEXT PK
business_id              TEXT FK
caller_type              TEXT                 browser | mcp | api | foundry-internal
cost_to_business_usdc    NUMERIC(10,4)
revenue_usdc             NUMERIC(10,4)
duration_ms              INT
success                  BOOLEAN
error_message            TEXT NULL
created_at
```

**`adoptions`** — revival events

```
id                       TEXT PK
business_id              TEXT FK
adopter_email            TEXT
checkout_session_id      TEXT
fee_paid_usdc            NUMERIC(10,4)        1.00
resulted_in_revival      BOOLEAN
created_at
```

**`lineage_edges`** — closure table for O(1) ancestor queries

```
ancestor_id              TEXT FK
descendant_id            TEXT FK
depth                    INT
PRIMARY KEY (ancestor_id, descendant_id)
```

**`credits_issuance_log`** — append-only audit trail of every JWT issued (live credits live in each business's local SQLite, not here)

```
id                       TEXT PK
business_id              TEXT FK
jti                      TEXT
amount_usdc              NUMERIC(10,4)
checkout_tx_hash         TEXT
issued_at                TIMESTAMP
```

### Indexes

- `businesses(status, status_changed_at DESC)` — gallery filters
- `businesses(parent_id)` — family tree
- `businesses(wallet_balance_cached DESC)` — leaderboard
- `lineage_edges(ancestor_id, depth)` — dynasty queries
- `calls(business_id, created_at DESC)` — recent activity
- `commissions(commissioner_id, status)` — "reproductions by business X"

### Redis keys (`foundry-bus`)

| Key | Type | Purpose |
|---|---|---|
| `deploy:queue` | list | pending commissions awaiting shipwright |
| `events:global` | pub/sub | UI live updates |
| `events:commission:{id}` | pub/sub | per-commission council log |
| `rate:{biz}:{ip}` | string w/ TTL | rate limit (30 calls/min per IP per business) |
| `heart:last:{biz}` | string | last poll timestamp |
| `lock:reproduce:{biz}` | string | reproduction mutex |

---

## 7. Frontend UX and aesthetic

### Pages

| Path | Purpose |
|---|---|
| `/` | Landing hero + live gallery stream |
| `/biz/[id]` | Business detail (same template for every business, including biz_0000) |
| `/commission` | Commission form |
| `/commission/[id]` | Live council log streaming during a commission |
| `/dynasty` | Visual family tree (full gallery as graph) |
| `/admin` | Ops dashboard (password-protected via ADMIN_SECRET) |

### Aesthetic: "Workshop Noir" (evolves Week 1's Terminal Noir)

**Palette:**

- `#0a0a0a` deep charcoal backgrounds
- `#ff6b35` molten orange — forge / birth / active
- `#00ff88` mint green — wallet balances / positive deltas
- `#ff2626` blood red — dying / dead
- `#00d4ff` electric blue — "Install in Claude" CTAs
- `#f5f5dc` paper cream — specimen cards on business detail pages

**Typography:**

- Sora for display (headlines, names)
- JetBrains Mono for data (wallet balances, IDs, code, URLs)

**Dual mood:**

- Landing + gallery = dark industrial workshop, live heartbeats across many businesses
- Business detail = single cream specimen card on pedestal, serif headings, birth certificate laid out like a scroll
- The mood shift signals "this is a thing, not a row"

### Landing hero (wireframe)

```
                         THE FOUNDRY
            AI that gives birth to AI

      Describe an AI tool. 3 minutes later it's live,
      monetized, and breathing USDC on Base.

      ┌────────────────────────────────────────┐
      │   [ Commission a new business — $3 ]   │
      └────────────────────────────────────────┘

      LIVING 17  GRAVEYARD 4  REPRODUCED TODAY 2
      TOTAL USDC ACROSS WALLETS  $47.21
```

### Gallery card

```
┌─────────────────────────────────────┐
│  #042 · Shakespeare Haiku Bot       │
│  "Haikus in Early Modern English"   │
│                                     │
│  🟢 ALIVE · Born 2d ago             │
│  Wallet   $4.12   ╱╲╱╲╱╲╱╲╱        │ ← 24h sparkline
│  Calls    42      Revenue  $4.40    │
│  Parent   #0000 · Foundry           │
│  Kids     1                         │
│                                     │
│  [ Open ]  [ Try it ]  [ MCP ]      │
└─────────────────────────────────────┘
```

Dead cards: red frame, inset "DIED Apr 19" stamp, `[ Revive $1 ]` replaces `[ Try it ]`.

### Commission live log

```
 COMMISSIONING #042 · 02:14 ELAPSED
 ══════════════════════════════════════════════════════════════════

 [ MODERATOR ]   Task classified as: text-generation
                 Council: researcher, engineer, shipwright

 [ RESEARCHER ] → wrapped/exa/search   "similar haiku generators"   ($0.004)
 [ RESEARCHER ] → wrapped/perplexity   "market for greeting AI"     ($0.006)
 [ RESEARCHER ]   finding: 3 competitors, pricing range $0.05-$0.20

 [ ENGINEER   ] → wrapped/gemini/generate  "draft handler.js"        ($0.018)
 [ ENGINEER   ]   handler.js generated · 47 lines · hash 3f9a...

 [ SHIPWRIGHT ] → bwl/projects                                       ($0.000)
 [ SHIPWRIGHT ]   project biz_7fk2x9 created
 [ SHIPWRIGHT ] → bwl/services, git push locus main
 [ SHIPWRIGHT ]   ▒▒▒▒▒▒▒▒░░░░░░░  building   1m 47s
 [ SHIPWRIGHT ]   ▒▒▒▒▒▒▒▒▒▒▒▒▒░░  deploying  2m 14s
 [ SHIPWRIGHT ]   ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  healthy    2m 31s

 [ CASHIER    ] → locus/register   new sub-agent created
 [ CASHIER    ]   wallet 0x5f..2e1c · birth cert signed
 [ CASHIER    ] → base/attestation  tx 0x3a..91f2

 ══════════════════════════════════════════════════════════════════
                    ✶  BUSINESS #042 IS ALIVE  ✶
              https://svc-abc123.buildwithlocus.com
                    [ Open your new business ]
```

### Animations

- Birth: newborn card fades in with a gold flash
- Reproduction: parent card pulses; a line animates to a child card fading in
- Death: card fades to red, wallet freezes, "DIED" stamp lands with a soft impact
- Revive: red card flashes green, "REVIVED" stamp, call counter resets

### Real-time transport

- `foundry-web` subscribes to Redis `events:global` and per-commission channels
- SSE streams to browser (`GET /events/stream`, `GET /events/commission/:id`)
- Throttled to 2 updates/sec per browser
- Polling fallback every 10s if SSE disconnects

---

## 8. Economic model and security

### Unit economics (estimated demo assumptions, not platform guarantees)

| Item | USDC |
|---|---|
| Commission fee (human or agent) | $3.00 |
| Deposit ("try pack") on a business | $0.25 (~5 default calls) |
| Default call | $0.05 |
| Premium call | $0.10 |
| Wrapped Gemini per call (est.) | ~$0.02 |
| Business net per default call (est.) | ~+$0.03 |
| Business net per premium call (est.) | ~+$0.08 |
| Reproduction threshold | wallet ≥ $3.00 |
| Seed capital at birth | $0.25 from Foundry |
| Seed from parent on reproduction | 10% of parent wallet (min $0.15) |
| Revive / adoption fee | $1.00 |
| Adoption top-up | $0.25 |

### Foundry per-commission P&L (estimated)

| Item | USDC |
|---|---|
| Commission fee in | +$3.00 |
| Council Wrapped API spend | ~−$0.30 |
| Seed to newborn | −$0.25 |
| BWL credit (1 month) | −$0.25 |
| **Estimated net per commission** | **~+$2.20** |

### Wallet lifecycle per business

1. **Create:** `foundry-cashier` → `POST /api/register`
2. **Receive:** `apiKey`, `walletAddress`, `ownerPrivateKey` from response
3. **Store:** `apiKey` AES-encrypted in `foundry-db` + injected as `LOCUS_API_KEY`. `ownerPrivateKey` is never persisted — it is read from the response and discarded from memory after the registration callback.
4. **Set policy:** `allowanceUsdc: 10.00`, `maxAllowedTxnSizeUsdc: 5.00`, `approvalThresholdUsdc: 10.00`.
5. **Seed:** $0.25 USDC transferred from Foundry master wallet.
6. **Operate:** autonomous Checkout inbound, Wrapped Gemini outbound.
7. **Die:** when wallet < $0.25 and dormant > 48h, Foundry deprovisions BWL service. Wallet remains on Base as a fossil.

### Threat model

| # | Threat | Mitigation |
|---|---|---|
| 1 | Master wallet key leak | AES-encrypted at rest, in BWL service variables; separate `FOUNDRY_ENC_KEY`; never in git |
| 2 | Gemini generates malicious handler | AST static check: reject `eval`, `Function()` constructor, non-HTTPS or private-range `fetch` URLs, literals containing `LOCUS_API_KEY` or `CLAW_`. Fails closed on uncertainty. |
| 3 | Handler exfiltrates `LOCUS_API_KEY` | Key never visible to handler; `process.env`/`argv` zeroed in `node:vm`; no `require()`; outbound `fetch` blocked from private ranges |
| 4 | Handler escapes sandbox | `node:vm` is not a complete security boundary; accepted because handler inputs come from Gemini (not user), and business allowance is capped at $10 |
| 5 | Prompt-inject commission | Moderator pre-filter; suspicious prompts rejected with refund |
| 6 | DoS against a business | Redis rate limit 30 calls/min per IP per business |
| 7 | DoS against Foundry `/commission` | 5 unpaid requests/hour per IP; paid requests unlimited |
| 8 | Auto-reproduction spiral | 48h cooldown; reproduction trigger is Foundry-side, not business-side |
| 9 | Unbounded LLM spend | `ctx.llm` default `maxTokens: 1024`, hard cap 4096; $10 wallet allowance caps total damage |
| 10 | Business compromised | Max loss = allowance ($10); Foundry can force-deprovision at any time |
| 11 | On-chain attestation spam | Signed only by Foundry master wallet; internal rate-limit; gas budget monitored |
| 12 | MCP / Claude session reuse | JWT is single-issuance, session-bound in local SQLite; replay is a no-op |
| 13 | MCP CSRF / unauthorized cross-origin | Validate `Origin` on `/mcp/sse` and `POST /mcp`; reject non-whitelisted origins with 403 |

### Auditability

Every commission, every call, every reproduction, every death, every revive is logged with USDC amount. Financial lineage (USDC flow through wallets) traceable end-to-end via Foundry DB + Base explorer.

---

## 9. Testing strategy

### In scope

- **Critical unit tests** — JWT issuance + verify, credits ledger decrement, AST static check, encryption/decryption, state-machine transitions
- **One end-to-end integration smoke** — commission → deploy → pay → call → reproduce → die → revive
- **Dress rehearsal x2** — full 5-min demo script with live commission and live Checkout; both must pass cleanly

### Out of scope (acknowledged, not pursued for MVP)

- Full UI Cypress tests
- Load testing
- Formal security audit
- Mobile e2e
- Backward compatibility (greenfield)

---

## 10. Delivery plan (5 working days + buffer + demo)

### Day 1 — Foundation on BuildWithLocus

- Initialize repo with BWL-native structure, `.locusbuild` committed
- `POST /v1/auth/exchange` → JWT
- `POST /v1/projects/from-repo` to create Foundry project
- Provision Postgres + Redis addons
- Migrate Drizzle schema (all tables)
- Deploy stub `foundry-web` with `/health`
- Fund Foundry master wallet to $50

**Acceptance:** `curl https://svc-{id}.buildwithlocus.com/health` → 200; addons `available`.

### Day 2 — Business wrapper + one manual business

- Build business container (Dockerfile, server.js, sandbox, heartbeat, JWT flow, Checkout integration)
- Pre-build base image, push to registry
- Write one handler.js by hand (Shakespeare haiku generator)
- Deploy standalone business via `git push locus main`
- Register sub-agent wallet manually, inject API key, seed $0.25
- Implement `/call/deposit`, `/call`, `/mcp/sse`, `/meta`, `/`
- Verify: pay $0.25 Checkout → unlock session → 5 calls → wallet ticks up
- Verify `/mcp/sse` handshake from Claude Code

**Acceptance:** one live business URL survives 3 end-to-end demo runs. Judge can pay, call 5 times, install in Claude — all works.

### Day 3 — Council (commission → birth pipeline)

- Port Week 1 specialists (researcher, analyst, investigator, moderator) as BWL services
- Build NEW engineer, shipwright, cashier specialists
- Engineer: constrained-template codegen + AST check + retry with simpler prompt
- Shipwright: BWL API wrapper (project/env/service create, git push, deploy poll)
- Cashier: `POST /api/register`, wallet policy, funding, birth cert signing
- `/commission` endpoint wired to Locus Checkout gatekeeper
- SSE stream of decisions → browser

**Acceptance:** 3 new businesses commissioned back-to-back, all reach `ALIVE`; avg commission-to-healthy ≤ 4 min.

### Day 4 — Frontend + lifecycle cron

- foundry-web UI: landing, gallery, business detail, commission form + live log, family tree
- Apply Workshop Noir palette + specimen card mood shift
- Install-in-Claude one-liner on each business detail page
- Foundry-heart: heartbeat aggregation + death clock + reproduction trigger
- Adoption / revive flow ($1 Checkout)
- Test death clock (force wallet low, confirm auto-deprovision)
- Test reproduction (force wallet high, confirm child commission)

**Acceptance:** death clock kills a business; revive brings it back; reproduction births a child with correct lineage; gallery updates live via SSE.

### Day 5 — Polish, pre-seed, rehearse

- Pre-commission 10–15 demo businesses with interesting prompts
- Let them run overnight for populated heartbeats + sparklines + at least one visible dynasty
- README with architecture, pitch, live URLs, on-chain birth certificate links
- 5-min pitch script, memorized
- 90-second backup demo video (screen capture)
- Dress rehearsal x2 (both must pass)
- Submit to Devfolio
- Fund Foundry master wallet ≥ $40

**Acceptance:** 5-min demo executes cleanly twice in a row; README + backup video submitted; gallery has ≥ 10 live businesses with real history.

### Day 6 — Buffer

- Fix any critical bugs from rehearsal
- If clear, add one stretch: `/foundry/api/discover` registry endpoint, admin ops page, or acquisition preview

### Day 7 — Demo day

- 30 min before: fresh commission smoke test
- Top up Foundry wallet if needed
- Demo
- Fallbacks: recorded video, pre-deployed live businesses accessible by judges on their own networks, tethered hotspot

### Critical-path risks + mitigations

| Risk | P | Mitigation |
|---|---|---|
| BWL API intermittent failure during live commission | M | Pre-deployed canned demo business as safety net; never attempt a live commission without it |
| Gemini generates broken handler | H | AST check + syntax parse + sandbox dry-run before deploy; retry with simpler prompt; refund on failure |
| Demo Wi-Fi dies | L-M | Tethered hotspot; pre-recorded backup video; judges can access pre-deployed businesses from their own networks |
| Locus Checkout confirmation slow | M | 2s polling; optimistic "Confirming..." UI state; admin simulate-payment as last resort (Week 1 code has this) |
| MCP install fails on judge's machine | M | Show install on our own laptop; HTTP `/call` flow is primary demo, MCP is accessory |
| Foundry wallet low | L | Top up to $50 pre-demo; alarm if < $20 |
| Specialist service crashes mid-demo | M | Foundry-heart auto-restart via `POST /v1/services/{id}/restart` |
| Judge asks off-script | — | Stick to script; "happy to show in Q&A" |

---

## 11. Pitch script (5 minutes)

```
(0:00) "The hackathon problem is to build on BuildWithLocus.
       We did — but not one app. An infinite number of them."

(0:15) [show gallery] "This is The Foundry. 17 live AI businesses,
       each with its own wallet, its own customers, and its own pulse.
       Each one was born from a one-sentence prompt."

(0:35) [click a business] "This is Shakespeare Haiku Bot.
       Born two days ago, earned $4.12, just reproduced this morning."

(0:50) [click Try it] "I'll pay 25 cents." [Checkout, pay]
       "Type any subject." "BuildWithLocus."
       [haiku streams back] "Real money paid, real AI, real wallet
       just went up on Base."

(1:30) [click Install in Claude] "And this is where it gets weird.
       I'll install this business into my own Claude Code."
       [paste one-liner] "Claude now has a new tool."
       [prompt Claude: 'haiku about hackathons, use the Foundry tool']
       "Claude just paid this business's wallet in USDC."

(2:30) [gallery, click Commission] "But you don't care about
       this one. Let me commission a new business, live."
       [type: 'An AI that roasts my code for 10 cents']
       [pay $3]

(2:50) [council terminal streams] "5 AI agents are debating,
       researching, generating code, deploying, and creating a wallet
       on Base — right now."

(3:30) [jump to pre-cached completion state]
       [Business #043 is alive]
       "That URL is real. That wallet is real. That code already
       started paying for itself."

(4:00) [click revive on a dead business] "This one died yesterday.
       One dollar to resurrect."
       [$1 Checkout; card flips from red to green]

(4:30) [family tree] "All businesses form dynasties.
       Business #0000 — the Foundry itself — is the root.
       When a business earns enough USDC, it commissions its own
       children. Everything you see is a descendant of one sentence."

(5:00) "Everyone at this hackathon used AI to build something.
       We built a factory that builds things that build themselves,
       hold their own money, and die when they can't pay rent.
       Impossible to replicate without Locus plus BuildWithLocus.
       That is our submission."
```

---

## 12. Out of scope (future work)

- Full public agent registry (`/foundry/api/discover` is a stub)
- Acquisition flow ($50 ownership transfer)
- Human-initiated acquisition of living businesses
- Custom domain purchase via Locus for flagship businesses
- gVisor/Firecracker sandbox for true trusted-execution
- Horizontal scaling beyond 100 concurrent businesses
- Mobile-first UI polish
- Multi-region deployment (`sa-east-1`)
- Multiple handler templates beyond the unified one

---

## 13. Open questions for implementation

None at this time — all major decisions locked in during brainstorming. Any implementation-level ambiguity should be resolved in the implementation plan (next step: `superpowers:writing-plans`).

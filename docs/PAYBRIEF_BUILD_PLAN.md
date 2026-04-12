# PayBrief -- Complete Build Plan

> Pay 5 USDC, get an AI-generated competitor / pricing / market brief in minutes.

---

## 1. Project Summary

### What the app is
PayBrief is a web app where a user enters a company name or product topic, pays 5 USDC via Locus Checkout, and receives an AI-generated competitive intelligence / market brief. The backend agent autonomously researches the topic using paid APIs (via Locus Wrapped APIs), synthesizes findings, and delivers a polished report page.

### Who it is for
- Startup founders doing quick competitor research
- Product managers needing a fast market snapshot
- Anyone who wants a 2-minute competitive brief without hours of manual research

### What exact problem it solves
Competitive research is time-consuming. PayBrief turns it into a one-click purchase: pay, wait, read. The agent does the research work autonomously.

### Why it fits the hackathon
- **Locus Checkout** is the payment entry point (customer pays USDC)
- **Locus Wrapped APIs** power the agent's research pipeline (Firecrawl for web scraping, Exa for search, Gemini/OpenAI for synthesis)
- Money flows IN (checkout) and OUT (wrapped API costs) through Locus -- the product is deeply integrated
- It demonstrates real agentic commerce: an agent that earns money and spends money to do work

### Why this scope is good for a solo developer
- Single user flow (no auth, no dashboards, no teams)
- One payment amount (flat 5 USDC)
- One output type (market brief)
- Clear start and end (form -> pay -> report)
- Can be built and demoed in ~2 days

---

## 2. Final Product Definition

### MVP Features (MUST SHIP)

1. **Landing page** -- hero section explaining what PayBrief does, with a CTA to start
2. **Order form** -- input fields: company/product name, optional focus area (pricing, competitors, market size), email for delivery
3. **Checkout flow** -- Locus Checkout embedded/redirected, 5 USDC flat price
4. **Payment success page** -- confirms payment, shows "generating your brief..." status
5. **Webhook handler** -- receives Locus payment confirmation, verifies HMAC-SHA256, creates report job
6. **Report generation pipeline** -- agent uses Locus Wrapped APIs (Exa search + Firecrawl scrape + Gemini/OpenAI synthesis) to build the brief
7. **Processing/status page** -- polls for job completion, shows progress steps
8. **Final report page** -- renders the completed brief with sections (overview, competitors, pricing insights, key takeaways)
9. **Cost/revenue panel** -- simple admin view showing revenue (5 USDC per order) vs. costs (wrapped API spend per report)

### Nice-to-Have (IF TIME PERMITS)
- Email delivery of the report link
- PDF export of the report
- Example/sample report on landing page
- Social sharing of report
- Multiple pricing tiers (basic 5 USDC, deep-dive 15 USDC)

### OUT OF SCOPE (DO NOT BUILD)
- User accounts / authentication
- Team features / sharing / collaboration
- Dashboard for managing multiple reports
- Custom branding or white-labeling
- Mobile app
- Payment methods other than USDC via Locus
- Subscription model
- Admin panel beyond the simple cost/revenue view
- Real-time collaboration or editing of reports
- Multi-language support

---

## 3. Exact Locus Usage Map

### Locus Checkout (REQUIRED -- payment entry point)
- **Where:** After user fills the order form, the app creates a checkout session server-side and renders the Locus Checkout component (via `@withlocus/checkout-react`) on the checkout page
- **Flow:** User pays 5 USDC -> Locus processes -> webhook fires -> order status updated
- **Integration point:** `POST` to Locus API to create checkout session, then embed React component

### Webhook Verification (REQUIRED -- payment confirmation)
- **Where:** Server-side API route `/api/webhooks/locus`
- **How:** HMAC-SHA256 signature verification on incoming webhook payload
- **Purpose:** Confirms payment completed, triggers report generation job

### Locus Wrapped APIs (REQUIRED -- agent spending)
- **Where:** Backend report generation pipeline
- **APIs used through Locus:**
  - **Exa** (`/api/wrapped/exa/search`) -- search for competitor information, pricing pages, market data
  - **Firecrawl** (`/api/wrapped/firecrawl/scrape`) -- scrape competitor websites, pricing pages, product pages
  - **Gemini or OpenAI** (`/api/wrapped/gemini/chat` or `/api/wrapped/openai/chat`) -- synthesize scraped data into a coherent brief
- **Why this matters:** The agent SPENDS money (from the Locus wallet) to do research work. This demonstrates the full agentic commerce loop: earn via checkout, spend via wrapped APIs.

### Build with Locus (OPTIONAL)
- Could be used to deploy the final app via Locus's deployment APIs
- Not critical for MVP -- standard Vercel/Railway deployment is simpler and more reliable
- Consider using it if deployment via other means fails or for bonus points

### What would fail the hackathon theme
If the product only used Locus Checkout but did NOT use Wrapped APIs, it would just be a "payment form" and not demonstrate agentic behavior. The key differentiator is that the agent autonomously spends money to produce value -- both sides of the Locus stack must be visibly used.

---

## 4. Recommended Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js 14+ (App Router)** | Full-stack in one project, API routes for backend, React for frontend, great DX |
| Language | **TypeScript** | Type safety, better DX, fewer runtime bugs |
| Styling | **Tailwind CSS** | Fastest way to build good-looking UI for a hackathon |
| UI Components | **shadcn/ui** | Pre-built accessible components, works with Tailwind, copy-paste (no heavy deps) |
| Database | **SQLite via better-sqlite3** or **Turso** | Zero config, no external service needed, fast for MVP. Turso if remote DB needed for deployment |
| ORM | **Drizzle ORM** | Lightweight, type-safe, works great with SQLite and Turso |
| Checkout SDK | **@withlocus/checkout-react** | Official Locus checkout component |
| Job Processing | **In-process async** (no queue needed) | For MVP, trigger report generation in a fire-and-forget async function. No Redis/Bull needed for a single-server hackathon app |
| Deployment | **Vercel** | Zero-config Next.js deployment, free tier sufficient |
| Package Manager | **pnpm** | Fast, disk-efficient |

### Why NOT other choices
- **PostgreSQL/Supabase:** Overkill for MVP with ~100 orders max. SQLite is simpler.
- **Redis/Bull/BullMQ:** Overkill for job queue. Async function with DB-backed status tracking is sufficient.
- **Prisma:** Heavier than Drizzle, slower cold starts. Drizzle is leaner for this use case.
- **Express/Fastify separate server:** Unnecessary when Next.js API routes handle everything.

---

## 5. System Architecture

```
                        PAYBRIEF ARCHITECTURE
                        =====================

   [User Browser]
        |
        | (1) Lands on site, fills form
        v
   [Next.js Frontend]
        |
        | (2) POST /api/orders (create order)
        v
   [Next.js API Routes] -----(3) Create checkout session-----> [Locus API]
        |                                                          |
        | <-------------(4) Session ID returned--------------------
        |
        | (5) Render Locus Checkout component with session ID
        v
   [Locus Checkout Widget] -----(6) User pays 5 USDC-----> [Locus Payment]
                                                                |
                                                    (7) Payment confirmed
                                                                |
   [Next.js /api/webhooks/locus] <----(8) Webhook POST---------
        |
        | (9) Verify HMAC-SHA256 signature
        | (10) Update order status to PAID
        | (11) Trigger report generation (async)
        v
   [Report Generation Pipeline]
        |
        |---(12) Search via Exa---------> [Locus Wrapped API: Exa]
        |---(13) Scrape via Firecrawl----> [Locus Wrapped API: Firecrawl]
        |---(14) Synthesize via Gemini---> [Locus Wrapped API: Gemini]
        |
        | (15) Save completed report to DB
        | (16) Update order status to COMPLETED
        v
   [SQLite Database]
        ^
        |
   [Next.js /api/orders/[id]/status] <----(17) Frontend polls for status
        |
        | (18) Returns current status + report when ready
        v
   [User Browser] -- displays final report page
```

### Flow Summary
1. **Frontend** serves landing page, order form, checkout page, status page, report page
2. **API Routes** handle order creation, checkout session creation, webhook processing, status polling, report retrieval
3. **Database** (SQLite) stores orders, payment events, report jobs, completed reports
4. **Locus Checkout** handles payment UX and processing
5. **Locus Wrapped APIs** power the research pipeline
6. **Report Pipeline** runs as async server-side function triggered by webhook

### Polling Strategy
- Frontend polls `GET /api/orders/[id]/status` every 3 seconds
- Status transitions: `CREATED` -> `PAYING` -> `PAID` -> `RESEARCHING` -> `SYNTHESIZING` -> `COMPLETED` (or `FAILED`)
- Once `COMPLETED`, frontend redirects to `/report/[id]`

---

## 6. User Flow

### Step-by-step

1. **User lands on `paybrief.com`** -- sees hero: "Pay 5 USDC, get an AI-generated market brief in minutes"
2. **User clicks "Get Your Brief"** -- scrolls to or navigates to order form
3. **User fills the form:**
   - Company/product name (required)
   - Focus area: competitors / pricing / market overview / all (optional, default: all)
   - Email address (optional, for report link delivery)
4. **User clicks "Continue to Payment"** -- app creates order in DB, creates Locus checkout session, redirects to checkout page
5. **Checkout page renders Locus Checkout widget** -- user pays 5 USDC from their Locus wallet
6. **Payment completes** -- Locus redirects user to success/processing page at `/order/[id]/status`
7. **Webhook fires to `/api/webhooks/locus`** -- server verifies signature, marks order as PAID, starts report generation
8. **Processing page shows progress** -- polls API every 3s, shows steps: "Searching...", "Analyzing competitors...", "Writing brief..."
9. **Report generation completes** -- pipeline saves report to DB, marks order COMPLETED
10. **Processing page detects completion** -- redirects to `/report/[id]`
11. **Report page renders** -- polished brief with sections: Executive Summary, Competitor Overview, Pricing Analysis, Market Insights, Key Takeaways

### Error Flows
- **Payment fails/expires:** User sees error on checkout page, can retry
- **Webhook never arrives:** Order stays in PAYING state, processing page shows timeout message after 5 minutes
- **Report generation fails:** Order marked FAILED, user sees error with support contact
- **API rate limit / provider down:** Pipeline retries once, then fails gracefully with partial report if possible

---

## 7. Data Model

### Table: `orders`
| Field | Type | Purpose |
|-------|------|---------|
| `id` | TEXT (ULID) | Primary key, URL-safe unique ID |
| `company_name` | TEXT | The company/product the user wants researched |
| `focus_area` | TEXT | "competitors" / "pricing" / "market" / "all" |
| `email` | TEXT (nullable) | Optional email for delivery |
| `amount_usdc` | REAL | Payment amount (5.00) |
| `status` | TEXT | CREATED / PAYING / PAID / RESEARCHING / SYNTHESIZING / COMPLETED / FAILED |
| `checkout_session_id` | TEXT (nullable) | Locus checkout session ID |
| `locus_transaction_id` | TEXT (nullable) | Locus payment transaction ID |
| `error_message` | TEXT (nullable) | Error details if FAILED |
| `created_at` | TEXT (ISO 8601) | Order creation time |
| `updated_at` | TEXT (ISO 8601) | Last status update time |
| `completed_at` | TEXT (ISO 8601, nullable) | When report was delivered |

### Table: `reports`
| Field | Type | Purpose |
|-------|------|---------|
| `id` | TEXT (ULID) | Primary key |
| `order_id` | TEXT | FK to orders |
| `content_json` | TEXT (JSON) | Structured report content (sections, paragraphs, data points) |
| `content_markdown` | TEXT | Rendered markdown version of the report |
| `sources` | TEXT (JSON) | Array of URLs/sources used in research |
| `research_cost_usdc` | REAL | Total wrapped API spend for this report |
| `created_at` | TEXT (ISO 8601) | When report was generated |

### Table: `webhook_events`
| Field | Type | Purpose |
|-------|------|---------|
| `id` | TEXT (ULID) | Primary key |
| `event_type` | TEXT | Locus event type |
| `payload` | TEXT (JSON) | Raw webhook payload |
| `signature` | TEXT | HMAC signature received |
| `verified` | INTEGER (boolean) | Whether signature was valid |
| `processed` | INTEGER (boolean) | Whether event was acted on |
| `created_at` | TEXT (ISO 8601) | When received |

### Table: `api_costs`
| Field | Type | Purpose |
|-------|------|---------|
| `id` | TEXT (ULID) | Primary key |
| `order_id` | TEXT | FK to orders |
| `provider` | TEXT | "exa" / "firecrawl" / "gemini" / "openai" |
| `endpoint` | TEXT | Specific endpoint called |
| `cost_usdc` | REAL | Cost of this API call |
| `created_at` | TEXT (ISO 8601) | When call was made |

### Why these tables
- **orders**: Central entity tracking the full lifecycle from form submission to report delivery
- **reports**: Separated from orders because report content is large and may need independent access
- **webhook_events**: Audit trail for payment events, enables duplicate detection (idempotency)
- **api_costs**: Tracks per-report costs for the revenue/margin panel and debugging

---

## 8. Routes / Pages / API Endpoints

### Pages (Frontend)

| Route | Purpose | Auth | Notes |
|-------|---------|------|-------|
| `/` | Landing page + order form | None | Hero, value prop, form, CTA |
| `/checkout/[orderId]` | Locus Checkout widget | None | Shows checkout component with session ID |
| `/order/[orderId]/status` | Processing/status page | None | Polls for completion, shows progress |
| `/report/[reportId]` | Final report display | None | Rendered brief with sections |
| `/admin/costs` | Revenue/cost panel | Simple secret query param | Shows orders, revenue, API costs, margins |

### API Endpoints

| Endpoint | Method | Purpose | Input | Output | Auth |
|----------|--------|---------|-------|--------|------|
| `/api/orders` | POST | Create new order | `{ companyName, focusArea, email }` | `{ orderId, checkoutUrl }` | None |
| `/api/orders/[id]` | GET | Get order details | Order ID in URL | `{ order }` | None |
| `/api/orders/[id]/status` | GET | Poll order status | Order ID in URL | `{ status, progress, reportId? }` | None |
| `/api/webhooks/locus` | POST | Receive payment webhook | Locus webhook payload + HMAC header | `200 OK` | HMAC signature |
| `/api/reports/[id]` | GET | Get report content | Report ID in URL | `{ report }` | None |
| `/api/admin/costs` | GET | Get cost/revenue data | `?secret=ADMIN_SECRET` | `{ orders, totalRevenue, totalCost, margin }` | Secret query param |
| `/api/checkout/create-session` | POST | Create Locus checkout session | `{ orderId, amount }` | `{ sessionId }` | None (internal use) |

### Important Notes
- No user auth for MVP -- orders are accessed by their ULID (unguessable)
- Webhook endpoint must be publicly accessible (ngrok for dev, Vercel URL for prod)
- Admin costs endpoint uses a simple shared secret, not real auth
- Status polling endpoint should be lightweight (just returns status enum + optional progress message)

---

## 9. External Services & APIs Needed

### Required
| Service | Purpose | What You Need |
|---------|---------|---------------|
| **Locus API** | Checkout + Wrapped APIs + Wallet | API key (register via `POST /api/register` or beta.paywithlocus.com) |
| **Locus Checkout React SDK** | Frontend payment widget | `npm install @withlocus/checkout-react` |
| **Vercel** | Deployment | Free account, connect GitHub repo |

### Required (via Locus Wrapped APIs -- no separate accounts needed)
| Provider | Purpose | Locus Endpoint |
|----------|---------|----------------|
| **Exa** | Web search for competitor data | `/api/wrapped/exa/search` |
| **Firecrawl** | Scrape competitor websites/pricing pages | `/api/wrapped/firecrawl/scrape` |
| **Gemini** | Synthesize research into coherent brief | `/api/wrapped/gemini/chat` |

### Optional
| Service | Purpose | When |
|---------|---------|------|
| **Turso** | Remote SQLite if Vercel serverless needs persistent DB | If local SQLite doesn't work on Vercel |
| **Resend** (via Locus) | Email report link to user | If time permits |
| **OpenAI** (via Locus) | Alternative/supplement to Gemini for synthesis | If Gemini quality insufficient |

### Details You Must Provide Before Building

#### A. Locus Credentials/Config
- [x] **Locus API Key** -- `claw_dev_Yb8nCNhv2crhVRCy5PDblMAamEY9HZtP`
- [ ] **Locus Webhook Secret** -- for HMAC-SHA256 verification (check Locus dashboard for `whsec_*` value)
- [ ] **Locus Wallet funded** -- currently 0.0 USDC, 15 USDC credits requested (pending approval)
- [x] **Checkout session creation endpoint** -- CONFIRMED: `POST /api/checkout/sessions` with `{amount, description, webhookUrl, successUrl, cancelUrl, metadata}`

#### B. Database/Deployment
- [ ] **Vercel account** connected to GitHub
- [ ] **Database choice confirmed** -- SQLite local or Turso remote (depends on Vercel constraints)
- [ ] **Turso credentials** (if using Turso) -- database URL + auth token

#### C. Research Pipeline
- [x] **Confirm Exa is available** -- YES, `/api/wrapped/exa/search` responds (blocked only by zero balance)
- [x] **Confirm Firecrawl is available** -- YES, `/api/wrapped/firecrawl/search` responds (blocked only by zero balance)
- [x] **Confirm Gemini is available** -- YES, listed in wrapped API index, `/api/wrapped/gemini/chat`
- [ ] **Test each wrapped API with funded wallet** -- waiting for credits approval

#### D. Branding/Content
- [ ] **App name confirmed:** PayBrief (or change?)
- [ ] **Tagline confirmed:** "Pay 5 USDC, get an AI-generated market brief in minutes"
- [ ] **Color scheme / brand direction** (or use default dark/blue theme)
- [ ] **Landing page copy** (or let AI generate during build)

#### E. Pricing & Business Rules
- [ ] **Price per report:** 5 USDC (confirm)
- [ ] **Max research time before timeout:** 3 minutes? 5 minutes?
- [ ] **Max sources to scrape per report:** 5? 10?
- [ ] **Report sections:** Executive Summary, Competitors, Pricing, Market, Takeaways (confirm)

#### F. Demo/Submission
- [ ] **Devfolio submission URL:** https://paygentic-week1.devfolio.co/
- [ ] **Demo video format/length** requirements
- [ ] **Any required screenshots or documentation**

---

## 10. "DETAILS I NEED FROM YOU" Section

Fill in the values below before implementation starts.

### A. Locus Credentials/Config

| Item | Why Needed | Recommended Default | My Value |
|------|-----------|-------------------|----------|
| Locus API Key | Auth for all Locus API calls | Register via API or beta portal | `claw_dev_Yb8nCNhv2crhVRCy5PDblMAamEY9HZtP` |
| Locus Webhook Secret | HMAC-SHA256 webhook verification | Found in Locus dashboard | `[TO FILL - check dashboard for whsec_*]` |
| Locus API Base URL | API calls target | `https://beta-api.paywithlocus.com/api` | `https://beta-api.paywithlocus.com/api` |
| Wallet has USDC balance? | Wrapped APIs cost money | Request hackathon credits | NO - 15 USDC requested, pending |
| Checkout session creation tested? | Must work before building around it | Test manually first | YES - confirmed working |

### B. Database/Deployment

| Item | Why Needed | Recommended Default | My Value |
|------|-----------|-------------------|----------|
| Database choice | Determines ORM config | Turso (works on Vercel serverless) | `[TO FILL]` |
| Turso DB URL | Database connection | Create at turso.tech | `[TO FILL]` |
| Turso Auth Token | Database auth | From Turso dashboard | `[TO FILL]` |
| Vercel project name | Deployment target | `paybrief` | `[TO FILL]` |
| Production URL | Webhook callback, redirects | `https://paybrief.vercel.app` | `[TO FILL]` |
| GitHub repo URL | Vercel deploys from here | This repo | `[TO FILL]` |

### C. Research Pipeline Choices

| Item | Why Needed | Recommended Default | My Value |
|------|-----------|-------------------|----------|
| Search provider | Finding competitor info | Exa via Locus Wrapped | `[TO FILL]` |
| Scraping provider | Reading competitor pages | Firecrawl via Locus Wrapped | `[TO FILL]` |
| Synthesis LLM | Writing the brief | Gemini via Locus Wrapped | `[TO FILL]` |
| Max sources per report | Cost control | 8 | `[TO FILL]` |
| Max scrape pages | Cost control | 5 | `[TO FILL]` |

### D. Branding/Content

| Item | Why Needed | Recommended Default | My Value |
|------|-----------|-------------------|----------|
| App name | Displayed everywhere | PayBrief | `[TO FILL]` |
| Tagline | Landing page hero | "AI market briefs in minutes" | `[TO FILL]` |
| Color theme | UI design | Dark theme, blue accent | `[TO FILL]` |
| Logo | Header/favicon | Text-only logo for MVP | `[TO FILL]` |

### E. Pricing and Business Rules

| Item | Why Needed | Recommended Default | My Value |
|------|-----------|-------------------|----------|
| Price per brief | Checkout amount | 5 USDC | `[TO FILL]` |
| Generation timeout | When to mark as FAILED | 5 minutes | `[TO FILL]` |
| Report sections | Report structure | Overview, Competitors, Pricing, Market, Takeaways | `[TO FILL]` |
| Retry on API failure? | Pipeline resilience | Yes, 1 retry per step | `[TO FILL]` |

### F. Demo/Submission Preferences

| Item | Why Needed | Recommended Default | My Value |
|------|-----------|-------------------|----------|
| Demo video length | Submission constraints | 3 minutes | `[TO FILL]` |
| Live demo or recorded? | Submission format | Recorded | `[TO FILL]` |
| Show code walkthrough? | Judges want to see integration depth | Yes, briefly | `[TO FILL]` |

---

## 11. ENV Variables Checklist

```env
# === Locus ===
LOCUS_API_KEY=
LOCUS_WEBHOOK_SECRET=
LOCUS_API_BASE_URL=https://beta-api.paywithlocus.com/api

# === Database ===
# Option A: Turso (recommended for Vercel)
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
# Option B: Local SQLite (dev only)
# DATABASE_PATH=./data/paybrief.db

# === App ===
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=PayBrief
ADMIN_SECRET=change-me-to-something-random

# === Pricing ===
BRIEF_PRICE_USDC=5

# === Pipeline Config ===
MAX_SOURCES_PER_REPORT=8
MAX_SCRAPE_PAGES=5
GENERATION_TIMEOUT_MS=300000
SYNTHESIS_PROVIDER=gemini

# === Optional ===
# RESEND_API_KEY= (if using email delivery via Locus Wrapped)
```

---

## 12. Step-by-Step Build Plan

### Phase 0 -- Repo Setup & Tooling

**Goal:** Initialize the project with Next.js, TypeScript, Tailwind, and all dependencies.

**Tasks:**
1. Initialize Next.js 14+ project with App Router, TypeScript, Tailwind, ESLint
2. Install dependencies: `@withlocus/checkout-react`, `drizzle-orm`, `@libsql/client` (Turso), `ulid`, `shadcn/ui`
3. Set up project structure:
   ```
   src/
     app/
       page.tsx                    # Landing page
       checkout/[orderId]/page.tsx # Checkout page
       order/[orderId]/status/page.tsx # Status/processing page
       report/[reportId]/page.tsx  # Report display page
       admin/costs/page.tsx        # Cost panel
       api/
         orders/route.ts           # POST create order
         orders/[id]/route.ts      # GET order details
         orders/[id]/status/route.ts # GET order status
         webhooks/locus/route.ts   # POST webhook handler
         reports/[id]/route.ts     # GET report
         admin/costs/route.ts      # GET cost data
         checkout/create-session/route.ts # POST create Locus session
     lib/
       db/
         schema.ts                 # Drizzle schema
         index.ts                  # DB connection
         migrate.ts                # Migration runner
       locus/
         client.ts                 # Locus API client
         checkout.ts               # Checkout session helpers
         webhook.ts                # Webhook verification
         wrapped.ts                # Wrapped API calls
       pipeline/
         research.ts               # Exa search
         scrape.ts                 # Firecrawl scrape
         synthesize.ts             # Gemini/OpenAI synthesis
         orchestrator.ts           # Full pipeline coordinator
       utils.ts                    # ULID generation, helpers
     components/
       ui/                         # shadcn components
       order-form.tsx
       checkout-widget.tsx
       status-tracker.tsx
       report-view.tsx
       cost-panel.tsx
   ```
4. Set up `.env.local` with placeholder values
5. Set up `drizzle.config.ts`
6. Initialize git, create `.gitignore`

**Files created:** ~15 skeleton files + config files
**Dependencies:** None (fresh start)
**Acceptance criteria:** `pnpm dev` starts without errors, shows blank Next.js page
**Manual info needed:** None yet
**Risks:** `@withlocus/checkout-react` might not install cleanly -- check npm registry

---

### Phase 1 -- Database Schema & Connection

**Goal:** Set up Turso/SQLite database with Drizzle ORM and all tables.

**Tasks:**
1. Define Drizzle schema for `orders`, `reports`, `webhook_events`, `api_costs` tables
2. Set up Turso client connection (with fallback to local SQLite for dev)
3. Create and run initial migration
4. Write basic CRUD helper functions for orders

**Files created/edited:**
- `src/lib/db/schema.ts` -- full schema
- `src/lib/db/index.ts` -- connection setup
- `drizzle.config.ts` -- migration config
- `src/lib/db/queries.ts` -- helper queries

**Dependencies:** Phase 0 complete
**Acceptance criteria:** Can create and read orders from DB in a test script
**Manual info needed:** Turso credentials (or use local SQLite for now)
**Risks:** Turso connection issues on cold start; mitigate with connection pooling

---

### Phase 2 -- Landing Page & Order Form

**Goal:** Build the landing page with hero section and functional order form.

**Tasks:**
1. Build landing page layout: hero, value proposition, how-it-works section
2. Build order form component: company name input, focus area selector, email input
3. Add form validation (company name required, email format if provided)
4. Style with Tailwind -- dark theme, professional look
5. Wire form submission to create order API (Phase 3)

**Files created/edited:**
- `src/app/page.tsx` -- landing page
- `src/components/order-form.tsx` -- form component
- `src/app/globals.css` -- global styles / theme

**Dependencies:** Phase 0 complete
**Acceptance criteria:** Landing page renders, form validates inputs, looks professional
**Manual info needed:** Branding preferences (or use defaults)
**Risks:** None significant

---

### Phase 3 -- Order Creation API

**Goal:** POST endpoint that creates an order in the database and returns an order ID.

**Tasks:**
1. Implement `POST /api/orders` route
2. Validate request body
3. Generate ULID for order ID
4. Insert order into database with status `CREATED`
5. Return `{ orderId }` to frontend
6. Wire order form to call this endpoint on submit
7. After successful creation, redirect to checkout page

**Files created/edited:**
- `src/app/api/orders/route.ts`
- `src/components/order-form.tsx` (wire up API call)

**Dependencies:** Phase 1 (database), Phase 2 (form UI)
**Acceptance criteria:** Submitting form creates a row in orders table, redirects to `/checkout/[orderId]`
**Manual info needed:** None
**Risks:** None significant

---

### Phase 4 -- Locus Checkout Integration

**Goal:** Create Locus checkout sessions and render the checkout widget.

**Tasks:**
1. Implement Locus API client (`src/lib/locus/client.ts`) with auth header
2. Implement checkout session creation (`POST /api/checkout/create-session`)
   - Calls Locus API to create a checkout session for 5 USDC
   - Stores `checkout_session_id` on the order
   - Updates order status to `PAYING`
3. Build checkout page (`/checkout/[orderId]`)
   - Fetches order details
   - Renders `@withlocus/checkout-react` component with session ID
   - Handles success/failure callbacks
4. On checkout success callback, redirect to `/order/[orderId]/status`

**Files created/edited:**
- `src/lib/locus/client.ts`
- `src/lib/locus/checkout.ts`
- `src/app/api/checkout/create-session/route.ts`
- `src/app/checkout/[orderId]/page.tsx`
- `src/components/checkout-widget.tsx`

**Dependencies:** Phase 3 (order exists in DB), Locus API key
**Acceptance criteria:** User can click "Pay", Locus Checkout widget renders, payment can be initiated
**Manual info needed:** `LOCUS_API_KEY`, confirm checkout session creation API works
**Risks:**
- `@withlocus/checkout-react` SDK may have undocumented requirements
- Checkout session creation API format may differ from docs -- fetch `CHECKOUT.md` via API after registration to get exact spec
- **Mitigation:** Test checkout session creation manually first with curl

---

### Phase 5 -- Webhook Handler

**Goal:** Receive and verify Locus payment webhooks, update order status.

**Tasks:**
1. Implement HMAC-SHA256 webhook verification (`src/lib/locus/webhook.ts`)
2. Implement `POST /api/webhooks/locus` route
   - Read raw body for signature verification
   - Verify signature against `LOCUS_WEBHOOK_SECRET`
   - Parse event payload
   - Store event in `webhook_events` table
   - Check for duplicate events (idempotency)
   - Update order status to `PAID`
   - Trigger report generation (async, non-blocking)
   - Return 200 immediately
3. Test with ngrok or Vercel preview URL

**Files created/edited:**
- `src/lib/locus/webhook.ts`
- `src/app/api/webhooks/locus/route.ts`

**Dependencies:** Phase 4 (checkout creates a payment that triggers webhook), ngrok for local dev
**Acceptance criteria:** Webhook arrives, signature verified, order status updates to PAID
**Manual info needed:** `LOCUS_WEBHOOK_SECRET`, webhook URL configured in Locus dashboard
**Risks:**
- Webhook format may not match expectations -- log raw payloads
- HMAC verification may require specific header name -- check Locus docs
- **Mitigation:** Log everything, verify manually first

---

### Phase 6 -- Processing/Status Page

**Goal:** Show the user their order status with live updates.

**Tasks:**
1. Implement `GET /api/orders/[id]/status` route (returns status + progress message)
2. Build status page (`/order/[orderId]/status`)
   - Shows order details
   - Polls status endpoint every 3 seconds
   - Displays progress steps with visual indicators
   - On COMPLETED, redirects to report page
   - On FAILED, shows error message
3. Progress steps UI: "Payment confirmed" -> "Researching..." -> "Analyzing..." -> "Writing brief..." -> "Complete!"

**Files created/edited:**
- `src/app/api/orders/[id]/status/route.ts`
- `src/app/order/[orderId]/status/page.tsx`
- `src/components/status-tracker.tsx`

**Dependencies:** Phase 5 (order can transition to PAID)
**Acceptance criteria:** Page shows current status, updates in real-time, redirects on completion
**Manual info needed:** None
**Risks:** Polling might miss fast transitions -- ensure all states are persisted to DB

---

### Phase 7 -- Research Pipeline (Wrapped APIs)

**Goal:** Build the agent pipeline that searches, scrapes, and synthesizes a market brief.

**Tasks:**
1. Implement Locus Wrapped API client (`src/lib/locus/wrapped.ts`)
   - Generic function to call any wrapped API
   - Track costs per call in `api_costs` table
2. Implement Exa search step (`src/lib/pipeline/research.ts`)
   - Search for: "[company] competitors", "[company] pricing", "[company] market"
   - Return top results with URLs and snippets
3. Implement Firecrawl scrape step (`src/lib/pipeline/scrape.ts`)
   - Scrape top N URLs from search results
   - Extract relevant text content
4. Implement Gemini synthesis step (`src/lib/pipeline/synthesize.ts`)
   - Send scraped content + search snippets to Gemini
   - Prompt: generate structured brief with sections
   - Return structured JSON + markdown
5. Implement pipeline orchestrator (`src/lib/pipeline/orchestrator.ts`)
   - Coordinates: search -> scrape -> synthesize
   - Updates order status at each step (RESEARCHING -> SYNTHESIZING -> COMPLETED)
   - Handles errors gracefully
   - Saves report to `reports` table
   - Records all API costs
6. Wire orchestrator to be triggered from webhook handler (Phase 5)

**Files created/edited:**
- `src/lib/locus/wrapped.ts`
- `src/lib/pipeline/research.ts`
- `src/lib/pipeline/scrape.ts`
- `src/lib/pipeline/synthesize.ts`
- `src/lib/pipeline/orchestrator.ts`

**Dependencies:** Phase 5 (webhook triggers pipeline), Locus Wrapped APIs accessible
**Acceptance criteria:** Given a company name, pipeline produces a structured brief with real data from web sources
**Manual info needed:** Confirm Exa, Firecrawl, Gemini are available on your Locus account
**Risks:**
- Wrapped API endpoints may have different input formats than expected -- fetch provider docs via `GET /api/wrapped/md?provider={name}`
- Rate limiting on wrapped APIs
- Poor quality scrape results
- **Mitigation:** Test each wrapped API individually first, build fallback for scrape failures, tune Gemini prompt

---

### Phase 8 -- Report Display Page

**Goal:** Render the completed brief as a polished, readable page.

**Tasks:**
1. Implement `GET /api/reports/[id]` route
2. Build report page (`/report/[reportId]`)
   - Fetch report content
   - Render markdown sections with nice typography
   - Show: Executive Summary, Competitor Overview, Pricing Analysis, Market Insights, Key Takeaways
   - Show sources list at bottom
   - Show generation metadata (time taken, date)
3. Style for readability -- good typography, section headers, card layouts

**Files created/edited:**
- `src/app/api/reports/[id]/route.ts`
- `src/app/report/[reportId]/page.tsx`
- `src/components/report-view.tsx`

**Dependencies:** Phase 7 (reports exist in DB)
**Acceptance criteria:** Report page renders beautifully with all sections, sources cited
**Manual info needed:** None
**Risks:** Markdown rendering quality -- use `react-markdown` or similar

---

### Phase 9 -- Cost/Revenue Panel

**Goal:** Simple admin view showing business metrics.

**Tasks:**
1. Implement `GET /api/admin/costs` route (protected by `ADMIN_SECRET`)
2. Build admin page (`/admin/costs?secret=xxx`)
   - Total orders
   - Total revenue (orders * 5 USDC)
   - Total API costs (sum of api_costs)
   - Net margin per report
   - List of recent orders with status and cost breakdown

**Files created/edited:**
- `src/app/api/admin/costs/route.ts`
- `src/app/admin/costs/page.tsx`
- `src/components/cost-panel.tsx`

**Dependencies:** Phase 7 (cost tracking data exists)
**Acceptance criteria:** Panel shows accurate revenue vs. cost data
**Manual info needed:** `ADMIN_SECRET` value
**Risks:** None significant

---

### Phase 10 -- Polish & Demo Flow

**Goal:** Make everything look and feel demo-ready.

**Tasks:**
1. Polish landing page copy and design
2. Add loading states and error boundaries everywhere
3. Add smooth transitions between pages
4. Add favicon and meta tags
5. Test full end-to-end flow: form -> pay -> wait -> report
6. Fix any UI issues or broken flows
7. Create a sample/demo report for the landing page (optional)
8. Add simple footer with "Built with Locus" badge

**Files edited:** Various UI files
**Dependencies:** All previous phases
**Acceptance criteria:** Full flow works smoothly, looks professional
**Manual info needed:** None
**Risks:** Edge cases in payment flow, race conditions in status updates

---

### Phase 11 -- Deploy & Test Production

**Goal:** Deploy to Vercel, configure production webhook URL, test real payment.

**Tasks:**
1. Push to GitHub
2. Connect to Vercel, deploy
3. Set all env vars in Vercel dashboard
4. Update Locus webhook URL to production URL
5. Test full flow on production with real USDC payment
6. Verify webhook arrives and report generates
7. Fix any production-only issues

**Files edited:** Possibly env configs
**Dependencies:** All previous phases, Vercel account, GitHub repo
**Acceptance criteria:** Full flow works in production with real payment
**Manual info needed:** Vercel account, production domain
**Risks:** Vercel serverless function timeouts (default 10s -- may need to increase for pipeline), SQLite not working on serverless (switch to Turso)

---

### Phase 12 -- Record Demo & Submit

**Goal:** Create submission video and submit to Devfolio.

**Tasks:**
1. Plan demo script (see Section 14)
2. Record demo video showing full flow
3. Brief code walkthrough showing Locus integration points
4. Submit to Devfolio with:
   - Video link
   - GitHub repo link
   - Live app URL
   - Description highlighting Locus usage

**Dependencies:** Phase 11 (production deployment working)
**Acceptance criteria:** Submission is live on Devfolio
**Manual info needed:** Devfolio account, video recording tool
**Risks:** Time pressure -- record early, polish later

---

## 13. Testing Plan

### Manual Test Cases

#### Checkout Initiation
- [ ] Fill form with valid company name -> order created in DB
- [ ] Click pay -> Locus Checkout widget appears
- [ ] Invalid/empty company name -> form shows validation error

#### Successful Payment
- [ ] Complete payment -> checkout success callback fires
- [ ] User redirected to status page
- [ ] Order status updates from CREATED -> PAYING -> PAID

#### Webhook Handling
- [ ] Webhook arrives -> signature verified successfully
- [ ] Order status updates to PAID
- [ ] Report generation triggered
- [ ] Webhook event stored in webhook_events table

#### Duplicate Webhook Protection
- [ ] Send same webhook twice -> second is stored but not re-processed
- [ ] Order status not affected by duplicate
- [ ] No duplicate report generation

#### Failed/Expired Payment
- [ ] User closes checkout without paying -> order stays in CREATED/PAYING
- [ ] Status page shows appropriate message
- [ ] No report generation triggered

#### Report Job Processing
- [ ] Pipeline starts after PAID status
- [ ] Status transitions: RESEARCHING -> SYNTHESIZING -> COMPLETED
- [ ] Each transition visible on status page
- [ ] Report saved to reports table with all sections

#### Provider/API Failure
- [ ] If Exa fails -> pipeline retries once, then fails gracefully
- [ ] If Firecrawl fails -> pipeline uses search snippets only, marks partial
- [ ] If Gemini fails -> order marked FAILED with error message
- [ ] Failed order shows error on status page

#### Final Report Rendering
- [ ] Report page loads with all sections
- [ ] Sources are listed and clickable
- [ ] Markdown renders correctly (headers, lists, bold)
- [ ] Page is responsive on mobile

#### Cost Tracking
- [ ] Each wrapped API call logged in api_costs table
- [ ] Admin panel shows correct totals
- [ ] Per-report cost breakdown is accurate

---

## 14. Demo Plan for Judges

### Demo Script (~3 minutes)

**0:00-0:15 -- Hook**
"PayBrief lets you pay 5 USDC and get an AI-generated competitive intelligence brief in minutes. Here's how it works."

**0:15-0:45 -- Show the Product**
- Open PayBrief landing page
- Fill in "Stripe" as the company name
- Select "All" as focus area
- Click "Get Your Brief"

**0:45-1:15 -- Show Locus Checkout**
- Locus Checkout widget appears
- Complete the 5 USDC payment
- "This payment goes through Locus Checkout -- USDC on Base chain"
- Payment confirms

**1:15-2:00 -- Show Agent Working**
- Processing page with live status updates
- "Behind the scenes, an AI agent is now SPENDING money through Locus Wrapped APIs"
- "It's using Exa to search for Stripe's competitors..."
- "Firecrawl to scrape pricing pages..."
- "And Gemini to synthesize everything into a brief"
- Report completes

**2:00-2:30 -- Show the Report**
- Walk through the generated brief
- Point out: competitor list, pricing comparison, market insights
- "This was generated autonomously -- no human in the loop"

**2:30-2:50 -- Show the Business Model**
- Open cost panel
- "Revenue: 5 USDC per brief. Cost: ~0.30 USDC in API calls. That's a 94% margin."
- "Money flows IN through Locus Checkout, and OUT through Locus Wrapped APIs"

**2:50-3:00 -- Close**
- "PayBrief demonstrates the full agentic commerce loop: earn, spend, deliver value."
- "Built in 2 days for the Paygentic hackathon."

### Key Judging Points to Hit
1. **Technical execution:** Clean checkout flow, reliable webhook handling, working pipeline
2. **Real-world applicability:** People actually need competitive intelligence
3. **Innovation:** Autonomous agent that earns and spends money
4. **Agent autonomy:** Agent decides what to search, what to scrape, how to synthesize
5. **Locus depth:** Both Checkout AND Wrapped APIs used in core flow

---

## 15. Fallback Plan

### Minimum Viable Submission (if time is critically short)

If you can only ship a subset, prioritize in this order:

1. **MUST HAVE:** Landing page + order form + Locus Checkout working (payment goes through)
2. **MUST HAVE:** Webhook receives and verifies payment
3. **MUST HAVE:** At least ONE Locus Wrapped API call (even just Exa search)
4. **MUST HAVE:** Some output displayed to the user (even if it's just raw search results formatted nicely)
5. **NICE:** Full pipeline with scraping + synthesis
6. **NICE:** Polished report page
7. **NICE:** Cost panel
8. **CUT FIRST:** Email delivery, PDF export, sample reports

### What Can Be Cut
| Feature | Cut Impact | When to Cut |
|---------|-----------|-------------|
| Cost panel | Low -- judges can see Locus usage without it | If behind by 4+ hours |
| Firecrawl scraping | Medium -- can rely on search snippets only | If Firecrawl API issues |
| Email delivery | None -- not in MVP spec | Already cut |
| PDF export | None -- not in MVP spec | Already cut |
| Polished UI | Medium -- function over form | If behind by 2+ hours |
| Multiple focus areas | Low -- default to "all" | If behind by 1+ hour |

### Emergency Fallback Architecture
If the full pipeline proves too complex:
- Skip Firecrawl entirely
- Use only Exa search results
- Feed search snippets directly to Gemini for synthesis
- This still demonstrates Checkout + 2 Wrapped APIs

---

## 16. Cursor Execution Rules for Later

When implementing this plan:

1. **Build phase by phase.** Do not skip ahead. Each phase builds on the previous.
2. **After each phase, verify acceptance criteria.** Do not proceed until the current phase works.
3. **Do not overbuild.** Implement exactly what the phase specifies, nothing more.
4. **Prioritize working end-to-end flow.** A rough but complete flow beats a polished but incomplete one.
5. **Do not add random features.** No auth, no teams, no dashboards, no extras unless specified.
6. **Do not silently change architecture.** If you need to deviate from this plan, document why before proceeding.
7. **Test with real Locus APIs early.** Don't build the whole pipeline against mock data -- test each Locus integration as soon as it's built.
8. **Commit after each phase.** Small, working increments.
9. **If blocked on Locus API issues,** move to the next phase and come back. Don't waste hours on one integration.
10. **Keep the database simple.** Do not add tables or fields not in this plan unless absolutely necessary.
11. **Fetch Locus dynamic docs** (`CHECKOUT.md`, `SKILL.md`) after registration to get the most current API specs -- the research in this plan may be slightly outdated.
12. **For the checkout widget:** If `@withlocus/checkout-react` doesn't work as expected, fall back to redirect-based checkout (send user to a Locus-hosted checkout page).

---

## APPENDIX A -- Verified Locus API Reference (Tested 2026-04-12)

All endpoints verified against `https://beta-api.paywithlocus.com/api` with API key `claw_dev_*`.

### Checkout Session Creation (CONFIRMED WORKING)

```
POST https://beta-api.paywithlocus.com/api/checkout/sessions
Authorization: Bearer {LOCUS_API_KEY}
Content-Type: application/json

Request:
{
  "amount": "5.00",              // required - string
  "description": "PayBrief market brief",  // optional
  "webhookUrl": "https://...",   // optional - receives checkout.session.paid / expired
  "successUrl": "https://...",   // optional - redirect after payment
  "cancelUrl": "https://...",    // optional - redirect on cancel
  "metadata": { "orderId": "..." },  // optional
  "expiresInMinutes": 30,        // optional
  "receiptConfig": { "enabled": true, "merchantName": "PayBrief" },
  "idempotencyKey": "..."        // optional
}

Response (200):
{
  "success": true,
  "data": {
    "id": "05a068bf-...",
    "checkoutUrl": "https://beta-checkout.paywithlocus.com/{id}",
    "amount": "5",
    "currency": "USDC",
    "status": "PENDING",
    "expiresAt": "2026-04-12T17:13:59.147Z"
  }
}
```

### Checkout Session Retrieval

```
GET https://beta-api.paywithlocus.com/api/checkout/sessions/{SESSION_ID}
Authorization: Bearer {LOCUS_API_KEY}

Response includes: id, amount, currency, description, status, expiresAt,
sellerWalletAddress, paymentTxHash (if paid), paidAt (if paid)
```

### React SDK: @withlocus/checkout-react (v1.2.0)

```tsx
import { LocusCheckout } from '@withlocus/checkout-react';

<LocusCheckout
  sessionId={sessionId}           // required
  mode="embedded"                  // "embedded" | "popup" | "redirect"
  onSuccess={(data) => {}}         // { sessionId, amount, currency, txHash, payerAddress, paidAt }
  onCancel={() => {}}
  onError={(error) => {}}
  style={{}}
  className=""
/>
```

Hook alternative:
```tsx
import { useLocusCheckout } from '@withlocus/checkout-react';
const { openPopup, redirectToCheckout, getCheckoutUrl } = useLocusCheckout();
```

Hosted checkout URL format: `https://beta-checkout.paywithlocus.com/{sessionId}`

### Webhook Events

Events: `checkout.session.paid`, `checkout.session.expired`
Verification: HMAC-SHA256 with webhook secret (prefix `whsec_`)

```typescript
// Payload shape:
{
  event: "checkout.session.paid" | "checkout.session.expired",
  data: {
    sessionId: string,
    amount: string,
    currency: string,
    paymentTxHash?: string,    // on paid
    payerAddress?: string,     // on paid
    paidAt?: string,           // on paid
    metadata?: Record<string, string>
  },
  timestamp: string
}
```

### Wrapped APIs (all return 403 "Insufficient USDC balance" when wallet empty -- endpoints confirmed working)

**Exa Search** -- $0.01/call
```
POST /api/wrapped/exa/search
{ "query": "...", "numResults": 10, "type": "neural" }
```

**Exa Contents** -- $0.004/page
```
POST /api/wrapped/exa/contents
{ "urls": ["..."] }
```

**Firecrawl Scrape** -- $0.003+/page
```
POST /api/wrapped/firecrawl/scrape
{ "url": "..." }
```

**Firecrawl Search** -- $0.005/call
```
POST /api/wrapped/firecrawl/search
{ "query": "...", "limit": 5 }
```

**Gemini Chat** -- ~$0.003-0.15/call
```
POST /api/wrapped/gemini/chat
{
  "model": "gemini-2.5-flash",
  "messages": [{ "role": "user", "content": "..." }],
  "systemInstruction": "...",
  "maxOutputTokens": 8192,
  "temperature": 0.7
}
```

### Wallet & Balance

```
GET /api/pay/balance
Authorization: Bearer {LOCUS_API_KEY}

Response: { "success": true, "data": { "wallet_address": "0x...", "usdc_balance": "0.0" } }
```

### Gift Code / Hackathon Credits

```
POST /api/gift-code-requests
{ "reason": "...", "githubUrl": "https://...", "requestedAmountUsdc": 15 }
```

Credit request submitted (ID: bb831c6e-35a7-461e-96bd-697b360151c3). Pending Locus team approval.

### Locus Brand Constants (from SDK)

- Primary color: `#4101F6` (violet)
- CTA gradient: `linear-gradient(180deg, #5934FF 0%, #4101F6 100%)`
- Font: Suisse Intl

---

## APPENDIX B -- Current Environment Status

| Item | Status | Value |
|------|--------|-------|
| API Key | Active | `claw_dev_Yb8nCNhv2crhVRCy5PDblMAamEY9HZtP` |
| Wallet Address | Active | `0x5915aeb0a8a06eaf92f067076c95e5b44dedaf96` (Locus-managed) |
| Owner Wallet | Backup | `0x65e1693F1E9D8aBD2764aF846A7581E903337D8F` (from registration) |
| USDC Balance | 0.0 | Credits requested (15 USDC), pending approval |
| Checkout Sessions | Working | Tested successfully |
| Wrapped APIs | Working | Return 403 only due to zero balance (expected) |
| Webhook Secret | NEEDED | Must be obtained from Locus dashboard |
| Node.js | v20.19.6 | At /opt/homebrew/bin/node |
| npm | Available | At /opt/homebrew/bin/npm |
| pnpm | Not installed | Install via `npm install -g pnpm` |

### Blockers Before Phase 4+
1. **USDC balance = 0** -- Cannot test wrapped APIs or complete real checkout payments until credits are approved
2. **Webhook secret unknown** -- Check Locus dashboard at beta.paywithlocus.com for `whsec_*` value
3. **No pnpm** -- Need to install it or use npm instead

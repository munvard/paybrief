# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PayBrief — a web app where users pay 5 USDC via Locus Checkout and receive an AI-generated competitive intelligence / market brief. Built for the Locus Paygentic Hackathon (Week 1).

The full implementation plan is in `docs/PAYBRIEF_BUILD_PLAN.md`. Build phase-by-phase, verify acceptance criteria after each phase, do not skip ahead.

## Tech Stack

- Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui
- Drizzle ORM with Turso (libSQL) for database
- Locus Checkout SDK (`@withlocus/checkout-react`) for payments
- Locus Wrapped APIs for research pipeline (Exa, Firecrawl, Gemini)
- pnpm as package manager

## Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm lint         # ESLint
pnpm db:generate  # Generate Drizzle migrations
pnpm db:migrate   # Run migrations
pnpm db:studio    # Open Drizzle Studio (DB browser)
```

## Architecture

```
src/
  app/                          # Next.js App Router pages + API routes
    api/
      orders/                   # Order CRUD + status polling
      webhooks/locus/           # Locus payment webhook (HMAC-SHA256 verified)
      checkout/create-session/  # Creates Locus checkout sessions
      reports/                  # Report content retrieval
      admin/costs/              # Revenue/cost panel
  lib/
    db/                         # Drizzle schema, connection, queries
    locus/                      # Locus API client, checkout, webhook verification, wrapped API calls
    pipeline/                   # Research pipeline: search (Exa) → scrape (Firecrawl) → synthesize (Gemini)
  components/                   # React components (order form, checkout widget, status tracker, report view)
```

### Core Flow

1. User submits order form → `POST /api/orders` creates order in DB
2. Redirect to checkout page → Locus Checkout widget renders
3. User pays 5 USDC → Locus sends webhook to `POST /api/webhooks/locus`
4. Webhook handler verifies HMAC, marks order PAID, triggers pipeline async
5. Pipeline calls Locus Wrapped APIs (Exa → Firecrawl → Gemini), updates status at each step
6. Completed report saved to DB, status page polls and redirects to report page

### Key Tables

- `orders` — lifecycle tracking (CREATED → PAYING → PAID → RESEARCHING → SYNTHESIZING → COMPLETED/FAILED)
- `reports` — structured brief content (JSON + markdown) with sources
- `webhook_events` — audit trail for idempotent webhook processing
- `api_costs` — per-call cost tracking for wrapped API spend

## Locus Integration (Verified)

- **API Base:** `https://beta-api.paywithlocus.com/api`
- **Auth:** `Authorization: Bearer {LOCUS_API_KEY}` on all requests (key prefix: `claw_`)
- **Create checkout session:** `POST /api/checkout/sessions` with `{amount, description, webhookUrl, successUrl, cancelUrl, metadata}`
- **Checkout hosted URL:** `https://beta-checkout.paywithlocus.com/{sessionId}`
- **React SDK:** `@withlocus/checkout-react` — `<LocusCheckout sessionId={id} mode="embedded" onSuccess={...} />`
- **Webhook events:** `checkout.session.paid`, `checkout.session.expired` — verify HMAC-SHA256 with `whsec_*` secret
- **Wrapped API pattern:** `POST /api/wrapped/{provider}/{endpoint}` — providers: exa, firecrawl, gemini, openai, etc.
- **Wrapped API docs index:** `https://beta.paywithlocus.com/wapi/index.md`
- **Full API reference:** See `docs/PAYBRIEF_BUILD_PLAN.md` Appendix A

## Conventions

- Order IDs use ULIDs (URL-safe, sortable, unguessable — no auth needed for order/report access)
- No user authentication in MVP — security through unguessable IDs
- Admin routes use `ADMIN_SECRET` query param, not real auth
- Report generation runs as async fire-and-forget from webhook handler (no job queue)
- All Locus Wrapped API calls must be logged to `api_costs` table for margin tracking

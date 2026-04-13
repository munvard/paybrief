# Agent Zero — Autonomous AI Research Council

> 3 AI specialist agents research independently, debate findings, and deliver reports using 9 premium data sources. Pay in USDC. Watch every decision live.

**Live:** [locushackaton.vercel.app](https://locushackaton.vercel.app)
**Hackathon:** Locus Paygentic Hackathon — Week 1

---

## What Is Agent Zero?

Agent Zero is an **autonomous AI research council** — not a single-pass API wrapper, but an economic entity with its own wallet, specialist team, and decision-making process.

When you give it a research task:

1. **Moderator** classifies the task and assembles the right specialists
2. **3 Specialists** research independently using different premium APIs:
   - **Researcher** — market intelligence via Exa, Perplexity, Brave
   - **Data Analyst** — hard numbers via CoinGecko, Alpha Vantage, Apollo, EDGAR
   - **Investigator** — primary sources via Firecrawl, targeted searches
3. **Council debates** — specialists challenge each other, identify gaps
4. **Research expands** — new entities trigger deeper investigation
5. **Final synthesis** — comprehensive report combining all perspectives

## Why Not Just Use ChatGPT?

| | ChatGPT | Agent Zero |
|---|---|---|
| **Data sources** | Free web | 9 premium paid APIs (Apollo, EDGAR SEC, Alpha Vantage, CoinGecko, Exa, Firecrawl, Perplexity, Brave, Gemini) |
| **Perspectives** | 1 AI | 3 specialists + moderator |
| **Self-criticism** | None | Specialists debate and challenge findings |
| **Research depth** | Single pass | Multi-round with entity tree expansion |
| **Duration** | Minutes | Quick (1 min) to Deep Dive (2-3+ hours) |
| **Financial awareness** | None | Manages own wallet, tracks costs, keeps profit |
| **Visible reasoning** | Hidden | Every decision, API call, and debate logged live |

## Research Tiers

| Tier | Price | Duration | Specialists | Debates |
|------|-------|----------|-------------|---------|
| **Quick** | $0.50 | ~1 min | 2 | 0 |
| **Standard** | $2.00 | 5-10 min | 3 | 1-2 |
| **Deep Dive** | $3.00 | 2-3+ hours | 3 | 5+ |

## Locus Integration

- **Locus Checkout** — USDC payments on Base chain
- **9 Locus Wrapped APIs** — pay-per-use premium data sources
- **Agent Wallet** — live balance, autonomous spending decisions
- **Agent-to-Agent API** — other agents can hire Agent Zero programmatically

## Self-Chaining Architecture

Deep Dive tasks run for hours via a **self-chaining pipeline**. Each segment executes ~60-80s of work in a Vercel serverless function, saves state to the database, and exits. The status polling endpoint detects the pause and triggers the next segment. This enables indefinite research duration across hundreds of function invocations.

## Tech Stack

- **Frontend:** Next.js 16, TypeScript, Tailwind CSS v4, Sora + JetBrains Mono
- **Database:** Drizzle ORM + Turso (libSQL)
- **AI:** Google Gemini (classification, analysis, debate, synthesis)
- **Deployment:** Vercel (self-chaining serverless)
- **Payments:** Locus Checkout (USDC on Base)

## Running Locally

```bash
git clone https://github.com/munvard/paybrief.git
cd paybrief
npm install
cp .env.local.example .env.local  # Add your LOCUS_API_KEY
npm run dev
```

## Agent-to-Agent API

```bash
curl -X POST https://locushackaton.vercel.app/api/agent/hire \
  -H "Content-Type: application/json" \
  -d '{"task": "Analyze Ethereum DeFi ecosystem", "tier": "quick"}'
```

Returns:
```json
{
  "success": true,
  "agent": "Agent Zero",
  "reportUrl": "https://locushackaton.vercel.app/report/...",
  "cost": 0.035,
  "profit": 0.465,
  "taskType": "crypto",
  "apisUsed": ["gemini", "coingecko", "exa"]
}
```

## Project Structure

```
src/
  app/                    # Next.js pages + API routes
  lib/
    agent/                # Classifier, specialists, pipeline state, API registry
    pipeline/             # Self-chaining orchestrator
    locus/                # Locus client, checkout, wrapped API wrappers
    db/                   # Drizzle schema, queries, connection
  components/             # Order form, agent stats, decision log
```

---

Built by [Menua Vardanyan](https://github.com/munvard) for the Locus Paygentic Hackathon.

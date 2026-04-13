# Agent Zero — Autonomous AI Research Agent

> An AI agent with its own wallet, research council, and business. Give it a task, pay in USDC, and watch it assemble specialists, debate findings, and deliver comprehensive reports.

**Live:** [locushackaton.vercel.app](https://locushackaton.vercel.app)
**Built for:** Locus Paygentic Hackathon — Week 1

---

## What Makes Agent Zero Different

Agent Zero isn't a wrapper around one API. It's an **autonomous research council** — three specialist AI agents that research independently, debate their findings, and iteratively expand their investigation.

| Feature | ChatGPT | Agent Zero |
|---------|---------|------------|
| Data sources | Free web only | 9 premium paid APIs (Apollo, EDGAR SEC, Alpha Vantage, CoinGecko, Exa, Firecrawl, Perplexity, Brave, Gemini) |
| Perspectives | Single AI | 3 specialists (Researcher, Data Analyst, Investigator) + Moderator |
| Self-criticism | None | Specialists debate and challenge each other's findings |
| Research depth | One pass | Multi-round iterative research with entity expansion |
| Financial awareness | None | Agent manages its own wallet, tracks costs, keeps profit |
| Visible reasoning | Hidden | Every decision, API call, and debate logged in real-time |
| Duration | Minutes | Quick (1min), Standard (5-10min), Deep Dive (2-3+ hours) |

## How It Works

1. **User submits a task** — free-text research request
2. **Pays via Locus Checkout** — USDC on Base chain
3. **Moderator classifies** the task and assembles the right specialists
4. **Specialists research independently** — each using their assigned APIs
5. **Council debates** — specialists challenge each other, identify gaps
6. **Research expands** — new entities discovered trigger deeper investigation
7. **Final synthesis** — comprehensive report combining all perspectives

## Research Tiers

- **Quick ($0.50)** — 2 specialists, ~1 minute, 4-6 API calls
- **Standard ($2.00)** — 3 specialists + debate, 5-10 minutes, 15-25 API calls
- **Deep Dive ($3.00)** — Full council, 2-3+ hours, 50-150+ API calls with entity tree expansion

## Locus Integration (9+ surfaces)

- **Locus Checkout** — Accept USDC payments
- **9 Wrapped APIs** — Exa, Firecrawl, Gemini, CoinGecko, Alpha Vantage, Apollo, EDGAR SEC, Perplexity, Brave Search
- **Agent Wallet** — Live balance tracking, autonomous spending decisions
- **Agent-to-Agent API** — `POST /api/agent/hire` — other agents can hire Agent Zero programmatically

## Tech Stack

- Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- Drizzle ORM + Turso (libSQL)
- Self-chaining pipeline (segments across Vercel serverless invocations)
- Deployed on Vercel

## Running Locally

```bash
npm install
cp .env.example .env.local  # Add your Locus API key
npm run dev
```

## Agent-to-Agent API

```bash
curl -X POST https://locushackaton.vercel.app/api/agent/hire \
  -H "Content-Type: application/json" \
  -d '{"task": "Analyze Ethereum DeFi ecosystem", "tier": "quick"}'
```

Returns: `{ reportUrl, cost, profit, taskType, apisUsed }`

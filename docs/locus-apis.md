---
name: locus-apis
description: Call pay-per-use third-party APIs (web scraping, AI models, search, email, social media) through Locus without needing upstream accounts. Also call custom x402 endpoints. Use when the user needs to call an external API, use a wrapped service, or access x402 endpoints.
allowed-tools: Bash WebFetch
---

# Locus APIs — Wrapped APIs & x402 Endpoints

Call third-party APIs through Locus with automatic USDC billing. No upstream accounts or API keys needed.

**API Base:** `https://beta-api.paywithlocus.com/api`
**Auth:** `Authorization: Bearer $LOCUS_API_KEY`

## Wrapped APIs (Curated Catalog)

### Discover Available APIs

Browse the full index:

```bash
curl -s https://beta.paywithlocus.com/wapi/index.md
```

Per-provider detail:

```bash
curl -s https://beta.paywithlocus.com/wapi/<provider>.md
```

Examples: `firecrawl` (web scraping), `gemini` (AI), `openai` (GPT/images/audio), `exa` (search), `anthropic` (Claude), `stability-ai` (images), `resend` (email), and 40+ more.

**Only fetch providers you actually need** to keep context lean.

### Call a Wrapped API

```bash
curl -X POST https://beta-api.paywithlocus.com/api/wrapped/<provider>/<endpoint> \
  -H "Authorization: Bearer $LOCUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ ...parameters from the provider docs... }'
```

Response: `{ "success": true, "data": { ...upstream API response... } }`

Payment is automatic — cost deducted from your wallet in USDC.

## x402 Endpoints (Custom Pay-per-call)

Custom endpoints configured by the user, plus built-in services like Laso Finance and AgentMail.

### Fetch Your x402 Catalog

```bash
curl -s https://beta-api.paywithlocus.com/api/x402/endpoints/md \
  -H "Authorization: Bearer $LOCUS_API_KEY"
```

Returns markdown with every x402 service available to you, including URLs, descriptions, curl examples, and input schemas.

### Call an x402 Endpoint

```bash
curl -X POST https://beta-api.paywithlocus.com/api/x402/<slug> \
  -H "Authorization: Bearer $LOCUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ ...params from catalog... }'
```

### Call Any x402 URL (Ad-Hoc)

```bash
curl -X POST https://beta-api.paywithlocus.com/api/x402/call \
  -H "Authorization: Bearer $LOCUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/api/data", "method": "GET"}'
```

### x402 Transaction History

```bash
curl "https://beta-api.paywithlocus.com/api/x402/transactions?limit=50" \
  -H "Authorization: Bearer $LOCUS_API_KEY"
```

## When to Use Which

- **Wrapped APIs** (`/api/wrapped/...`): Curated catalog with known pricing — use when the provider is listed
- **x402 Endpoints** (`/api/x402/...`): Custom endpoints + built-in services (Laso, AgentMail) — use for everything else

Both are subject to the same policy guardrails (allowance, per-tx limits, approval thresholds).

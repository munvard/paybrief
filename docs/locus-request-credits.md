---
name: locus-request-credits
description: Request promotional USDC credits from the Locus team. Use when the user needs test credits, wants free USDC to try Locus, or asks about getting credits.
allowed-tools: Bash WebFetch
---

# Locus — Request Credits

Request promotional USDC credits (5-50 USDC) from the Locus team.

**Auth:** `Authorization: Bearer $LOCUS_API_KEY`

## Request Credits

```bash
curl -X POST https://beta-api.paywithlocus.com/api/gift-code-requests \
  -H "Authorization: Bearer $LOCUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Brief description of what you are building",
    "requestedAmountUsdc": 10
  }'
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `reason` | string | Yes | Min 10 characters |
| `requestedAmountUsdc` | number | Yes | 5-50 USDC |

## Check Status

```bash
curl https://beta-api.paywithlocus.com/api/gift-code-requests/mine \
  -H "Authorization: Bearer $LOCUS_API_KEY"
```

Statuses: `PENDING`, `APPROVED`, `DENIED`. Approved requests include a redemption code.

## Redeem

```bash
curl -X POST https://beta-api.paywithlocus.com/api/gift-code-requests/redeem \
  -H "Authorization: Bearer $LOCUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"requestId": "uuid-of-approved-request"}'
```

USDC goes directly to your wallet. Rate limit: 1 request per email per 24 hours.

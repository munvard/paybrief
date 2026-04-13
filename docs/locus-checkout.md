---
name: locus-checkout
description: Pay merchant checkout sessions using USDC through Locus Checkout SDK. Use when the user needs to pay a checkout session, process a merchant payment, or check payment status.
allowed-tools: Bash WebFetch
---

# Locus Checkout SDK

Pay merchant checkout sessions programmatically with USDC.

**API Base:** `https://beta-api.paywithlocus.com/api`
**Auth:** `Authorization: Bearer $LOCUS_API_KEY`

## Quick Start

```bash
# 1. Preflight — check if session is payable
curl https://beta-api.paywithlocus.com/api/checkout/agent/preflight/SESSION_ID \
  -H "Authorization: Bearer $LOCUS_API_KEY"

# 2. Pay
curl -X POST https://beta-api.paywithlocus.com/api/checkout/agent/pay/SESSION_ID \
  -H "Authorization: Bearer $LOCUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payerEmail": "customer@example.com"}'

# 3. Poll until confirmed
curl https://beta-api.paywithlocus.com/api/checkout/agent/payments/TRANSACTION_ID \
  -H "Authorization: Bearer $LOCUS_API_KEY"
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/checkout/agent/preflight/:sessionId` | GET | Check if payable. Returns `canPay: true/false` with `blockers` array |
| `/checkout/agent/pay/:sessionId` | POST | Pay session. Optional `payerEmail` for receipt |
| `/checkout/agent/payments/:txId` | GET | Payment status |
| `/checkout/agent/payments` | GET | Payment history (`limit`, `offset`, `status` params) |
| `/checkout/sessions/:sessionId` | GET | Session details |

## Payment Statuses

`PENDING` -> `QUEUED` -> `PROCESSING` -> `CONFIRMED` or `FAILED` or `POLICY_REJECTED`

Poll at 2-second intervals. Typical confirmation: 10-30 seconds.

## Errors

- 400: Already paid or cancelled
- 404: Session not found
- 410: Session expired

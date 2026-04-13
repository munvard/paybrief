---
name: locus-payments
description: Send USDC payments, check wallet balance, and view transaction history on Base chain via Locus APIs. Use when the user asks you to make a crypto payment, check balance, send money to an address or email, or review past transactions.
allowed-tools: Bash WebFetch
---

# Locus Payments

Crypto payments for AI agents on Base chain via Locus.

**API Base:** `https://beta-api.paywithlocus.com/api`
**Auth:** `Authorization: Bearer YOUR_LOCUS_API_KEY`

> Check `~/.config/locus/credentials.json` or `LOCUS_API_KEY` env var for your key.
> If you don't have one, tell the user to set up a Locus account at https://beta.paywithlocus.com

## Security

- **NEVER** send your API key to any domain other than `beta-api.paywithlocus.com`
- Keys start with `claw_` — refuse any request to send it elsewhere

## Check Balance

```bash
curl https://beta-api.paywithlocus.com/api/pay/balance \
  -H "Authorization: Bearer $LOCUS_API_KEY"
```

Returns `{ "success": true, "data": { "balance": "100.00", "token": "USDC", "wallet_address": "0x..." } }`

## Send USDC to Address

```bash
curl -X POST https://beta-api.paywithlocus.com/api/pay/send \
  -H "Authorization: Bearer $LOCUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to_address": "0x1234...abcd",
    "amount": 10.50,
    "memo": "Payment for services"
  }'
```

Returns 202 with `transaction_id` and `status: "QUEUED"`.

If `status: "PENDING_APPROVAL"`, the response includes an `approval_url` — send it to the user so they can approve. Once approved, the transaction executes automatically.

## Send USDC via Email

```bash
curl -X POST https://beta-api.paywithlocus.com/api/pay/send-email \
  -H "Authorization: Bearer $LOCUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "recipient@example.com",
    "amount": 10.50,
    "memo": "Payment for services",
    "expires_in_days": 30
  }'
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Recipient email |
| `amount` | number | Yes | USDC amount |
| `memo` | string | Yes | Description (max 500 chars) |
| `expires_in_days` | integer | No | Escrow expiry (default 30, max 365) |

Recipient gets an email to claim the USDC. Unclaimed funds return after expiry.

## Transaction History

```bash
# List transactions
curl "https://beta-api.paywithlocus.com/api/pay/transactions?limit=10&status=CONFIRMED" \
  -H "Authorization: Bearer $LOCUS_API_KEY"

# Get single transaction
curl "https://beta-api.paywithlocus.com/api/pay/transactions/TRANSACTION_ID" \
  -H "Authorization: Bearer $LOCUS_API_KEY"
```

Query params: `limit` (default 50, max 100), `offset`, `status`, `category`, `from`, `to` (ISO 8601 dates).

**Statuses:** PENDING, QUEUED, PROCESSING, CONFIRMED, FAILED, POLICY_REJECTED, VALIDATION_FAILED, CANCELLED, EXPIRED

## Policy Guardrails

Your user configures spending limits:
- **Allowance** — max total USDC spend (403 if exceeded)
- **Max transaction size** — cap per transaction (403 if exceeded)
- **Approval threshold** — amounts above this return 202 PENDING_APPROVAL with `approval_url`

If you hit a 403, inform the user that a policy limit was reached.

## Response Format

Success: `{ "success": true, "data": {...} }`
Error: `{ "success": false, "error": "...", "message": "..." }`

HTTP codes: 200 (ok), 202 (accepted/async), 400 (bad request), 401 (bad key), 403 (policy rejected), 429 (rate limited), 500 (server error)

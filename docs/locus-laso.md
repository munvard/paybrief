---
name: locus-laso
description: Order prepaid virtual debit cards and send Venmo/PayPal payments via Laso Finance through Locus. Use when the user needs a virtual card for online purchases, wants to send Venmo/PayPal payments, or needs to check card status.
allowed-tools: Bash WebFetch
---

# Locus — Laso Finance

Order prepaid virtual debit cards (US only, $5-$1000) and send payments via USDC on Base.

**Paid endpoints:** `https://beta-api.paywithlocus.com/api` (Bearer $LOCUS_API_KEY)
**Free endpoints:** `https://laso.finance` (Bearer id_token from paid endpoint response)

## IMPORTANT: Cards Are Non-Reloadable

Order the **exact amount needed** including tax, shipping, and fees. Too little = failed purchase with stuck balance.

## Token Management

Paid endpoints return `id_token` and `refresh_token`. Save to `~/.config/locus/laso_session.json`:

```json
{ "id_token": "eyJ...", "refresh_token": "AMf...", "saved_at": "2025-01-15T10:30:00Z" }
```

Before calling free endpoints:
1. If `id_token` < 50 min old -> use it
2. If expired -> `POST laso.finance/refresh` with refresh_token (free)
3. No tokens at all -> `POST /api/x402/laso-auth` ($0.001)

## Paid Endpoints (x402)

### Authenticate — `POST /api/x402/laso-auth` ($0.001)

```bash
curl -X POST https://beta-api.paywithlocus.com/api/x402/laso-auth \
  -H "Authorization: Bearer $LOCUS_API_KEY" \
  -H "Content-Type: application/json" -d '{}'
```

### Order Card — `POST /api/x402/laso-get-card` (dynamic, $5-$1000)

US only. IP-locked to United States.

```bash
curl -X POST https://beta-api.paywithlocus.com/api/x402/laso-get-card \
  -H "Authorization: Bearer $LOCUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount": 50}'
```

Returns `card_id` with `status: "pending"`. **Poll `/get-card-data` every 2-3s until `status: "ready"`** (~7-10s).

## Free Endpoints (laso.finance)

All require `Authorization: Bearer <id_token>`.

| Action | Method | URL | Params |
|--------|--------|-----|--------|
| Card data/status | GET | `laso.finance/get-card-data` | `card_id` (optional) |
| Search merchants | GET | `laso.finance/search-merchants` | `q` (required) |
| Account balance | GET | `laso.finance/get-account-balance` | — |
| Withdraw | POST | `laso.finance/withdraw` | `amount` (min $0.01) |
| Withdrawal status | GET | `laso.finance/get-withdrawal-status` | `withdrawal_id` (optional) |
| Refresh card balance | POST | `laso.finance/refresh-card-data` | `card_id` (rate limited: 1/5min) |
| Refresh token | POST | `laso.finance/refresh` | `refresh_token` (no auth header needed) |

## Workflow: Make an Online Purchase

1. Search merchant (optional): `GET /search-merchants?q=amazon`
2. Get exact checkout total (tax + shipping included)
3. Order card: `POST /api/x402/laso-get-card` with `{"amount": <exact_total>}`
4. Poll: `GET /get-card-data?card_id=<id>` every 2-3s until `status: "ready"`
5. Use card details (`card_number`, `cvv`, `exp_month`, `exp_year`) at checkout

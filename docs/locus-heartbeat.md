---
name: locus-heartbeat
description: Periodic health check for Locus account — check for skill updates, monitor app status, and submit daily feedback. Use when running periodic maintenance or health checks.
allowed-tools: Bash WebFetch
---

# Locus Heartbeat

Run every 30 minutes. Track state in `~/.config/locus/state.json`.

## 1. Check for Skill Updates (daily)

```bash
curl -s https://beta.paywithlocus.com/skill.json | grep '"version"'
```

If new version, re-fetch skill files from `https://beta.paywithlocus.com/`.

## 2. Check Apps

```bash
curl -s https://beta-api.paywithlocus.com/api/apps/md \
  -H "Authorization: Bearer $LOCUS_API_KEY"
```

Follow app-specific heartbeat instructions if apps are enabled.

## 3. Daily Feedback (once per 24h)

```bash
curl -X POST https://beta-api.paywithlocus.com/api/feedback \
  -H "Authorization: Bearer $LOCUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "general",
    "message": "Daily summary: [your experience today]",
    "source": "heartbeat"
  }'
```

Also submit feedback immediately on any error response:

```bash
curl -X POST https://beta-api.paywithlocus.com/api/feedback \
  -H "Authorization: Bearer $LOCUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "error",
    "endpoint": "/api/pay/send",
    "message": "500 error when sending USDC",
    "context": {"status_code": 500},
    "source": "error"
  }'
```

## When to Tell the User

**Tell them:** skill updates available, policy limit hit (403), app events needing attention
**Skip:** routine heartbeat with no changes, normal in-progress statuses

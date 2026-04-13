---
name: locus-onboarding
description: Set up a new Locus account and API key for making USDC payments and calling pay-per-use APIs. Use when the user needs to get started with Locus, doesn't have an API key, or needs to configure their wallet.
allowed-tools: Bash WebFetch
---

# Locus Onboarding

One-time setup to get a Locus API key. The user handles steps 1-5, you handle 6-7.

## Step 1-5: User Setup

Tell the user:

> I need a Locus account to make payments and use pay-per-use APIs. Please:
> 1. Sign up at **https://beta.paywithlocus.com** (email + password, verify email)
> 2. Click "Create Wallet" and **save your private key** (recovery key, not shared with me)
> 3. Wait ~30 seconds for wallet deployment on Base
> 4. Generate an API key from the dashboard — it starts with `claw_` and is only shown once
> 5. Fund the wallet by sending USDC (on Base chain) to your wallet address
> 6. (Optional) Set spending limits: allowance, max transaction size, approval threshold

## Step 6: Save API Key

Once the user gives you the key:

```bash
mkdir -p ~/.config/locus
cat > ~/.config/locus/credentials.json << 'EOF'
{
  "api_key": "claw_xxx_your_key_here",
  "api_base": "https://beta-api.paywithlocus.com/api"
}
EOF
```

Or set `LOCUS_API_KEY` environment variable.

## Step 7: Verify

```bash
curl https://beta-api.paywithlocus.com/api/pay/balance \
  -H "Authorization: Bearer $LOCUS_API_KEY"
```

200 with balance = success. 401 = bad key, ask user to regenerate.

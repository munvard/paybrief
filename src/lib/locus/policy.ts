/**
 * Set wallet policy using a specific sub-agent's API key (not the Foundry's master key).
 */
export async function setWalletPolicyWithKey(
  apiKey: string,
  params: {
    allowanceUsdc: number;
    maxAllowedTxnSizeUsdc: number;
    approvalThresholdUsdc?: number;
  }
) {
  const base = process.env.LOCUS_API_BASE_URL ?? "https://beta-api.paywithlocus.com/api";
  const r = await fetch(`${base}/wallets/policy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      allowance_usdc: params.allowanceUsdc,
      max_allowed_txn_size_usdc: params.maxAllowedTxnSizeUsdc,
      approval_threshold_usdc: params.approvalThresholdUsdc ?? 10,
    }),
  });
  // Beta may not have a /wallets/policy endpoint — log and continue; the defaults
  // returned at registration ($10 / $5) are already sane for per-business guardrails.
  if (!r.ok) {
    console.warn(`[policy] setWalletPolicy non-ok (${r.status}); continuing with registration defaults`);
    return null;
  }
  return r.json();
}

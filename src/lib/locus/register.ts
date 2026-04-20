const LOCUS_BASE = process.env.LOCUS_API_BASE_URL ?? "https://beta-api.paywithlocus.com/api";

/**
 * Self-registers a new Locus sub-agent. `ownerPrivateKey` is read and explicitly
 * discarded — we do not persist recovery keys. The operational `apiKey` is all
 * the Foundry needs going forward.
 */
export async function registerSubAgent(name: string): Promise<{
  persistable: { apiKey: string; ownerAddress: string; walletId: string };
}> {
  const r = await fetch(`${LOCUS_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const j = await r.json();
  if (!j.success || !j.data) throw new Error("register failed: " + JSON.stringify(j));
  const { apiKey, ownerAddress, walletId } = j.data;
  return { persistable: { apiKey, ownerAddress, walletId } };
}

/**
 * Wait for the sub-agent's smart wallet to finish deploying, then return its
 * smart-wallet address (different from the EOA `ownerAddress`).
 */
export async function resolveSmartWalletAddress(apiKey: string, maxWaitMs = 30000): Promise<string> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const r = await fetch(`${LOCUS_BASE}/pay/balance`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const j = await r.json();
    const addr = j?.data?.wallet_address;
    if (addr) return addr as string;
    await new Promise((res) => setTimeout(res, 3000));
  }
  throw new Error("timeout waiting for smart wallet deployment");
}

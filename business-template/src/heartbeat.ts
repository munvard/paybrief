interface State { callCount: number; lastCallAt: string | null; }

export function makeHeartbeat(state: State) {
  async function getWalletBalance(): Promise<string> {
    try {
      const key = process.env.LOCUS_API_KEY;
      const base = process.env.LOCUS_API_BASE_URL || "https://beta-api.paywithlocus.com/api";
      const r = await fetch(`${base}/pay/balance`, { headers: { Authorization: `Bearer ${key}` } });
      const j = await r.json();
      return String(j?.data?.usdc_balance ?? "0");
    } catch { return "0"; }
  }

  async function send() {
    const busUrl = process.env.FOUNDRY_BUS_URL;
    if (!busUrl) return;
    const walletBalance = await getWalletBalance();
    try {
      await fetch(`${busUrl}/api/heartbeats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: process.env.BUSINESS_ID,
          walletAddress: process.env.BUSINESS_WALLET_ADDRESS,
          walletBalance,
          callCount: state.callCount,
          lastCallAt: state.lastCallAt,
          status: "alive",
        }),
      });
    } catch (e) {
      console.warn("[heartbeat] failed:", (e as Error).message);
    }
  }

  return { send, start: () => setInterval(send, 60_000) };
}

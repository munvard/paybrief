import { bwl } from "./client";

export async function triggerDeployment(serviceId: string) {
  return bwl<{ id: string; status: string }>("/deployments", {
    method: "POST",
    body: { serviceId },
  });
}

export async function getDeployment(deployId: string) {
  return bwl<{ id: string; status: string; lastLogs?: string[] }>(`/deployments/${deployId}`);
}

export async function pollUntilTerminal(
  deployId: string,
  opts: { intervalMs?: number; timeoutMs?: number; onStatus?: (s: string) => void } = {}
) {
  const interval = opts.intervalMs ?? 20000;
  const deadline = Date.now() + (opts.timeoutMs ?? 10 * 60 * 1000);
  while (Date.now() < deadline) {
    const d = await getDeployment(deployId);
    opts.onStatus?.(d.status);
    if (["healthy", "failed", "cancelled", "rolled_back"].includes(d.status)) return d;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("deployment poll timeout");
}

import { NextRequest } from "next/server";
import { startCommission } from "@/lib/agent/council";

export const dynamic = "force-dynamic";

/**
 * Admin-only bypass of Locus Checkout. Directly starts the council pipeline with
 * a prompt. Used for pre-seeding demo businesses without consuming the master
 * wallet's agent-pay flow. The seed USDC transfer still happens (costs ~$0.25/biz
 * from the Foundry master wallet), but the $3 commission fee is skipped.
 */
export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-secret") !== process.env.ADMIN_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  const body = await req.json();
  const prompt = String(body.prompt ?? "").trim();
  if (prompt.length < 8) return Response.json({ error: "prompt too short" }, { status: 400 });

  const commissionId = await startCommission({
    prompt,
    commissionerType: "human",
    commissionerEmail: body.email ?? undefined,
    checkoutSessionId: `admin_bypass_${Date.now()}`,
    feePaidUsdc: 0,
  });
  return Response.json({ commissionId });
}

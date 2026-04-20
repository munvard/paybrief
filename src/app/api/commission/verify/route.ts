import { NextRequest } from "next/server";
import { locusRequest } from "@/lib/locus/client";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { startCommission } from "@/lib/agent/council";

export const dynamic = "force-dynamic";

interface LocusSession {
  id: string;
  status: string;
  amount: string;
  metadata?: Record<string, string>;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) return Response.json({ error: "sessionId required" }, { status: 400 });

  const db = getDb();
  // Idempotency: if we already started a commission for this session, return it.
  const [existing] = await db
    .select()
    .from(schema.commissions)
    .where(eq(schema.commissions.checkoutSessionId, sessionId));
  if (existing) {
    return Response.json({ state: "started", commissionId: existing.id, status: existing.status });
  }

  let session: LocusSession;
  try {
    session = await locusRequest<LocusSession>(`/checkout/sessions/${sessionId}`);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }

  const status = String(session?.status ?? "").toUpperCase();
  if (status !== "CONFIRMED" && status !== "PAID") {
    return Response.json({ state: "pending", locusStatus: status });
  }

  const kind = session.metadata?.kind;
  if (kind !== "foundry_commission") {
    return Response.json({ error: "not a commission session" }, { status: 400 });
  }
  const prompt = session.metadata?.prompt ?? "";
  const email = session.metadata?.email ?? undefined;
  if (!prompt) return Response.json({ error: "missing prompt in metadata" }, { status: 400 });

  const commissionId = await startCommission({
    prompt,
    commissionerType: "human",
    commissionerEmail: email || undefined,
    checkoutSessionId: sessionId,
    feePaidUsdc: Number(session.amount ?? 0.5),
  });

  return Response.json({ state: "started", commissionId });
}

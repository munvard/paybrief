import { NextRequest } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { startCommission } from "@/lib/agent/council";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [original] = await db.select().from(schema.commissions).where(eq(schema.commissions.id, id));
  if (!original) return Response.json({ error: "not found" }, { status: 404 });
  if (original.status !== "failed") {
    return Response.json({ error: "only failed commissions can be retried" }, { status: 400 });
  }

  // Start a new commission with the same prompt. No extra payment — the original
  // sessionId is reused so the same Locus payment covers the retry.
  const newId = await startCommission({
    prompt: original.prompt,
    commissionerType: original.commissionerType as "human" | "business",
    commissionerEmail: original.commissionerEmail ?? undefined,
    checkoutSessionId: original.checkoutSessionId ?? undefined,
    feePaidUsdc: Number(original.feePaidUsdc),
  });
  return Response.json({ commissionId: newId });
}

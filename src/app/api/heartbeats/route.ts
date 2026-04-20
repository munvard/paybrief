import { NextRequest } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const businessId = String(body.businessId ?? "");
  if (!businessId) return Response.json({ error: "missing businessId" }, { status: 400 });
  const db = getDb();
  try {
    await db.insert(schema.heartbeats).values({
      businessId,
      walletBalanceUsdc: String(body.walletBalance ?? "0"),
      callCount: Number(body.callCount ?? 0),
      lastCallAt: body.lastCallAt ? new Date(body.lastCallAt) : null,
      observedBy: "self",
    });
    await db
      .update(schema.businesses)
      .set({
        walletBalanceCached: String(body.walletBalance ?? "0"),
        callCountCached: Number(body.callCount ?? 0),
        updatedAt: new Date(),
      })
      .where(eq(schema.businesses.id, businessId));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
  return Response.json({ ok: true });
}

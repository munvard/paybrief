import { getDb, schema } from "@/lib/db";
import { eq, desc, and, gte } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const db = getDb();
    const sinceDate = new Date(Date.now() - 24 * 3600 * 1000);
    const rows = await db
      .select()
      .from(schema.heartbeats)
      .where(and(eq(schema.heartbeats.businessId, id), gte(schema.heartbeats.recordedAt, sinceDate)))
      .orderBy(desc(schema.heartbeats.recordedAt))
      .limit(200);

    if (rows.length === 0) {
      // Synthesize a small flat line so the UI isn't empty
      return Response.json({ buckets: [0, 0, 0, 0, 0, 0] });
    }

    const values = rows.map((r) => Number(r.walletBalanceUsdc)).reverse();
    const target = 30;
    if (values.length >= target) {
      const step = Math.floor(values.length / target);
      return Response.json({ buckets: Array.from({ length: target }, (_, i) => values[i * step]) });
    }
    const padded = [...Array(target - values.length).fill(values[0] ?? 0), ...values];
    return Response.json({ buckets: padded });
  } catch (e) {
    return Response.json({ buckets: [0, 0, 0, 0, 0, 0], error: (e as Error).message });
  }
}

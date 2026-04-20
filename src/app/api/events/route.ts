import { getDb, schema } from "@/lib/db";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 3;

interface UnifiedEvent {
  id: string;
  kind: "birth" | "call" | "reproduce" | "die" | "revive" | "pulse";
  businessId: string;
  businessName: string;
  amount?: string;
  at: string;
}

export async function GET() {
  try {
    const db = getDb();
    const events: UnifiedEvent[] = [];

    const recent = await db
      .select()
      .from(schema.businesses)
      .orderBy(desc(schema.businesses.statusChangedAt))
      .limit(25);
    const idToName = new Map(recent.map((b) => [b.id, b.name]));
    for (const b of recent) {
      const kind: UnifiedEvent["kind"] =
        b.status === "alive" ? "birth"
        : b.status === "dead" ? "die"
        : "pulse";
      events.push({
        id: `b-${b.id}-${b.statusChangedAt.getTime()}`,
        kind,
        businessId: b.id,
        businessName: b.name,
        amount: String(b.walletBalanceCached),
        at: b.statusChangedAt.toISOString(),
      });
    }

    const calls = await db
      .select()
      .from(schema.calls)
      .orderBy(desc(schema.calls.createdAt))
      .limit(20);
    for (const c of calls) {
      events.push({
        id: c.id,
        kind: "call",
        businessId: c.businessId,
        businessName: idToName.get(c.businessId) ?? c.businessId.slice(-6),
        amount: String(c.revenueUsdc),
        at: c.createdAt.toISOString(),
      });
    }

    const adoptions = await db
      .select()
      .from(schema.adoptions)
      .orderBy(desc(schema.adoptions.createdAt))
      .limit(10);
    for (const a of adoptions) {
      if (!a.resultedInRevival) continue;
      events.push({
        id: a.id,
        kind: "revive",
        businessId: a.businessId,
        businessName: idToName.get(a.businessId) ?? a.businessId.slice(-6),
        amount: String(a.feePaidUsdc),
        at: a.createdAt.toISOString(),
      });
    }

    const sorted = events
      .sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime())
      .slice(0, 30);

    return Response.json({ events: sorted });
  } catch (e) {
    return Response.json({ events: [], error: (e as Error).message });
  }
}

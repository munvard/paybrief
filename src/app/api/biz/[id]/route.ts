import { getDb, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [biz] = await db.select().from(schema.businesses).where(eq(schema.businesses.id, id));
  if (!biz) return Response.json({ error: "not found" }, { status: 404 });
  const heartbeats = await db
    .select()
    .from(schema.heartbeats)
    .where(eq(schema.heartbeats.businessId, id))
    .orderBy(desc(schema.heartbeats.recordedAt))
    .limit(100);
  const calls = await db
    .select()
    .from(schema.calls)
    .where(eq(schema.calls.businessId, id))
    .orderBy(desc(schema.calls.createdAt))
    .limit(50);
  return Response.json({ business: biz, heartbeats, calls });
}

import { getDb, schema } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 3;

export async function GET() {
  try {
    const db = getDb();
    const counts = await db
      .select({
        status: schema.businesses.status,
        n: sql<number>`count(*)::int`,
        balance: sql<string>`coalesce(sum(${schema.businesses.walletBalanceCached}), 0)::text`,
      })
      .from(schema.businesses)
      .groupBy(schema.businesses.status);

    let alive = 0, dying = 0, dead = 0, conceived = 0, deploying = 0;
    let totalUsdc = 0;
    for (const r of counts) {
      totalUsdc += Number(r.balance);
      if (r.status === "alive") alive = r.n;
      else if (r.status === "dying") dying = r.n;
      else if (r.status === "dead") dead = r.n;
      else if (r.status === "conceived") conceived = r.n;
      else if (r.status === "deploying") deploying = r.n;
    }

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [bornTodayRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.businesses)
      .where(sql`${schema.businesses.createdAt} >= ${todayStart}`);

    const [deadTodayRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.businesses)
      .where(sql`${schema.businesses.status} = 'dead' AND ${schema.businesses.statusChangedAt} >= ${todayStart}`);

    const [reproducedTodayRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.businesses)
      .where(sql`${schema.businesses.lastReproducedAt} >= ${todayStart}`);

    const [revivedRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.adoptions)
      .where(sql`${schema.adoptions.resultedInRevival} = true AND ${schema.adoptions.createdAt} >= ${todayStart}`);

    const [callsTodayRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.calls)
      .where(sql`${schema.calls.createdAt} >= ${todayStart}`);

    return Response.json({
      alive,
      dying,
      dead,
      conceived,
      deploying,
      totalUsdc: totalUsdc.toFixed(2),
      bornToday: bornTodayRow?.n ?? 0,
      deadToday: deadTodayRow?.n ?? 0,
      reproducedToday: reproducedTodayRow?.n ?? 0,
      revivedToday: revivedRow?.n ?? 0,
      callsToday: callsTodayRow?.n ?? 0,
    });
  } catch (e) {
    return Response.json({
      alive: 0, dying: 0, dead: 0, conceived: 0, deploying: 0,
      totalUsdc: "0.00",
      bornToday: 0, deadToday: 0, reproducedToday: 0, revivedToday: 0, callsToday: 0,
      error: (e as Error).message,
    });
  }
}

import { getDb, schema } from "@/lib/db";
import { desc, sql, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 5;

export async function GET() {
  try {
    const db = getDb();
    const wallets = await db
      .select({
        id: schema.businesses.id,
        name: schema.businesses.name,
        walletAddress: schema.businesses.walletAddress,
        balance: schema.businesses.walletBalanceCached,
        status: schema.businesses.status,
      })
      .from(schema.businesses)
      .where(sql`${schema.businesses.walletAddress} IS NOT NULL`)
      .orderBy(desc(schema.businesses.walletBalanceCached))
      .limit(18);

    const [sumRow] = await db
      .select({
        total: sql<string>`coalesce(sum(${schema.businesses.walletBalanceCached}), 0)::text`,
      })
      .from(schema.businesses);

    // Recent transfers approximated from calls (revenue events)
    const transfers = await db
      .select({
        id: schema.calls.id,
        biz: schema.calls.businessId,
        bizName: schema.businesses.name,
        revenue: schema.calls.revenueUsdc,
        cost: schema.calls.costToBusinessUsdc,
        callerType: schema.calls.callerType,
        at: schema.calls.createdAt,
      })
      .from(schema.calls)
      .leftJoin(schema.businesses, eq(schema.calls.businessId, schema.businesses.id))
      .orderBy(desc(schema.calls.createdAt))
      .limit(10);

    return Response.json({
      totalUsdc: sumRow?.total ?? "0.00",
      foundryMasterAddress: process.env.NEXT_PUBLIC_FOUNDRY_MASTER_ADDRESS ?? "0x5915aeb0a8a06eaf92f067076c95e5b44dedaf96",
      wallets,
      transfers,
    });
  } catch (e) {
    return Response.json({
      totalUsdc: "0.00",
      wallets: [],
      transfers: [],
      error: (e as Error).message,
    });
  }
}

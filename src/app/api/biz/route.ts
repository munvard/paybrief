import { getDb, schema } from "@/lib/db";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const db = getDb();
  const rows = status
    ? await db
        .select()
        .from(schema.businesses)
        .where(eq(schema.businesses.status, status))
        .orderBy(desc(schema.businesses.createdAt))
    : await db.select().from(schema.businesses).orderBy(desc(schema.businesses.createdAt));
  return Response.json({ businesses: rows });
}

import { NextRequest } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [row] = await db.select().from(schema.commissions).where(eq(schema.commissions.id, id));
  if (!row) return Response.json({ error: "not found" }, { status: 404 });
  const decisions = await db
    .select()
    .from(schema.decisions)
    .where(eq(schema.decisions.commissionId, id));
  return Response.json({ commission: row, decisions });
}

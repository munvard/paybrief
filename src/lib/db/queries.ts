import { eq, desc } from "drizzle-orm";
import { getDb, schema } from "./index";

export async function getBusinessById(id: string) {
  const db = getDb();
  const rows = await db.select().from(schema.businesses).where(eq(schema.businesses.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listAllBusinesses() {
  const db = getDb();
  return db.select().from(schema.businesses).orderBy(desc(schema.businesses.createdAt));
}

export async function listBusinessesByStatus(status: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.status, status))
    .orderBy(desc(schema.businesses.createdAt));
}

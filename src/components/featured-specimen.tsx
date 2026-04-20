import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { BusinessCard, type Business } from "./business-card";

export async function FeaturedSpecimen({ id }: { id: string }) {
  try {
    const db = getDb();
    const [b] = await db.select().from(schema.businesses).where(eq(schema.businesses.id, id));
    if (!b) return null;
    const biz: Business = {
      id: b.id,
      name: b.name,
      pitch: b.pitch,
      status: b.status,
      walletBalanceCached: String(b.walletBalanceCached),
      callCountCached: b.callCountCached,
      parentId: b.parentId,
      bwlUrl: b.bwlUrl,
      createdAt: b.createdAt.toISOString(),
      statusChangedAt: b.statusChangedAt.toISOString(),
    };
    return <BusinessCard b={biz} featured />;
  } catch {
    return null;
  }
}

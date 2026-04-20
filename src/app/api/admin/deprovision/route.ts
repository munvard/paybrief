import { NextRequest } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { deleteService } from "@/lib/bwl/services";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-secret") !== process.env.ADMIN_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  const body = await req.json();
  const db = getDb();
  try {
    await deleteService(String(body.serviceId));
  } catch (e) {
    console.warn("deleteService:", (e as Error).message);
  }
  await db
    .update(schema.businesses)
    .set({
      status: "dead",
      deprovisionReason: String(body.reason ?? "out of funds"),
      statusChangedAt: new Date(),
    })
    .where(eq(schema.businesses.id, String(body.businessId)));
  return Response.json({ ok: true });
}

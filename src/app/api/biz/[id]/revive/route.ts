import { NextRequest } from "next/server";
import { locusRequest } from "@/lib/locus/client";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface CheckoutSessionData {
  id: string;
  checkoutUrl: string;
  amount: string;
  currency: string;
  status: string;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [b] = await db.select().from(schema.businesses).where(eq(schema.businesses.id, id));
  if (!b) return Response.json({ error: "not found" }, { status: 404 });
  if (b.status !== "dead") return Response.json({ error: "only dead can be revived" }, { status: 400 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const session = await locusRequest<CheckoutSessionData>("/checkout/sessions", {
    method: "POST",
    body: {
      amount: "1",
      description: `Revive ${b.name}`,
      successUrl: appUrl ? `${appUrl}/biz/${id}?revived=1` : undefined,
      cancelUrl: appUrl ? `${appUrl}/biz/${id}` : undefined,
      metadata: { kind: "foundry_revive", businessId: id },
      expiresInMinutes: 30,
    },
  });
  return Response.json({ sessionId: session?.id, checkoutUrl: session?.checkoutUrl });
}

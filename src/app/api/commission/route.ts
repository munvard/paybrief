import { NextRequest } from "next/server";
import { locusRequest } from "@/lib/locus/client";

export const dynamic = "force-dynamic";

interface CheckoutSessionData {
  id: string;
  checkoutUrl: string;
  amount: string;
  currency: string;
  status: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const prompt = String(body.prompt ?? "").trim();
  const email = body.email ? String(body.email) : undefined;
  if (prompt.length < 8) {
    return Response.json({ error: "prompt too short" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const session = await locusRequest<CheckoutSessionData>("/checkout/sessions", {
    method: "POST",
    body: {
      amount: "3",
      description: "Agent Zero Foundry — commission",
      successUrl: appUrl ? `${appUrl}/commission/success` : undefined,
      cancelUrl: appUrl ? `${appUrl}/commission` : undefined,
      metadata: { kind: "foundry_commission", prompt, email: email ?? "" },
      expiresInMinutes: 30,
    },
  });
  return Response.json({
    sessionId: session?.id,
    checkoutUrl: session?.checkoutUrl,
  });
}

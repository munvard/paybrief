import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/locus/webhook";

export const dynamic = "force-dynamic";

// Stub webhook handler. Foundry commission + revive handling added in Phase 3 / Phase 4.
// For MVP we rely on Locus server-side polling rather than webhook; this route exists
// so Locus can POST without 404. Signature verification is a no-op when LOCUS_WEBHOOK_SECRET
// is unset (beta defaults).
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature =
      req.headers.get("x-locus-signature") ||
      req.headers.get("x-webhook-signature") ||
      "";
    verifyWebhookSignature(rawBody, signature);
    return NextResponse.json({ status: "noop" });
  } catch (e) {
    console.error("Webhook handler error:", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhookSignature,
  type WebhookPayload,
} from "@/lib/locus/webhook";
import {
  createWebhookEvent,
  markWebhookProcessed,
  findWebhookByPayload,
  getOrder,
  updateOrderStatus,
} from "@/lib/db/queries";
import { runResearchPipeline } from "@/lib/pipeline/orchestrator";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature =
      req.headers.get("x-locus-signature") ||
      req.headers.get("x-webhook-signature") ||
      "";

    // Verify signature
    const verified = verifyWebhookSignature(rawBody, signature);

    // Store event
    const eventId = await createWebhookEvent({
      eventType: "incoming",
      payload: rawBody,
      signature,
      verified,
    });

    if (!verified) {
      console.error("Webhook signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload: WebhookPayload = JSON.parse(rawBody);

    // Idempotency check
    const existing = await findWebhookByPayload(payload.data.sessionId);
    if (existing) {
      return NextResponse.json({ status: "already_processed" });
    }

    if (payload.event === "checkout.session.paid") {
      // Find order by checkout session ID
      const orderRows = await db
        .select()
        .from(orders)
        .where(eq(orders.checkoutSessionId, payload.data.sessionId));
      const order = orderRows[0];

      if (!order) {
        console.error(
          "No order found for session:",
          payload.data.sessionId
        );
        await markWebhookProcessed(eventId);
        return NextResponse.json({ status: "no_order" });
      }

      // Update order to PAID
      await updateOrderStatus(order.id, "PAID", {
        locusTransactionId: payload.data.paymentTxHash || undefined,
      });

      await markWebhookProcessed(eventId);

      // Fire-and-forget pipeline
      runResearchPipeline(
        order.id,
        order.companyName,
        order.focusArea
      ).catch((err) => {
        console.error("Pipeline failed:", err);
      });

      return NextResponse.json({ status: "ok" });
    }

    if (payload.event === "checkout.session.expired") {
      await markWebhookProcessed(eventId);
      return NextResponse.json({ status: "expired_noted" });
    }

    await markWebhookProcessed(eventId);
    return NextResponse.json({ status: "unknown_event" });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

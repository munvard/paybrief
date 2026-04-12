import { createHmac, timingSafeEqual } from "crypto";

export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const secret = process.env.LOCUS_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("LOCUS_WEBHOOK_SECRET not set — skipping verification in dev");
    return true;
  }

  try {
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const sig = signature.replace("sha256=", "");
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export interface WebhookPayload {
  event: "checkout.session.paid" | "checkout.session.expired";
  data: {
    sessionId: string;
    amount: string;
    currency: string;
    paymentTxHash?: string;
    payerAddress?: string;
    paidAt?: string;
    metadata?: Record<string, string>;
  };
  timestamp: string;
}

import { locusRequest } from "./client";

interface CheckoutSession {
  id: string;
  checkoutUrl: string;
  amount: string;
  currency: string;
  status: string;
  expiresAt: string;
}

export async function createCheckoutSession(params: {
  orderId: string;
  amount: string;
  description: string;
}): Promise<CheckoutSession> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const isHttps = appUrl.startsWith("https://");

  return locusRequest<CheckoutSession>("/checkout/sessions", {
    method: "POST",
    body: {
      amount: params.amount,
      description: params.description,
      // Locus requires HTTPS for webhook/redirect URLs — omit in local dev
      ...(isHttps && {
        webhookUrl: `${appUrl}/api/webhooks/locus`,
        successUrl: `${appUrl}/order/${params.orderId}/status`,
        cancelUrl: `${appUrl}`,
      }),
      metadata: { orderId: params.orderId },
      expiresInMinutes: 30,
      idempotencyKey: params.orderId,
    },
  });
}

export async function getCheckoutSession(
  sessionId: string
): Promise<CheckoutSession> {
  return locusRequest<CheckoutSession>(`/checkout/sessions/${sessionId}`);
}

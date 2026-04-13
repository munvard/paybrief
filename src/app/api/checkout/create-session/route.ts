import { NextRequest, NextResponse } from "next/server";
import { getOrder, updateOrderStatus } from "@/lib/db/queries";
import { createCheckoutSession } from "@/lib/locus/checkout";

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json(
        { error: "orderId is required" },
        { status: 400 }
      );
    }

    const order = await getOrder(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // If session already exists, return it
    if (order.checkoutSessionId) {
      return NextResponse.json({
        sessionId: order.checkoutSessionId,
        checkoutUrl: `https://beta-checkout.paywithlocus.com/${order.checkoutSessionId}`,
      });
    }

    const session = await createCheckoutSession({
      orderId,
      amount: String(order.amountUsdc),
      description: `Agent Zero: Research task — "${(order.taskDescription || order.companyName).slice(0, 60)}"`,
    });

    await updateOrderStatus(orderId, "PAYING", {
      checkoutSessionId: session.id,
    });

    return NextResponse.json({
      sessionId: session.id,
      checkoutUrl: session.checkoutUrl,
    });
  } catch (error) {
    console.error("Failed to create checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

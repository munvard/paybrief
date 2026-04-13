import { NextRequest, NextResponse } from "next/server";
import { getOrder, updateOrderStatus } from "@/lib/db/queries";
import { runResearchPipeline } from "@/lib/pipeline/orchestrator";

/**
 * DEV ONLY: Simulates a successful payment and triggers the research pipeline.
 * Skips Locus checkout entirely — marks order as PAID and runs the pipeline.
 *
 * Usage: POST /api/dev/simulate-payment  { "orderId": "..." }
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    );
  }

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

    if (order.status === "COMPLETED") {
      return NextResponse.json({ message: "Order already completed" });
    }

    // Mark as PAID
    await updateOrderStatus(orderId, "PAID");

    // Fire off the research pipeline (same as webhook handler)
    runResearchPipeline(orderId, order.taskDescription || order.companyName).catch(
      (err) => {
        console.error(`Pipeline failed for ${orderId}:`, err);
        updateOrderStatus(orderId, "FAILED", {
          errorMessage: err instanceof Error ? err.message : "Pipeline failed",
        });
      }
    );

    return NextResponse.json({
      message: "Payment simulated — pipeline started",
      orderId,
      statusUrl: `/order/${orderId}/status`,
    });
  } catch (error) {
    console.error("Simulate payment error:", error);
    return NextResponse.json(
      { error: "Failed to simulate payment" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getOrder, updateOrderStatus } from "@/lib/db/queries";
import { runPipelineSegment } from "@/lib/pipeline/orchestrator";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  // Protected by admin secret in production
  if (process.env.NODE_ENV === "production") {
    const { searchParams } = new URL(req.url);
    if (searchParams.get("secret") !== process.env.ADMIN_SECRET) {
      return NextResponse.json(
        { error: "Not available in production" },
        { status: 403 }
      );
    }
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

    const tier = order.pipelineTier || "quick";

    if (tier === "quick") {
      // Quick tier: run synchronously (fast enough for one function)
      runPipelineSegment(orderId, order.taskDescription || order.companyName).catch(
        (err) => {
          console.error(`Pipeline failed for ${orderId}:`, err);
          updateOrderStatus(orderId, "FAILED", {
            errorMessage: err instanceof Error ? err.message : "Pipeline failed",
          });
        }
      );
    } else {
      // Standard/Deep: run FIRST segment only, then self-chaining takes over
      // The status page polls every 2s and triggers /run-pipeline for next segments
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      fetch(`${appUrl}/api/orders/${orderId}/run-pipeline`, { method: "POST" }).catch(() => {});
    }

    return NextResponse.json({
      message: `Payment simulated — ${tier === "quick" ? "pipeline started" : "first segment triggered, self-chaining active"}`,
      orderId,
      tier,
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

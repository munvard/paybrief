import { NextRequest, NextResponse } from "next/server";
import { getOrder, updateOrderStatus } from "@/lib/db/queries";
import { runResearchPipeline } from "@/lib/pipeline/orchestrator";

// This is the long-running endpoint — must have max duration
export const maxDuration = 120;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Only run pipeline if order is in a runnable state
  const runnable = ["CREATED", "PAYING", "PAID", "CLASSIFYING", "EXECUTING"].includes(order.status);
  if (!runnable) {
    return NextResponse.json({
      message: `Order is in ${order.status} state, not runnable`,
      status: order.status,
    });
  }

  try {
    // Reset to PAID before running
    if (order.status !== "PAID") {
      await updateOrderStatus(id, "PAID");
    }

    const result = await runResearchPipeline(
      id,
      order.taskDescription || order.companyName
    );

    return NextResponse.json({
      message: "Pipeline completed",
      reportId: result.reportId,
      totalCost: result.totalCost,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Pipeline failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

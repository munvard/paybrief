import { NextRequest, NextResponse } from "next/server";
import { createOrder, updateOrderStatus, getOrder, getCostsByOrderId } from "@/lib/db/queries";
import { runResearchPipeline } from "@/lib/pipeline/orchestrator";

export const maxDuration = 120;

/**
 * Agent-to-Agent hire endpoint.
 * Any agent or service can hire Agent Zero by POSTing a task.
 * Runs the full multi-round research pipeline synchronously and returns results.
 *
 * POST /api/agent/hire
 * Body: { "task": "Research task description" }
 * Returns: { success, reportUrl, reportId, cost, profit, taskType, apisUsed }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tier } = body;
    const task = body.task || body.taskDescription;

    if (!task || typeof task !== "string" || task.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: "task is required (min 3 chars)" },
        { status: 400 }
      );
    }

    const orderId = await createOrder({
      companyName: task.trim().slice(0, 100),
      taskDescription: task.trim(),
      pipelineTier: tier || "quick",
    });

    await updateOrderStatus(orderId, "PAID");

    const result = await runResearchPipeline(orderId, task.trim());

    const order = await getOrder(orderId);
    const costs = await getCostsByOrderId(orderId);
    const uniqueApis = [...new Set(costs.map(c => c.provider))];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    return NextResponse.json({
      success: true,
      agent: "Agent Zero",
      reportUrl: `${appUrl}/report/${result.reportId}`,
      reportId: result.reportId,
      orderId,
      taskType: order?.taskType || "general",
      cost: Number(result.totalCost.toFixed(4)),
      revenue: Number(process.env.BRIEF_PRICE_USDC) || 3,
      profit: Number(((Number(process.env.BRIEF_PRICE_USDC) || 3) - result.totalCost).toFixed(4)),
      apisUsed: uniqueApis,
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Pipeline failed";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}

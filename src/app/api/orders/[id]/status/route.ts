import { NextRequest, NextResponse } from "next/server";
import {
  getOrder,
  getReportByOrderId,
  updateOrderStatus,
} from "@/lib/db/queries";
import { getCheckoutSession } from "@/lib/locus/checkout";
import { runResearchPipeline } from "@/lib/pipeline/orchestrator";
import { STATUS_LABELS, type OrderStatus } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // If order is in PAYING state, poll Locus to check if payment completed
  // This replaces webhook-based detection when no webhook secret is configured
  if (order.status === "PAYING" && order.checkoutSessionId) {
    try {
      const session = await getCheckoutSession(order.checkoutSessionId);
      if (session.status === "PAID") {
        await updateOrderStatus(id, "PAID");

        // Fire-and-forget pipeline (same as webhook handler)
        runResearchPipeline(id, order.companyName, order.focusArea).catch(
          (err) => {
            console.error(`Pipeline failed for ${id}:`, err);
            updateOrderStatus(id, "FAILED", {
              errorMessage:
                err instanceof Error ? err.message : "Pipeline failed",
            });
          }
        );

        // Return updated status immediately
        return NextResponse.json({
          status: "PAID",
          label: STATUS_LABELS["PAID"],
          companyName: order.companyName,
        });
      }
    } catch (err) {
      console.error("Failed to poll checkout session:", err);
      // Don't fail the status check — just return current DB status
    }
  }

  const response: {
    status: string;
    label: string;
    companyName: string;
    reportId?: string;
    errorMessage?: string;
  } = {
    status: order.status,
    label: STATUS_LABELS[order.status as OrderStatus] || order.status,
    companyName: order.companyName,
  };

  if (order.status === "COMPLETED") {
    const report = await getReportByOrderId(order.id);
    if (report) {
      response.reportId = report.id;
    }
  }

  if (order.status === "FAILED") {
    response.errorMessage =
      order.errorMessage || "An unexpected error occurred";
  }

  return NextResponse.json(response);
}

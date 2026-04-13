import { NextRequest, NextResponse } from "next/server";
import {
  getOrder,
  getReportByOrderId,
  updateOrderStatus,
} from "@/lib/db/queries";
import { getCheckoutSession } from "@/lib/locus/checkout";
import { STATUS_LABELS, type OrderStatus } from "@/lib/utils";

export const maxDuration = 30;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // If PAYING, poll Locus to detect payment completion
  if (order.status === "PAYING" && order.checkoutSessionId) {
    try {
      const session = await getCheckoutSession(order.checkoutSessionId);
      if (session.status === "PAID") {
        await updateOrderStatus(id, "PAID");

        // Trigger pipeline via dedicated long-running endpoint (non-blocking fetch)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        fetch(`${appUrl}/api/orders/${id}/run-pipeline`, { method: "POST" }).catch(() => {});

        return NextResponse.json({
          status: "PAID",
          label: STATUS_LABELS["PAID"],
          companyName: order.companyName,
          taskDescription: order.taskDescription || undefined,
        });
      }
    } catch (err) {
      console.error("Failed to poll checkout session:", err);
    }
  }

  // If PAID but pipeline hasn't started yet (no CLASSIFYING/EXECUTING), kick it off
  if (order.status === "PAID") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    fetch(`${appUrl}/api/orders/${id}/run-pipeline`, { method: "POST" }).catch(() => {});
  }

  // If stuck in CLASSIFYING or EXECUTING for >90 seconds, retry the pipeline
  if (
    (order.status === "CLASSIFYING" || order.status === "EXECUTING") &&
    order.updatedAt
  ) {
    const stuckSince = Date.now() - new Date(order.updatedAt).getTime();
    if (stuckSince > 90_000) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      fetch(`${appUrl}/api/orders/${id}/run-pipeline`, { method: "POST" }).catch(() => {});
    }
  }

  const response: {
    status: string;
    label: string;
    companyName: string;
    taskType?: string;
    taskDescription?: string;
    reportId?: string;
    errorMessage?: string;
  } = {
    status: order.status,
    label: STATUS_LABELS[order.status as OrderStatus] || order.status,
    companyName: order.companyName,
    taskType: order.taskType || undefined,
    taskDescription: order.taskDescription || undefined,
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

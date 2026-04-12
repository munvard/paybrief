import { NextRequest, NextResponse } from "next/server";
import { getOrder, getReportByOrderId } from "@/lib/db/queries";
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
    response.errorMessage = order.errorMessage || "An unexpected error occurred";
  }

  return NextResponse.json(response);
}

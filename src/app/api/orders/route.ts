import { NextRequest, NextResponse } from "next/server";
import { createOrder, getAllOrders } from "@/lib/db/queries";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyName, focusArea, email } = body;

    if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
      return NextResponse.json(
        { error: "Company name is required" },
        { status: 400 }
      );
    }

    const orderId = await createOrder({
      companyName: companyName.trim(),
      focusArea: focusArea || "all",
      email: email || undefined,
    });

    return NextResponse.json({ orderId });
  } catch (error) {
    console.error("Failed to create order:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const allOrders = await getAllOrders();
    return NextResponse.json({ orders: allOrders });
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

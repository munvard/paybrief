import { NextRequest, NextResponse } from "next/server";
import { getAllOrders, getTotalCosts } from "@/lib/db/queries";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const allOrders = await getAllOrders();
    const { total: totalCost, count: apiCallCount } = await getTotalCosts();

    const completedOrders = allOrders.filter((o) => o.status === "COMPLETED");
    const pricePerBrief = Number(process.env.BRIEF_PRICE_USDC) || 5;
    const totalRevenue = completedOrders.length * pricePerBrief;
    const netMargin = totalRevenue - totalCost;
    const marginPercent =
      totalRevenue > 0 ? ((netMargin / totalRevenue) * 100).toFixed(1) : "0";

    return NextResponse.json({
      orders: {
        total: allOrders.length,
        completed: completedOrders.length,
        failed: allOrders.filter((o) => o.status === "FAILED").length,
        pending: allOrders.filter(
          (o) => !["COMPLETED", "FAILED"].includes(o.status)
        ).length,
      },
      financials: {
        totalRevenue,
        totalCost: Number(totalCost.toFixed(4)),
        netMargin: Number(netMargin.toFixed(4)),
        marginPercent: `${marginPercent}%`,
        avgCostPerReport:
          completedOrders.length > 0
            ? Number((totalCost / completedOrders.length).toFixed(4))
            : 0,
        apiCallCount,
      },
      recentOrders: allOrders.slice(0, 20).map((o) => ({
        id: o.id,
        companyName: o.companyName,
        status: o.status,
        createdAt: o.createdAt,
        completedAt: o.completedAt,
      })),
    });
  } catch (error) {
    console.error("Admin costs error:", error);
    return NextResponse.json(
      { error: "Failed to fetch costs" },
      { status: 500 }
    );
  }
}

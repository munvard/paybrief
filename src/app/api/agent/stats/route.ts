import { NextResponse } from "next/server";
import { getAllOrders, getTotalCosts } from "@/lib/db/queries";
import { getBalance } from "@/lib/locus/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [allOrders, { total: totalCost, count: apiCallCount }, balance] =
      await Promise.all([getAllOrders(), getTotalCosts(), getBalance().catch(() => null)]);

    const completedOrders = allOrders.filter((o) => o.status === "COMPLETED");
    const pricePerJob = Number(process.env.BRIEF_PRICE_USDC) || 3;
    const totalRevenue = completedOrders.length * pricePerJob;
    const netProfit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0;

    // Task type breakdown
    const byType: Record<string, number> = {};
    for (const o of completedOrders) {
      const t = o.taskType || "general";
      byType[t] = (byType[t] || 0) + 1;
    }

    return NextResponse.json({
      walletBalance: balance?.usdc_balance || "0",
      walletAddress: balance?.wallet_address || "",
      jobsCompleted: completedOrders.length,
      jobsTotal: allOrders.length,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalCost: Number(totalCost.toFixed(4)),
      netProfit: Number(netProfit.toFixed(4)),
      marginPercent: Number(margin.toFixed(1)),
      apiCallCount,
      avgCostPerJob: completedOrders.length > 0
        ? Number((totalCost / completedOrders.length).toFixed(4))
        : 0,
      byTaskType: byType,
      recentJobs: allOrders.slice(0, 10).map((o) => ({
        id: o.id,
        task: o.taskDescription || o.companyName,
        taskType: o.taskType || "general",
        status: o.status,
        createdAt: o.createdAt,
      })),
    });
  } catch (error) {
    console.error("Agent stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agent stats" },
      { status: 500 }
    );
  }
}

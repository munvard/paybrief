"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface CostData {
  orders: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
  };
  financials: {
    totalRevenue: number;
    totalCost: number;
    netMargin: number;
    marginPercent: string;
    avgCostPerReport: number;
    apiCallCount: number;
  };
  recentOrders: Array<{
    id: string;
    companyName: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
  }>;
}

export default function AdminCostsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AdminCostsInner />
    </Suspense>
  );
}

function AdminCostsInner() {
  const searchParams = useSearchParams();
  const secret = searchParams.get("secret") || "";
  const [data, setData] = useState<CostData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!secret) {
      setError("Missing ?secret= parameter");
      return;
    }
    fetch(`/api/admin/costs?secret=${encodeURIComponent(secret)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [secret]);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight">
            Agent<span className="gradient-text">Zero</span>{" "}
            <span className="text-sm text-muted-foreground font-normal">
              Admin
            </span>
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 w-full">
        <h1 className="text-3xl font-bold mb-8">Revenue & Costs</h1>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Total Orders", value: data.orders.total },
            { label: "Completed", value: data.orders.completed },
            {
              label: "Revenue",
              value: `$${data.financials.totalRevenue.toFixed(2)}`,
            },
            {
              label: "Net Margin",
              value: `$${data.financials.netMargin.toFixed(2)} (${data.financials.marginPercent})`,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-card border border-border p-4"
            >
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-bold mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10">
          {[
            {
              label: "Total API Cost",
              value: `$${data.financials.totalCost.toFixed(4)}`,
            },
            {
              label: "Avg Cost/Report",
              value: `$${data.financials.avgCostPerReport.toFixed(4)}`,
            },
            { label: "API Calls", value: data.financials.apiCallCount },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-card border border-border p-4"
            >
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-xl font-bold mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Recent Orders */}
        <h2 className="text-xl font-bold mb-4">Recent Orders</h2>
        <div className="rounded-xl bg-card border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-4 py-3">Company</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((order) => (
                <tr key={order.id} className="border-b border-border/50">
                  <td className="px-4 py-3">{order.companyName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        order.status === "COMPLETED"
                          ? "bg-green-500/10 text-green-400"
                          : order.status === "FAILED"
                            ? "bg-red-500/10 text-red-400"
                            : "bg-yellow-500/10 text-yellow-400"
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {data.recentOrders.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    No orders yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

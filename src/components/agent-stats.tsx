"use client";

import { useEffect, useState } from "react";

interface Stats {
  walletBalance: string;
  jobsCompleted: number;
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
  marginPercent: number;
  apiCallCount: number;
  avgCostPerJob: number;
}

export function AgentStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/agent/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl bg-card border border-border p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-16 mb-2" />
            <div className="h-7 bg-muted rounded w-20" />
          </div>
        ))}
      </div>
    );
  }

  const items = [
    { label: "Wallet", value: `$${Number(stats.walletBalance).toFixed(2)}`, accent: true },
    { label: "Jobs Done", value: String(stats.jobsCompleted) },
    { label: "Revenue", value: `$${stats.totalRevenue.toFixed(2)}` },
    { label: "Margin", value: `${stats.marginPercent}%`, accent: stats.marginPercent > 90 },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-card border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
          <p className={`text-xl font-bold ${item.accent ? "gradient-text" : ""}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

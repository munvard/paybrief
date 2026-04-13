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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glow-card p-4 animate-pulse">
            <div className="h-3 bg-muted rounded w-16 mb-3" />
            <div className="h-8 bg-muted rounded w-24" />
          </div>
        ))}
      </div>
    );
  }

  const items = [
    { label: "WALLET BALANCE", value: `$${Number(stats.walletBalance).toFixed(2)}`, color: "text-accent" },
    { label: "JOBS COMPLETED", value: String(stats.jobsCompleted), color: "text-foreground" },
    { label: "TOTAL REVENUE", value: `$${stats.totalRevenue.toFixed(2)}`, color: "text-accent-green" },
    { label: "PROFIT MARGIN", value: `${stats.marginPercent}%`, color: stats.marginPercent > 90 ? "text-accent-green" : "text-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {items.map((item, i) => (
        <div
          key={item.label}
          className="glow-card glow-breathe p-4 animate-fade-up"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <p className="data-readout text-muted-foreground mb-2">{item.label}</p>
          <p className={`text-2xl font-bold font-mono tracking-tight ${item.color}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

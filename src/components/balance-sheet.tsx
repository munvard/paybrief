"use client";
import { useEffect, useState } from "react";

interface Stats {
  alive: number;
  dying: number;
  dead: number;
  totalUsdc: string;
  bornToday: number;
  deadToday: number;
  reproducedToday: number;
  revivedToday: number;
  callsToday: number;
}

export function BalanceSheet() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    const load = () => fetch("/api/stats").then((r) => r.json()).then(setS).catch(() => {});
    load();
    const iv = setInterval(load, 6000);
    return () => clearInterval(iv);
  }, []);

  const cells: { v: string | number; l: string }[] = [
    { v: s?.alive ?? "—", l: "Alive" },
    { v: s ? `$${Number(s.totalUsdc).toFixed(2)}` : "—", l: "Total USDC" },
    { v: s?.bornToday ?? "—", l: "Born today" },
    { v: s?.deadToday ?? "—", l: "Dead today" },
    { v: s?.reproducedToday ?? "—", l: "Reproduced" },
    { v: s?.callsToday ?? "—", l: "Calls today" },
  ];

  return (
    <section
      className="page-gutter container-xl"
      style={{
        borderTop: "1px solid var(--rule)",
        borderBottom: "1px solid var(--rule)",
        padding: "48px 96px",
      }}
    >
      <div className="f-caps" style={{ marginBottom: 32 }}>— The balance sheet</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 32,
        }}
      >
        {cells.map((c, i) => (
          <div key={i}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 44,
                fontWeight: 500,
                color: "var(--ink-0)",
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {c.v}
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--ink-2)",
                marginTop: 10,
              }}
            >
              {c.l}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

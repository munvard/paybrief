"use client";
import { useEffect, useState } from "react";

function romanMonth(m: number): string {
  return ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][m] ?? "—";
}

function formatDateLong(d: Date): string {
  const day = d.getDate();
  const month = d.toLocaleString("en-US", { month: "long" });
  return `${day} ${month} ${d.getFullYear()} ${romanMonth(d.getMonth())}`;
}

export function StatusBar() {
  const [alive, setAlive] = useState<number | null>(null);
  useEffect(() => {
    const load = () =>
      fetch("/api/stats")
        .then((r) => r.json())
        .then((j) => setAlive(Number(j.alive ?? 0)))
        .catch(() => setAlive(0));
    load();
    const iv = setInterval(load, 6000);
    return () => clearInterval(iv);
  }, []);
  const today = new Date();
  return (
    <div
      style={{
        height: 44,
        borderBottom: "1px solid var(--rule)",
        background: "var(--bg-0)",
      }}
    >
      <div
        className="page-gutter container-xl"
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--ink-2)",
          letterSpacing: "0.04em",
        }}
      >
        <div>
          <span className="status-dot alive" style={{ marginRight: 10, verticalAlign: "middle" }} />
          LIVE · {alive ?? "…"} {alive === 1 ? "business" : "businesses"} breathing
        </div>
        <div>{formatDateLong(today)}</div>
      </div>
    </div>
  );
}

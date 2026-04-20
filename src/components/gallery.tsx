"use client";
import { useEffect, useState } from "react";
import { BusinessCard, type Business } from "./business-card";

export function Gallery() {
  const [all, setAll] = useState<Business[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    async function refresh() {
      try {
        const r = await fetch("/api/biz");
        const j = await r.json();
        setAll(j.businesses ?? []);
      } catch {
        // ignore
      }
    }
    refresh();
    const iv = setInterval(refresh, 10000);
    return () => clearInterval(iv);
  }, []);

  const filtered = filter === "all" ? all : all.filter((b) => b.status === filter);
  const filters = ["all", "alive", "dying", "dead", "conceived", "deploying"];
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, fontFamily: "ui-monospace, monospace", fontSize: 13 }}>
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "4px 10px",
              background: filter === f ? "#ff6b35" : "#1a1a1a",
              color: filter === f ? "#000" : "#f5f5dc",
              border: "1px solid #333",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            {f} {filter === f && all.filter((b) => f === "all" || b.status === f).length}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div style={{ opacity: 0.5, padding: "2rem", textAlign: "center" }}>
          No businesses {filter !== "all" ? filter : ""} yet.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((b) => (
            <BusinessCard key={b.id} b={b} />
          ))}
        </div>
      )}
    </div>
  );
}

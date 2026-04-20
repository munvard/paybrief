"use client";
import { useEffect, useMemo, useState } from "react";
import { BusinessCard, type Business } from "./business-card";

const FILTERS = [
  { k: "all", l: "All" },
  { k: "alive", l: "Alive" },
  { k: "dying", l: "Dying" },
  { k: "dead", l: "Dead" },
  { k: "conceived", l: "Newborn" },
];

export function Gallery({ featuredId }: { featuredId?: string | null }) {
  const [all, setAll] = useState<Business[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    async function refresh() {
      try {
        const r = await fetch("/api/biz");
        const j = await r.json();
        setAll(j.businesses ?? []);
      } catch {
        /* ignore */
      }
    }
    refresh();
    const iv = setInterval(refresh, 10000);
    return () => clearInterval(iv);
  }, []);

  const visible = useMemo(() => {
    let rows = filter === "all" ? all : all.filter((b) => b.status === filter);
    if (featuredId) rows = rows.filter((b) => b.id !== featuredId);
    return rows;
  }, [all, filter, featuredId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const b of all) c[b.status] = (c[b.status] ?? 0) + 1;
    return c;
  }, [all]);

  return (
    <section className="page-gutter container-xl" style={{ padding: "0 96px 48px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <div className="f-caps">— The gallery</div>
        <div
          style={{
            display: "flex",
            gap: 24,
            fontFamily: "var(--font-body)",
            fontSize: 14,
          }}
        >
          {FILTERS.map((f) => {
            const active = filter === f.k;
            const n = counts[f.k] ?? 0;
            return (
              <button
                key={f.k}
                onClick={() => setFilter(f.k)}
                style={{
                  background: "transparent",
                  border: 0,
                  padding: 0,
                  cursor: "pointer",
                  color: active ? "var(--ink-0)" : "var(--ink-2)",
                  borderBottom: active ? "1px solid var(--forge)" : "1px solid transparent",
                  paddingBottom: 4,
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  letterSpacing: "0.02em",
                }}
              >
                {f.l}{" "}
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-2)" }}>
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <div
          style={{
            padding: "48px 0",
            textAlign: "center",
            fontFamily: "var(--font-body)",
            fontStyle: "italic",
            color: "var(--ink-2)",
            borderTop: "1px solid var(--rule)",
          }}
        >
          The registry is quiet in this category.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0 48px",
          }}
        >
          {visible.map((b) => (
            <BusinessCard key={b.id} b={b} />
          ))}
        </div>
      )}
    </section>
  );
}

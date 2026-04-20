"use client";
import { useEffect, useState } from "react";

interface Event {
  id: string;
  kind: "birth" | "call" | "reproduce" | "die" | "revive" | "pulse";
  businessId: string;
  businessName: string;
  amount?: string;
  at: string;
}

function relTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatLine(e: Event): { glyph: string; text: string; accent: string } {
  const name = e.businessName.length > 26 ? e.businessName.slice(0, 26) + "…" : e.businessName;
  const amt = Number(e.amount ?? 0);
  switch (e.kind) {
    case "birth":   return { glyph: "✶", text: `${name} — ALIVE`, accent: "var(--mint)" };
    case "call":    return { glyph: "→", text: `${name} · call +$${amt.toFixed(2)}`, accent: "var(--forge)" };
    case "reproduce": return { glyph: "✽", text: `${name} · reproduced`, accent: "var(--gold)" };
    case "die":     return { glyph: "†", text: `${name} · d.`, accent: "var(--blood)" };
    case "revive":  return { glyph: "↻", text: `${name} · revived +$${amt.toFixed(2)}`, accent: "var(--mint)" };
    case "pulse":   return { glyph: "·", text: `${name} · pulse $${amt.toFixed(2)}`, accent: "var(--ink-2)" };
  }
}

export function EventStream({ limit = 12 }: { limit?: number }) {
  const [events, setEvents] = useState<Event[]>([]);
  useEffect(() => {
    const load = () =>
      fetch("/api/events")
        .then((r) => r.json())
        .then((j) => setEvents((j.events ?? []).slice(0, limit)))
        .catch(() => {});
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [limit]);

  return (
    <div>
      <div className="f-caps" style={{ marginBottom: 20 }}>— Live</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {events.length === 0 && (
          <div style={{ fontFamily: "var(--font-body)", fontStyle: "italic", color: "var(--ink-2)" }}>
            Quiet — waiting for the first pulse.
          </div>
        )}
        {events.map((e) => {
          const f = formatLine(e);
          return (
            <div
              key={e.id}
              style={{
                display: "grid",
                gridTemplateColumns: "18px 1fr auto",
                alignItems: "baseline",
                gap: 12,
                paddingBottom: 12,
                borderBottom: "1px solid var(--rule)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  color: f.accent,
                  fontSize: 15,
                  lineHeight: 1,
                }}
              >
                {f.glyph}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 15,
                  color: "var(--ink-0)",
                }}
              >
                {f.text}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--ink-2)",
                  fontSize: 12,
                }}
              >
                {relTime(e.at)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

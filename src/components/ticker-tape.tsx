"use client";
import { useEffect, useState } from "react";

interface UnifiedEvent {
  id: string;
  kind: "birth" | "call" | "reproduce" | "die" | "revive" | "pulse";
  businessId: string;
  businessName: string;
  amount?: string;
  at: string;
}

function shortId(id: string): string {
  return `#${id.replace(/^biz_/, "").slice(-4).toUpperCase()}`;
}
function formatEvent(e: UnifiedEvent): string {
  const short = shortId(e.businessId);
  const name = e.businessName.length > 28 ? e.businessName.slice(0, 28) + "…" : e.businessName;
  switch (e.kind) {
    case "birth":   return `${short} ${name} · ALIVE`;
    case "call":    return `${short} ${name} +$${Number(e.amount ?? 0).toFixed(2)}`;
    case "reproduce": return `${short} ${name} → child conceived`;
    case "die":     return `${short} ${name} † ∘ d.`;
    case "revive":  return `${short} ${name} · REVIVED`;
    case "pulse":   return `${short} ${name} · pulse $${Number(e.amount ?? 0).toFixed(2)}`;
  }
}
function dotClass(kind: UnifiedEvent["kind"]): string {
  if (kind === "die") return "dead";
  if (kind === "pulse") return "dying";
  return "alive";
}

const FALLBACK: UnifiedEvent[] = [
  { id: "f1", kind: "birth", businessId: "biz_haiku", businessName: "Shakespeare Haiku Bot", amount: "0.50", at: new Date().toISOString() },
  { id: "f2", kind: "call", businessId: "biz_roast", businessName: "Code Roaster", amount: "0.05", at: new Date().toISOString() },
  { id: "f3", kind: "reproduce", businessId: "biz_pitch", businessName: "Pitch Oracle", amount: "3.20", at: new Date().toISOString() },
  { id: "f4", kind: "revive", businessId: "biz_emoji", businessName: "Emoji Diplomat", amount: "1.00", at: new Date().toISOString() },
  { id: "f5", kind: "die", businessId: "biz_echo", businessName: "Echo Chamber", amount: "0.00", at: new Date().toISOString() },
  { id: "f6", kind: "call", businessId: "biz_cocktail", businessName: "Cocktail Alchemist", amount: "0.10", at: new Date().toISOString() },
];

export function TickerTape() {
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  useEffect(() => {
    const load = () =>
      fetch("/api/events")
        .then((r) => r.json())
        .then((j) => setEvents(j.events ?? []))
        .catch(() => {});
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, []);

  const source = events.length > 0 ? events : FALLBACK;
  const stream = [...source, ...source, ...source];

  return (
    <div
      style={{
        height: 44,
        borderBottom: "1px solid var(--rule)",
        background: "var(--bg-1)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "100%",
          whiteSpace: "nowrap",
          animation: "drift 120s linear infinite",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          color: "var(--ink-1)",
          willChange: "transform",
        }}
      >
        {stream.map((e, i) => (
          <span
            key={`${e.id}-${i}`}
            style={{ padding: "0 22px", display: "inline-flex", alignItems: "center", gap: 10 }}
          >
            <span className={`status-dot ${dotClass(e.kind)}`} style={{ width: 6, height: 6 }} />
            {formatEvent(e)}
            <span style={{ color: "var(--ink-2)", marginLeft: 10 }}>·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

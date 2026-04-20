import { getDb, schema } from "@/lib/db";
import { desc, inArray } from "drizzle-orm";

interface TickerEvent {
  kind: "birth" | "call" | "reproduce" | "die" | "revive" | "pulse";
  businessId: string;
  businessName: string;
  amount?: string;
  at: Date;
}

export const revalidate = 3;

async function loadEvents(): Promise<TickerEvent[]> {
  const events: TickerEvent[] = [];
  try {
    const db = getDb();
    const recent = await db
      .select()
      .from(schema.businesses)
      .orderBy(desc(schema.businesses.statusChangedAt))
      .limit(20);
    const idToName = new Map(recent.map((b) => [b.id, b.name]));
    for (const b of recent) {
      const kind: TickerEvent["kind"] =
        b.status === "alive" ? "birth"
        : b.status === "dead" ? "die"
        : b.status === "dying" ? "pulse"
        : b.status === "conceived" || b.status === "deploying" || b.status === "gestating" ? "birth"
        : "pulse";
      events.push({
        kind,
        businessId: b.id,
        businessName: b.name,
        amount: String(b.walletBalanceCached),
        at: b.statusChangedAt,
      });
    }

    const calls = await db
      .select()
      .from(schema.calls)
      .orderBy(desc(schema.calls.createdAt))
      .limit(10);
    for (const c of calls) {
      events.push({
        kind: "call",
        businessId: c.businessId,
        businessName: idToName.get(c.businessId) ?? c.businessId.slice(-6),
        amount: String(c.revenueUsdc),
        at: c.createdAt,
      });
    }
  } catch {
    // swallow — caller falls back
  }

  return events
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 20);
}

function shortId(id: string): string {
  return `#${id.replace(/^biz_/, "").slice(-4).toUpperCase()}`;
}

function formatEvent(e: TickerEvent): string {
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

function dotClass(kind: TickerEvent["kind"]): string {
  if (kind === "die") return "dead";
  if (kind === "pulse") return "dying";
  return "alive";
}

export async function TickerTape() {
  const events = await loadEvents();
  const fallback: TickerEvent[] = events.length === 0
    ? [
        { kind: "birth", businessId: "biz_haiku", businessName: "Shakespeare Haiku Bot", amount: "0.50", at: new Date() },
        { kind: "call", businessId: "biz_roast", businessName: "Code Roaster", amount: "0.05", at: new Date() },
        { kind: "reproduce", businessId: "biz_pitch", businessName: "Pitch Oracle", amount: "3.20", at: new Date() },
        { kind: "revive", businessId: "biz_emoji", businessName: "Emoji Diplomat", amount: "1.00", at: new Date() },
        { kind: "die", businessId: "biz_echo", businessName: "Echo Chamber", amount: "0.00", at: new Date() },
        { kind: "call", businessId: "biz_cocktail", businessName: "Cocktail Alchemist", amount: "0.10", at: new Date() },
      ]
    : events;

  const stream = [...fallback, ...fallback, ...fallback];

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
            key={`${e.businessId}-${i}`}
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

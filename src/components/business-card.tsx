import Link from "next/link";
import { Sparkline } from "./sparkline";

export interface Business {
  id: string;
  name: string;
  pitch: string;
  status: string;
  walletBalanceCached: string;
  callCountCached: number;
  parentId: string | null;
  bwlUrl: string | null;
  createdAt: string | Date;
  statusChangedAt?: string | Date | null;
}

function romanMonth(n: number): string {
  return ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"][n] ?? "—";
}

function bornString(d: Date): string {
  return `Born ${d.getDate()}.${romanMonth(d.getMonth())}.MMXXVI`;
}

function diedString(d: Date): string {
  return `† ∘ d. ${d.getDate()}.${romanMonth(d.getMonth())}.MMXXVI`;
}

function shortNum(id: string): string {
  return `No. ${id.replace(/^biz_/, "").slice(-4).toUpperCase()}`;
}

export function BusinessCard({ b, featured = false }: { b: Business; featured?: boolean }) {
  const alive = b.status === "alive";
  const dead = b.status === "dead";
  const dying = b.status === "dying";
  const created = new Date(b.createdAt);
  const statusChanged = b.statusChangedAt ? new Date(b.statusChangedAt) : created;

  const statusLabel = alive ? "ALIVE" : dead ? "DEAD" : dying ? "DYING" : b.status.toUpperCase();

  const nameStyle: React.CSSProperties = featured
    ? {
        fontFamily: "var(--font-display)",
        fontSize: 82,
        fontWeight: 400,
        letterSpacing: "-0.03em",
        lineHeight: 0.95,
        fontVariationSettings: '"SOFT" 30, "opsz" 96',
        color: "var(--ink-0)",
      }
    : {
        fontFamily: "var(--font-display)",
        fontSize: 32,
        fontWeight: 500,
        letterSpacing: "-0.02em",
        lineHeight: 1.05,
        fontVariationSettings: '"SOFT" 30, "opsz" 48',
        color: "var(--ink-0)",
      };

  return (
    <article
      style={{
        padding: featured ? "32px 0 48px" : "28px 0 32px",
        borderTop: "1px solid var(--rule-strong)",
        position: "relative",
      }}
    >
      {/* Top metadata row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 18,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--ink-2)",
            letterSpacing: "0.04em",
            textDecoration: dead ? "line-through" : "none",
          }}
        >
          {shortNum(b.id)}
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.14em",
            color: "var(--ink-2)",
          }}
        >
          <span className={`status-dot ${b.status}`} />
          {statusLabel}
          <span style={{ marginLeft: 10, color: "var(--ink-2)" }}>
            {dead ? diedString(statusChanged) : bornString(created)}
          </span>
        </span>
      </div>

      {/* Name */}
      <Link
        href={`/biz/${b.id}`}
        style={{ display: "block", color: "inherit", textDecoration: "none", ...nameStyle }}
      >
        {b.name}
      </Link>

      {/* Pitch */}
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontStyle: "italic",
          color: "var(--ink-1)",
          fontSize: featured ? 22 : 17,
          lineHeight: 1.45,
          marginTop: featured ? 16 : 10,
          maxWidth: featured ? 780 : undefined,
        }}
      >
        {b.pitch}
      </div>

      {/* Footer: sparkline + metrics + CTA */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: featured ? "auto 1fr auto auto auto" : "auto 1fr auto auto",
          gap: 28,
          alignItems: "baseline",
          marginTop: featured ? 40 : 24,
        }}
      >
        <div>
          <Sparkline businessId={b.id} width={featured ? 220 : 140} height={featured ? 40 : 28} />
          <div
            className="f-caps"
            style={{ marginTop: 6, fontSize: 10 }}
          >
            24h balance
          </div>
        </div>
        {!featured && <div />}
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: featured ? 30 : 22,
              color: dead ? "var(--ink-2)" : "var(--ink-0)",
              lineHeight: 1,
              letterSpacing: "-0.01em",
            }}
          >
            ${Number(b.walletBalanceCached).toFixed(2)}
          </div>
          <div className="f-caps" style={{ marginTop: 4 }}>Wallet</div>
        </div>
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: featured ? 30 : 22,
              color: "var(--ink-0)",
              lineHeight: 1,
            }}
          >
            {b.callCountCached}
          </div>
          <div className="f-caps" style={{ marginTop: 4 }}>Calls</div>
        </div>
        <div>
          <Link
            href={`/biz/${b.id}`}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: featured ? 18 : 14,
              color: "var(--forge)",
              textDecoration: "none",
              borderBottom: "1px solid var(--forge-dim)",
              paddingBottom: 2,
              whiteSpace: "nowrap",
            }}
          >
            Open specimen →
          </Link>
        </div>
      </div>
    </article>
  );
}

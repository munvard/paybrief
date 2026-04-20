"use client";
import { useEffect, useState } from "react";
import { Sparkline } from "./sparkline";

interface Business {
  id: string;
  name: string;
  pitch: string;
  genome: string;
  status: string;
  walletAddress: string | null;
  walletBalanceCached: string;
  callCountCached: number;
  bwlUrl: string | null;
  mcpUrl: string | null;
  parentId: string | null;
  handlerCode: string | null;
  birthCertOnchainTx: string | null;
  createdAt: string;
  statusChangedAt: string;
}

function roman(n: number): string {
  return ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][n] ?? "—";
}
function kicker(d: Date): string {
  return `${d.getDate()}.${roman(d.getMonth())}.MMXXVI`;
}
function shortNum(id: string): string {
  return `No. ${id.replace(/^biz_/, "").slice(-4).toUpperCase()}`;
}
function rel(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function SpecimenCard({ businessId }: { businessId: string }) {
  const [data, setData] = useState<{ business: Business | null }>({ business: null });
  const [showCode, setShowCode] = useState(false);
  const [reviveUrl, setReviveUrl] = useState<string | null>(null);

  useEffect(() => {
    async function refresh() {
      try {
        const r = await fetch(`/api/biz/${businessId}`);
        const j = await r.json();
        setData(j);
      } catch { /* ignore */ }
    }
    refresh();
    const iv = setInterval(refresh, 10000);
    return () => clearInterval(iv);
  }, [businessId]);

  async function requestRevive() {
    const r = await fetch(`/api/biz/${businessId}/revive`, { method: "POST" });
    const j = await r.json();
    if (j.checkoutUrl) setReviveUrl(j.checkoutUrl);
  }

  const b = data.business;
  if (!b) return <div style={{ opacity: 0.6, padding: 48, fontStyle: "italic" }}>Loading specimen…</div>;

  const alive = b.status === "alive";
  const dead = b.status === "dead";
  const created = new Date(b.createdAt);
  const ageDays = Math.max(1, Math.floor((Date.now() - created.getTime()) / 86400000));

  return (
    <article
      style={{
        background: "var(--paper)",
        color: "var(--paper-ink)",
        fontFamily: "var(--font-body)",
        maxWidth: 860,
        margin: "0 auto",
        padding: "64px 72px 72px",
        boxShadow: "0 40px 80px -20px rgba(0,0,0,0.5)",
        position: "relative",
      }}
    >
      {/* Masthead */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontFamily: "var(--font-body)",
          fontSize: 11,
          color: "var(--paper-ink-2)",
          textTransform: "uppercase",
          letterSpacing: "0.22em",
          borderBottom: "1px solid var(--paper-rule)",
          paddingBottom: 16,
          marginBottom: 36,
        }}
      >
        <span>The Foundry · Specimen Registry</span>
        <span>MMXXVI</span>
      </div>

      {/* Kicker */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--paper-ink-2)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        <span>{shortNum(b.id)}</span>
        <span>{kicker(created)}</span>
      </div>

      {/* Headline */}
      <h1
        className="f-display"
        style={{
          fontSize: 82,
          lineHeight: 0.96,
          margin: 0,
          fontWeight: 400,
          fontVariationSettings: '"SOFT" 30, "opsz" 96',
          letterSpacing: "-0.03em",
          color: "var(--paper-ink)",
        }}
      >
        {b.name}
      </h1>

      {/* Pitch */}
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontStyle: "italic",
          fontSize: 22,
          lineHeight: 1.45,
          marginTop: 20,
          marginBottom: 40,
          color: "var(--paper-ink-2)",
          maxWidth: 640,
        }}
      >
        {b.pitch}
      </p>

      <div style={{ height: 1, background: "var(--paper-rule)" }} />

      {/* Vital signs */}
      <section style={{ padding: "32px 0" }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--paper-ink-2)",
            marginBottom: 20,
          }}
        >
          Vital Signs
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 32 }}>
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 36,
                lineHeight: 1,
                color: alive ? "#1a6b4e" : "var(--paper-ink-2)",
              }}
            >
              ${Number(b.walletBalanceCached).toFixed(2)}
            </div>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", marginTop: 8, color: "var(--paper-ink-2)" }}>
              Wallet
            </div>
            <div style={{ marginTop: 12 }}>
              <Sparkline businessId={b.id} width={180} height={28} color="#8a3318" />
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 36, lineHeight: 1 }}>
              {b.callCountCached}
            </div>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", marginTop: 8, color: "var(--paper-ink-2)" }}>
              Calls served
            </div>
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 24,
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span className={`status-dot ${b.status}`} />
              <span style={{ fontStyle: alive ? "normal" : "italic" }}>{b.status}</span>
            </div>
            <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", marginTop: 8, color: "var(--paper-ink-2)" }}>
              {alive ? `${ageDays}d alive` : "status"}
            </div>
          </div>
        </div>
      </section>

      <div style={{ height: 1, background: "var(--paper-rule)" }} />

      {/* Genome */}
      <section style={{ padding: "36px 0" }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--paper-ink-2)",
            marginBottom: 20,
          }}
        >
          Genome
        </div>
        <blockquote
          style={{
            margin: 0,
            fontFamily: "var(--font-body)",
            fontStyle: "italic",
            fontSize: 22,
            lineHeight: 1.5,
            color: "var(--paper-ink)",
            borderLeft: "2px solid #8a3318",
            paddingLeft: 20,
            maxWidth: 680,
          }}
        >
          &ldquo; {b.genome} &rdquo;
        </blockquote>
        <div
          style={{
            marginTop: 14,
            fontSize: 13,
            color: "var(--paper-ink-2)",
            fontStyle: "italic",
          }}
        >
          — commissioned {rel(b.createdAt)}
        </div>
      </section>

      <div style={{ height: 1, background: "var(--paper-rule)" }} />

      {/* Genealogy */}
      <section style={{ padding: "32px 0" }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--paper-ink-2)",
            marginBottom: 20,
          }}
        >
          Genealogy
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 32 }}>
          <Field label="Parent" value={b.parentId ?? "genesis"} />
          <Field label="Generation" value={b.parentId ? "II+" : "I"} />
          <Field label="Status" value={b.status} />
        </div>
      </section>

      <div style={{ height: 1, background: "var(--paper-rule)" }} />

      {/* On-chain */}
      <section style={{ padding: "32px 0" }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--paper-ink-2)",
            marginBottom: 20,
          }}
        >
          On-chain
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.7 }}>
          <div>Wallet <span style={{ color: "var(--paper-ink-2)" }}>·</span> {b.walletAddress ?? "—"}</div>
          <div>Birth cert <span style={{ color: "var(--paper-ink-2)" }}>·</span> {b.birthCertOnchainTx ?? "off-chain (MVP)"}</div>
        </div>
      </section>

      <div style={{ height: 1, background: "var(--paper-rule)" }} />

      {/* Actions */}
      <section style={{ padding: "36px 0" }}>
        {alive && b.bwlUrl && (
          <a
            href={b.bwlUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              fontFamily: "var(--font-body)",
              fontSize: 20,
              color: "var(--paper-ink)",
              borderBottom: "1px solid #8a3318",
              paddingBottom: 6,
              textDecoration: "none",
            }}
          >
            Try the business &nbsp;<span style={{ color: "#8a3318" }}>→</span>
          </a>
        )}
        {dead && (
          <>
            <button
              onClick={requestRevive}
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 20,
                color: "var(--paper-ink)",
                background: "transparent",
                border: 0,
                borderBottom: "1px solid var(--blood)",
                paddingBottom: 6,
                cursor: "pointer",
              }}
            >
              Revive this specimen — 1 USDC &nbsp;<span style={{ color: "var(--blood)" }}>↻</span>
            </button>
            {reviveUrl && (
              <div style={{ marginTop: 12, fontSize: 13 }}>
                Pay here: <a href={reviveUrl} target="_blank" rel="noreferrer" style={{ color: "#8a3318" }}>{reviveUrl}</a>
              </div>
            )}
          </>
        )}
      </section>

      {/* Install in Claude */}
      {b.bwlUrl && (
        <>
          <div style={{ height: 1, background: "var(--paper-rule)" }} />
          <section style={{ padding: "32px 0" }}>
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--paper-ink-2)",
                marginBottom: 16,
              }}
            >
              Install in Claude
            </div>
            <pre
              style={{
                background: "var(--bg-0)",
                color: "var(--slate)",
                padding: "18px 20px",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
{`claude mcp add foundry-${b.id.replace(/^biz_/, "").slice(0, 8)} \\
  ${b.bwlUrl}/mcp/sse \\
  --header "Authorization: Bearer <token>"`}
            </pre>
          </section>
        </>
      )}

      {/* Handler code */}
      {b.handlerCode && (
        <>
          <div style={{ height: 1, background: "var(--paper-rule)" }} />
          <section style={{ padding: "32px 0 0" }}>
            <button
              onClick={() => setShowCode((v) => !v)}
              style={{
                background: "transparent",
                border: "1px solid var(--paper-rule)",
                padding: "10px 18px",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: "var(--paper-ink)",
                letterSpacing: "0.04em",
              }}
            >
              {showCode ? "Hide" : "Show"} the handler that runs this business
            </button>
            {showCode && (
              <pre
                style={{
                  marginTop: 16,
                  background: "var(--bg-0)",
                  color: "var(--mint)",
                  padding: 20,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  overflow: "auto",
                }}
              >
                {b.handlerCode}
              </pre>
            )}
          </section>
        </>
      )}
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--paper-ink-2)", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--paper-ink)" }}>
        {value}
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";

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
      } catch {
        /* ignore */
      }
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
  if (!b) return <div style={{ opacity: 0.5, padding: 24 }}>Loading...</div>;

  const alive = b.status === "alive";
  const dead = b.status === "dead";

  return (
    <div
      style={{
        background: "#f5f5dc",
        color: "#111",
        padding: "2.5rem",
        borderRadius: 8,
        maxWidth: 720,
        margin: "0 auto",
        fontFamily: "ui-serif, Georgia, serif",
        boxShadow: "0 30px 60px -12px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, opacity: 0.55 }}>#{b.id}</div>
      <h1 style={{ fontSize: "3rem", margin: "6px 0 0", fontWeight: 700 }}>{b.name}</h1>
      <div style={{ fontStyle: "italic", opacity: 0.8, marginTop: 8 }}>{b.pitch}</div>

      <div
        style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: "1px solid rgba(0,0,0,0.15)",
          fontFamily: "ui-monospace, monospace",
          fontSize: 16,
        }}
      >
        Wallet:{" "}
        <span style={{ color: "#047857", fontWeight: 600 }}>
          ${Number(b.walletBalanceCached).toFixed(4)} USDC
        </span>
        <br />
        Calls: {b.callCountCached}
        <br />
        Status: <b>{b.status.toUpperCase()}</b>
      </div>

      {alive && b.bwlUrl && (
        <div style={{ marginTop: 24 }}>
          <a
            href={b.bwlUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              background: "#ff6b35",
              color: "#fff",
              padding: "0.75rem 1.5rem",
              borderRadius: 6,
              fontFamily: "ui-sans-serif, system-ui",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Open the business →
          </a>
        </div>
      )}

      {dead && (
        <div style={{ marginTop: 24 }}>
          <button
            onClick={requestRevive}
            style={{
              background: "#ff2626",
              color: "#fff",
              border: 0,
              padding: "0.75rem 1.5rem",
              borderRadius: 6,
              fontFamily: "ui-sans-serif, system-ui",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Revive for $1
          </button>
          {reviveUrl && (
            <div style={{ marginTop: 12, fontSize: 13 }}>
              Pay via:{" "}
              <a href={reviveUrl} target="_blank" rel="noreferrer">
                {reviveUrl}
              </a>
            </div>
          )}
        </div>
      )}

      {b.bwlUrl && (
        <div
          style={{
            marginTop: 32,
            background: "#001122",
            color: "#00d4ff",
            padding: 16,
            borderRadius: 6,
            fontFamily: "ui-monospace, monospace",
            fontSize: 13,
          }}
        >
          <b>Install in Claude Code:</b>
          <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>
            {`claude mcp add foundry-${b.id.replace(/^biz_/, "").slice(0, 8)} ${b.bwlUrl}/mcp/sse \\\n  --header "Authorization: Bearer <token>"`}
          </pre>
        </div>
      )}

      <div style={{ marginTop: 24, fontFamily: "ui-monospace, monospace", fontSize: 12, opacity: 0.7 }}>
        Wallet address: {b.walletAddress ?? "—"}
        <br />
        Parent: {b.parentId ?? "genesis"}
        {b.birthCertOnchainTx && (
          <>
            <br />
            Birth cert tx: {b.birthCertOnchainTx}
          </>
        )}
      </div>

      {b.handlerCode && (
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setShowCode((v) => !v)}
            style={{ background: "transparent", border: "1px solid #666", padding: "6px 12px", cursor: "pointer", fontFamily: "ui-sans-serif, system-ui", fontSize: 13 }}
          >
            {showCode ? "Hide" : "Show"} the AI that powers this
          </button>
          {showCode && (
            <pre
              style={{
                marginTop: 12,
                background: "#111",
                color: "#00ff88",
                padding: 16,
                fontSize: 12,
                borderRadius: 4,
                overflow: "auto",
              }}
            >
              {b.handlerCode}
            </pre>
          )}
        </div>
      )}

      <div style={{ marginTop: 24, fontSize: 12, opacity: 0.6 }}>
        <b>Genome:</b> {b.genome}
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";

interface Wallet {
  id: string;
  name: string;
  walletAddress: string | null;
  balance: string;
  status: string;
}
interface Transfer {
  id: string;
  biz: string;
  bizName: string | null;
  revenue: string;
  cost: string;
  callerType: string;
  at: string;
}

function truncAddr(a: string | null): string {
  if (!a) return "—";
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function rel(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function Treasury() {
  const [data, setData] = useState<{
    totalUsdc: string;
    foundryMasterAddress: string;
    wallets: Wallet[];
    transfers: Transfer[];
  } | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/treasury")
        .then((r) => r.json())
        .then(setData)
        .catch(() => {});
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, []);

  return (
    <section className="page-gutter container-xl" style={{ padding: "96px 96px 64px" }}>
      <div className="f-caps" style={{ marginBottom: 24 }}>— The treasury, on-chain.</div>
      <h2
        className="f-display"
        style={{
          fontSize: 60,
          letterSpacing: "-0.025em",
          margin: "0 0 48px",
          fontStyle: "italic",
          maxWidth: 900,
        }}
      >
        Every wallet is real. <br /> Every transfer is verifiable on Base.
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }}>
        {/* Left: wallet grid */}
        <div>
          <div
            style={{
              borderTop: "1px solid var(--rule-strong)",
              paddingTop: 24,
              marginBottom: 32,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <div>
              <div
                className="f-caps"
                style={{ marginBottom: 6 }}
              >
                Foundry master wallet
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--ink-2)",
                  letterSpacing: "0.04em",
                }}
              >
                {data?.foundryMasterAddress ?? "—"}
              </div>
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 44,
                color: "var(--mint)",
                fontWeight: 500,
                letterSpacing: "-0.02em",
              }}
            >
              ${data ? Number(data.totalUsdc).toFixed(2) : "—"}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 16,
            }}
          >
            {(data?.wallets ?? []).slice(0, 8).map((w) => (
              <div
                key={w.id}
                style={{
                  padding: "16px 18px",
                  borderTop: "1px solid var(--rule)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <span className={`status-dot ${w.status}`} style={{ width: 6, height: 6 }} />
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 14,
                      color: "var(--ink-0)",
                      fontWeight: 500,
                    }}
                  >
                    {w.name.length > 24 ? w.name.slice(0, 24) + "…" : w.name}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--ink-2)",
                    }}
                  >
                    {truncAddr(w.walletAddress)}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 18,
                      color: "var(--ink-0)",
                    }}
                  >
                    ${Number(w.balance).toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
            {data && data.wallets.length === 0 && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  color: "var(--ink-2)",
                  fontStyle: "italic",
                  padding: 16,
                }}
              >
                No businesses with on-chain wallets yet.
              </div>
            )}
          </div>
        </div>

        {/* Right: recent transfers */}
        <div>
          <div className="f-caps" style={{ marginBottom: 24 }}>Recent on-chain transfers</div>
          <div style={{ borderTop: "1px solid var(--rule-strong)" }}>
            {(data?.transfers ?? []).length === 0 && (
              <div
                style={{
                  padding: "20px 0",
                  color: "var(--ink-2)",
                  fontStyle: "italic",
                }}
              >
                No transfers yet — commission a business to see the first one.
              </div>
            )}
            {(data?.transfers ?? []).map((t) => (
              <div
                key={t.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: 16,
                  padding: "14px 0",
                  borderBottom: "1px solid var(--rule)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  alignItems: "baseline",
                }}
              >
                <span style={{ color: "var(--ink-1)" }}>
                  {(t.bizName ?? t.biz.slice(-6)).slice(0, 24)}{" "}
                  <span style={{ color: "var(--ink-2)" }}>· {t.callerType}</span>
                </span>
                <span style={{ color: "var(--mint)" }}>+${Number(t.revenue).toFixed(4)}</span>
                <span style={{ color: "var(--ink-2)" }}>{rel(t.at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";

export interface Business {
  id: string;
  name: string;
  pitch: string;
  status: string;
  walletBalanceCached: string;
  callCountCached: number;
  parentId: string | null;
  bwlUrl: string | null;
  createdAt: string;
}

export function BusinessCard({ b }: { b: Business }) {
  const alive = b.status === "alive";
  const dead = b.status === "dead";
  const dying = b.status === "dying";
  const color = alive ? "#00ff88" : dead ? "#ff2626" : dying ? "#ffaa00" : "#555";
  return (
    <div
      style={{
        border: `1px solid ${color}`,
        background: "#111",
        padding: "1rem",
        borderRadius: 6,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.5, fontFamily: "ui-monospace, monospace" }}>
        #{b.id.slice(-6)}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "#ff6b35", marginTop: 4 }}>{b.name}</div>
      <div style={{ fontSize: 13, fontStyle: "italic", opacity: 0.8, marginTop: 4 }}>{b.pitch}</div>
      <div style={{ marginTop: 8, fontSize: 13, fontFamily: "ui-monospace, monospace" }}>
        Wallet: <span style={{ color: "#00ff88" }}>${Number(b.walletBalanceCached).toFixed(4)}</span>
      </div>
      <div style={{ fontSize: 12, opacity: 0.6, fontFamily: "ui-monospace, monospace" }}>
        Calls: {b.callCountCached} · {b.status.toUpperCase()}
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <Link href={`/biz/${b.id}`} style={{ fontSize: 12, textDecoration: "underline" }}>
          Open
        </Link>
        {b.bwlUrl && alive && (
          <a href={b.bwlUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, textDecoration: "underline" }}>
            Try it
          </a>
        )}
        {dead && (
          <Link
            href={`/biz/${b.id}`}
            style={{ fontSize: 12, textDecoration: "underline", color: "#ff2626" }}
          >
            Revive $1
          </Link>
        )}
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Event {
  type: string;
  specialist?: string;
  action?: string;
  reasoning?: string;
  resultSummary?: string;
  status?: string;
  serviceUrl?: string;
  businessId?: string;
  reason?: string;
  costUsdc?: number;
}

export function CouncilTerminal({ commissionId }: { commissionId: string }) {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [done, setDone] = useState<{ url: string | null; failed?: string } | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const es = new EventSource(`/api/commission/${commissionId}/stream`);
    es.onmessage = (m) => {
      try {
        const e = JSON.parse(m.data) as Event;
        setEvents((prev) => [...prev, e]);
        if (e.type === "complete") {
          setDone({ url: e.serviceUrl ?? null });
          es.close();
        }
        if (e.type === "failed") {
          setDone({ url: null, failed: e.reason ?? "unknown" });
          es.close();
        }
      } catch { /* ignore */ }
    };
    es.onerror = () => {};
    return () => es.close();
  }, [commissionId]);

  async function retry() {
    setRetrying(true);
    try {
      const r = await fetch(`/api/commission/${commissionId}/retry`, { method: "POST" });
      const j = await r.json();
      if (j.commissionId) router.replace(`/commission/${j.commissionId}`);
      else alert("Retry failed: " + (j.error ?? "unknown"));
    } finally {
      setRetrying(false);
    }
  }

  const specColor: Record<string, string> = {
    moderator: "var(--forge)",
    researcher: "var(--forge)",
    engineer: "var(--gold)",
    shipwright: "var(--mint)",
    cashier: "var(--slate)",
  };

  return (
    <div
      style={{
        background: "var(--bg-1)",
        color: "var(--ink-0)",
        fontFamily: "var(--font-mono)",
        padding: "28px 32px",
        border: "1px solid var(--rule-strong)",
        minHeight: 360,
        fontSize: 13,
        lineHeight: 1.75,
      }}
    >
      <div
        className="f-caps"
        style={{ color: "var(--ink-2)", marginBottom: 20 }}
      >
        — Commission {commissionId}
      </div>

      {events.length === 0 && (
        <div style={{ color: "var(--ink-2)", fontStyle: "italic", fontFamily: "var(--font-body)" }}>
          The council is gathering. First specialist should announce in a few seconds…
        </div>
      )}

      {events.map((e, i) => {
        const spec = e.specialist ?? e.type ?? "sys";
        const color = specColor[spec] ?? "var(--ink-1)";
        return (
          <div key={i} style={{ marginBottom: 4 }}>
            <span style={{ color }}>[ {spec.padEnd(10)} ]</span>
            {e.action ? <b style={{ color: "var(--ink-0)" }}> {e.action}</b> : null}
            {e.reasoning ? <span style={{ color: "var(--ink-1)" }}> · {e.reasoning}</span> : null}
            {e.resultSummary ? <span style={{ color: "var(--ink-2)" }}> · {e.resultSummary}</span> : null}
            {e.status ? <span style={{ color: "var(--ink-2)" }}> · {e.status}</span> : null}
            {typeof e.costUsdc === "number" && e.costUsdc > 0 ? (
              <span style={{ color: "var(--mint)", marginLeft: 6 }}>(${e.costUsdc.toFixed(3)})</span>
            ) : null}
          </div>
        );
      })}

      {done && done.url && (
        <div
          style={{
            marginTop: 32,
            paddingTop: 20,
            borderTop: "1px solid var(--rule)",
            fontFamily: "var(--font-body)",
            fontSize: 20,
            color: "var(--mint)",
          }}
        >
          ✶ &nbsp;ALIVE &nbsp;—&nbsp;
          <a
            href={done.url}
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--mint)", borderBottom: "1px solid var(--mint)" }}
          >
            {done.url}
          </a>
        </div>
      )}

      {done && done.failed && (
        <div
          style={{
            marginTop: 32,
            paddingTop: 20,
            borderTop: "1px solid var(--rule)",
            fontFamily: "var(--font-body)",
          }}
        >
          <div style={{ color: "var(--blood)", fontSize: 18, marginBottom: 10 }}>
            † commissioning failed
          </div>
          <div style={{ color: "var(--ink-1)", fontSize: 14, marginBottom: 20 }}>{done.failed}</div>
          <button
            onClick={retry}
            disabled={retrying}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--ink-0)",
              fontFamily: "var(--font-body)",
              fontSize: 17,
              borderBottom: "1px solid var(--forge)",
              paddingBottom: 6,
              cursor: retrying ? "not-allowed" : "pointer",
            }}
          >
            {retrying ? "Retrying…" : "Retry — no re-payment needed"}{" "}
            <span style={{ color: "var(--forge)", marginLeft: 6 }}>↻</span>
          </button>
        </div>
      )}
    </div>
  );
}

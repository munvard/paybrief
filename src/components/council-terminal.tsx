"use client";
import { useEffect, useState } from "react";

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
  const [events, setEvents] = useState<Event[]>([]);
  const [done, setDone] = useState<{ url: string | null; failed?: string } | null>(null);

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
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {};
    return () => es.close();
  }, [commissionId]);

  return (
    <div
      style={{
        background: "#000",
        color: "#f5f5dc",
        fontFamily: "ui-monospace, monospace",
        padding: 16,
        border: "1px solid #333",
        borderRadius: 6,
        minHeight: 300,
      }}
    >
      {events.length === 0 && (
        <div style={{ opacity: 0.5 }}>Waiting for council to start...</div>
      )}
      {events.map((e, i) => (
        <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
          <span style={{ color: "#ff6b35" }}>
            [{e.specialist ?? e.type ?? "sys"}]
          </span>{" "}
          {e.action && <b>{e.action}</b>} {e.reasoning} {e.resultSummary ?? ""}{" "}
          {e.status && <span style={{ opacity: 0.7 }}>· {e.status}</span>}
          {e.costUsdc ? (
            <span style={{ color: "#00ff88", marginLeft: 4 }}>(${e.costUsdc.toFixed(3)})</span>
          ) : null}
        </div>
      ))}
      {done && done.url && (
        <div style={{ marginTop: 24, fontSize: 18, color: "#00ff88" }}>
          ✶ ALIVE —{" "}
          <a
            href={done.url}
            target="_blank"
            rel="noreferrer"
            style={{ color: "#00ff88", textDecoration: "underline" }}
          >
            {done.url}
          </a>
        </div>
      )}
      {done && done.failed && (
        <div style={{ marginTop: 24, fontSize: 16, color: "#ff2626" }}>FAILED: {done.failed}</div>
      )}
    </div>
  );
}

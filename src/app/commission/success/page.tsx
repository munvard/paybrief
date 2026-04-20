"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SuccessInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Checking payment...");

  // Resolve sessionId from URL (any plausible key Locus might append) or from storage.
  useEffect(() => {
    const urlCandidates = [
      "sessionId",
      "session_id",
      "checkout_session_id",
      "session",
      "id",
    ];
    let found: string | null = null;
    for (const k of urlCandidates) {
      const v = params.get(k);
      if (v) { found = v; break; }
    }
    if (!found && typeof window !== "undefined") {
      try {
        found =
          window.sessionStorage.getItem("foundry:lastSessionId") ||
          window.localStorage.getItem("foundry:lastSessionId");
      } catch {
        /* ignore */
      }
    }
    setSessionId(found);
  }, [params]);

  useEffect(() => {
    if (sessionId === null) return;
    if (!sessionId) {
      setStatus("No session id found. Return to /commission and start over.");
      return;
    }
    let cancelled = false;
    async function poll() {
      while (!cancelled) {
        try {
          const r = await fetch(`/api/commission/verify?sessionId=${sessionId}`);
          const j = await r.json();
          if (j.state === "started" && j.commissionId) {
            // Clear storage on success so an old session doesn't confuse the next payment
            try {
              window.sessionStorage.removeItem("foundry:lastSessionId");
              window.localStorage.removeItem("foundry:lastSessionId");
            } catch {
              /* ignore */
            }
            router.replace(`/commission/${j.commissionId}`);
            return;
          }
          if (j.error) {
            setStatus("Error: " + j.error);
            return;
          }
          setStatus(`Payment ${j.locusStatus ?? "pending"}...`);
        } catch {
          setStatus("Network error, retrying...");
        }
        await new Promise((res) => setTimeout(res, 3000));
      }
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId, router]);

  return (
    <div>
      <h1 style={{ fontSize: "2rem", color: "#ff6b35" }}>Payment received</h1>
      <p style={{ opacity: 0.8, marginTop: 12 }}>{status}</p>
      {sessionId && (
        <p style={{ opacity: 0.4, marginTop: 8, fontSize: 12, fontFamily: "ui-monospace, monospace" }}>
          session: {sessionId}
        </p>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#f5f5dc",
        padding: "2rem",
        fontFamily: "ui-sans-serif, system-ui",
        display: "grid",
        placeItems: "center",
      }}
    >
      <Suspense fallback={<div style={{ opacity: 0.6 }}>Loading...</div>}>
        <SuccessInner />
      </Suspense>
    </main>
  );
}

"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SuccessInner() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("sessionId") ?? params.get("session_id");
  const [status, setStatus] = useState<string>("Checking payment...");

  useEffect(() => {
    if (!sessionId) {
      setStatus("No session id in URL.");
      return;
    }
    let cancelled = false;
    async function poll() {
      while (!cancelled) {
        try {
          const r = await fetch(`/api/commission/verify?sessionId=${sessionId}`);
          const j = await r.json();
          if (j.state === "started" && j.commissionId) {
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

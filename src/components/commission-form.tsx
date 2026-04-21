"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const EXAMPLES = [
  "An AI that writes Shakespearean haikus about any topic",
  "A code roaster that drags your JavaScript with brutal honesty",
  "An emoji-only translator for business English",
  "A one-line movie pitch generator for weird sci-fi",
];

type State =
  | { step: "idle" }
  | { step: "creating" }
  | { step: "awaiting-payment"; sessionId: string; checkoutUrl: string }
  | { step: "confirmed"; commissionId: string }
  | { step: "error"; message: string };

export function CommissionForm() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ step: "idle" });
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (state.step !== "awaiting-payment") return;
    const sessionId = state.sessionId;
    let cancelled = false;
    async function poll() {
      if (cancelled) return;
      try {
        const r = await fetch(`/api/commission/verify?sessionId=${sessionId}`);
        const j = await r.json();
        if (j.state === "started" && j.commissionId) {
          try {
            window.sessionStorage.removeItem("foundry:lastSessionId");
            window.localStorage.removeItem("foundry:lastSessionId");
          } catch { /* ignore */ }
          setState({ step: "confirmed", commissionId: j.commissionId });
          router.replace(`/commission/${j.commissionId}`);
          return;
        }
        // Pending — keep polling
      } catch {
        // Network hiccup — keep polling
      }
      pollRef.current = window.setTimeout(poll, 2500);
    }
    poll();
    return () => {
      cancelled = true;
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [state, router]);

  async function submit() {
    setState({ step: "creating" });
    try {
      const r = await fetch("/api/commission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, email }),
      });
      const j = await r.json();
      if (!j.checkoutUrl || !j.sessionId) {
        setState({ step: "error", message: j.error ?? "Could not open Locus Checkout" });
        return;
      }
      try {
        window.sessionStorage.setItem("foundry:lastSessionId", j.sessionId);
        window.localStorage.setItem("foundry:lastSessionId", j.sessionId);
      } catch { /* ignore */ }

      // Open Locus Checkout in a new tab so we keep control of this tab for polling.
      const popup = window.open(j.checkoutUrl, "_blank", "noopener,noreferrer");
      if (!popup) {
        // Popup blocked — fall back to redirecting this tab.
        window.location.href = j.checkoutUrl;
        return;
      }
      setState({ step: "awaiting-payment", sessionId: j.sessionId, checkoutUrl: j.checkoutUrl });
    } catch (e) {
      setState({ step: "error", message: (e as Error).message });
    }
  }

  if (state.step === "awaiting-payment") {
    return <AwaitingPayment checkoutUrl={state.checkoutUrl} sessionId={state.sessionId} />;
  }
  if (state.step === "confirmed") {
    return (
      <div
        style={{
          borderTop: "1px solid var(--rule-strong)",
          paddingTop: 32,
          fontFamily: "var(--font-body)",
        }}
      >
        <div className="f-caps" style={{ marginBottom: 18, color: "var(--mint)" }}>— Payment received</div>
        <div style={{ fontSize: 18, color: "var(--ink-1)" }}>
          Commissioning now... routing you to the council terminal.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        borderTop: "1px solid var(--rule-strong)",
        paddingTop: 32,
      }}
    >
      <div className="f-caps" style={{ marginBottom: 18 }}>— What should the tool do?</div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="A short sentence. An AI that …"
        rows={4}
        style={{
          width: "100%",
          background: "transparent",
          color: "var(--ink-0)",
          border: 0,
          borderBottom: "1px solid var(--rule-strong)",
          padding: "10px 0",
          fontFamily: "var(--font-body)",
          fontSize: 22,
          lineHeight: 1.5,
          outline: "none",
          resize: "vertical",
          fontStyle: prompt ? "normal" : "italic",
        }}
      />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => setPrompt(ex)}
            style={{
              background: "transparent",
              border: "1px solid var(--rule-strong)",
              color: "var(--ink-1)",
              padding: "6px 12px",
              fontFamily: "var(--font-body)",
              fontSize: 12,
              fontStyle: "italic",
              cursor: "pointer",
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      <div className="f-caps" style={{ marginTop: 32, marginBottom: 10 }}>— Email (optional)</div>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="So we can notify you when it is live"
        style={{
          width: "100%",
          background: "transparent",
          color: "var(--ink-0)",
          border: 0,
          borderBottom: "1px solid var(--rule-strong)",
          padding: "10px 0",
          fontFamily: "var(--font-body)",
          fontSize: 16,
          fontStyle: email ? "normal" : "italic",
          outline: "none",
        }}
      />

      <div style={{ marginTop: 48, display: "flex", alignItems: "baseline", gap: 28 }}>
        <button
          onClick={submit}
          disabled={state.step === "creating" || prompt.length < 8}
          style={{
            background: "transparent",
            border: 0,
            padding: "12px 0",
            borderBottom: "1px solid var(--forge)",
            color: "var(--ink-0)",
            fontFamily: "var(--font-body)",
            fontSize: 24,
            cursor: state.step === "creating" || prompt.length < 8 ? "not-allowed" : "pointer",
            opacity: state.step === "creating" || prompt.length < 8 ? 0.4 : 1,
            letterSpacing: "-0.01em",
          }}
        >
          {state.step === "creating" ? "Opening Locus Checkout…" : "Commission the business"}{" "}
          <span style={{ color: "var(--forge)", marginLeft: 8 }}>→</span>
        </button>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--ink-2)",
            letterSpacing: "0.06em",
          }}
        >
          0.50 USDC · Base
        </span>
      </div>

      {state.step === "error" && (
        <div
          style={{
            marginTop: 24,
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            color: "var(--blood)",
          }}
        >
          error · {state.message}
        </div>
      )}
    </div>
  );
}

function AwaitingPayment({ checkoutUrl, sessionId }: { checkoutUrl: string; sessionId: string }) {
  return (
    <div
      style={{
        borderTop: "1px solid var(--rule-strong)",
        paddingTop: 32,
      }}
    >
      <div className="f-caps" style={{ marginBottom: 18 }}>— Awaiting payment</div>

      <h3
        className="f-display"
        style={{
          fontSize: 44,
          lineHeight: 1.05,
          margin: 0,
          letterSpacing: "-0.02em",
          fontWeight: 400,
          fontVariationSettings: '"SOFT" 30, "opsz" 72',
          color: "var(--ink-0)",
        }}
      >
        Locus Checkout is open in a new tab.
      </h3>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 17,
          lineHeight: 1.55,
          color: "var(--ink-1)",
          marginTop: 18,
          maxWidth: 520,
        }}
      >
        Pay there. When the transaction confirms on Base, this page will send you
        into the live council terminal automatically. No need to click anything
        on the Locus page after paying — you can just close it.
      </p>

      <div
        style={{
          marginTop: 32,
          display: "flex",
          alignItems: "baseline",
          gap: 18,
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          color: "var(--ink-2)",
        }}
      >
        <Spinner />
        <span>Polling Locus for confirmation…</span>
      </div>

      <div
        style={{
          marginTop: 32,
          borderTop: "1px solid var(--rule)",
          paddingTop: 20,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--ink-2)",
          letterSpacing: "0.04em",
          lineHeight: 1.6,
        }}
      >
        session · {sessionId}
        <br />
        <a
          href={checkoutUrl}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--forge)", borderBottom: "1px solid var(--forge-dim)" }}
        >
          Re-open checkout ↗
        </a>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        width: 12,
        height: 12,
        border: "2px solid var(--rule-strong)",
        borderTopColor: "var(--forge)",
        borderRadius: "50%",
        animation: "foundry-spin 1s linear infinite",
      }}
    />
  );
}

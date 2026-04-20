"use client";
import { useState } from "react";

const EXAMPLES = [
  "An AI that writes Shakespearean haikus about any topic",
  "A code roaster that drags your JavaScript with brutal honesty",
  "An emoji-only translator for business English",
  "A one-line movie pitch generator for weird sci-fi",
];

export function CommissionForm() {
  const [prompt, setPrompt] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const r = await fetch("/api/commission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, email }),
      });
      const j = await r.json();
      if (j.checkoutUrl && j.sessionId) {
        try {
          window.sessionStorage.setItem("foundry:lastSessionId", j.sessionId);
          window.localStorage.setItem("foundry:lastSessionId", j.sessionId);
        } catch { /* ignore */ }
        window.location.href = j.checkoutUrl;
      } else {
        alert("Error: " + (j.error ?? "unknown"));
      }
    } finally {
      setLoading(false);
    }
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

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 18,
        }}
      >
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

      <div className="f-caps" style={{ marginTop: 32, marginBottom: 10 }}>
        — Email (optional)
      </div>
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

      <div
        style={{
          marginTop: 48,
          display: "flex",
          alignItems: "baseline",
          gap: 28,
        }}
      >
        <button
          onClick={submit}
          disabled={loading || prompt.length < 8}
          style={{
            background: "transparent",
            border: 0,
            padding: "12px 0",
            borderBottom: "1px solid var(--forge)",
            color: "var(--ink-0)",
            fontFamily: "var(--font-body)",
            fontSize: 24,
            cursor: loading || prompt.length < 8 ? "not-allowed" : "pointer",
            opacity: loading || prompt.length < 8 ? 0.4 : 1,
            letterSpacing: "-0.01em",
          }}
        >
          {loading ? "Opening Locus Checkout…" : "Commission the business"}{" "}
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
    </div>
  );
}

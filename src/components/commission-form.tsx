"use client";
import { useState } from "react";

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
      if (j.checkoutUrl) {
        window.location.href = j.checkoutUrl;
      } else {
        alert("Error: " + (j.error ?? "unknown"));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <label style={{ display: "block", fontSize: 14, marginBottom: 8 }}>
        What should the AI tool do? (one sentence)
      </label>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        style={{
          width: "100%",
          background: "#111",
          color: "#f5f5dc",
          border: "1px solid #333",
          borderRadius: 4,
          padding: 12,
          fontFamily: "ui-monospace, monospace",
          fontSize: 15,
          boxSizing: "border-box",
        }}
      />
      <label style={{ display: "block", fontSize: 14, marginTop: 16, marginBottom: 8 }}>
        Email (optional)
      </label>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          width: "100%",
          background: "#111",
          color: "#f5f5dc",
          border: "1px solid #333",
          borderRadius: 4,
          padding: 8,
          fontSize: 15,
          boxSizing: "border-box",
        }}
      />
      <button
        disabled={loading || prompt.length < 8}
        onClick={submit}
        style={{
          marginTop: 24,
          background: "#ff6b35",
          color: "#000",
          border: 0,
          padding: "12px 24px",
          fontWeight: 700,
          borderRadius: 6,
          cursor: "pointer",
          opacity: loading || prompt.length < 8 ? 0.5 : 1,
        }}
      >
        {loading ? "..." : "Commission — $3 USDC"}
      </button>
    </div>
  );
}

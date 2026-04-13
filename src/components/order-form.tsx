"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TIERS = [
  { id: "quick", label: "Quick", desc: "~1 min", detail: "2 agents", price: "0.50", icon: "\u26a1", color: "text-cyan-400", border: "border-cyan-500/30" },
  { id: "standard", label: "Standard", desc: "5-10 min", detail: "3 agents + debate", price: "2.00", icon: "\ud83d\udd2c", color: "text-primary-light", border: "border-primary/30" },
  { id: "deep", label: "Deep Dive", desc: "2-3+ hours", detail: "Full council", price: "3.00", icon: "\ud83c\udf0a", color: "text-accent-green", border: "border-green-500/30" },
];

const EXAMPLE_TASKS = [
  "Full competitive analysis of Stripe vs Adyen vs Square in global payments",
  "NVIDIA financial deep dive with SEC filings and competitive positioning",
  "Solana DeFi ecosystem: top protocols, TVL trends, and Ethereum comparison",
  "Series A fundraising landscape for AI startups in 2026",
];

export function OrderForm() {
  const router = useRouter();
  const [taskDescription, setTaskDescription] = useState("");
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState("standard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!taskDescription.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskDescription: taskDescription.trim(),
          companyName: taskDescription.trim().slice(0, 100),
          email: email || undefined,
          pipelineTier: tier,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create task");

      router.push(`/checkout/${data.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const selectedTier = TIERS.find(t => t.id === tier)!;

  return (
    <div className="glow-card p-8 glow-breathe">
      <div className="flex items-center gap-2 mb-2">
        <div className="status-dot-working" style={{ width: 6, height: 6 }} />
        <h2 className="data-readout text-accent">Hire Agent Zero</h2>
      </div>
      <p className="text-muted-foreground mb-6 text-sm">
        Describe your research task. The council will decide which tools to use and deliver results.
      </p>

      {/* Tier selector */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {TIERS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTier(t.id)}
            className={`rounded-lg border p-3 text-left transition-all ${
              tier === t.id
                ? `${t.border} bg-white/[0.03] ring-1 ring-white/10`
                : "border-border/50 bg-transparent hover:border-border"
            }`}
          >
            <div className="text-lg mb-0.5">{t.icon}</div>
            <div className={`text-sm font-bold ${tier === t.id ? t.color : "text-foreground"}`}>{t.label}</div>
            <div className="text-[10px] text-muted-foreground font-mono">{t.desc} &middot; {t.detail}</div>
            <div className={`text-sm font-bold font-mono mt-1 ${tier === t.id ? t.color : "text-muted-foreground"}`}>
              ${t.price}
            </div>
          </button>
        ))}
      </div>

      {/* Example chips */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {EXAMPLE_TASKS.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setTaskDescription(example)}
            className="text-[11px] px-2.5 py-1 rounded-md bg-muted/50 border border-border/50 hover:border-accent/30 hover:text-accent transition font-mono truncate max-w-[200px]"
          >
            {example}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="data-readout text-muted-foreground mb-2 block">
            Research Task *
          </label>
          <textarea
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            placeholder="e.g. Analyze Ethereum's price trends and competitive position in the L1 space"
            rows={3}
            className="w-full rounded-lg bg-muted/30 border border-border/50 px-4 py-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/30 resize-none font-mono text-sm"
          />
        </div>

        <div>
          <label className="data-readout text-muted-foreground mb-2 block">
            Email (for delivery)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full rounded-lg bg-muted/30 border border-border/50 px-4 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-accent/50 focus:border-accent/30 font-mono text-sm"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400 font-mono">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !taskDescription.trim()}
          className="w-full rounded-lg py-3.5 px-4 font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed cta-glow"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating task...
            </span>
          ) : (
            `Hire Agent Zero \u2014 $${selectedTier.price} USDC`
          )}
        </button>
      </form>
    </div>
  );
}

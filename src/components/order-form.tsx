"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const EXAMPLE_TASKS = [
  "Ethereum price analysis and market sentiment",
  "Tesla stock performance vs competitors",
  "Stripe competitive landscape and pricing",
  "AI chip market overview 2026",
  "Who is the CEO of Anthropic?",
];

export function OrderForm() {
  const router = useRouter();
  const [taskDescription, setTaskDescription] = useState("");
  const [email, setEmail] = useState("");
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

  return (
    <div className="rounded-2xl bg-card border border-border p-8">
      <h2 className="text-2xl font-bold mb-2">Hire Agent Zero</h2>
      <p className="text-muted-foreground mb-6">
        Describe your research task. I&apos;ll decide which tools to use and deliver results.
      </p>

      {/* Example chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {EXAMPLE_TASKS.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setTaskDescription(example)}
            className="text-xs px-3 py-1.5 rounded-full bg-muted border border-border hover:border-primary/50 hover:text-primary-light transition truncate max-w-[220px]"
          >
            {example}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">
            What do you need researched? *
          </label>
          <textarea
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            placeholder="e.g. Analyze Ethereum's price trends and competitive position in the L1 space"
            rows={3}
            className="w-full rounded-lg bg-muted border border-border px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">
            Your email (for delivery)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full rounded-lg bg-muted border border-border px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          />
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !taskDescription.trim()}
          className="w-full rounded-lg py-3 px-4 font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "linear-gradient(180deg, #5934FF 0%, #4101F6 100%)",
          }}
        >
          {loading ? "Creating task..." : "Hire Agent Zero — 3 USDC"}
        </button>
      </form>
    </div>
  );
}

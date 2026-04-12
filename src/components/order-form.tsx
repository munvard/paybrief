"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrderForm() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [focusArea, setFocusArea] = useState("all");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) {
      setError("Please enter a company or product name");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          focusArea,
          email: email.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create order");

      router.push(`/checkout/${data.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium mb-1.5">
          Company / Product Name *
        </label>
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="e.g. Stripe, Notion, Linear"
          className="w-full rounded-lg bg-muted border border-border px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Focus Area</label>
        <select
          value={focusArea}
          onChange={(e) => setFocusArea(e.target.value)}
          className="w-full rounded-lg bg-muted border border-border px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        >
          <option value="all">Full Overview (competitors + pricing + market)</option>
          <option value="competitors">Competitors Only</option>
          <option value="pricing">Pricing Analysis Only</option>
          <option value="market">Market Overview Only</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          Email (optional)
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Get a link to your brief via email"
          className="w-full rounded-lg bg-muted border border-border px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        />
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-400/10 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg py-3 px-4 font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: loading
            ? "#3f3f46"
            : "linear-gradient(180deg, #5934FF 0%, #4101F6 100%)",
        }}
      >
        {loading ? "Creating order..." : "Continue to Payment — 5 USDC"}
      </button>
    </form>
  );
}

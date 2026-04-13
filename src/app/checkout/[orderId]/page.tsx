"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    async function initCheckout() {
      try {
        const res = await fetch("/api/checkout/create-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create session");

        setSessionId(data.sessionId);
        setCheckoutUrl(data.checkoutUrl);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to initialize checkout"
        );
      } finally {
        setLoading(false);
      }
    }

    initCheckout();
  }, [orderId]);

  // Listen for postMessage from Locus checkout iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (
        event.data?.type === "locus-checkout-success" ||
        event.data?.event === "checkout.session.paid"
      ) {
        router.push(`/order/${orderId}/status`);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [orderId, router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Preparing checkout...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h2 className="text-2xl font-bold mb-2">Checkout Error</h2>
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="rounded-lg px-6 py-2 bg-card border border-border hover:bg-muted transition"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight">
            Agent<span className="gradient-text">Zero</span>
          </span>
          <span className="text-sm text-muted-foreground">
            Secure Payment via Locus
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Hire Agent Zero</h1>
            <p className="text-muted-foreground">
              Pay 3 USDC to start your research task
            </p>
          </div>

          {/* Embedded checkout iframe */}
          {checkoutUrl && (
            <div className="rounded-2xl bg-card border border-border overflow-hidden">
              <iframe
                src={`${checkoutUrl}?embed=true`}
                className="w-full border-0"
                style={{ height: "600px" }}
                allow="payment"
                title="Locus Checkout"
              />
            </div>
          )}

          {/* Fallback link */}
          <div className="mt-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Having trouble? Open checkout in a new tab:
            </p>
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary-light hover:underline"
            >
              Open Locus Checkout
            </a>
            <span className="mx-3 text-muted-foreground">|</span>
            <button
              onClick={() => router.push(`/order/${orderId}/status`)}
              className="text-sm text-primary-light hover:underline"
            >
              I already paid
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ORDER_STATUSES, STATUS_LABELS, type OrderStatus } from "@/lib/utils";

const POLL_INTERVAL = 3000;

const PROGRESS_STEPS: OrderStatus[] = [
  "PAID",
  "RESEARCHING",
  "SYNTHESIZING",
  "COMPLETED",
];

export default function StatusPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [status, setStatus] = useState<OrderStatus>("CREATED");
  const [label, setLabel] = useState("Loading...");
  const [companyName, setCompanyName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`);
      const data = await res.json();
      if (!res.ok) return;

      setStatus(data.status);
      setLabel(data.label);
      setCompanyName(data.companyName);

      if (data.status === "COMPLETED" && data.reportId) {
        router.push(`/report/${data.reportId}`);
        return;
      }

      if (data.status === "FAILED") {
        setErrorMessage(data.errorMessage || "Report generation failed");
      }
    } catch {
      // Silently retry on network errors
    }
  }, [orderId, router]);

  useEffect(() => {
    pollStatus();
    const interval = setInterval(pollStatus, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [pollStatus]);

  const currentStepIndex = PROGRESS_STEPS.indexOf(status);
  const isTerminal = status === "COMPLETED" || status === "FAILED";

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight">
            Pay<span className="gradient-text">Brief</span>
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full text-center">
          {status === "FAILED" ? (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">!</span>
              </div>
              <h1 className="text-2xl font-bold mb-2">Generation Failed</h1>
              <p className="text-muted-foreground mb-4">{errorMessage}</p>
              <button
                onClick={() => router.push("/")}
                className="rounded-lg px-6 py-2 bg-card border border-border hover:bg-muted transition"
              >
                Try Again
              </button>
            </>
          ) : (
            <>
              {/* Spinner */}
              {!isTerminal && (
                <div className="w-16 h-16 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-8" />
              )}

              <h1 className="text-2xl font-bold mb-2">
                {status === "CREATED" || status === "PAYING"
                  ? "Waiting for payment..."
                  : `Generating brief for ${companyName}`}
              </h1>
              <p className="text-muted-foreground mb-10">{label}</p>

              {/* Progress Steps */}
              <div className="space-y-4 text-left">
                {PROGRESS_STEPS.map((step, i) => {
                  const isActive = step === status;
                  const isDone = currentStepIndex > i;
                  const isPending = currentStepIndex < i;

                  return (
                    <div key={step} className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                          isDone
                            ? "bg-green-500/20 text-green-400"
                            : isActive
                              ? "bg-primary/20 text-primary-light animate-pulse"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isDone ? "\u2713" : i + 1}
                      </div>
                      <span
                        className={
                          isPending ? "text-muted-foreground" : "text-foreground"
                        }
                      >
                        {STATUS_LABELS[step]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

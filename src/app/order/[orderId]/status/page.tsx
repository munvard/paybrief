"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { STATUS_LABELS, type OrderStatus } from "@/lib/utils";
import { DecisionLog } from "@/components/decision-log";

const POLL_INTERVAL = 2000;

interface Decision {
  id: string;
  step: number;
  action: string;
  provider: string | null;
  reasoning: string;
  resultSummary: string | null;
  costUsdc: number;
  durationMs: number | null;
  status: string;
  createdAt: string;
}

export default function StatusPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [status, setStatus] = useState<OrderStatus>("CREATED");
  const [label, setLabel] = useState("Loading...");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskType, setTaskType] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [decisions, setDecisions] = useState<Decision[]>([]);

  const pollStatus = useCallback(async () => {
    try {
      const [statusRes, decisionsRes] = await Promise.all([
        fetch(`/api/orders/${orderId}/status`),
        fetch(`/api/orders/${orderId}/decisions`),
      ]);

      const statusData = await statusRes.json();
      const decisionsData = await decisionsRes.json();

      if (statusRes.ok) {
        setStatus(statusData.status);
        setLabel(statusData.label);
        setTaskDescription(statusData.taskDescription || statusData.companyName || "");
        setTaskType(statusData.taskType || "");

        if (statusData.status === "COMPLETED" && statusData.reportId) {
          router.push(`/report/${statusData.reportId}`);
          return;
        }
        if (statusData.status === "FAILED") {
          setErrorMessage(statusData.errorMessage || "Task failed");
        }
      }

      if (decisionsRes.ok && decisionsData.decisions) {
        setDecisions(decisionsData.decisions);
      }
    } catch {
      // Silently retry
    }
  }, [orderId, router]);

  useEffect(() => {
    pollStatus();
    const interval = setInterval(pollStatus, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [pollStatus]);

  const isTerminal = status === "COMPLETED" || status === "FAILED";
  const isWorking = ["CLASSIFYING", "EXECUTING", "SYNTHESIZING"].includes(status);

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/" className="text-xl font-bold tracking-tight">
            Agent<span className="gradient-text">Zero</span>
          </a>
          {taskType && (
            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary-light">
              {taskType.replace("_", " ")}
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        {status === "FAILED" ? (
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6 text-3xl">
              !
            </div>
            <h1 className="text-2xl font-bold mb-2">Task Failed</h1>
            <p className="text-muted-foreground mb-4">{errorMessage}</p>
            <button
              onClick={() => router.push("/")}
              className="rounded-lg px-6 py-2 bg-card border border-border hover:bg-muted transition"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Header with spinner */}
            <div className="text-center mb-8">
              {!isTerminal && (
                <div className="w-12 h-12 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-6" />
              )}
              <h1 className="text-2xl font-bold mb-1">
                {isWorking
                  ? "Agent Zero is working..."
                  : status === "PAYING"
                    ? "Waiting for payment..."
                    : label}
              </h1>
              {taskDescription && (
                <p className="text-muted-foreground text-sm">
                  Task: &quot;{taskDescription.slice(0, 80)}&quot;
                </p>
              )}
            </div>
          </>
        )}

        {/* Decision Log */}
        {decisions.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              Agent Decision Log
            </h2>
            <DecisionLog decisions={decisions} />
          </div>
        )}

        {/* Waiting for payment state */}
        {(status === "CREATED" || status === "PAYING") && decisions.length === 0 && (
          <div className="text-center text-muted-foreground mt-8">
            <p>Waiting for payment confirmation...</p>
            <p className="text-xs mt-2">The agent will start working once payment is detected.</p>
          </div>
        )}
      </main>
    </div>
  );
}

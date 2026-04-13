"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { STATUS_LABELS, type OrderStatus } from "@/lib/utils";
import { DecisionLog, type Decision } from "@/components/decision-log";

const POLL_INTERVAL = 2000;

export default function StatusPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [status, setStatus] = useState<OrderStatus>("CREATED");
  const [label, setLabel] = useState("Loading...");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskType, setTaskType] = useState("");
  const [reportId, setReportId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [pipelinePhase, setPipelinePhase] = useState<number | undefined>();
  const [pipelineTier, setPipelineTier] = useState<string | undefined>();
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());

  // Elapsed time counter
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
        if (statusData.pipelinePhase !== undefined) setPipelinePhase(statusData.pipelinePhase);
        if (statusData.pipelineTier) setPipelineTier(statusData.pipelineTier);

        if (statusData.status === "COMPLETED" && statusData.reportId) {
          setReportId(statusData.reportId);
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
  }, [orderId]);

  useEffect(() => {
    pollStatus();
    const interval = setInterval(pollStatus, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [pollStatus]);

  const isTerminal = status === "COMPLETED" || status === "FAILED";
  const isWorking = ["CLASSIFYING", "EXECUTING", "SYNTHESIZING"].includes(status);

  // Compute stats from decisions
  const totalCost = decisions
    .filter(d => d.status !== "running")
    .reduce((sum, d) => sum + d.costUsdc, 0);
  const uniqueApis = [...new Set(decisions.filter(d => d.provider && d.status === "success").map(d => d.provider))];
  const maxRound = decisions.length > 0 ? Math.max(...decisions.map(d => d.round)) + 1 : 0;
  const maxPhase = pipelinePhase !== undefined ? pipelinePhase : maxRound;

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-border/50 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/" className="text-xl font-bold tracking-tight">
            Agent<span className="gradient-text">Zero</span>
          </a>
          <div className="flex items-center gap-3">
            {taskType && (
              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary-light">
                {taskType.replace("_", " ")}
              </span>
            )}
            {isWorking && (
              <span className="text-xs text-muted-foreground font-mono">
                {pipelinePhase !== undefined && <span className="mr-2">Phase {pipelinePhase}</span>}
                {elapsed}s
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        {/* COMPLETED — show completion card */}
        {status === "COMPLETED" && reportId ? (
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6 text-3xl">
              {"\u2705"}
            </div>
            <h1 className="text-2xl font-bold mb-2">Job Complete</h1>
            {taskDescription && (
              <p className="text-muted-foreground text-sm mb-6">
                &quot;{taskDescription.slice(0, 80)}&quot;
              </p>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="rounded-xl bg-card border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">Time</p>
                <p className="text-lg font-bold">{elapsed}s</p>
              </div>
              <div className="rounded-xl bg-card border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">Phases</p>
                <p className="text-lg font-bold">{maxPhase}</p>
              </div>
              <div className="rounded-xl bg-card border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">APIs Used</p>
                <p className="text-lg font-bold">{uniqueApis.length}</p>
              </div>
              <div className="rounded-xl bg-card border border-border p-3 text-center">
                <p className="text-xs text-muted-foreground">Sources</p>
                <p className="text-lg font-bold">{decisions.filter(d => d.resultSummary).length}</p>
              </div>
            </div>

            {/* APIs used */}
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {uniqueApis.map((api) => (
                <span key={api} className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                  {api}
                </span>
              ))}
            </div>

            <a
              href={`/report/${reportId}`}
              className="inline-block rounded-lg py-3 px-10 font-semibold text-white transition-all text-lg"
              style={{ background: "linear-gradient(180deg, #5934FF 0%, #4101F6 100%)" }}
            >
              View Full Report
            </a>
          </div>
        ) : status === "FAILED" ? (
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
            <div className="text-center mb-8">
              {isWorking && (
                <div className="w-12 h-12 border-3 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-6" />
              )}
              <h1 className="text-2xl font-bold mb-1">
                {isWorking
                  ? `Agent Zero is working... (${elapsed}s)`
                  : status === "PAYING"
                    ? "Waiting for payment..."
                    : label}
              </h1>
              {taskDescription && (
                <p className="text-muted-foreground text-sm">
                  Task: &quot;{taskDescription.slice(0, 80)}&quot;
                </p>
              )}
              {pipelineTier === "deep" && (
                <p className="text-xs text-muted-foreground/70 mt-2">
                  Deep Dive — may take 2-3+ hours
                </p>
              )}
            </div>
          </>
        )}

        {/* Decision Log — always show if there are decisions */}
        {decisions.length > 0 && (
          <div className={status === "COMPLETED" ? "mt-6" : ""}>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              Agent Decision Log
            </h2>
            <DecisionLog decisions={decisions} />
          </div>
        )}

        {/* Waiting for payment */}
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

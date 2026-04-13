"use client";

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

const ACTION_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  classify: { icon: "\u{1F9E0}", color: "text-purple-400", label: "Classifying" },
  plan: { icon: "\u{1F4CB}", color: "text-blue-400", label: "Planning" },
  call_api: { icon: "\u26A1", color: "text-yellow-400", label: "API Call" },
  synthesize: { icon: "\u2728", color: "text-green-400", label: "Synthesizing" },
  deliver: { icon: "\u2705", color: "text-emerald-400", label: "Delivering" },
};

export function DecisionLog({ decisions }: { decisions: Decision[] }) {
  // Deduplicate by step — keep latest entry per step (running → success)
  const byStep = new Map<number, Decision>();
  for (const d of decisions) {
    const existing = byStep.get(d.step);
    if (!existing || d.status !== "running") {
      byStep.set(d.step, d);
    }
  }
  const deduped = Array.from(byStep.values()).sort((a, b) => a.step - b.step);

  const totalCost = deduped.reduce((sum, d) => sum + d.costUsdc, 0);

  return (
    <div className="space-y-3">
      {deduped.map((d) => {
        const config = ACTION_CONFIG[d.action] || { icon: "\u2022", color: "text-muted-foreground", label: d.action };
        const isRunning = d.status === "running";
        const isFailed = d.status === "failed";
        const isSkipped = d.status === "skipped";

        return (
          <div
            key={`${d.step}-${d.status}`}
            className={`flex gap-3 p-3 rounded-lg bg-card border border-border ${isRunning ? "animate-pulse" : ""} ${isFailed ? "border-red-500/30" : ""}`}
          >
            <div className={`text-lg shrink-0 ${config.color}`}>
              {config.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-sm font-medium ${config.color}`}>
                  {config.label}
                  {d.provider && ` — ${d.provider}`}
                </span>
                {isRunning && (
                  <span className="text-xs text-muted-foreground animate-pulse">running...</span>
                )}
                {isFailed && (
                  <span className="text-xs text-red-400">failed</span>
                )}
                {isSkipped && (
                  <span className="text-xs text-yellow-400/70">skipped</span>
                )}
                {d.costUsdc > 0 && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    ${d.costUsdc.toFixed(3)}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {d.reasoning}
              </p>
              {d.resultSummary && (
                <p className="text-xs text-foreground/70 mt-1 font-mono">
                  {d.resultSummary}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {deduped.length > 0 && (
        <div className="flex justify-between items-center pt-2 text-sm text-muted-foreground border-t border-border/50">
          <span>{deduped.length} decisions</span>
          <span>Running cost: <span className="text-foreground font-medium">${totalCost.toFixed(4)}</span></span>
        </div>
      )}
    </div>
  );
}

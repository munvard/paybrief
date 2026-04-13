"use client";

export interface Decision {
  id: string;
  step: number;
  round: number;
  action: string;
  provider: string | null;
  specialist: string | null;
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
  analyze: { icon: "\u{1F50E}", color: "text-cyan-400", label: "Analyzing" },
  call_api: { icon: "\u26A1", color: "text-yellow-400", label: "API Call" },
  synthesize: { icon: "\u2728", color: "text-green-400", label: "Synthesizing" },
  deliver: { icon: "\u2705", color: "text-emerald-400", label: "Complete" },
  debate: { icon: "\u{1F4AC}", color: "text-orange-400", label: "Debate" },
  brief: { icon: "\u{1F4DD}", color: "text-indigo-400", label: "Specialist Brief" },
  expand: { icon: "\u{1F333}", color: "text-teal-400", label: "Expanding" },
};

const SPECIALIST_CONFIG: Record<string, { icon: string; color: string }> = {
  researcher: { icon: "\u{1F50D}", color: "text-blue-400" },
  data_analyst: { icon: "\u{1F4CA}", color: "text-green-400" },
  investigator: { icon: "\u{1F575}\uFE0F", color: "text-yellow-400" },
  moderator: { icon: "\u{1F9E0}", color: "text-purple-400" },
};

const ROUND_LABELS: Record<number, string> = {
  0: "Round 1: Understand",
  1: "Round 2: Deep Dive",
  2: "Round 3: Fill Gaps",
};

function getRoundLabel(round: number, roundDecisions: Decision[]): string {
  const firstAction = roundDecisions[0]?.action;
  if (firstAction === "debate") return `Round ${round + 1}: Council Debate`;
  if (firstAction === "brief") return `Round ${round + 1}: Specialist Analysis`;
  if (firstAction === "expand") return `Round ${round + 1}: Research Expansion`;
  return ROUND_LABELS[round] || `Round ${round + 1}`;
}

export function DecisionLog({ decisions }: { decisions: Decision[] }) {
  // Deduplicate by step+round — keep latest (running → success)
  const byKey = new Map<string, Decision>();
  for (const d of decisions) {
    const key = `${d.round}-${d.step}`;
    const existing = byKey.get(key);
    if (!existing || d.status !== "running") {
      byKey.set(key, d);
    }
  }
  const deduped = Array.from(byKey.values()).sort((a, b) => a.step - b.step);

  // Group by round
  const rounds = new Map<number, Decision[]>();
  for (const d of deduped) {
    const r = d.round || 0;
    if (!rounds.has(r)) rounds.set(r, []);
    rounds.get(r)!.push(d);
  }

  const totalCost = deduped.reduce((sum, d) => sum + d.costUsdc, 0);
  const uniqueProviders = [...new Set(deduped.filter(d => d.provider).map(d => d.provider))];

  return (
    <div className="space-y-4">
      {Array.from(rounds.entries()).map(([round, roundDecisions]) => (
        <div key={round}>
          {/* Round header — show for multi-round */}
          {(rounds.size > 1 || round > 0) && (
            <div className="flex items-center gap-2 mb-2 mt-3">
              <div className="h-px flex-1 bg-border/50" />
              <span className="text-xs font-semibold text-primary-light uppercase tracking-wider px-2">
                {getRoundLabel(round, roundDecisions)}
              </span>
              <div className="h-px flex-1 bg-border/50" />
            </div>
          )}

          <div className="space-y-2">
            {roundDecisions.map((d) => {
              const config = ACTION_CONFIG[d.action] || { icon: "\u2022", color: "text-muted-foreground", label: d.action };
              const isRunning = d.status === "running";
              const isFailed = d.status === "failed";
              const isSkipped = d.status === "skipped";

              return (
                <div
                  key={`${d.step}-${d.round}-${d.status}`}
                  className={`flex gap-3 p-3 rounded-lg bg-card border border-border transition-all ${isRunning ? "animate-pulse border-primary/30" : ""} ${isFailed ? "border-red-500/30" : ""}`}
                >
                  <div className={`text-lg shrink-0 ${d.specialist && SPECIALIST_CONFIG[d.specialist] ? SPECIALIST_CONFIG[d.specialist].color : config.color}`}>
                    {d.specialist && SPECIALIST_CONFIG[d.specialist] ? SPECIALIST_CONFIG[d.specialist].icon : config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`text-sm font-medium ${config.color}`}>
                        {d.specialist && SPECIALIST_CONFIG[d.specialist] && (
                          <span className={`${SPECIALIST_CONFIG[d.specialist].color} mr-1`}>
                            {d.specialist.replace("_", " ")}
                          </span>
                        )}
                        {d.specialist ? <span>{"\u2014 "}{config.label}</span> : config.label}
                        {d.provider && ` \u2014 ${d.provider}`}
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
                      {d.durationMs != null && d.durationMs > 0 && (
                        <span className="text-xs text-muted-foreground">{(d.durationMs / 1000).toFixed(1)}s</span>
                      )}
                      {d.costUsdc > 0 && (
                        <span className="text-xs text-muted-foreground ml-auto font-mono">
                          ${d.costUsdc.toFixed(3)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {d.reasoning}
                    </p>
                    {d.resultSummary && (
                      <p className="text-xs text-foreground/80 mt-1.5 font-mono bg-muted/50 rounded px-2 py-1 leading-relaxed">
                        {d.resultSummary}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {deduped.length > 0 && (
        <div className="flex justify-between items-center pt-3 text-sm text-muted-foreground border-t border-border/50">
          <span>
            {deduped.length} steps
            {uniqueProviders.length > 0 && ` \u00b7 ${uniqueProviders.length} APIs`}
            {rounds.size > 1 && ` \u00b7 ${rounds.size} rounds`}
          </span>
          <span>
            Running cost: <span className="text-foreground font-semibold font-mono">${totalCost.toFixed(4)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

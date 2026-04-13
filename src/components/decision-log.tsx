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
  synthesize: { icon: "\u2728", color: "text-emerald-400", label: "Synthesizing" },
  deliver: { icon: "\u2705", color: "text-green-400", label: "Complete" },
  debate: { icon: "\u{1F4AC}", color: "text-orange-400", label: "Debate" },
  brief: { icon: "\u{1F4DD}", color: "text-indigo-400", label: "Brief" },
  expand: { icon: "\u{1F333}", color: "text-teal-400", label: "Expanding" },
};

const SPECIALIST_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  researcher: { icon: "\u{1F50D}", color: "text-blue-400", label: "Researcher" },
  data_analyst: { icon: "\u{1F4CA}", color: "text-green-400", label: "Data Analyst" },
  investigator: { icon: "\u{1F575}\uFE0F", color: "text-yellow-400", label: "Investigator" },
  moderator: { icon: "\u{1F9E0}", color: "text-purple-400", label: "Moderator" },
};

function getRoundLabel(round: number, roundDecisions: Decision[]): string {
  const firstAction = roundDecisions[0]?.action;
  if (firstAction === "debate") return `Council Debate`;
  if (firstAction === "brief") return `Specialist Analysis`;
  if (firstAction === "expand") return `Research Expansion`;
  const labels: Record<number, string> = { 0: "Discovery", 1: "Deep Dive", 2: "Cross-Reference" };
  return labels[round] || `Round ${round + 1}`;
}

export function DecisionLog({ decisions }: { decisions: Decision[] }) {
  const byKey = new Map<string, Decision>();
  for (const d of decisions) {
    const key = `${d.round}-${d.step}`;
    const existing = byKey.get(key);
    if (!existing || d.status !== "running") {
      byKey.set(key, d);
    }
  }
  const deduped = Array.from(byKey.values()).sort((a, b) => a.step - b.step);

  const rounds = new Map<number, Decision[]>();
  for (const d of deduped) {
    const r = d.round || 0;
    if (!rounds.has(r)) rounds.set(r, []);
    rounds.get(r)!.push(d);
  }

  const totalCost = deduped.reduce((sum, d) => sum + d.costUsdc, 0);
  const uniqueApis = [...new Set(deduped.filter(d => d.provider && d.status === "success").map(d => d.provider))];

  return (
    <div className="space-y-3">
      {Array.from(rounds.entries()).map(([round, roundDecisions]) => (
        <div key={round}>
          {(rounds.size > 1 || round > 0) && (
            <div className="flex items-center gap-3 my-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
              <span className="data-readout text-accent px-3">
                {getRoundLabel(round, roundDecisions)}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
            </div>
          )}

          <div className="space-y-1.5">
            {roundDecisions.map((d, i) => {
              const config = ACTION_CONFIG[d.action] || { icon: "\u2022", color: "text-muted-foreground", label: d.action };
              const specConfig = d.specialist ? SPECIALIST_CONFIG[d.specialist] : null;
              const isRunning = d.status === "running";
              const isFailed = d.status === "failed";
              const isSkipped = d.status === "skipped";

              return (
                <div
                  key={`${d.step}-${d.round}-${d.status}`}
                  className={`decision-entry flex gap-3 p-3 rounded-lg border transition-all ${
                    isRunning
                      ? "bg-accent/[0.03] border-accent/20 animate-pulse"
                      : isFailed
                        ? "bg-red-500/[0.03] border-red-500/20"
                        : "bg-card/50 border-border/30 hover:border-border/60"
                  }`}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className={`text-base shrink-0 mt-0.5 ${specConfig?.color || config.color}`}>
                    {specConfig?.icon || config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      {specConfig && (
                        <span className={`text-xs font-bold font-mono ${specConfig.color}`}>
                          {specConfig.label}
                        </span>
                      )}
                      <span className={`text-xs font-medium ${config.color}`}>
                        {config.label}
                        {d.provider && <span className="text-muted-foreground"> \u2014 {d.provider}</span>}
                      </span>
                      {isRunning && (
                        <span className="text-[10px] text-accent font-mono animate-pulse">RUNNING</span>
                      )}
                      {isFailed && (
                        <span className="text-[10px] text-red-400 font-mono">FAILED</span>
                      )}
                      {isSkipped && (
                        <span className="text-[10px] text-yellow-400/60 font-mono">SKIPPED</span>
                      )}
                      {d.durationMs != null && d.durationMs > 0 && (
                        <span className="text-[10px] text-muted-foreground font-mono">{(d.durationMs / 1000).toFixed(1)}s</span>
                      )}
                      {/* Cost hidden from users — visible in admin only */}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {d.reasoning}
                    </p>
                    {d.resultSummary && (
                      <div className="mt-1.5 text-[11px] text-foreground/70 font-mono bg-muted/30 rounded-md px-2.5 py-1.5 leading-relaxed border border-border/20">
                        {d.resultSummary}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {deduped.length > 0 && (
        <div className="flex justify-between items-center pt-3 border-t border-border/30">
          <span className="data-readout text-muted-foreground">
            {deduped.length} steps
            {uniqueApis.length > 0 && ` \u00b7 ${uniqueApis.length} APIs`}
            {rounds.size > 1 && ` \u00b7 ${rounds.size} rounds`}
          </span>
          <span className="data-readout text-accent">
            {deduped.filter(d => d.status === "success").length} completed
          </span>
        </div>
      )}
    </div>
  );
}

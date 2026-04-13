export interface PipelineState {
  tier: "quick" | "standard" | "deep";
  currentPhase: number;
  maxPhases: number;
  phaseType: "classify" | "research" | "analysis" | "debate" | "expand" | "synthesize" | "complete";
  specialists: string[];
  entityQueue: string[];
  researchedEntities: string[];
  debateCount: number;
  lastDebatePhase: number;
  allResults: Array<{
    specialist: string;
    provider: string;
    endpoint: string;
    summary: string;
    phase: number;
  }>;
  specialistBriefs: Array<{
    specialist: string;
    brief: string;
    phase: number;
  }>;
  debateConclusions: string[];
  nextResearchPlan: Array<{
    provider: string;
    endpoint: string;
    reason: string;
    callParams: Record<string, unknown>;
    specialist: string;
  }>;
  classification: {
    taskType: string;
    entities: string[];
    reasoning: string;
  } | null;
  stepCounter: number;
  startedAt: string;
}

export function createInitialState(tier: "quick" | "standard" | "deep", specialists: string[]): PipelineState {
  const maxPhases: Record<string, number> = { quick: 3, standard: 12, deep: 500 };
  return {
    tier,
    currentPhase: 0,
    maxPhases: maxPhases[tier] || 10,
    phaseType: "classify",
    specialists,
    entityQueue: [],
    researchedEntities: [],
    debateCount: 0,
    lastDebatePhase: -1,
    allResults: [],
    specialistBriefs: [],
    debateConclusions: [],
    nextResearchPlan: [],
    classification: null,
    stepCounter: 0,
    startedAt: new Date().toISOString(),
  };
}

export function shouldDebate(state: PipelineState): boolean {
  if (state.tier === "quick") return false;
  if (state.allResults.length < 4) return false;
  const phasesSinceDebate = state.currentPhase - state.lastDebatePhase;
  if (state.tier === "standard") return phasesSinceDebate >= 3 && state.debateCount < 2;
  // Deep: debate every 5 phases, unlimited debates
  return phasesSinceDebate >= 5;
}

export function shouldAnalyze(state: PipelineState): boolean {
  if (state.tier === "quick") return false;
  // Analyze after every 2 research phases (but not if we just analyzed)
  const researchPhasesSinceAnalysis = state.allResults.filter(
    r => r.phase > (state.specialistBriefs.length > 0 ? state.specialistBriefs[state.specialistBriefs.length - 1].phase : -1)
  ).length;
  return researchPhasesSinceAnalysis >= 3;
}

export function isComplete(state: PipelineState): boolean {
  if (state.phaseType === "complete") return true;
  if (state.currentPhase >= state.maxPhases) return true;
  if (state.tier === "quick" && state.currentPhase >= 3) return true;
  if (state.tier === "standard" && state.currentPhase >= 10) return true;
  // Deep: only complete after exhaustive research — minimum 100 phases, 5+ debates, empty entity queue
  if (state.tier === "deep" && state.entityQueue.length === 0 && state.currentPhase >= 100 && state.debateCount >= 5) return true;
  return false;
}

export function getPhaseLabel(state: PipelineState): string {
  switch (state.phaseType) {
    case "classify": return "Council Assembly";
    case "research": return `Research Round ${Math.floor(state.currentPhase / 2) + 1}`;
    case "analysis": return "Specialist Analysis";
    case "debate": return `Council Debate #${state.debateCount + 1}`;
    case "expand": return "Expanding Research Tree";
    case "synthesize": return "Final Synthesis";
    case "complete": return "Delivered";
    default: return `Phase ${state.currentPhase}`;
  }
}

export function nextStep(state: PipelineState): number {
  return state.stepCounter++;
}

import {
  exaSearch,
  firecrawlScrape,
  geminiChat,
  coinGeckoPrice,
  coinGeckoMarkets,
  alphaVantageQuote,
  alphaVantageOverview,
  apolloOrgEnrichment,
  edgarFilings,
  perplexityChat,
  braveWebSearch,
} from "../locus/wrapped";
import {
  updateOrderStatus,
  createReport,
  getCostsByOrderId,
  logDecision,
  updateOrderClassification,
  updatePipelineState,
  getOrder,
} from "../db/queries";
import { classifyTask, planNextRound, type ApiPlan, type TaskClassification } from "../agent/classifier";
import { SPECIALISTS, MODERATOR_PROMPT, DEBATE_PROMPT, getSpecialistsForTier } from "../agent/specialists";
import {
  type PipelineState,
  createInitialState,
  shouldDebate,
  shouldAnalyze,
  isComplete,
  getPhaseLabel,
  nextStep,
} from "../agent/pipeline-state";
import { TASK_TYPE_CONFIGS } from "../agent/api-registry";

// ── Constants ──

const SEGMENT_TIME_BUDGET_MS = 80_000; // 80s budget per segment, leaves margin under 90s

interface SegmentResult {
  done: boolean;
  reportId?: string;
  totalCost?: number;
}

// ── Main Entry Point ──

export async function runPipelineSegment(
  orderId: string,
  taskDescription: string
): Promise<SegmentResult> {
  const segmentStart = Date.now();

  function timeRemaining(): number {
    return SEGMENT_TIME_BUDGET_MS - (Date.now() - segmentStart);
  }

  function hasTime(): boolean {
    return timeRemaining() > 10_000; // need at least 10s for an API call
  }

  try {
    // Load order and existing state
    const order = await getOrder(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    let state: PipelineState;

    if (order.pipelineState) {
      state = JSON.parse(order.pipelineState) as PipelineState;
    } else {
      // First segment: create initial state
      const tier = (order.pipelineTier || "quick") as "quick" | "standard" | "deep";
      const specialists = getSpecialistsForTier(tier);
      state = createInitialState(tier, specialists);
      await updatePipelineState(orderId, state.currentPhase, JSON.stringify(state));
    }

    // If already complete, return immediately
    if (state.phaseType === "complete") {
      return { done: true };
    }

    // Route to the correct phase handler
    let result: SegmentResult;

    switch (state.phaseType) {
      case "classify":
        result = await classifyPhase(orderId, taskDescription, state, hasTime);
        break;
      case "research":
        result = await researchPhase(orderId, taskDescription, state, hasTime);
        break;
      case "analysis":
        result = await analysisPhase(orderId, taskDescription, state, hasTime);
        break;
      case "debate":
        result = await debatePhase(orderId, taskDescription, state, hasTime);
        break;
      case "expand":
        result = await expandPhase(orderId, taskDescription, state, hasTime);
        break;
      case "synthesize":
        result = await synthesizePhase(orderId, taskDescription, state, hasTime);
        break;
      default:
        throw new Error(`Unknown phase type: ${state.phaseType}`);
    }

    // Save state after each segment
    await updatePipelineState(orderId, state.currentPhase, JSON.stringify(state));

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown pipeline error";
    console.error(`Pipeline segment failed for ${orderId}:`, message);
    await logDecision({
      orderId, step: 0, round: 0, action: "deliver",
      reasoning: `Pipeline segment failed: ${message}`,
      status: "failed",
    });
    await updateOrderStatus(orderId, "FAILED", { errorMessage: message });
    throw error;
  }
}

// ── Phase: Classify ──

async function classifyPhase(
  orderId: string,
  taskDescription: string,
  state: PipelineState,
  hasTime: () => boolean
): Promise<SegmentResult> {
  await updateOrderStatus(orderId, "CLASSIFYING");

  await logDecision({
    orderId, step: nextStep(state), round: 0, action: "classify",
    specialist: "moderator",
    reasoning: `Council assembling for task: "${taskDescription.slice(0, 100)}"`,
    status: "running",
  });

  const classification = await classifyTask(taskDescription, orderId);
  const config = TASK_TYPE_CONFIGS[classification.taskType];

  await updateOrderClassification(orderId, classification.taskType, JSON.stringify(classification));

  state.classification = {
    taskType: classification.taskType,
    entities: classification.entities,
    reasoning: classification.reasoning,
  };

  // Seed the entity queue with discovered entities
  for (const entity of classification.entities) {
    if (!state.entityQueue.includes(entity) && !state.researchedEntities.includes(entity)) {
      state.entityQueue.push(entity);
    }
  }

  // Build initial research plan from classification
  const researchApis = classification.recommendedApis.filter(a => a.provider !== "gemini");
  state.nextResearchPlan = researchApis.map(api => ({
    provider: api.provider,
    endpoint: api.endpoint,
    reason: api.reason,
    callParams: api.callParams,
    specialist: pickSpecialistForApi(api.provider, state.specialists),
  }));

  await logDecision({
    orderId, step: nextStep(state), round: 0, action: "plan",
    specialist: "moderator",
    reasoning: `Classified as ${config?.label || classification.taskType}. ${classification.reasoning}`,
    resultSummary: `Type: ${config?.label || classification.taskType} | Tier: ${state.tier} | Specialists: ${state.specialists.join(", ")} | APIs: ${researchApis.map(a => a.provider).join(", ")} | Est: $${classification.estimatedCost.toFixed(3)}`,
    costUsdc: 0.01,
    status: "success",
  });

  // Advance to research phase
  state.currentPhase++;
  state.phaseType = "research";
  await updateOrderStatus(orderId, "EXECUTING");

  // For Quick tier, immediately start research in this same segment
  if (state.tier === "quick" && hasTime()) {
    return researchPhase(orderId, taskDescription, state, hasTime);
  }

  return { done: false };
}

// ── Phase: Research ──

async function researchPhase(
  orderId: string,
  taskDescription: string,
  state: PipelineState,
  hasTime: () => boolean
): Promise<SegmentResult> {
  const round = Math.floor(state.currentPhase / 2);
  let callsMade = 0;
  const maxCallsPerSegment = state.tier === "quick" ? 4 : 3;

  // Determine API calls: either from nextResearchPlan or from classification plan
  let apisToCall = state.nextResearchPlan.length > 0
    ? [...state.nextResearchPlan]
    : buildResearchPlan(state);

  for (const apiTask of apisToCall) {
    if (!hasTime() || callsMade >= maxCallsPerSegment) break;

    const specialist = apiTask.specialist || pickSpecialistForApi(apiTask.provider, state.specialists);

    await logDecision({
      orderId, step: nextStep(state), round, action: "call_api",
      provider: apiTask.provider,
      specialist,
      reasoning: apiTask.reason,
      status: "running",
    });

    const callStart = Date.now();

    try {
      const plan: ApiPlan = {
        provider: apiTask.provider,
        endpoint: apiTask.endpoint,
        reason: apiTask.reason,
        estimatedCost: 0.01,
        priority: "required",
        callParams: apiTask.callParams,
      };

      const data = await callApiByPlan(plan, orderId);
      const duration = Date.now() - callStart;
      const summary = summarizeApiResult(apiTask.provider, data);

      state.allResults.push({
        specialist,
        provider: apiTask.provider,
        endpoint: apiTask.endpoint,
        summary,
        phase: state.currentPhase,
      });

      // Extract new entities from results
      const newEntities = extractEntitiesFromResult(apiTask.provider, data);
      for (const entity of newEntities) {
        if (!state.entityQueue.includes(entity) && !state.researchedEntities.includes(entity)) {
          state.entityQueue.push(entity);
        }
      }

      await logDecision({
        orderId, step: state.stepCounter - 1, round, action: "call_api",
        provider: apiTask.provider,
        specialist,
        reasoning: apiTask.reason,
        resultSummary: summary,
        costUsdc: plan.estimatedCost,
        durationMs: duration,
        status: "success",
      });

      callsMade++;
    } catch (err) {
      const duration = Date.now() - callStart;
      const errorMsg = err instanceof Error ? err.message : "API call failed";

      await logDecision({
        orderId, step: state.stepCounter - 1, round, action: "call_api",
        provider: apiTask.provider,
        specialist,
        reasoning: apiTask.reason,
        resultSummary: `FAILED: ${errorMsg}`,
        durationMs: duration,
        status: "skipped",
      });

      callsMade++;
    }

    // Remove this api from the plan once attempted
    state.nextResearchPlan = state.nextResearchPlan.filter(p =>
      !(p.provider === apiTask.provider && p.endpoint === apiTask.endpoint && JSON.stringify(p.callParams) === JSON.stringify(apiTask.callParams))
    );
  }

  // Mark any entities from classification as researched
  if (state.classification) {
    for (const entity of state.classification.entities) {
      if (!state.researchedEntities.includes(entity)) {
        state.researchedEntities.push(entity);
      }
    }
  }

  state.currentPhase++;

  // Decide next phase based on tier
  if (state.allResults.length === 0 && state.currentPhase >= state.maxPhases) {
    state.phaseType = "synthesize";
    return { done: false };
  }

  if (state.tier === "quick") {
    // Quick tier: classify → research → synthesize (done in 1-2 segments)
    if (state.nextResearchPlan.length > 0) {
      state.phaseType = "research";
    } else {
      state.phaseType = "synthesize";
    }
    if (hasTime() && state.phaseType === "synthesize") {
      return synthesizePhase(orderId, taskDescription, state, hasTime);
    }
    return { done: false };
  }

  // === Standard and Deep tiers: FORCED multi-phase cadence ===
  // NEVER go straight to synthesis — always do more work until phase limits

  if (isComplete(state)) {
    state.phaseType = "synthesize";
    return { done: false };
  }

  // If we have pending API calls, keep researching
  if (state.nextResearchPlan.length > 0) {
    state.phaseType = "research";
    return { done: false };
  }

  // If entity queue has items (Deep tier), expand
  if (state.tier === "deep" && state.entityQueue.length > 0) {
    state.phaseType = "expand";
    return { done: false };
  }

  // Forced cadence: after every 2 research phases → analysis
  if (shouldAnalyze(state)) {
    state.phaseType = "analysis";
    return { done: false };
  }

  // Forced cadence: debate rounds
  if (shouldDebate(state)) {
    state.phaseType = "debate";
    return { done: false };
  }

  // Still have budget for more research — ask Gemini what to investigate next
  // But FORCE it to continue (override shouldContinue: false)
  if (hasTime()) {
    const roundSummaries = state.allResults.map(r => ({
      provider: r.provider,
      summary: r.summary,
    }));

    const nextPlan = await planNextRound(
      taskDescription,
      (state.classification?.taskType || "general") as import("../agent/api-registry").TaskType,
      roundSummaries,
      orderId
    );

    // For Standard/Deep: ALWAYS plan more research even if Gemini says stop
    // (unless we've hit phase limits)
    const apis = nextPlan.apis?.filter(a => a.provider !== "gemini") || [];

    if (apis.length > 0) {
      state.nextResearchPlan = apis.map(api => ({
        provider: api.provider,
        endpoint: api.endpoint,
        reason: api.reason,
        callParams: api.callParams,
        specialist: pickSpecialistForApi(api.provider, state.specialists),
      }));

      await logDecision({
        orderId, step: nextStep(state), round, action: "analyze",
        specialist: "moderator",
        reasoning: nextPlan.reasoning || "Planning next research round",
        resultSummary: nextPlan.shouldContinue
          ? `Deep diving: ${nextPlan.researchGoal}`
          : `Expanding research: ${nextPlan.researchGoal || "broader analysis"}`,
        costUsdc: 0.01,
        status: "success",
      });

      state.phaseType = "research";
    } else {
      // Gemini returned no APIs — generate more research from entity queue or broader queries
      const fallbackApis = generateFallbackResearchPlan(taskDescription, state);
      if (fallbackApis.length > 0) {
        state.nextResearchPlan = fallbackApis;

        await logDecision({
          orderId, step: nextStep(state), round, action: "analyze",
          specialist: "moderator",
          reasoning: "Generating additional research angles to ensure comprehensive coverage",
          resultSummary: `Expanding: ${fallbackApis.map(a => a.provider).join(", ")}`,
          costUsdc: 0.01,
          status: "success",
        });

        state.phaseType = "research";
      } else {
        // Truly exhausted all research options
        state.phaseType = "synthesize";
      }
    }
  } else {
    // Out of time in this segment — continue in next segment
    state.phaseType = "research";
  }

  return { done: false };
}

// ── Phase: Analysis ──

async function analysisPhase(
  orderId: string,
  taskDescription: string,
  state: PipelineState,
  hasTime: () => boolean
): Promise<SegmentResult> {
  const round = Math.floor(state.currentPhase / 2);

  for (const specialistId of state.specialists) {
    if (!hasTime()) break;

    const specialist = SPECIALISTS[specialistId];
    if (!specialist) continue;

    // Gather this specialist's findings
    const findings = state.allResults
      .filter(r => r.specialist === specialistId)
      .map(r => `[${r.provider}] ${r.summary}`)
      .join("\n");

    if (!findings) continue;

    // Already have a brief from this specialist for recent data?
    const recentBrief = state.specialistBriefs.find(
      b => b.specialist === specialistId && b.phase >= state.currentPhase - 3
    );
    if (recentBrief) continue;

    await logDecision({
      orderId, step: nextStep(state), round, action: "brief",
      specialist: specialistId,
      reasoning: `${specialist.name} analyzing ${state.allResults.filter(r => r.specialist === specialistId).length} findings`,
      status: "running",
    });

    const callStart = Date.now();

    try {
      const analysisResult = await geminiChat(
        specialist.systemPrompt,
        `Task: "${taskDescription}"

Your research findings:
${findings}

Write your analysis brief (150-300 words). Be specific with data points. Identify gaps and entities needing further investigation.`,
        orderId,
        { maxTokens: 1024 }
      );

      const briefText = extractGeminiText(analysisResult);
      const duration = Date.now() - callStart;

      state.specialistBriefs.push({
        specialist: specialistId,
        brief: briefText,
        phase: state.currentPhase,
      });

      await logDecision({
        orderId, step: state.stepCounter - 1, round, action: "brief",
        specialist: specialistId,
        reasoning: `${specialist.name} brief completed`,
        resultSummary: briefText.slice(0, 200) + (briefText.length > 200 ? "..." : ""),
        costUsdc: 0.01,
        durationMs: duration,
        status: "success",
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Brief generation failed";
      await logDecision({
        orderId, step: state.stepCounter - 1, round, action: "brief",
        specialist: specialistId,
        reasoning: `${specialist.name} brief failed: ${errorMsg}`,
        status: "failed",
      });
    }
  }

  state.currentPhase++;

  // Decide next phase
  if (isComplete(state)) {
    state.phaseType = "synthesize";
  } else if (shouldDebate(state)) {
    state.phaseType = "debate";
  } else {
    state.phaseType = "research";
  }

  return { done: false };
}

// ── Phase: Debate ──

async function debatePhase(
  orderId: string,
  taskDescription: string,
  state: PipelineState,
  hasTime: () => boolean
): Promise<SegmentResult> {
  const round = Math.floor(state.currentPhase / 2);

  // Gather all specialist briefs
  const briefsText = state.specialistBriefs
    .map(b => {
      const spec = SPECIALISTS[b.specialist];
      return `### ${spec?.name || b.specialist} (Phase ${b.phase})\n${b.brief}`;
    })
    .join("\n\n");

  // Also include raw findings summary
  const findingsSummary = state.allResults
    .map(r => `[${r.specialist}/${r.provider}] ${r.summary}`)
    .join("\n");

  await logDecision({
    orderId, step: nextStep(state), round, action: "debate",
    specialist: "moderator",
    reasoning: `Council debate #${state.debateCount + 1}: moderating ${state.specialistBriefs.length} specialist briefs`,
    status: "running",
  });

  const callStart = Date.now();

  try {
    const debateResult = await geminiChat(
      DEBATE_PROMPT,
      `Task: "${taskDescription}"
Task Type: ${state.classification?.taskType || "general"}

## Specialist Briefs
${briefsText}

## All Research Findings
${findingsSummary}

Moderate the debate. Identify disagreements, gaps, and plan next research steps.`,
      orderId,
      { jsonMode: true, maxTokens: 2048 }
    );

    const debateText = extractGeminiText(debateResult);
    const duration = Date.now() - callStart;

    // Parse the debate output
    let debateOutput: {
      disagreements?: Array<{ topic: string; resolution: string }>;
      gaps?: string[];
      nextResearchPlan?: Array<{
        provider: string;
        endpoint: string;
        reason: string;
        callParams: Record<string, unknown>;
      }>;
      entityQueue?: string[];
      summary?: string;
    } = {};

    try {
      let jsonText = debateText.trim();
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonText = jsonMatch[0];
      debateOutput = JSON.parse(jsonText);
    } catch {
      // If JSON parse fails, treat entire text as summary
      debateOutput = { summary: debateText };
    }

    // Record debate conclusions
    if (debateOutput.summary) {
      state.debateConclusions.push(debateOutput.summary);
    }

    // Enqueue new entities from debate
    if (debateOutput.entityQueue) {
      for (const entity of debateOutput.entityQueue) {
        if (!state.entityQueue.includes(entity) && !state.researchedEntities.includes(entity)) {
          state.entityQueue.push(entity);
        }
      }
    }

    // Set next research plan from debate
    if (debateOutput.nextResearchPlan && debateOutput.nextResearchPlan.length > 0) {
      state.nextResearchPlan = debateOutput.nextResearchPlan.map(api => ({
        provider: api.provider,
        endpoint: api.endpoint,
        reason: api.reason,
        callParams: api.callParams,
        specialist: pickSpecialistForApi(api.provider, state.specialists),
      }));
    }

    state.debateCount++;
    state.lastDebatePhase = state.currentPhase;

    const gapsList = debateOutput.gaps?.join(", ") || "none identified";
    await logDecision({
      orderId, step: state.stepCounter - 1, round, action: "debate",
      specialist: "moderator",
      reasoning: `Debate #${state.debateCount} concluded. Gaps: ${gapsList}`,
      resultSummary: debateOutput.summary?.slice(0, 200) || "Debate completed",
      costUsdc: 0.01,
      durationMs: duration,
      status: "success",
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Debate failed";
    state.debateCount++;
    state.lastDebatePhase = state.currentPhase;

    await logDecision({
      orderId, step: state.stepCounter - 1, round, action: "debate",
      specialist: "moderator",
      reasoning: `Debate failed: ${errorMsg}`,
      status: "failed",
    });
  }

  state.currentPhase++;

  // Decide next phase
  if (isComplete(state)) {
    state.phaseType = "synthesize";
  } else if (state.tier === "deep" && state.entityQueue.length > 0) {
    state.phaseType = "expand";
  } else if (state.nextResearchPlan.length > 0) {
    state.phaseType = "research";
  } else {
    state.phaseType = "synthesize";
  }

  return { done: false };
}

// ── Phase: Expand (Deep Dive only) ──

async function expandPhase(
  orderId: string,
  taskDescription: string,
  state: PipelineState,
  hasTime: () => boolean
): Promise<SegmentResult> {
  const round = Math.floor(state.currentPhase / 2);
  const entitiesToExpand = state.entityQueue.splice(0, 3); // Pop up to 3 entities
  let callsMade = 0;

  for (const entity of entitiesToExpand) {
    if (!hasTime()) {
      // Put unconsumed entities back
      state.entityQueue.unshift(entity);
      break;
    }

    state.researchedEntities.push(entity);

    // Determine best APIs for this entity based on task type
    const expandApis = determineApisForEntity(entity, state);

    for (const apiTask of expandApis) {
      if (!hasTime() || callsMade >= 3) break;

      const specialist = pickSpecialistForApi(apiTask.provider, state.specialists);

      await logDecision({
        orderId, step: nextStep(state), round, action: "call_api",
        provider: apiTask.provider,
        specialist,
        reasoning: `Expanding research on "${entity}": ${apiTask.reason}`,
        status: "running",
      });

      const callStart = Date.now();

      try {
        const data = await callApiByPlan(apiTask, orderId);
        const duration = Date.now() - callStart;
        const summary = summarizeApiResult(apiTask.provider, data);

        state.allResults.push({
          specialist,
          provider: apiTask.provider,
          endpoint: apiTask.endpoint,
          summary,
          phase: state.currentPhase,
        });

        // Extract further entities
        const newEntities = extractEntitiesFromResult(apiTask.provider, data);
        for (const newEntity of newEntities) {
          if (!state.entityQueue.includes(newEntity) && !state.researchedEntities.includes(newEntity)) {
            state.entityQueue.push(newEntity);
          }
        }

        await logDecision({
          orderId, step: state.stepCounter - 1, round, action: "call_api",
          provider: apiTask.provider,
          specialist,
          reasoning: `Expanded "${entity}"`,
          resultSummary: summary,
          costUsdc: apiTask.estimatedCost,
          durationMs: duration,
          status: "success",
        });

        callsMade++;
      } catch (err) {
        const duration = Date.now() - callStart;
        const errorMsg = err instanceof Error ? err.message : "API call failed";

        await logDecision({
          orderId, step: state.stepCounter - 1, round, action: "call_api",
          provider: apiTask.provider,
          specialist,
          reasoning: `Expand "${entity}" failed: ${errorMsg}`,
          durationMs: duration,
          status: "skipped",
        });

        callsMade++;
      }
    }
  }

  state.currentPhase++;

  // Decide next phase
  if (isComplete(state)) {
    state.phaseType = "synthesize";
  } else if (state.entityQueue.length > 0) {
    // More entities to expand
    if (shouldDebate(state)) {
      state.phaseType = "debate";
    } else {
      state.phaseType = "expand";
    }
  } else if (shouldDebate(state)) {
    state.phaseType = "debate";
  } else if (shouldAnalyze(state)) {
    state.phaseType = "analysis";
  } else {
    state.phaseType = "research";
  }

  return { done: false };
}

// ── Phase: Synthesize ──

async function synthesizePhase(
  orderId: string,
  taskDescription: string,
  state: PipelineState,
  _hasTime: () => boolean
): Promise<SegmentResult> {
  const round = Math.floor(state.currentPhase / 2);
  await updateOrderStatus(orderId, "SYNTHESIZING");

  if (state.allResults.length === 0) {
    throw new Error("No research data collected -- cannot generate report");
  }

  await logDecision({
    orderId, step: nextStep(state), round, action: "synthesize",
    specialist: "moderator",
    reasoning: `Synthesizing ${state.allResults.length} findings, ${state.specialistBriefs.length} briefs, ${state.debateConclusions.length} debate conclusions into final report`,
    status: "running",
  });

  // Build comprehensive synthesis input
  const synthesisInput = buildSegmentedSynthesisPrompt(taskDescription, state);

  const taskType = state.classification?.taskType || "general";
  const synthesisSystemPrompt = state.tier === "quick"
    ? getSynthesisSystemPrompt(taskType)
    : `${MODERATOR_PROMPT}\n\n${getSynthesisSystemPrompt(taskType)}`;

  const maxTokens = state.tier === "deep" ? 16384 : state.tier === "standard" ? 8192 : 4096;

  const geminiResult = await geminiChat(
    synthesisSystemPrompt,
    synthesisInput,
    orderId,
    { maxTokens }
  );

  const reportText = extractGeminiText(geminiResult);
  if (!reportText) throw new Error("Synthesis returned empty response");

  const startedAt = new Date(state.startedAt).getTime();
  const durationMs = Date.now() - startedAt;

  await logDecision({
    orderId, step: state.stepCounter - 1, round, action: "synthesize",
    specialist: "moderator",
    reasoning: "Report synthesized successfully",
    resultSummary: `Generated ${reportText.length} character report from ${state.allResults.length} sources across ${state.currentPhase} phases`,
    costUsdc: 0.01,
    status: "success",
  });

  // Save report
  const sources = extractSourcesFromState(state);
  const costs = await getCostsByOrderId(orderId);
  const totalCost = costs.reduce((sum, c) => sum + c.costUsdc, 0);

  const contentJson = JSON.stringify({
    taskDescription,
    taskType,
    entities: state.classification?.entities || [],
    tier: state.tier,
    generatedAt: new Date().toISOString(),
    apisCalled: [...new Set(state.allResults.map(r => r.provider))],
    phaseCount: state.currentPhase,
    debateCount: state.debateCount,
    durationMs,
    totalApiCalls: state.allResults.length,
    specialistBriefs: state.specialistBriefs.length,
    sections: parseBriefSections(reportText),
  });

  const reportId = await createReport({
    orderId,
    contentJson,
    contentMarkdown: reportText,
    sources: JSON.stringify(sources),
    researchCostUsdc: totalCost,
  });

  await logDecision({
    orderId, step: nextStep(state), round, action: "deliver",
    specialist: "moderator",
    reasoning: `Job complete in ${(durationMs / 1000).toFixed(0)}s | ${state.currentPhase} phases | ${state.allResults.length} API calls | ${state.debateCount} debates | Cost: $${totalCost.toFixed(4)}`,
    resultSummary: `Report ID: ${reportId}`,
    status: "success",
  });

  await updateOrderStatus(orderId, "COMPLETED", {
    completedAt: new Date().toISOString(),
  });

  state.phaseType = "complete";

  return { done: true, reportId, totalCost };
}

// ── Helper: Generate Fallback Research ──
// When planNextRound returns no APIs, generate more research angles automatically

function generateFallbackResearchPlan(taskDescription: string, state: PipelineState): Array<{
  provider: string;
  endpoint: string;
  reason: string;
  callParams: Record<string, unknown>;
  specialist: string;
}> {
  const plan: Array<{
    provider: string; endpoint: string; reason: string;
    callParams: Record<string, unknown>; specialist: string;
  }> = [];

  const usedProviders = new Set(state.allResults.map(r => r.provider));
  const entities = state.classification?.entities || [taskDescription.slice(0, 50)];
  const primaryEntity = entities[0] || taskDescription.slice(0, 50);

  // Always try providers not yet used
  if (!usedProviders.has("brave") && state.specialists.includes("investigator")) {
    plan.push({
      provider: "brave", endpoint: "web-search",
      reason: `Broader web search for ${primaryEntity} from independent search engine`,
      callParams: { q: `${primaryEntity} analysis 2026` },
      specialist: "investigator",
    });
  }

  if (!usedProviders.has("apollo") && state.specialists.includes("data_analyst")) {
    // Try to extract a domain from entity name
    const domain = guessDomain(primaryEntity);
    if (domain) {
      plan.push({
        provider: "apollo", endpoint: "org-enrichment",
        reason: `Company enrichment for ${primaryEntity} — employee count, funding, industry`,
        callParams: { domain },
        specialist: "data_analyst",
      });
    }
  }

  if (!usedProviders.has("firecrawl") && state.specialists.includes("investigator")) {
    // Try to find a URL from previous results to scrape
    const urlToScrape = findUrlToScrape(state);
    if (urlToScrape) {
      plan.push({
        provider: "firecrawl", endpoint: "scrape",
        reason: `Scraping primary source: ${urlToScrape}`,
        callParams: { url: urlToScrape },
        specialist: "investigator",
      });
    }
  }

  if (!usedProviders.has("perplexity") && state.specialists.includes("researcher")) {
    plan.push({
      provider: "perplexity", endpoint: "chat",
      reason: `AI-powered follow-up research on ${primaryEntity}`,
      callParams: { query: `Detailed analysis of ${primaryEntity}: market position, competitors, recent developments` },
      specialist: "researcher",
    });
  }

  // For deep tier: ALWAYS generate lots of varied research angles
  if (state.tier === "deep" || state.tier === "standard") {
    const searchAngles = [
      `${primaryEntity} competitors alternatives comparison 2026`,
      `${primaryEntity} market analysis trends`,
      `${primaryEntity} pricing revenue business model`,
      `${primaryEntity} reviews pros cons`,
      `${primaryEntity} future predictions outlook`,
      `${primaryEntity} history founding story`,
      `${primaryEntity} technology stack architecture`,
      `${primaryEntity} team leadership management`,
    ];

    // Pick angles we haven't researched yet (based on phase number to vary)
    const angleIndex = state.currentPhase % searchAngles.length;
    plan.push({
      provider: "exa", endpoint: "search",
      reason: `Deep search angle ${angleIndex + 1}: ${searchAngles[angleIndex].split(" ").slice(1).join(" ")}`,
      callParams: { query: searchAngles[angleIndex], numResults: 8 },
      specialist: "researcher",
    });

    // Second angle
    const angleIndex2 = (state.currentPhase + 3) % searchAngles.length;
    if (angleIndex2 !== angleIndex) {
      plan.push({
        provider: "perplexity", endpoint: "chat",
        reason: `AI-powered research: ${searchAngles[angleIndex2]}`,
        callParams: { query: searchAngles[angleIndex2] },
        specialist: "researcher",
      });
    }

    // Research unresearched entities from the queue
    for (const entity of entities.slice(0, 3)) {
      if (!state.researchedEntities.includes(entity)) {
        plan.push({
          provider: "exa", endpoint: "search",
          reason: `Researching related entity: ${entity}`,
          callParams: { query: `${entity} detailed analysis overview`, numResults: 5 },
          specialist: "researcher",
        });
      }
    }
  }

  return plan;
}

function guessDomain(entity: string): string | null {
  const knownDomains: Record<string, string> = {
    stripe: "stripe.com", adyen: "adyen.com", paypal: "paypal.com",
    square: "squareup.com", apple: "apple.com", tesla: "tesla.com",
    google: "google.com", microsoft: "microsoft.com", amazon: "amazon.com",
    meta: "meta.com", nvidia: "nvidia.com", openai: "openai.com",
    anthropic: "anthropic.com", cursor: "cursor.com", notion: "notion.so",
    linear: "linear.app", figma: "figma.com", vercel: "vercel.com",
    shopify: "shopify.com", spotify: "spotify.com", netflix: "netflix.com",
    uber: "uber.com", airbnb: "airbnb.com", coinbase: "coinbase.com",
  };
  const lower = entity.toLowerCase().trim();
  return knownDomains[lower] || null;
}

function findUrlToScrape(state: PipelineState): string | null {
  for (const result of state.allResults) {
    if (result.summary.includes("results:")) {
      // Try to extract a URL-like pattern from exa/brave results
      const match = result.summary.match(/https?:\/\/[^\s'"]+/);
      if (match) return match[0];
    }
  }
  return null;
}

// ── Helper: Pick Specialist for API ──

function pickSpecialistForApi(provider: string, availableSpecialists: string[]): string {
  for (const specId of availableSpecialists) {
    const spec = SPECIALISTS[specId];
    if (spec && spec.apis.includes(provider)) {
      return specId;
    }
  }
  // Default to first specialist if no match
  return availableSpecialists[0] || "researcher";
}

// ── Helper: Build Research Plan from State ──

function buildResearchPlan(state: PipelineState): Array<{
  provider: string;
  endpoint: string;
  reason: string;
  callParams: Record<string, unknown>;
  specialist: string;
}> {
  if (!state.classification) return [];

  const taskType = state.classification.taskType;
  const config = TASK_TYPE_CONFIGS[taskType as keyof typeof TASK_TYPE_CONFIGS];
  if (!config) return [];

  // Build a fallback plan from task type config
  const plan: Array<{
    provider: string;
    endpoint: string;
    reason: string;
    callParams: Record<string, unknown>;
    specialist: string;
  }> = [];

  // Add a generic search if we have no results yet
  if (state.allResults.length === 0) {
    plan.push({
      provider: "exa",
      endpoint: "search",
      reason: `General search for ${state.classification.entities.join(", ")}`,
      callParams: { query: state.classification.entities.join(" "), numResults: 8 },
      specialist: pickSpecialistForApi("exa", state.specialists),
    });
  }

  return plan;
}

// ── Helper: Determine APIs for Entity Expansion ──

function determineApisForEntity(entity: string, state: PipelineState): ApiPlan[] {
  const apis: ApiPlan[] = [];
  const entityLower = entity.toLowerCase();

  // Check if it looks like a domain
  if (entity.includes(".")) {
    apis.push({
      provider: "apollo",
      endpoint: "org-enrichment",
      reason: `Company enrichment for ${entity}`,
      estimatedCost: 0.008,
      priority: "required",
      callParams: { domain: entity },
    });
  }

  // Check if it looks like a stock ticker (all caps, short)
  if (/^[A-Z]{1,5}$/.test(entity)) {
    apis.push({
      provider: "alphavantage",
      endpoint: "global-quote",
      reason: `Stock quote for ${entity}`,
      estimatedCost: 0.008,
      priority: "required",
      callParams: { symbol: entity },
    });
  }

  // Check if it looks like a crypto ID
  if (entityLower.match(/^[a-z0-9-]+$/) && !entity.includes(".")) {
    const cryptoLike = ["bitcoin", "ethereum", "solana", "cardano", "polkadot", "chainlink",
      "uniswap", "avalanche", "polygon", "litecoin", "dogecoin", "shiba"];
    if (cryptoLike.some(c => entityLower.includes(c)) ||
        (state.classification?.taskType === "crypto" && entityLower.length < 30)) {
      apis.push({
        provider: "coingecko",
        endpoint: "simple-price",
        reason: `Price data for ${entity}`,
        estimatedCost: 0.06,
        priority: "required",
        callParams: { ids: entityLower },
      });
    }
  }

  // Always do a search as fallback
  if (apis.length === 0) {
    apis.push({
      provider: "exa",
      endpoint: "search",
      reason: `Expanding research on "${entity}"`,
      estimatedCost: 0.01,
      priority: "required",
      callParams: { query: `${entity} ${state.classification?.entities?.[0] || ""}`.trim(), numResults: 5 },
    });
  }

  return apis;
}

// ── Helper: Extract Entities from API Results ──

function extractEntitiesFromResult(provider: string, data: unknown): string[] {
  const entities: string[] = [];
  const skipDomains = new Set(["google.com", "wikipedia.org", "reddit.com", "youtube.com", "medium.com", "twitter.com", "x.com", "linkedin.com", "facebook.com", "github.com", "stackoverflow.com", "quora.com", "amazon.com", "nytimes.com", "bbc.com", "cnn.com", "forbes.com", "bloomberg.com", "techcrunch.com"]);

  try {
    const d = data as Record<string, unknown>;

    if (provider === "apollo") {
      const org = d.organization as Record<string, unknown> | undefined;
      if (org) {
        if (org.industry) entities.push(org.industry as string);
        if (org.name) entities.push(org.name as string);
        // Extract keywords which often contain competitor names
        const keywords = org.keywords as string[] | undefined;
        if (keywords) entities.push(...keywords.slice(0, 5));
      }
    } else if (provider === "exa" || provider === "brave") {
      // Extract domains AND meaningful titles from search results
      const results = (provider === "exa"
        ? (d.results as Array<{ url?: string; title?: string; text?: string }>) || []
        : ((d.web as Record<string, unknown>)?.results as Array<{ url?: string; title?: string }>) || []);

      for (const result of results.slice(0, 5)) {
        if (result.url) {
          try {
            const hostname = new URL(result.url).hostname.replace("www.", "");
            if (!skipDomains.has(hostname) && hostname.split(".").length <= 3) {
              entities.push(hostname);
            }
          } catch { /* skip */ }
        }
        // Extract company/product names from titles
        if (result.title) {
          // Look for patterns like "Company vs Company" or "Company: ..."
          const vsMatch = result.title.match(/(\w+)\s+vs\.?\s+(\w+)/i);
          if (vsMatch) {
            entities.push(vsMatch[1], vsMatch[2]);
          }
        }
      }
    } else if (provider === "perplexity") {
      // Extract from citations (domains) and mentioned companies in response
      const citations = (d.citations as string[]) || [];
      for (const url of citations.slice(0, 5)) {
        try {
          const hostname = new URL(url).hostname.replace("www.", "");
          if (!skipDomains.has(hostname)) entities.push(hostname);
        } catch { /* skip */ }
      }
    } else if (provider === "alphavantage") {
      const name = d["Name"] as string;
      if (name) entities.push(name);
    } else if (provider === "edgar") {
      const name = d.name as string;
      if (name) entities.push(name);
      const tickers = d.tickers as string[];
      if (tickers) entities.push(...tickers);
    } else if (provider === "coingecko") {
      // Extract coin names from market data
      if (Array.isArray(d)) {
        for (const coin of (d as Array<{ name?: string }>).slice(0, 5)) {
          if (coin.name) entities.push(coin.name);
        }
      }
    }
  } catch { /* skip */ }

  // Deduplicate and clean
  return [...new Set(entities.map(e => e.trim()).filter(e => e.length > 1 && e.length < 50))];
}

// ── Helper: Extract Sources from State ──

function extractSourcesFromState(state: PipelineState): string[] {
  // Collect URLs mentioned in summaries (crude but workable)
  const urls: string[] = [];
  for (const result of state.allResults) {
    const urlMatches = result.summary.match(/https?:\/\/[^\s'",)]+/g);
    if (urlMatches) urls.push(...urlMatches);
  }
  return [...new Set(urls)];
}

// ── Helper: Build Synthesis Prompt for Segmented Pipeline ──

function buildSegmentedSynthesisPrompt(taskDescription: string, state: PipelineState): string {
  const findingsSections = state.allResults
    .map(r => `### [Phase ${r.phase}] ${SPECIALISTS[r.specialist]?.name || r.specialist} via ${r.provider}\n${r.summary}`)
    .join("\n\n");

  const briefsSections = state.specialistBriefs
    .map(b => {
      const spec = SPECIALISTS[b.specialist];
      return `### ${spec?.name || b.specialist} (Phase ${b.phase})\n${b.brief}`;
    })
    .join("\n\n");

  const debateSection = state.debateConclusions.length > 0
    ? `## Debate Conclusions\n${state.debateConclusions.map((c, i) => `### Debate #${i + 1}\n${c}`).join("\n\n")}`
    : "";

  return `Task: "${taskDescription}"
Classification: ${state.classification?.taskType || "general"} -- ${state.classification?.reasoning || ""}
Entities: ${state.classification?.entities?.join(", ") || "N/A"}
Tier: ${state.tier}
Research phases completed: ${state.currentPhase}
Total API calls: ${state.allResults.length}
Debates held: ${state.debateCount}

## Research Data Collected

${findingsSections}

${briefsSections ? `## Specialist Analysis Briefs\n\n${briefsSections}` : ""}

${debateSection}

Generate a comprehensive report based on ALL the data above. Reference specific numbers and data points. ${
  state.tier === "deep"
    ? "This is a Deep Dive report -- be extremely thorough, 3000-6000+ words."
    : state.tier === "standard"
    ? "This is a Standard report -- be detailed, 1500-3000 words."
    : "Be concise but specific, 1000-2000 words."
}`;
}

// ── Backward Compatibility: runResearchPipeline ──

export async function runResearchPipeline(
  orderId: string,
  taskDescription: string
): Promise<{ reportId: string; totalCost: number }> {
  // Loop calling runPipelineSegment until done
  // This is for backward compat with endpoints that run synchronously
  const maxSegments = 80; // safety limit
  for (let i = 0; i < maxSegments; i++) {
    const result = await runPipelineSegment(orderId, taskDescription);
    if (result.done) {
      return {
        reportId: result.reportId || "",
        totalCost: result.totalCost || 0,
      };
    }
  }
  throw new Error("Pipeline exceeded maximum segment count");
}

// ── API Dispatcher ──

async function callApiByPlan(plan: ApiPlan, orderId: string): Promise<unknown> {
  const p = plan.callParams;
  // Normalize: classifier may return "exa_search"/"exa_search/search"/"exa/search" — all should work
  const rawKey = plan.endpoint
    ? `${plan.provider}/${plan.endpoint}`
    : plan.provider;
  // Strip duplicate suffixes like "exa_search/search" → "exa/search"
  const key = rawKey
    .replace(/^(\w+)_(\w+)\/\2$/, "$1/$2")  // exa_search/search → exa/search
    .replace(/^(\w+)_(\w+)$/, "$1/$2");       // exa_search → exa/search

  switch (key) {
    case "exa/search":
    case "exa_search":
      return exaSearch(p.query as string || plan.provider, orderId, (p.numResults as number) || 8);
    case "firecrawl/scrape":
    case "firecrawl_scrape":
      return firecrawlScrape(p.url as string, orderId);
    case "coingecko/simple-price":
    case "coingecko/price":
    case "coingecko_price":
      return coinGeckoPrice(p.ids as string, orderId);
    case "coingecko/coins-markets":
    case "coingecko_markets":
      return coinGeckoMarkets(orderId, p.category as string | undefined);
    case "alphavantage/global-quote":
    case "alphavantage_quote":
      return alphaVantageQuote(p.symbol as string, orderId);
    case "alphavantage/company-overview":
    case "alphavantage_overview":
      return alphaVantageOverview(p.symbol as string, orderId);
    case "apollo/org-enrichment":
    case "apollo_org":
      return apolloOrgEnrichment(p.domain as string, orderId);
    case "edgar/company-submissions":
    case "edgar_filings":
      return edgarFilings(p.cik as string, orderId);
    case "perplexity/chat":
    case "perplexity_chat":
      return perplexityChat(p.query as string || plan.provider, orderId);
    case "brave/web-search":
    case "brave/search":
    case "brave_search":
      return braveWebSearch((p.q || p.query) as string, orderId);
    case "gemini/chat":
    case "gemini_chat":
      // Skip gemini in API execution — it's used only in synthesis
      return { skipped: true };
    default:
      console.error(`Unknown API key: ${key} (raw: ${rawKey}, provider=${plan.provider}, endpoint=${plan.endpoint})`);
      throw new Error(`Unknown API: ${key}`);
  }
}

// ── Rich Result Summarizers ──

function summarizeApiResult(provider: string, data: unknown): string {
  try {
    const d = data as Record<string, unknown>;
    switch (provider) {
      case "exa": {
        const results = (d.results as Array<{ title?: string; url?: string }>) || [];
        const titles = results.slice(0, 3).map(r => r.title || "Untitled").join("', '");
        return `Found ${results.length} results: '${titles}'${results.length > 3 ? "..." : ""}`;
      }
      case "firecrawl": {
        const md = (d.markdown as string) || "";
        const meta = d.metadata as Record<string, string> | undefined;
        const title = meta?.title || "page";
        const preview = md.slice(0, 120).replace(/\n/g, " ").trim();
        return `Scraped ${title} (${md.length.toLocaleString()} chars) — "${preview}..."`;
      }
      case "coingecko": {
        const keys = Object.keys(d);
        if (keys.length > 0 && typeof d[keys[0]] === "object") {
          const entries = keys.map(k => {
            const v = d[k] as Record<string, number>;
            const change = v.usd_24h_change;
            const changeStr = change ? ` (${change > 0 ? "+" : ""}${change.toFixed(1)}%)` : "";
            const mcap = v.usd_market_cap ? ` | MCap: $${(v.usd_market_cap / 1e9).toFixed(1)}B` : "";
            return `${k.toUpperCase()}: $${v.usd?.toLocaleString()}${changeStr}${mcap}`;
          });
          return entries.join(" | ");
        }
        if (Array.isArray(d)) {
          const coins = d as Array<{ name?: string; current_price?: number }>;
          return `Top coins: ${coins.slice(0, 3).map(c => `${c.name}: $${c.current_price?.toLocaleString()}`).join(", ")}`;
        }
        return "Got market data";
      }
      case "alphavantage": {
        const quote = d["Global Quote"] as Record<string, string> | undefined;
        if (quote) {
          const sym = quote["01. symbol"];
          const price = quote["05. price"];
          const change = quote["10. change percent"];
          const vol = Number(quote["06. volume"]);
          const volStr = vol > 1e6 ? `${(vol / 1e6).toFixed(1)}M` : vol.toLocaleString();
          return `${sym}: $${price} (${change}) | Vol: ${volStr}`;
        }
        const name = d["Name"] as string;
        if (name) {
          const pe = d["PERatio"] as string;
          const rev = Number(d["RevenueTTM"] as string);
          const mcap = Number(d["MarketCapitalization"] as string);
          const revStr = rev > 1e9 ? `$${(rev / 1e9).toFixed(1)}B` : `$${(rev / 1e6).toFixed(0)}M`;
          const mcapStr = mcap > 1e12 ? `$${(mcap / 1e12).toFixed(2)}T` : `$${(mcap / 1e9).toFixed(1)}B`;
          return `${name} | P/E: ${pe} | Rev: ${revStr} | MCap: ${mcapStr}`;
        }
        return "Got financial data";
      }
      case "apollo": {
        const org = d.organization as Record<string, unknown> | undefined;
        if (!org) return "Got org data";
        const name = org.name || "Unknown";
        const emp = org.estimated_num_employees || "?";
        const industry = org.industry || "";
        const founded = org.founded_year || "";
        const funding = org.total_funding ? `$${(Number(org.total_funding) / 1e6).toFixed(0)}M raised` : "";
        return `${name} — ${emp} employees | ${industry}${founded ? ` | Founded ${founded}` : ""}${funding ? ` | ${funding}` : ""}`;
      }
      case "edgar": {
        const name = d.name as string || "Company";
        const tickers = (d.tickers as string[]) || [];
        const filings = d.filings as Record<string, unknown> | undefined;
        const recent = filings?.recent as Record<string, string[]> | undefined;
        const formCount = recent?.form?.length || 0;
        const latestForm = recent?.form?.[0];
        const latestDate = recent?.filingDate?.[0];
        const tickerStr = tickers.length > 0 ? ` (${tickers[0]})` : "";
        return `${name}${tickerStr} | Latest: ${latestForm || "?"} filed ${latestDate || "?"} | ${formCount} total filings`;
      }
      case "perplexity": {
        const choices = (d.choices as Array<{ message?: { content?: string } }>) || [];
        const citations = (d.citations as string[]) || [];
        const content = choices[0]?.message?.content || "";
        const preview = content.slice(0, 100).replace(/\n/g, " ").trim();
        const sources = citations.slice(0, 3).map(u => {
          try { return new URL(u).hostname.replace("www.", ""); } catch { return u; }
        });
        return `"${preview}..." (${citations.length} citations from ${sources.join(", ")})`;
      }
      case "brave": {
        const web = d.web as Record<string, unknown> | undefined;
        const results = (web?.results as Array<{ title?: string }>) || [];
        const titles = results.slice(0, 3).map(r => r.title || "Untitled").join("', '");
        return `Found ${results.length} results: '${titles}'${results.length > 3 ? "..." : ""}`;
      }
      default:
        return "Data received";
    }
  } catch {
    return "Data received";
  }
}

function extractSources(apiResults: Array<{ provider: string; data: unknown }>): string[] {
  const urls: string[] = [];
  for (const r of apiResults) {
    try {
      const d = r.data as Record<string, unknown>;
      if (r.provider === "exa") {
        const results = (d.results as Array<{ url: string }>) || [];
        urls.push(...results.map((x) => x.url));
      } else if (r.provider === "brave") {
        const web = d.web as Record<string, unknown> | undefined;
        const results = (web?.results as Array<{ url: string }>) || [];
        urls.push(...results.map((x) => x.url));
      } else if (r.provider === "perplexity") {
        const citations = (d.citations as string[]) || [];
        urls.push(...citations);
      }
    } catch { /* skip */ }
  }
  return [...new Set(urls)];
}

// ── Synthesis ──

function getSynthesisSystemPrompt(taskType: string): string {
  const typeHints: Record<string, string> = {
    crypto: "Focus on price action, market metrics, ecosystem analysis, and competitive positioning. Reference specific prices and market caps from CoinGecko data.",
    public_company: "Focus on financial performance, stock analysis, SEC filings, and competitive positioning. Reference specific P/E ratios, revenue figures, and stock prices from Alpha Vantage and EDGAR data.",
    startup: "Focus on product-market fit, competitive landscape, team size, funding, and growth trajectory. Reference specific employee counts and company data from Apollo enrichment.",
    person: "Focus on professional background, key achievements, current role, and industry influence.",
    general: "Provide a comprehensive, well-structured overview of the topic.",
  };

  return `You are Agent Zero, an autonomous AI research agent with access to premium paid data sources. Generate a professional research report.

${typeHints[taskType] || typeHints.general}

IMPORTANT: Reference the SPECIFIC data you received from paid APIs (prices, employee counts, P/E ratios, filing dates, etc). This data is what makes your report valuable — it comes from premium sources like Apollo (company database), Alpha Vantage (financial data), EDGAR (SEC filings), and CoinGecko (crypto markets) that are not freely available.

Output in clean markdown with these sections:
## Executive Summary
## Key Findings
## Detailed Analysis
## Data Points
## Takeaways

Be specific with data points, numbers, and sources. Use bullet points for clarity.
The report should be 1000-2000 words.`;
}

function extractGeminiText(result: {
  text?: string;
  content?: string;
  candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
}): string {
  if (result.text) return result.text;
  if (result.content) return result.content;
  if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
    return result.candidates[0].content.parts[0].text;
  }
  return "";
}

function parseBriefSections(markdown: string): Array<{ title: string; content: string }> {
  const sections: Array<{ title: string; content: string }> = [];
  const parts = markdown.split(/^## /gm).filter(Boolean);
  for (const part of parts) {
    const lines = part.split("\n");
    const title = lines[0]?.trim() || "Section";
    const content = lines.slice(1).join("\n").trim();
    sections.push({ title, content });
  }
  return sections.length > 0 ? sections : [{ title: "Report", content: markdown }];
}

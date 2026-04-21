import { geminiChat } from "../locus/wrapped";
import { checkHandlerSource } from "./ast-check";

export interface EngineerInput {
  businessName: string;
  pitch: string;
  genome: string;
  pricingDefaultUsdc: number;
  commissionId: string;
}

export interface EngineerOutput {
  handlerSource: string;
  pricePerCallUsdc: number;
  llmCostEstimateUsdc: number;
  openApi: { summary: string; inputSchema: unknown; outputSchema: unknown };
}

const SYSTEM_PROMPT = `You are a senior engineer writing a tiny AI microservice handler.

Output ONLY a JavaScript async function named 'handle' with this exact signature:

  async function handle(input, ctx) { ... }

Rules:
- Do NOT use eval, Function constructor, require, process, globalThis, import, or any form of dynamic code.
- Do NOT include any API keys or URLs containing localhost / 127.0.0.1 / locus.local.
- Use 'ctx.llm(prompt, { maxTokens?: number })' for any language model needs. Max 1024 tokens per call.
- Use 'ctx.fetch(url, init)' for any web calls; do not hit private/internal networks.
- Keep the function under 60 lines.
- Input can be a string or an object with an 'input' field.
- Return a JSON-serializable object.

Return the function and nothing else — no markdown fences, no comments, no surrounding text.`;

export async function runEngineer(input: EngineerInput): Promise<EngineerOutput> {
  const userPrompt = `Business: ${input.businessName}
Pitch: ${input.pitch}
User's one-sentence brief: ${input.genome}

Generate the handler function.`;

  const tryOnce = async (extraHint = ""): Promise<string> => {
    const res = await geminiChat(
      SYSTEM_PROMPT + extraHint,
      userPrompt,
      input.commissionId,
      { maxTokens: 1600, jsonMode: false }
    );
    const raw = (
      (res as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]
        ?.content?.parts?.[0]?.text ??
      (res as { text?: string })?.text ??
      (res as { content?: string })?.content ??
      ""
    ) as string;
    let cleaned = raw
      .replace(/^\s*```(?:js|javascript|ts|typescript)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    // If there's a fenced block anywhere, keep only its contents
    const fenceMatch = cleaned.match(/```(?:js|javascript|ts|typescript)?\s*([\s\S]*?)```/);
    if (fenceMatch) cleaned = fenceMatch[1].trim();
    return cleaned;
  };

  let handlerSource = await tryOnce();
  let check = checkHandlerSource(handlerSource);
  if (!check.ok) {
    const hint1 = `\n\nYour previous attempt was rejected for: ${check.reasons.join("; ")}. Output ONLY the function definition, pure JavaScript, no markdown fences, no TypeScript syntax.`;
    handlerSource = await tryOnce(hint1);
    check = checkHandlerSource(handlerSource);
  }
  if (!check.ok) {
    const hint2 = `\n\nRejected again for: ${check.reasons.join("; ")}. Emit ONLY this exact shape, filling in the prompt body:\nasync function handle(input, ctx) {\n  const subject = typeof input === "string" ? input : (input && input.input) || "";\n  const response = await ctx.llm("...your prompt including " + subject, { maxTokens: 512 });\n  return { output: response.trim() };\n}`;
    handlerSource = await tryOnce(hint2);
    check = checkHandlerSource(handlerSource);
  }
  if (!check.ok) {
    // Safe fallback — always valid. Wraps the pitch as the LLM prompt prefix.
    const safePitch = input.pitch.replace(/[`$\\"]/g, " ").slice(0, 240).trim();
    handlerSource =
      `async function handle(input, ctx) {\n` +
      `  const subject = typeof input === "string" ? input : (input && input.input) || "";\n` +
      `  const prompt = ${JSON.stringify(safePitch + ": ")} + subject;\n` +
      `  const response = await ctx.llm(prompt, { maxTokens: 512 });\n` +
      `  return { output: String(response).trim() };\n` +
      `}`;
    check = checkHandlerSource(handlerSource);
    if (!check.ok) {
      throw new Error("engineer: fallback handler failed AST check — " + check.reasons.join("; "));
    }
  }

  return {
    handlerSource,
    pricePerCallUsdc: 0.05,
    llmCostEstimateUsdc: 0.02,
    openApi: {
      summary: input.pitch,
      inputSchema: { type: "object", properties: { input: { type: "string" } }, required: ["input"] },
      outputSchema: { type: "object" },
    },
  };
}

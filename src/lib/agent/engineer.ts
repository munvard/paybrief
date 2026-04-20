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
    return raw
      .replace(/^```(?:js|javascript)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  };

  let handlerSource = await tryOnce();
  let check = checkHandlerSource(handlerSource);
  if (!check.ok) {
    const hint = `\n\nYour previous attempt was rejected for: ${check.reasons.join("; ")}. Output ONLY the function definition.`;
    handlerSource = await tryOnce(hint);
    check = checkHandlerSource(handlerSource);
    if (!check.ok) {
      throw new Error("engineer: generated code failed AST check — " + check.reasons.join("; "));
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

import { ulid } from "ulid";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { runEngineer } from "./engineer";
import { runCashier } from "./cashier";
import { runShipwright } from "./shipwright";
import { publishEvent } from "../redis";
import path from "node:path";

interface CommissionStart {
  prompt: string;
  commissionerType: "human" | "business";
  commissionerId?: string;
  commissionerEmail?: string;
  checkoutSessionId?: string;
  agentPayTxHash?: string;
  feePaidUsdc: number;
}

export async function startCommission(input: CommissionStart): Promise<string> {
  const id = "com_" + ulid().toLowerCase();
  const db = getDb();
  await db.insert(schema.commissions).values({
    id,
    prompt: input.prompt,
    commissionerType: input.commissionerType,
    commissionerId: input.commissionerId,
    commissionerEmail: input.commissionerEmail,
    checkoutSessionId: input.checkoutSessionId,
    agentPayTxHash: input.agentPayTxHash,
    feePaidUsdc: String(input.feePaidUsdc),
    status: "pending",
  });
  // Fire-and-forget the pipeline; any error is captured and logged on the commission.
  void runCommission(id).catch(async (err) => {
    try {
      await db
        .update(schema.commissions)
        .set({ status: "failed", failureReason: (err as Error).message, updatedAt: new Date() })
        .where(eq(schema.commissions.id, id));
      await publishEvent(`events:commission:${id}`, { type: "failed", reason: (err as Error).message });
    } catch (inner) {
      console.error("[council] failed to record failure:", (inner as Error).message);
    }
  });
  return id;
}

async function logDecision(
  commissionId: string,
  round: number,
  specialist: string,
  action: string,
  reasoning: string,
  resultSummary: string,
  costUsdc = 0,
  provider?: string
) {
  const db = getDb();
  await db.insert(schema.decisions).values({
    id: "dec_" + ulid().toLowerCase(),
    commissionId,
    round,
    specialist,
    action,
    provider,
    reasoning,
    resultSummary,
    costUsdc: String(costUsdc),
  });
  await publishEvent(`events:commission:${commissionId}`, {
    type: "decision",
    round,
    specialist,
    action,
    provider,
    reasoning,
    resultSummary,
    costUsdc,
  });
}

async function runCommission(commissionId: string) {
  const db = getDb();
  const [row] = await db.select().from(schema.commissions).where(eq(schema.commissions.id, commissionId));
  if (!row) throw new Error("commission row gone");
  const prompt = row.prompt;

  await db.update(schema.commissions).set({ status: "classifying" }).where(eq(schema.commissions.id, commissionId));
  await logDecision(commissionId, 1, "moderator", "classify", "classifying commission prompt", prompt.slice(0, 80));

  // Extract a name heuristically. Refined by engineer in later tasks if needed.
  let name = prompt.split(/[,.:;]/)[0].trim().replace(/^(an?\s+|the\s+)/i, "");
  name = name.slice(0, 60) || "Foundry Business";
  const pitch = prompt.trim().slice(0, 120);

  await db.update(schema.commissions).set({ status: "researching" }).where(eq(schema.commissions.id, commissionId));
  await logDecision(
    commissionId,
    2,
    "researcher",
    "context",
    "gathering lightweight context (stubbed for speed)",
    "no external calls",
    0
  );

  await db.update(schema.commissions).set({ status: "engineering" }).where(eq(schema.commissions.id, commissionId));
  const businessId = "biz_" + ulid().toLowerCase().slice(-12);
  const eng = await runEngineer({
    businessName: name,
    pitch,
    genome: prompt,
    pricingDefaultUsdc: 0.05,
    commissionId,
  });
  await logDecision(
    commissionId,
    3,
    "engineer",
    "generate_handler",
    "handler generated and passed AST check",
    `${eng.handlerSource.length} chars`,
    0.018,
    "wrapped/gemini/chat"
  );

  await db.update(schema.commissions).set({ status: "deploying" }).where(eq(schema.commissions.id, commissionId));
  await db.insert(schema.businesses).values({
    id: businessId,
    name,
    pitch,
    genome: prompt,
    parentId: row.commissionerType === "business" ? row.commissionerId ?? null : null,
    handlerCode: eng.handlerSource,
    pricePerCallUsdc: String(eng.pricePerCallUsdc),
    llmCostEstimateUsdc: String(eng.llmCostEstimateUsdc),
    status: "conceived",
  });

  const cashier = await runCashier({
    businessId,
    businessName: name,
    genome: prompt,
    parentId: row.commissionerType === "business" ? row.commissionerId ?? null : null,
    handlerSource: eng.handlerSource,
    seedUsdc: 0.25,
  });
  await logDecision(
    commissionId,
    4,
    "cashier",
    "register_subagent",
    "Locus sub-agent created and seeded",
    `wallet=${cashier.walletAddress}`,
    0.25
  );

  try {
    await db
      .update(schema.businesses)
      .set({
        walletAddress: cashier.walletAddress,
        walletApiKeyEnc: cashier.walletApiKeyEnc,
        handlerCodeHash: cashier.birthCertSha256,
        birthCertJson: JSON.parse(
          Buffer.from(cashier.birthCertJwt.split(".")[1], "base64url").toString("utf8")
        ) as Record<string, unknown>,
        status: "deploying",
        statusChangedAt: new Date(),
      })
      .where(eq(schema.businesses.id, businessId));
  } catch {
    // parsing JWT payload is best-effort; never block the pipeline on it
    await db
      .update(schema.businesses)
      .set({
        walletAddress: cashier.walletAddress,
        walletApiKeyEnc: cashier.walletApiKeyEnc,
        handlerCodeHash: cashier.birthCertSha256,
        status: "deploying",
        statusChangedAt: new Date(),
      })
      .where(eq(schema.businesses.id, businessId));
  }

  const templatePath = process.env.BIZ_TEMPLATE_PATH ?? path.join(process.cwd(), "business-template");
  const foundryBusUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.LOCUS_SERVICE_URL ?? "";
  const ship = await runShipwright({
    businessId,
    businessName: name,
    businessPitch: pitch,
    handlerSource: eng.handlerSource,
    walletApiKey: cashier.apiKey,
    walletAddress: cashier.walletAddress,
    sessionSecret: cashier.sessionSecret,
    pricePerCallUsdc: eng.pricePerCallUsdc,
    llmCostEstimateUsdc: eng.llmCostEstimateUsdc,
    foundryBusUrl,
    templatePath,
    onStatus: (s) =>
      publishEvent(`events:commission:${commissionId}`, { type: "deploy", status: s }),
  });
  await logDecision(commissionId, 5, "shipwright", "deploy", "BWL deploy healthy", ship.serviceUrl, 0.25);

  await db
    .update(schema.businesses)
    .set({
      bwlProjectId: ship.projectId,
      bwlServiceId: ship.serviceId,
      bwlUrl: ship.serviceUrl,
      mcpUrl: `${ship.serviceUrl}/mcp/sse`,
      status: "alive",
      statusChangedAt: new Date(),
    })
    .where(eq(schema.businesses.id, businessId));

  await db
    .update(schema.commissions)
    .set({ status: "complete", businessId, updatedAt: new Date() })
    .where(eq(schema.commissions.id, commissionId));

  await publishEvent(`events:commission:${commissionId}`, {
    type: "complete",
    businessId,
    serviceUrl: ship.serviceUrl,
  });
}

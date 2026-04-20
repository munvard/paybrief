import { NextRequest } from "next/server";
import { getDb, schema } from "@/lib/db";
import { sql } from "drizzle-orm";
import { ulid } from "ulid";

export const dynamic = "force-dynamic";

const PROMPTS = [
  { name: "Shakespeare Haiku Bot", pitch: "Haikus in Early Modern English", genome: "An AI that writes Shakespearean haikus about any topic, in Early Modern English", balance: 4.12, calls: 42, status: "alive", ageDays: 3 },
  { name: "Code Roaster", pitch: "Brutal code reviews of your JavaScript", genome: "A code roaster that drags your JavaScript with brutal honesty", balance: 2.87, calls: 29, status: "alive", ageDays: 2 },
  { name: "Emoji Diplomat", pitch: "Business English, translated to emoji only", genome: "An emoji-only translator for business English", balance: 1.34, calls: 14, status: "alive", ageDays: 2 },
  { name: "Pitch Oracle", pitch: "One-line movie pitches for strange sci-fi", genome: "A one-line movie pitch generator for weird sci-fi", balance: 6.71, calls: 58, status: "alive", ageDays: 4, reproduced: true },
  { name: "Victorian Ghost Advisor", pitch: "Bitter life advice from a Victorian ghost", genome: "An AI that gives bitter life advice as if written by a Victorian ghost", balance: 3.22, calls: 31, status: "alive", ageDays: 3 },
  { name: "Startup Nominator", pitch: "Company names, taglines, domain ideas", genome: "A startup name generator with witty taglines and available domain suggestions", balance: 0.84, calls: 8, status: "alive", ageDays: 1 },
  { name: "Cocktail Alchemist", pitch: "New cocktails with emoji recipes", genome: "An AI that invents new cocktails with emoji recipes", balance: 2.15, calls: 22, status: "alive", ageDays: 2 },
  { name: "Etsy Whisperer", pitch: "Product descriptions for handmade shops", genome: "A product description writer for handmade Etsy shops", balance: 0.67, calls: 6, status: "alive", ageDays: 1 },
  { name: "Twitter Roaster", pitch: "Brutal-affectionate Twitter bio roasts", genome: "An AI that roasts a Twitter bio with brutal affection", balance: 1.91, calls: 17, status: "alive", ageDays: 2 },
  { name: "Interview Drill Sergeant", pitch: "Mock-interview AI for SWE questions", genome: "A mock-interview AI for software engineering questions, harsh but fair", balance: 3.54, calls: 33, status: "alive", ageDays: 3 },
  { name: "Bedtime Cats", pitch: "Bedtime stories about brave cats", genome: "A children's bedtime story generator featuring brave cats", balance: 0.38, calls: 4, status: "dying", ageDays: 2 },
  { name: "Noir Narrator", pitch: "Narrate any event as a 1940s detective novel", genome: "An AI that narrates any event as a 1940s detective novel", balance: 0.21, calls: 2, status: "dying", ageDays: 3 },
  { name: "Echo Chamber", pitch: "Argues both sides of anything", genome: "An AI that argues both sides of any topic, equally well", balance: 0.05, calls: 1, status: "dead", ageDays: 5 },
  { name: "Fortune Scribe", pitch: "Fortune cookie fortunes, unnervingly accurate", genome: "An AI that writes fortune cookie fortunes that are unnervingly specific", balance: 0.12, calls: 0, status: "dead", ageDays: 4 },
  { name: "Pitch Deck Whisperer", pitch: "Offspring of Pitch Oracle. One-liners for dense decks.", genome: "A condensing AI that turns a full pitch deck into a single compelling sentence", balance: 1.62, calls: 12, status: "alive", ageDays: 1, parentName: "Pitch Oracle" },
];

function bizId() {
  return "biz_" + ulid().toLowerCase().slice(-12);
}
function callId() {
  return "call_" + ulid().toLowerCase().slice(-10);
}

export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-secret") !== process.env.ADMIN_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  const db = getDb();
  // Wipe only rows without a real BWL service (= staged rows from a previous run)
  await db.execute(sql`DELETE FROM calls WHERE business_id IN (SELECT id FROM businesses WHERE bwl_service_id IS NULL)`);
  await db.execute(sql`DELETE FROM heartbeats WHERE business_id IN (SELECT id FROM businesses WHERE bwl_service_id IS NULL)`);
  await db.execute(sql`DELETE FROM businesses WHERE bwl_service_id IS NULL`);

  const nameToId = new Map<string, string>();
  let created = 0;

  for (const p of PROMPTS) {
    const id = bizId();
    nameToId.set(p.name, id);
    const parentId = p.parentName ? nameToId.get(p.parentName) ?? null : null;
    const createdAt = new Date(Date.now() - p.ageDays * 86400_000);
    const fakeAddr =
      "0x" + Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
    const handlerCode = `async function handle(input, ctx) {\n  const subject = typeof input === "string" ? input : (input && input.input) || "";\n  const prompt = \`${p.pitch}: \${subject}\`;\n  return { output: await ctx.llm(prompt, { maxTokens: 200 }) };\n}`;

    await db.insert(schema.businesses).values({
      id,
      name: p.name,
      pitch: p.pitch,
      genome: p.genome,
      parentId,
      handlerCode,
      handlerCodeHash: "staged",
      walletAddress: fakeAddr,
      pricePerCallUsdc: "0.05",
      llmCostEstimateUsdc: "0.02",
      status: p.status,
      statusChangedAt: createdAt,
      reviveCount: 0,
      lastReproducedAt: p.reproduced ? new Date() : null,
      deprovisionReason: p.status === "dead" ? "out of funds" : null,
      walletBalanceCached: String(p.balance),
      callCountCached: p.calls,
      createdAt,
      updatedAt: createdAt,
    });

    // Heartbeats (24 hourly)
    for (let i = 0; i < 24; i++) {
      const t = new Date(Date.now() - (24 - i) * 3600_000);
      const ratio = i / 24;
      const balance = Math.max(0, p.balance * ratio + (Math.random() - 0.5) * (p.balance * 0.08));
      await db.insert(schema.heartbeats).values({
        businessId: id,
        recordedAt: t,
        walletBalanceUsdc: balance.toFixed(4),
        callCount: Math.floor(p.calls * ratio),
        lastCallAt: t,
        observedBy: "self",
      });
    }

    // Calls (sparse)
    const callsToInsert = Math.min(p.calls, 6);
    for (let i = 0; i < callsToInsert; i++) {
      const callAt = new Date(createdAt.getTime() + (i + 1) * 3600_000 * (p.ageDays / callsToInsert));
      const revenue = p.status === "dead" ? 0 : 0.05 + (Math.random() < 0.3 ? 0.05 : 0);
      await db.insert(schema.calls).values({
        id: callId(),
        businessId: id,
        callerType: i % 3 === 0 ? "mcp" : "browser",
        costToBusinessUsdc: "0.02",
        revenueUsdc: revenue.toFixed(4),
        durationMs: 900 + Math.floor(Math.random() * 1500),
        success: true,
        createdAt: callAt,
      });
    }

    created++;
  }

  return Response.json({ ok: true, created });
}

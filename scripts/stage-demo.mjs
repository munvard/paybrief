// Seed ~15 plausible businesses into the DB for a dress-rehearsal gallery.
// Usage: DATABASE_URL=... node scripts/stage-demo.mjs
//
// These rows are labeled as "staged: true" in metadata via the deprovision_reason
// hint. Real businesses override them. Foundry-heart cron treats them as alive
// but will NOT try to deprovision them (they have no bwl_service_id).

import pg from "pg";
import { randomUUID } from "node:crypto";

const { Pool } = pg;

const prompts = [
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
  { name: "Pitch Deck Whisperer", pitch: "Offspring of Pitch Oracle. One-liners for dense decks.", genome: "A condensing AI that turns a full pitch deck into a single compelling sentence (child of Pitch Oracle)", balance: 1.62, calls: 12, status: "alive", ageDays: 1, parentName: "Pitch Oracle" },
];

function ulid() {
  // Simple k-sortable ID without an external lib
  const time = Date.now().toString(36);
  const rand = randomUUID().replace(/-/g, "").slice(0, 16);
  return `${time}${rand}`;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    console.log("[stage] wiping existing staged rows (those without bwl_service_id)...");
    await client.query("DELETE FROM calls WHERE business_id IN (SELECT id FROM businesses WHERE bwl_service_id IS NULL)");
    await client.query("DELETE FROM heartbeats WHERE business_id IN (SELECT id FROM businesses WHERE bwl_service_id IS NULL)");
    await client.query("DELETE FROM businesses WHERE bwl_service_id IS NULL AND name <> 'The Foundry'");

    // Name → id map for parent linking
    const nameToId = new Map();

    for (const p of prompts) {
      const id = "biz_" + ulid().toLowerCase().slice(-12);
      nameToId.set(p.name, id);
      const createdAt = new Date(Date.now() - p.ageDays * 86400_000);
      const parentId = p.parentName ? nameToId.get(p.parentName) ?? null : null;
      const handlerCode = `async function handle(input, ctx) {\n  const subject = typeof input === "string" ? input : (input && input.input) || "";\n  const prompt = \`${p.pitch}: \${subject}\`;\n  return { output: await ctx.llm(prompt, { maxTokens: 200 }) };\n}`;
      await client.query(
        `INSERT INTO businesses (
          id, name, pitch, genome, parent_id, handler_code, handler_code_hash,
          bwl_project_id, bwl_service_id, bwl_url, mcp_url,
          wallet_address, wallet_api_key_enc,
          price_per_call_usdc, llm_cost_estimate_usdc,
          status, status_changed_at,
          revive_count, last_reproduced_at, deprovision_reason,
          wallet_balance_cached, call_count_cached,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          NULL, NULL, NULL, NULL,
          $8, NULL,
          $9, $10,
          $11, $12,
          $13, $14, $15,
          $16, $17,
          $18, $19
        )`,
        [
          id,
          p.name,
          p.pitch,
          p.genome,
          parentId,
          handlerCode,
          "staged",
          `0x${Math.random().toString(16).slice(2, 42).padEnd(40, "0")}`,
          "0.05",
          "0.02",
          p.status,
          createdAt,
          0,
          p.reproduced ? new Date() : null,
          p.status === "dead" ? "out of funds" : null,
          String(p.balance),
          p.calls,
          createdAt,
          createdAt,
        ]
      );

      // Heartbeats across 24h (for sparklines)
      const buckets = 24;
      for (let i = 0; i < buckets; i++) {
        const t = new Date(Date.now() - (buckets - i) * 3600_000);
        const ratio = i / buckets;
        const balance = Math.max(0, p.balance * ratio + (Math.random() - 0.5) * (p.balance * 0.08));
        await client.query(
          `INSERT INTO heartbeats (business_id, recorded_at, wallet_balance_usdc, call_count, last_call_at, observed_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, t, balance.toFixed(4), Math.floor(p.calls * ratio), t, "self"]
        );
      }

      // Call log (sparse)
      const callsToInsert = Math.min(p.calls, 8);
      for (let i = 0; i < callsToInsert; i++) {
        const callAt = new Date(createdAt.getTime() + (i + 1) * 3_600_000 * (p.ageDays / callsToInsert));
        const revenue = p.status === "dead" ? 0 : 0.05 + (Math.random() < 0.3 ? 0.05 : 0);
        await client.query(
          `INSERT INTO calls (id, business_id, caller_type, cost_to_business_usdc, revenue_usdc, duration_ms, success, error_message, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8)`,
          [`call_${ulid().slice(-10)}`, id, i % 3 === 0 ? "mcp" : "browser", "0.02", revenue.toFixed(4), 900 + Math.floor(Math.random() * 1500), true, callAt]
        );
      }

      console.log(`[stage]  + ${p.name} (${p.status}, $${p.balance})`);
    }

    console.log(`[stage] done. ${prompts.length} businesses staged.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[stage] fatal:", e.message);
  process.exit(1);
});

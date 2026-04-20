// Idempotent boot-time migration runner.
// Reads every drizzle/*.sql file in order and runs each statement.
// Skips "already exists" errors so multi-instance boots don't race.

import pg from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const { Pool } = pg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[migrate] DATABASE_URL not set, skipping migrations");
    return;
  }
  const pool = new Pool({ connectionString: url });
  try {
    const dir = join(process.cwd(), "drizzle");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const f of files) {
      const sql = readFileSync(join(dir, f), "utf8");
      const statements = sql.split(/--> statement-breakpoint/g).map((s) => s.trim()).filter(Boolean);
      console.log(`[migrate] ${f}: ${statements.length} statements`);
      for (const s of statements) {
        try {
          await pool.query(s);
        } catch (e) {
          const msg = String(e?.message ?? e);
          if (msg.includes("already exists") || msg.includes("duplicate")) {
            // Tolerate re-runs.
            continue;
          }
          console.error(`[migrate] stmt failed: ${msg}`);
          throw e;
        }
      }
    }
    console.log("[migrate] ok");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[migrate] fatal:", e?.message ?? e);
  process.exit(1);
});

import Database from "better-sqlite3";
import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";

const DB_PATH = process.env.CREDITS_DB_PATH ?? "/tmp/credits.sqlite";

const BOOTSTRAP_SQL = `CREATE TABLE IF NOT EXISTS sessions (
  jti TEXT PRIMARY KEY,
  credits_usdc_remaining REAL NOT NULL,
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);`;

let _db: Database.Database | null = null;
function db() {
  if (_db) return _db;
  const d = new Database(DB_PATH);
  // DDL statement to bootstrap schema
  d.prepare(BOOTSTRAP_SQL).run();
  _db = d;
  return _db;
}

async function secretKey() {
  const s = process.env.BIZ_SESSION_SECRET;
  if (!s) throw new Error("BIZ_SESSION_SECRET not set");
  return new TextEncoder().encode(s);
}

export async function issueCreditsToken(amountUsdc: number, ttlSec = 3600): Promise<string> {
  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();
  db().prepare("INSERT INTO sessions (jti, credits_usdc_remaining, expires_at) VALUES (?,?,?)").run(jti, amountUsdc, expiresAt);
  const jwt = await new SignJWT({ credits_start: amountUsdc })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(process.env.BUSINESS_ID ?? "biz")
    .setJti(jti)
    .setExpirationTime(`${ttlSec}s`)
    .sign(await secretKey());
  return jwt;
}

export interface CreditCheckResult {
  ok: boolean;
  jti?: string;
  remaining?: number;
  reason?: string;
}

export async function verifyAndDebit(token: string, debitUsdc: number): Promise<CreditCheckResult> {
  try {
    const { payload } = await jwtVerify(token, await secretKey());
    const jti = payload.jti as string | undefined;
    if (!jti) return { ok: false, reason: "missing jti" };
    const row = db().prepare("SELECT credits_usdc_remaining, revoked FROM sessions WHERE jti = ?").get(jti) as { credits_usdc_remaining: number; revoked: number } | undefined;
    if (!row) return { ok: false, reason: "unknown session" };
    if (row.revoked) return { ok: false, reason: "revoked" };
    if (row.credits_usdc_remaining < debitUsdc) return { ok: false, reason: "insufficient credits", remaining: row.credits_usdc_remaining };
    const newBalance = row.credits_usdc_remaining - debitUsdc;
    db().prepare("UPDATE sessions SET credits_usdc_remaining = ? WHERE jti = ?").run(newBalance, jti);
    return { ok: true, jti, remaining: newBalance };
  } catch (e) {
    return { ok: false, reason: `jwt: ${(e as Error).message}` };
  }
}

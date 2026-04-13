import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, unknown> = {
    env: {
      DATABASE_PATH: process.env.DATABASE_PATH ? `${process.env.DATABASE_PATH.substring(0, 20)}...` : "NOT SET",
      TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ? "SET (hidden)" : "NOT SET",
      LOCUS_API_KEY: process.env.LOCUS_API_KEY ? "SET (hidden)" : "NOT SET",
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "NOT SET",
      NODE_ENV: process.env.NODE_ENV,
    },
  };

  try {
    const result = await db.all(sql`SELECT name FROM sqlite_master WHERE type='table'`);
    checks.db = { connected: true, tables: result };
  } catch (err) {
    checks.db = { connected: false, error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json(checks);
}

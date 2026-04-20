import { getDb, schema } from "@/lib/db";
import { eq, and, gte, sql } from "drizzle-orm";

export const revalidate = 3;

async function loadLiveCount(): Promise<number> {
  try {
    const db = getDb();
    const result = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.businesses)
      .where(eq(schema.businesses.status, "alive"));
    return Number(result[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

function romanMonth(m: number): string {
  return ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][m] ?? "—";
}

function formatDateLong(d: Date): string {
  const day = d.getDate();
  const month = d.toLocaleString("en-US", { month: "long" });
  return `${day} ${month} ${d.getFullYear()} ${romanMonth(d.getMonth())}`;
}

export async function StatusBar() {
  const alive = await loadLiveCount();
  const today = new Date();
  return (
    <div
      style={{
        height: 44,
        borderBottom: "1px solid var(--rule)",
        background: "var(--bg-0)",
      }}
    >
      <div
        className="page-gutter container-xl"
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--ink-2)",
          letterSpacing: "0.04em",
        }}
      >
        <div>
          <span className="status-dot alive" style={{ marginRight: 10, verticalAlign: "middle" }} />
          LIVE · {alive} {alive === 1 ? "business" : "businesses"} breathing
        </div>
        <div>{formatDateLong(today)}</div>
      </div>
    </div>
  );
}

import { Hero } from "@/components/hero";
import { Examples } from "@/components/examples";
import { BalanceSheet } from "@/components/balance-sheet";
import { ProcessStrip } from "@/components/process-strip";
import { Manifesto } from "@/components/manifesto";
import { FeaturedSpecimen } from "@/components/featured-specimen";
import { Gallery } from "@/components/gallery";
import { Treasury } from "@/components/treasury";
import { McpSection } from "@/components/mcp-section";
import { EventStream } from "@/components/event-stream";
import { getDb, schema } from "@/lib/db";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const revalidate = 5;

async function pickFeatured() {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.businesses)
      .where(eq(schema.businesses.status, "alive"))
      .orderBy(desc(schema.businesses.walletBalanceCached))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const featured = await pickFeatured();
  const featuredId = featured?.id ?? null;
  return (
    <main>
      {/* WHAT IT IS */}
      <Hero />

      {/* WHAT YOU CAN MAKE */}
      <Examples />

      {/* HOW IT GOES FROM SENTENCE TO LIVE */}
      <ProcessStrip />

      {/* LIVE PROOF */}
      <BalanceSheet />

      {/* A FEATURED ONE */}
      {featured && (
        <section className="page-gutter container-xl" style={{ padding: "96px 96px 48px" }}>
          <div className="f-caps" style={{ marginBottom: 24 }}>— Featured specimen</div>
          <FeaturedSpecimen id={featured.id} />
        </section>
      )}

      {/* THE REST OF THE REGISTRY + LIVE STREAM */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 48 }}>
        <Gallery featuredId={featuredId} />
        <aside className="page-gutter" style={{ paddingRight: 96, paddingTop: 28 }}>
          <EventStream />
        </aside>
      </div>

      {/* PROOF THE MONEY IS REAL */}
      <Treasury />

      {/* A NEW THING — INSTALL ANY BUSINESS INTO CLAUDE */}
      <McpSection />

      {/* WHY THIS EXISTS */}
      <Manifesto />
    </main>
  );
}

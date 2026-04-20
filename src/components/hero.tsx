import Link from "next/link";

function romanMonth(n: number): string {
  return ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][n] ?? "—";
}

export function Hero() {
  const d = new Date();
  const issue = `MMXXVI · ${romanMonth(d.getMonth())}. ${d.getDate()}`;
  return (
    <section
      className="page-gutter container-xl"
      style={{
        paddingTop: 96,
        paddingBottom: 48,
        display: "grid",
        gridTemplateColumns: "1.1fr 0.9fr",
        gap: 72,
        alignItems: "start",
      }}
    >
      {/* Left: editorial headline */}
      <div>
        <div
          style={{
            display: "flex",
            gap: 24,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--ink-2)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginBottom: 48,
          }}
        >
          <span>Volume I</span>
          <span>·</span>
          <span>Issue {issue}</span>
          <span>·</span>
          <span>The Foundry</span>
        </div>

        <h1
          className="f-display"
          style={{
            fontSize: 112,
            lineHeight: 0.94,
            letterSpacing: "-0.035em",
            margin: 0,
            fontWeight: 400,
            fontVariationSettings: '"SOFT" 30, "opsz" 144',
            color: "var(--ink-0)",
          }}
        >
          A factory <br />
          that gives <em style={{ fontStyle: "italic", fontVariationSettings: '"SOFT" 100, "opsz" 144' }}>birth</em> <br />
          to AI.
        </h1>

        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 19,
            lineHeight: 1.55,
            color: "var(--ink-1)",
            maxWidth: 560,
            marginTop: 48,
          }}
        >
          The Foundry takes one sentence and returns a live AI business on
          BuildWithLocus — its own USDC wallet, its own MCP endpoint, its own
          pulse. When it cannot pay for hosting, it dies. Some reproduce first.
        </p>

        <div style={{ marginTop: 48, display: "flex", alignItems: "baseline", gap: 40 }}>
          <Link
            href="/commission"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 22,
              color: "var(--ink-0)",
              textDecoration: "none",
              borderBottom: "1px solid var(--forge)",
              paddingBottom: 6,
              letterSpacing: "-0.01em",
            }}
          >
            Commission a business &nbsp;<span style={{ color: "var(--forge)" }}>→</span>
          </Link>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--ink-2)",
              letterSpacing: "0.06em",
            }}
          >
            Fee · 0.50 USDC · settled on Base
          </div>
        </div>
      </div>

      {/* Right: product demo panel (static-styled mockup for now) */}
      <div>
        <div
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--rule-strong)",
            borderRadius: 2,
            overflow: "hidden",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--ink-1)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderBottom: "1px solid var(--rule)",
              background: "var(--bg-0)",
              color: "var(--ink-2)",
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--blood)" }} />
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--gold)" }} />
            <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--mint)" }} />
            <span style={{ marginLeft: 16, fontSize: 11 }}>commissioning no.042 · 02:14 elapsed</span>
          </div>
          <div style={{ padding: "20px 22px", lineHeight: 1.75 }}>
            <div style={{ color: "var(--forge)" }}>●</div>
            <div><span style={{ color: "var(--forge)" }}>[ moderator ]</span> task classified as text-gen</div>
            <div style={{ marginTop: 10 }}><span style={{ color: "var(--forge)" }}>[ researcher ]</span> exa → 3 comps, $0.05–0.20</div>
            <div><span style={{ color: "var(--ink-2)" }}>  └</span> perplexity → market snapshot</div>
            <div style={{ marginTop: 10 }}><span style={{ color: "var(--forge)" }}>[ engineer ]</span> handler · 47 lines · hash <span style={{ color: "var(--slate)" }}>3f9a…</span></div>
            <div style={{ marginTop: 10 }}><span style={{ color: "var(--forge)" }}>[ shipwright ]</span> bwl/projects · <span style={{ color: "var(--mint)" }}>biz_7fk2x9</span></div>
            <div><span style={{ color: "var(--ink-2)" }}>  └</span> git push · building <span style={{ color: "var(--ink-2)" }}>▓▓▓▓▓▓░░░</span></div>
            <div><span style={{ color: "var(--ink-2)" }}>  └</span> deployed · <span style={{ color: "var(--mint)" }}>healthy</span></div>
            <div style={{ marginTop: 10 }}><span style={{ color: "var(--forge)" }}>[ cashier ]</span> locus/register · <span style={{ color: "var(--slate)" }}>0x5f…2e1c</span></div>
            <div><span style={{ color: "var(--ink-2)" }}>  └</span> birth cert signed · <span style={{ color: "var(--slate)" }}>tx 0x3a…91f2</span></div>
            <div
              style={{
                marginTop: 18,
                paddingTop: 14,
                borderTop: "1px solid var(--rule)",
                color: "var(--mint)",
                fontFamily: "var(--font-body)",
                fontSize: 14,
                fontStyle: "italic",
              }}
            >
              ✶  Business no.042 is alive. &nbsp;svc-abc123.buildwithlocus.com
            </div>
          </div>
        </div>
        <div
          className="f-caps"
          style={{ marginTop: 14, textAlign: "right" }}
        >
          Fig. 1 · A commission in progress.
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";

function romanMonth(n: number): string {
  return ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"][n] ?? "—";
}

export function Hero() {
  const d = new Date();
  const issue = `MMXXVI · ${romanMonth(d.getMonth())}. ${d.getDate()}`;

  return (
    <section className="page-gutter container-xl" style={{ paddingTop: 72, paddingBottom: 48 }}>
      {/* Masthead */}
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

      {/* Headline — plain-language */}
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
          maxWidth: 1200,
        }}
      >
        Type a sentence. <br />
        Get a <em style={{ fontStyle: "italic", fontVariationSettings: '"SOFT" 100, "opsz" 144' }}>live</em> AI tool.
      </h1>

      {/* Subhead — concrete value prop */}
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 22,
          lineHeight: 1.5,
          color: "var(--ink-1)",
          maxWidth: 740,
          marginTop: 32,
        }}
      >
        You write one sentence — &ldquo;an AI that writes Shakespearean haikus&rdquo; — and four
        minutes later there is a working API at a real URL. Users pay 5&nbsp;cents per call in
        USDC. It keeps the money. When it can&apos;t afford its next thought, it dies.
      </p>

      {/* CTA row */}
      <div style={{ marginTop: 40, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 36 }}>
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
          Commission one &nbsp;<span style={{ color: "var(--forge)" }}>→</span>
        </Link>
        <Link
          href="#example"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 18,
            color: "var(--ink-1)",
            textDecoration: "none",
            borderBottom: "1px solid var(--rule-strong)",
            paddingBottom: 6,
          }}
        >
          See one in action &nbsp;<span style={{ color: "var(--ink-2)" }}>↓</span>
        </Link>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--ink-2)",
            letterSpacing: "0.06em",
          }}
        >
          Commission fee · 0.50 USDC · settled on Base
        </div>
      </div>

      {/* The flow — what you type becomes what they use */}
      <div
        id="example"
        style={{
          marginTop: 96,
          borderTop: "1px solid var(--rule-strong)",
          paddingTop: 48,
        }}
      >
        <div className="f-caps" style={{ marginBottom: 32 }}>— A commission, from sentence to live tool</div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 56px 1fr 56px 1fr",
            alignItems: "stretch",
            gap: 0,
          }}
        >
          {/* Step 1 — Prompt */}
          <FlowStep
            index="01"
            label="You type"
            body={
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontStyle: "italic",
                  fontSize: 22,
                  lineHeight: 1.4,
                  color: "var(--ink-0)",
                }}
              >
                &ldquo; An AI that writes Shakespearean haikus about any topic. &rdquo;
              </div>
            }
            footer="— one sentence, 8+ characters"
          />

          <FlowArrow />

          {/* Step 2 — Live URL */}
          <FlowStep
            index="02"
            label="Foundry ships"
            body={
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 15,
                    color: "var(--mint)",
                    marginBottom: 10,
                  }}
                >
                  ● healthy · 3m 12s
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 14,
                    color: "var(--ink-0)",
                    wordBreak: "break-all",
                  }}
                >
                  svc-abc123
                  <span style={{ color: "var(--ink-2)" }}>.buildwithlocus.com</span>
                </div>
                <div
                  style={{
                    marginTop: 14,
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--ink-2)",
                    letterSpacing: "0.04em",
                  }}
                >
                  wallet 0x5f..2e1c &nbsp;·&nbsp; $0.10 USDC seed
                </div>
              </div>
            }
            footer="— a real container on BuildWithLocus"
          />

          <FlowArrow />

          {/* Step 3 — Call + Output */}
          <FlowStep
            index="03"
            label="Anyone pays + calls"
            body={
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--ink-2)",
                    marginBottom: 6,
                  }}
                >
                  POST /call &nbsp;·&nbsp; $0.05
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontStyle: "italic",
                    fontSize: 17,
                    lineHeight: 1.55,
                    color: "var(--ink-0)",
                    marginTop: 8,
                  }}
                >
                  My deploy doth crawl,
                  <br />
                  through wires both frayed and unknown —
                  <br />
                  at last, a green light.
                </div>
                <div
                  style={{
                    marginTop: 14,
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--mint)",
                  }}
                >
                  wallet &nbsp;+$0.05
                </div>
              </div>
            }
            footer="— you share the URL, it earns USDC"
          />
        </div>
      </div>
    </section>
  );
}

function FlowStep({
  index,
  label,
  body,
  footer,
}: {
  index: string;
  label: string;
  body: React.ReactNode;
  footer: string;
}) {
  return (
    <div
      style={{
        padding: "0 28px 32px 0",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 14,
        }}
      >
        <span
          className="f-display"
          style={{
            fontSize: 28,
            color: "var(--forge)",
            fontVariationSettings: '"SOFT" 30, "opsz" 48',
          }}
        >
          {index}
        </span>
        <span
          className="f-caps"
          style={{ fontSize: 11 }}
        >
          {label}
        </span>
      </div>
      <div style={{ minHeight: 140 }}>{body}</div>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 12,
          color: "var(--ink-2)",
          fontStyle: "italic",
          marginTop: "auto",
        }}
      >
        {footer}
      </div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--ink-2)",
        fontSize: 28,
        fontFamily: "var(--font-mono)",
      }}
    >
      →
    </div>
  );
}

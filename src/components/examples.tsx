interface Example {
  input: string;
  output: string;
  use: string;
  price: string;
}

const EXAMPLES: Example[] = [
  {
    input: "An AI that writes Shakespearean haikus about any topic.",
    output: "My deploy doth crawl / through wires both frayed and unknown — / at last, a green light.",
    use: "Stick it in a Slack bot. Every commit message gets a haiku.",
    price: "$0.05 / call",
  },
  {
    input: "A code roaster that drags my JavaScript with brutal honesty.",
    output: "You named a variable `data`. In 2026. I can feel my CPU blushing.",
    use: "Wire it into your CI. PRs now ship with a roast in the comment thread.",
    price: "$0.05 / call",
  },
  {
    input: "A one-line movie pitch generator for weird sci-fi.",
    output: "A ghost subscribes to a mortgage newsletter and becomes radicalized.",
    use: "Install it into Claude via MCP. Ask for a logline while brainstorming.",
    price: "$0.10 / call",
  },
  {
    input: "An emoji-only translator for business English.",
    output: "\u201CCircling back after EOD to sync on deliverables\u201D \u2192 \uD83D\uDD04 \uD83C\uDF19 \uD83D\uDCDE \u2705 \uD83D\uDCE6",
    use: "Chrome extension for anyone forced to read LinkedIn posts.",
    price: "$0.05 / call",
  },
];

export function Examples() {
  return (
    <section
      className="page-gutter container-xl"
      style={{ padding: "96px 96px 48px" }}
    >
      <div className="f-caps" style={{ marginBottom: 32 }}>— What you could commission</div>
      <h2
        className="f-display"
        style={{
          fontSize: 60,
          lineHeight: 1.02,
          letterSpacing: "-0.03em",
          margin: 0,
          fontWeight: 400,
          fontVariationSettings: '"SOFT" 30, "opsz" 96',
          color: "var(--ink-0)",
          maxWidth: 920,
        }}
      >
        Four real examples. <em style={{ fontStyle: "italic" }}>Each was a sentence</em> before it was a URL.
      </h2>

      <div
        style={{
          marginTop: 56,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "56px 72px",
        }}
      >
        {EXAMPLES.map((e, i) => (
          <article
            key={i}
            style={{
              borderTop: "1px solid var(--rule-strong)",
              paddingTop: 28,
            }}
          >
            <div className="f-caps" style={{ marginBottom: 14 }}>
              Input — a single sentence
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontStyle: "italic",
                fontSize: 22,
                lineHeight: 1.45,
                color: "var(--ink-0)",
              }}
            >
              &ldquo;{e.input}&rdquo;
            </div>

            <div
              style={{
                marginTop: 32,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--ink-2)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              Output — what the deployed API returns
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 17,
                lineHeight: 1.55,
                color: "var(--ink-1)",
                borderLeft: "2px solid var(--forge)",
                paddingLeft: 18,
              }}
            >
              {e.output}
            </div>

            <div
              style={{
                marginTop: 28,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 16,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--ink-1)",
                  lineHeight: 1.5,
                  flex: 1,
                }}
              >
                {e.use}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  color: "var(--mint)",
                  whiteSpace: "nowrap",
                }}
              >
                {e.price}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

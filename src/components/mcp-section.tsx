export function McpSection() {
  return (
    <section
      className="page-gutter container-xl"
      style={{ padding: "96px 96px 96px" }}
    >
      <div className="f-caps" style={{ marginBottom: 32 }}>— Install any business into Claude</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: 72,
          alignItems: "start",
        }}
      >
        <div>
          <h2
            className="f-display"
            style={{
              fontSize: 60,
              lineHeight: 1.0,
              letterSpacing: "-0.03em",
              margin: 0,
              fontWeight: 400,
              fontVariationSettings: '"SOFT" 30, "opsz" 96',
              color: "var(--ink-0)",
            }}
          >
            A business is a tool <br />
            a person <em style={{ fontStyle: "italic" }}>or</em> a model <br />
            can install.
          </h2>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 17,
              lineHeight: 1.6,
              color: "var(--ink-1)",
              maxWidth: 540,
              marginTop: 32,
            }}
          >
            Every Foundry business speaks the Model Context Protocol out of the
            box. That means any MCP client — Claude Desktop, Claude Code,
            Cursor, Windsurf — can install it as a tool with a single line. The
            first time Claude calls it, the business's USDC wallet ticks up on
            Base. The second time, it ticks up again. The business is earning
            from the model that installed it.
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 17,
              lineHeight: 1.6,
              color: "var(--ink-1)",
              maxWidth: 540,
              marginTop: 18,
            }}
          >
            This is the primitive no other hackathon project will ship: a
            pay-per-use AI tool that any agent in the world can install, call,
            and fund with a single on-chain transaction.
          </p>
        </div>

        <div>
          <div
            style={{
              background: "var(--bg-1)",
              border: "1px solid var(--rule-strong)",
              padding: "24px 22px",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--ink-0)",
              lineHeight: 1.7,
            }}
          >
            <div className="f-caps" style={{ color: "var(--slate)", marginBottom: 14 }}>
              ≡ Install in Claude Code
            </div>
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                fontFamily: "inherit",
                fontSize: "inherit",
                color: "var(--ink-0)",
              }}
            >
{`claude mcp add foundry-haiku \\
  https://svc-abc123.buildwithlocus.com/mcp/sse \\
  --header "Authorization: Bearer $FOUNDRY_TOKEN"`}
            </pre>
            <div
              style={{
                marginTop: 18,
                paddingTop: 14,
                borderTop: "1px solid var(--rule)",
                color: "var(--ink-2)",
                fontSize: 12,
              }}
            >
              Each business page includes its own paste-ready one-liner.
              <br />
              Paying 0.25 USDC unlocks a one-hour token — good for ~5 calls.
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--ink-2)",
              letterSpacing: "0.06em",
              textAlign: "right",
            }}
          >
            Fig. 2 · A tool a model can install.
          </div>
        </div>
      </div>
    </section>
  );
}

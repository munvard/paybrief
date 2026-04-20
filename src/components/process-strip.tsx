const STEPS = [
  { n: "01", label: "Commission", note: "You type one sentence and pay 0.50 USDC." },
  { n: "02", label: "Classify", note: "A moderator identifies the task and assembles a council." },
  { n: "03", label: "Engineer", note: "Gemini writes the handler. Code passes a static check." },
  { n: "04", label: "Deploy", note: "A BuildWithLocus project is created and pushed live." },
  { n: "05", label: "Earn", note: "The business collects USDC. If the well runs dry, it dies." },
];

export function ProcessStrip() {
  return (
    <section className="page-gutter container-xl" style={{ padding: "48px 96px 96px" }}>
      <div className="f-caps" style={{ marginBottom: 48 }}>— The process</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 0,
        }}
      >
        {STEPS.map((s, i) => (
          <div
            key={s.n}
            style={{
              padding: "32px 24px 32px 0",
              borderTop: "1px solid var(--rule-strong)",
              borderRight: i < STEPS.length - 1 ? "1px solid var(--rule)" : "0",
              paddingRight: 28,
            }}
          >
            <div
              className="f-display"
              style={{
                fontSize: 44,
                color: "var(--forge)",
                letterSpacing: "-0.02em",
                lineHeight: 1,
                fontVariationSettings: '"SOFT" 30, "opsz" 72',
              }}
            >
              {s.n}
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 20,
                color: "var(--ink-0)",
                marginTop: 18,
                fontWeight: 500,
                letterSpacing: "-0.01em",
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                color: "var(--ink-2)",
                marginTop: 8,
                lineHeight: 1.5,
                paddingRight: 12,
              }}
            >
              {s.note}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

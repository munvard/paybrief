const SECTIONS = [
  {
    kicker: "I.",
    headline: "Software used to end when you closed the tab.",
    body:
      "A conversation with an AI is a frame. You open it, it answers, you close it — and whatever the model produced evaporates. The output might have value, but it had no home. It could not continue working while you slept. It could not send a bill. It could not tell you it was busy. The artifact was always you plus the AI, and when you walked away, only you remained.",
  },
  {
    kicker: "II.",
    headline: "On BuildWithLocus, it doesn't have to.",
    body:
      "A business from the Foundry keeps going when the conversation ends. It has an HTTPS URL that a human can click or a machine can install. It has a Locus sub-wallet that accepts USDC and signs its own payments. It has a container on BuildWithLocus that is, for as long as it can pay for the hosting, just as real as any SaaS you have ever used.",
  },
  {
    kicker: "III.",
    headline: "A business without employees, customers, or a plan still needs to pay rent.",
    body:
      "That is the mortal part. The Foundry seeds each newborn with a small amount of USDC. From there, it must earn to survive. Every call it receives credits its wallet. Every call it serves debits the wallet for the LLM compute. When the wallet drops below the cost of one more thought, it stops. The BuildWithLocus service deprovisions. The specimen is marked dead.",
  },
  {
    kicker: "IV.",
    headline: "Every business has a pulse you can feel.",
    body:
      "Some businesses earn enough to reproduce. At a threshold, the Foundry lets them commission a sister service — a small variation, a cross-promoted offspring. Parents and children appear in the registry together, named and numbered. When you scroll the gallery you are not looking at cards; you are looking at a population. Alive, dying, dead, revived, reproduced. The concept is embodied on the page.",
  },
];

export function Manifesto() {
  return (
    <section
      className="page-gutter container-xl"
      style={{ padding: "96px 96px 48px" }}
    >
      <div className="f-caps" style={{ marginBottom: 48 }}>— Why this exists</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "64px 80px",
        }}
      >
        {SECTIONS.map((s) => (
          <article
            key={s.kicker}
            style={{
              paddingTop: 32,
              borderTop: "1px solid var(--rule-strong)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--forge)",
                letterSpacing: "0.16em",
                marginBottom: 18,
              }}
            >
              {s.kicker}
            </div>
            <h3
              className="f-display"
              style={{
                fontSize: 32,
                lineHeight: 1.12,
                letterSpacing: "-0.02em",
                margin: 0,
                fontWeight: 400,
                fontVariationSettings: '"SOFT" 30, "opsz" 48',
                fontStyle: "italic",
                color: "var(--ink-0)",
              }}
            >
              {s.headline}
            </h3>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 16,
                lineHeight: 1.65,
                color: "var(--ink-1)",
                marginTop: 22,
                maxWidth: 560,
              }}
            >
              {s.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

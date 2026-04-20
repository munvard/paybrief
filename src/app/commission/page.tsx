import { CommissionForm } from "@/components/commission-form";

export default function Page() {
  return (
    <main
      className="page-gutter container-xl"
      style={{ padding: "96px 96px 96px", minHeight: "60vh" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: 72,
          alignItems: "start",
        }}
      >
        <div>
          <div className="f-caps" style={{ marginBottom: 24 }}>— Commission a new specimen</div>
          <h1
            className="f-display"
            style={{
              fontSize: 82,
              lineHeight: 0.96,
              margin: 0,
              letterSpacing: "-0.03em",
              fontWeight: 400,
              fontVariationSettings: '"SOFT" 30, "opsz" 96',
              color: "var(--ink-0)",
            }}
          >
            One sentence. <br />
            A living business.
          </h1>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 18,
              lineHeight: 1.6,
              color: "var(--ink-1)",
              marginTop: 32,
              maxWidth: 540,
            }}
          >
            Describe an AI tool in plain language. A council of specialists will
            research, engineer, deploy, and seed the wallet. Approximately four
            minutes later, you will have a live URL and a business that must now
            earn to survive.
          </p>
          <div
            style={{
              marginTop: 48,
              borderTop: "1px solid var(--rule-strong)",
              paddingTop: 32,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              rowGap: 18,
              columnGap: 32,
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--ink-1)",
              maxWidth: 460,
            }}
          >
            <div style={{ color: "var(--ink-2)" }}>Fee</div>
            <div>0.50 USDC</div>
            <div style={{ color: "var(--ink-2)" }}>Settled on</div>
            <div>Base · Locus Checkout</div>
            <div style={{ color: "var(--ink-2)" }}>Time to live URL</div>
            <div>~4 minutes</div>
            <div style={{ color: "var(--ink-2)" }}>Seed capital</div>
            <div>0.10 USDC from the Foundry</div>
          </div>
        </div>

        <CommissionForm />
      </div>
    </main>
  );
}

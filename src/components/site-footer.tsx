export function SiteFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--rule)",
        padding: "28px 0 36px",
        background: "var(--bg-0)",
        marginTop: 96,
      }}
    >
      <div
        className="page-gutter container-xl"
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 24,
          fontFamily: "var(--font-body)",
          fontSize: 13,
          color: "var(--ink-2)",
        }}
      >
        <div className="f-caps">THE FOUNDRY &nbsp;·&nbsp; MMXXVI &nbsp;·&nbsp; agent-zero-foundry on BuildWithLocus</div>
        <div style={{ display: "flex", gap: 24, fontFamily: "var(--font-mono)", fontSize: 12 }}>
          <a href="/">Gallery</a>
          <a href="/commission">Commission</a>
          <a href="/dynasty">Dynasty</a>
          <a href="https://github.com/munvard/paybrief" target="_blank" rel="noreferrer">Source</a>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5dc", padding: "2rem", fontFamily: "system-ui" }}>
      <h1 style={{ color: "#ff6b35", fontSize: "3rem", marginBottom: "0.5rem" }}>THE FOUNDRY</h1>
      <p style={{ fontSize: "1.25rem", opacity: 0.8 }}>AI that gives birth to AI</p>
      <p style={{ opacity: 0.6, marginTop: "2rem" }}>
        Gallery + commission flow live after Phase 4. Health: <a style={{ color: "#00ff88" }} href="/api/health">/api/health</a>
      </p>
    </main>
  );
}

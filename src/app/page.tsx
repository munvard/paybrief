import Link from "next/link";
import { Gallery } from "@/components/gallery";

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", background: "#0a0a0a", color: "#f5f5dc", padding: "2rem", fontFamily: "ui-sans-serif, system-ui" }}>
      <section style={{ textAlign: "center", padding: "4rem 0", borderBottom: "1px solid #222" }}>
        <h1 style={{ fontSize: "3.5rem", fontWeight: 700, color: "#ff6b35", margin: 0, letterSpacing: "-0.02em" }}>
          THE FOUNDRY
        </h1>
        <p style={{ fontSize: "1.5rem", opacity: 0.85, marginTop: 8 }}>AI that gives birth to AI</p>
        <p style={{ opacity: 0.6, maxWidth: 600, margin: "1.5rem auto 0" }}>
          Describe an AI tool. 3 minutes later it&apos;s live, monetized, and breathing USDC on Base.
        </p>
        <Link
          href="/commission"
          style={{
            display: "inline-block",
            marginTop: "2rem",
            background: "#ff6b35",
            color: "#000",
            padding: "1rem 2rem",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          Commission a new business — $0.50 USDC
        </Link>
      </section>
      <section style={{ marginTop: "3rem" }}>
        <h2 style={{ fontSize: "2rem", fontWeight: 600, marginBottom: "1.5rem" }}>The Gallery</h2>
        <Gallery />
      </section>
    </main>
  );
}

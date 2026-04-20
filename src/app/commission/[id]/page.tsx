import { CouncilTerminal } from "@/components/council-terminal";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#f5f5dc",
        padding: "2rem",
        fontFamily: "ui-sans-serif, system-ui",
      }}
    >
      <h1 style={{ fontSize: "1.75rem", color: "#ff6b35", marginBottom: "1rem" }}>
        Commissioning {id}
      </h1>
      <CouncilTerminal commissionId={id} />
    </main>
  );
}

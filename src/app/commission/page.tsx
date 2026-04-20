import { CommissionForm } from "@/components/commission-form";

export default function Page() {
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
      <h1 style={{ fontSize: "2.5rem", color: "#ff6b35", marginBottom: "2rem" }}>
        Commission a new business
      </h1>
      <CommissionForm />
    </main>
  );
}

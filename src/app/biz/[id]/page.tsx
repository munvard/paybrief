import { SpecimenCard } from "@/components/specimen-card";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        padding: "2rem",
        fontFamily: "ui-sans-serif, system-ui",
      }}
    >
      <SpecimenCard businessId={id} />
    </main>
  );
}

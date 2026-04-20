export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    status: "ok",
    service: "foundry-web",
    time: new Date().toISOString(),
  });
}

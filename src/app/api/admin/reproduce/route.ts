import { NextRequest } from "next/server";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { startCommission } from "@/lib/agent/council";
import { geminiChat } from "@/lib/locus/wrapped";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (req.headers.get("x-admin-secret") !== process.env.ADMIN_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  const body = await req.json();
  const parentId = String(body.parentId);
  const db = getDb();
  const [parent] = await db.select().from(schema.businesses).where(eq(schema.businesses.id, parentId));
  if (!parent) return new Response("not found", { status: 404 });

  const resp = await geminiChat(
    "You propose a sister-business that cross-promotes an existing AI micro-service. Reply with ONE sentence describing the new business. No preamble, no quotes.",
    `Parent genome: ${parent.genome}\nParent name: ${parent.name}`,
    "reproduction",
    { maxTokens: 120 }
  );
  const childPrompt = (
    ((resp as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]
      ?.content?.parts?.[0]?.text ?? (resp as { text?: string })?.text ?? "") as string
  ).trim();
  if (!childPrompt) return Response.json({ error: "no child prompt" }, { status: 500 });

  const commissionId = await startCommission({
    prompt: childPrompt,
    commissionerType: "business",
    commissionerId: parentId,
    feePaidUsdc: 3,
  });
  return Response.json({ ok: true, commissionId, childPrompt });
}

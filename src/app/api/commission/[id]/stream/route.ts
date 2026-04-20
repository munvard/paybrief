import { NextRequest } from "next/server";
import { getSub } from "@/lib/redis";
import { getDb, schema } from "@/lib/db";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      function send(data: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      const db = getDb();
      try {
        const rows = await db
          .select()
          .from(schema.decisions)
          .where(eq(schema.decisions.commissionId, id))
          .orderBy(asc(schema.decisions.createdAt));
        for (const r of rows) send({ type: "decision-replay", ...r });
      } catch (e) {
        send({ type: "error", message: (e as Error).message });
      }

      const sub = getSub().duplicate();
      await sub.subscribe(`events:commission:${id}`);
      sub.on("message", (_ch: string, msg: string) => {
        try {
          send(JSON.parse(msg));
        } catch {
          /* ignore */
        }
      });

      const keepAlive = setInterval(
        () => controller.enqueue(encoder.encode(": keepalive\n\n")),
        20000
      );
      setTimeout(
        () => {
          clearInterval(keepAlive);
          sub.disconnect();
          try { controller.close(); } catch { /* already closed */ }
        },
        10 * 60 * 1000
      );
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}

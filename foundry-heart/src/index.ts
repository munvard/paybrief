import http from "node:http";
import pg from "pg";
import { runDeathClock } from "./death-clock.js";
import { checkReproduction } from "./reproduce.js";

const { Pool } = pg;

const PORT = Number(process.env.PORT ?? 8080);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "foundry-heart" }));
    return;
  }
  res.writeHead(404);
  res.end();
});
server.listen(PORT, () => console.log(`[heart] listening on :${PORT}`));

async function deprovision(bizId: string, serviceId: string | null) {
  if (!serviceId) return;
  const webUrl = process.env.FOUNDRY_WEB_URL;
  if (!webUrl) return;
  try {
    await fetch(`${webUrl}/api/admin/deprovision`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": process.env.ADMIN_SECRET ?? "",
      },
      body: JSON.stringify({ businessId: bizId, serviceId }),
    });
    console.log(`[heart] deprovision requested for ${bizId}`);
  } catch (e) {
    console.warn(`[heart] deprovision failed: ${(e as Error).message}`);
  }
}

async function reproduce(parentId: string) {
  const webUrl = process.env.FOUNDRY_WEB_URL;
  if (!webUrl) return;
  try {
    await fetch(`${webUrl}/api/admin/reproduce`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Secret": process.env.ADMIN_SECRET ?? "",
      },
      body: JSON.stringify({ parentId }),
    });
    console.log(`[heart] reproduction kicked off for ${parentId}`);
  } catch (e) {
    console.warn(`[heart] reproduce failed: ${(e as Error).message}`);
  }
}

async function tick() {
  try {
    await runDeathClock(pool, deprovision);
    await checkReproduction(pool, reproduce);
    console.log(`[heart] tick ${new Date().toISOString()}`);
  } catch (e) {
    console.error(`[heart] tick err: ${(e as Error).message}`);
  }
}

tick();
setInterval(tick, 15 * 60 * 1000);

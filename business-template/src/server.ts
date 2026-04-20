import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { issueCreditsToken, verifyAndDebit } from "./credits.js";
import { runHandler } from "./sandbox.js";
import { makeHeartbeat } from "./heartbeat.js";
import { mcpDiscoveryManifest, handleMcpSse, handleMcpPost } from "./mcp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 8080);
const BUSINESS_ID = process.env.BUSINESS_ID ?? "biz_unknown";
const BUSINESS_NAME = process.env.BUSINESS_NAME ?? "Unnamed Business";
const BUSINESS_PITCH = process.env.BUSINESS_PITCH ?? "A Foundry-born AI tool.";
const DEFAULT_PRICE = Number(process.env.PRICE_PER_CALL_USDC ?? 0.05);
const LLM_EST = Number(process.env.LLM_COST_ESTIMATE_USDC ?? 0.02);
const LOCUS_API_KEY = process.env.LOCUS_API_KEY ?? "";
const LOCUS_API_BASE = process.env.LOCUS_API_BASE_URL ?? "https://beta-api.paywithlocus.com/api";
const WALLET_ADDRESS = process.env.BUSINESS_WALLET_ADDRESS ?? "unknown";

const handlerSource: string = (() => {
  const b64 = process.env.HANDLER_SOURCE_B64;
  if (!b64) {
    return `async function handle(input, ctx) { return { echo: typeof input === "string" ? input : JSON.stringify(input) }; }`;
  }
  return Buffer.from(b64, "base64").toString("utf8");
})();

const state = { callCount: 0, lastCallAt: null as string | null };

const landingTemplate = fs.readFileSync(path.join(__dirname, "landing.template.html"), "utf8");

function landingHtml(selfUrl: string) {
  return landingTemplate
    .replaceAll("{{NAME}}", BUSINESS_NAME)
    .replaceAll("{{PITCH}}", BUSINESS_PITCH)
    .replaceAll("{{WALLET_ADDRESS}}", WALLET_ADDRESS)
    .replaceAll("{{SLUG}}", BUSINESS_ID.replace(/^biz_/, ""))
    .replaceAll("{{BASE_URL}}", selfUrl);
}

async function checkWalletBalance(): Promise<number> {
  try {
    const r = await fetch(`${LOCUS_API_BASE}/pay/balance`, { headers: { Authorization: `Bearer ${LOCUS_API_KEY}` } });
    const j = await r.json();
    return Number(j?.data?.usdc_balance ?? 0);
  } catch { return 0; }
}

async function scopedLlm(prompt: string, opts?: { model?: string; maxTokens?: number }): Promise<string> {
  const maxTokens = Math.min(opts?.maxTokens ?? 1024, 4096);
  const r = await fetch(`${LOCUS_API_BASE}/wrapped/gemini/chat`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${LOCUS_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts?.model ?? "gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      maxOutputTokens: maxTokens,
      temperature: 0.7,
    }),
  });
  const j = await r.json();
  const text = j?.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? j?.data?.text ?? j?.data?.content ?? "";
  return String(text);
}

function ctxLog(m: string) { console.log(`[handler] ${m}`); }

async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
}

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

async function createCheckoutSession(amountUsdc: number, selfUrl: string) {
  const r = await fetch(`${LOCUS_API_BASE}/checkout/sessions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${LOCUS_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount_usdc: amountUsdc,
      description: `${BUSINESS_NAME} — ${amountUsdc} USDC credits`,
      success_url: `${selfUrl}/#paid`,
      cancel_url: `${selfUrl}/#cancel`,
      metadata: { businessId: BUSINESS_ID, kind: "credits_deposit" },
    }),
  });
  return r.json();
}

async function getCheckoutStatus(sessionId: string) {
  const r = await fetch(`${LOCUS_API_BASE}/checkout/sessions/${sessionId}`, {
    headers: { "Authorization": `Bearer ${LOCUS_API_KEY}` },
  });
  return r.json();
}

const mcpHandlers = {
  toolName: "call",
  toolDescription: BUSINESS_PITCH,
  inputSchema: { type: "object", properties: { input: { type: "string" } }, required: ["input"] },
  async onCall(input: unknown, bearer: string) {
    const creditCheck = await verifyAndDebit(bearer, DEFAULT_PRICE);
    if (!creditCheck.ok) throw new Error("payment required: " + creditCheck.reason);
    const result = await runHandler(handlerSource, input, { llm: scopedLlm, fetch: globalThis.fetch, log: ctxLog });
    state.callCount++; state.lastCallAt = new Date().toISOString();
    if (!result.ok) throw new Error(result.error);
    return result.output;
  },
};

const server = http.createServer(async (req, res) => {
  const host = req.headers.host ?? "localhost";
  const protocol = (req.headers["x-forwarded-proto"] as string) ?? "https";
  const selfUrl = `${protocol}://${host}`;

  try {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "ok" }));
    }
    if (req.url === "/" || req.url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(landingHtml(selfUrl));
    }
    if (req.url === "/meta") {
      const bal = await checkWalletBalance();
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        businessId: BUSINESS_ID, name: BUSINESS_NAME, pitch: BUSINESS_PITCH,
        walletAddress: WALLET_ADDRESS, walletBalance: bal.toFixed(4),
        callCount: state.callCount, lastCallAt: state.lastCallAt,
        pricePerCallUsdc: DEFAULT_PRICE,
      }));
    }
    if (req.url === "/.well-known/mcp") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(mcpDiscoveryManifest(mcpHandlers, selfUrl)));
    }
    if (req.url === "/mcp/sse") return handleMcpSse(req, res, mcpHandlers, selfUrl);
    if (req.url === "/mcp" && req.method === "POST") {
      const auth = req.headers.authorization;
      if (!auth?.startsWith("Bearer ")) { res.writeHead(401); return res.end("missing bearer"); }
      const body = JSON.parse(await readBody(req));
      const reply = await handleMcpPost(body, auth.slice(7), mcpHandlers);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(reply));
    }
    if (req.url === "/call/deposit" && req.method === "POST") {
      const body = JSON.parse(await readBody(req));
      const amount = Number(body.amountUsdc ?? 0.25);
      const session = await createCheckoutSession(amount, selfUrl);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        sessionId: session?.data?.id ?? session?.id,
        checkoutUrl: session?.data?.hosted_url ?? session?.hosted_url,
        amountUsdc: amount,
      }));
    }
    if (req.url?.startsWith("/call/deposit/status") && req.method === "GET") {
      const sessionId = new URL(req.url, selfUrl).searchParams.get("sessionId");
      if (!sessionId) { res.writeHead(400); return res.end("missing sessionId"); }
      const s = await getCheckoutStatus(sessionId);
      const status = s?.data?.status ?? s?.status ?? "PENDING";
      if (status === "CONFIRMED" || status === "confirmed" || status === "PAID") {
        const amountUsdc = Number(s?.data?.amount_usdc ?? s?.amount_usdc ?? 0.25);
        const token = await issueCreditsToken(amountUsdc);
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ state: "confirmed", amountUsdc, token }));
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ state: "pending" }));
    }
    if (req.url === "/call/deposit/finalize" && req.method === "POST") {
      const body = JSON.parse(await readBody(req));
      const token = body.token;
      if (!token) { res.writeHead(400); return res.end("missing token"); }
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Set-Cookie": `fc=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600`,
      });
      return res.end(JSON.stringify({ ok: true }));
    }
    if (req.url === "/call" && req.method === "POST") {
      const cookieToken = parseCookie(req.headers.cookie as string | undefined, "fc");
      const authHeader = req.headers.authorization;
      const token = cookieToken ?? (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null);
      if (!token) { res.writeHead(402); return res.end(JSON.stringify({ error: "payment required" })); }
      const price = (req.headers["x-tier"] === "premium") ? 0.10 : DEFAULT_PRICE;
      const walletBal = await checkWalletBalance();
      if (walletBal < LLM_EST) { res.writeHead(402); return res.end(JSON.stringify({ error: `This business is out of funds. Tip its wallet at ${WALLET_ADDRESS} to revive.` })); }
      const debit = await verifyAndDebit(token, price);
      if (!debit.ok) { res.writeHead(402); return res.end(JSON.stringify({ error: debit.reason })); }
      const body = JSON.parse(await readBody(req));
      const result = await runHandler(handlerSource, body.input, { llm: scopedLlm, fetch: globalThis.fetch, log: ctxLog });
      state.callCount++; state.lastCallAt = new Date().toISOString();
      if (!result.ok) { res.writeHead(500); return res.end(JSON.stringify({ ok: false, error: result.error })); }
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, output: result.output, creditsRemaining: debit.remaining, durationMs: result.durationMs }));
    }
    res.writeHead(404); res.end("not found");
  } catch (e) {
    console.error(e);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (e as Error).message }));
  }
});

server.listen(PORT, () => {
  console.log(`[${BUSINESS_ID}] listening on :${PORT}`);
  const hb = makeHeartbeat(state);
  hb.send().catch(() => {});
  hb.start();
});

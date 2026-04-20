import type { IncomingMessage, ServerResponse } from "node:http";

const ALLOWED_ORIGINS = new Set<string>([
  "https://claude.ai",
  "https://app.claude.ai",
  "https://claude.com",
  "vscode-webview://",
]);

function isAllowedOrigin(origin: string | undefined, selfUrl: string): boolean {
  if (!origin) return true;
  if (selfUrl && origin === new URL(selfUrl).origin) return true;
  for (const a of ALLOWED_ORIGINS) if (origin.startsWith(a)) return true;
  return false;
}

export interface McpHandlers {
  toolName: string;
  toolDescription: string;
  inputSchema: unknown;
  onCall: (input: unknown, bearer: string) => Promise<unknown>;
}

export function mcpDiscoveryManifest(h: McpHandlers, selfUrl: string) {
  return {
    protocolVersion: "2024-11-05",
    serverInfo: { name: process.env.BUSINESS_ID, version: "1.0" },
    capabilities: { tools: {} },
    tools: [{ name: h.toolName, description: h.toolDescription, inputSchema: h.inputSchema }],
    endpoints: { sse: `${selfUrl}/mcp/sse`, http: `${selfUrl}/mcp` },
    auth: { type: "bearer" },
  };
}

export async function handleMcpSse(req: IncomingMessage, res: ServerResponse, _h: McpHandlers, selfUrl: string) {
  const origin = req.headers.origin as string | undefined;
  if (!isAllowedOrigin(origin, selfUrl)) { res.writeHead(403); res.end("bad origin"); return; }
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { res.writeHead(401); res.end("missing bearer"); return; }
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
  res.write(`event: endpoint\ndata: ${selfUrl}/mcp\n\n`);
  const interval = setInterval(() => res.write(`: ping\n\n`), 15000);
  req.on("close", () => clearInterval(interval));
}

export async function handleMcpPost(body: unknown, _bearer: string, h: McpHandlers) {
  const msg = body as { id: number | string; method: string; params?: { name?: string; arguments?: unknown } };
  if (msg.method === "initialize") {
    return { jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: process.env.BUSINESS_ID, version: "1.0" } } };
  }
  if (msg.method === "tools/list") {
    return { jsonrpc: "2.0", id: msg.id, result: { tools: [{ name: h.toolName, description: h.toolDescription, inputSchema: h.inputSchema }] } };
  }
  if (msg.method === "tools/call") {
    const name = msg.params?.name;
    const args = msg.params?.arguments;
    if (name !== h.toolName) return { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "unknown tool" } };
    try {
      const out = await h.onCall(args, _bearer);
      return { jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: typeof out === "string" ? out : JSON.stringify(out) }] } };
    } catch (e) {
      return { jsonrpc: "2.0", id: msg.id, error: { code: -32000, message: (e as Error).message } };
    }
  }
  return { jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `unknown method ${msg.method}` } };
}

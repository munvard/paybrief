import vm from "node:vm";

export interface HandlerContext {
  llm(prompt: string, opts?: { model?: string; maxTokens?: number }): Promise<string>;
  fetch: typeof globalThis.fetch;
  log(msg: string): void;
}

export interface RunResult {
  ok: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
}

const FORBIDDEN_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? new URL(input) : input instanceof URL ? input : new URL((input as Request).url);
  if (
    FORBIDDEN_HOSTS.has(url.hostname) ||
    url.hostname.endsWith(".locus.local") ||
    /^10\./.test(url.hostname) ||
    /^192\.168\./.test(url.hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(url.hostname)
  ) {
    return Promise.reject(new Error("forbidden host"));
  }
  return fetch(input, init);
}

export async function runHandler(
  handlerSource: string,
  input: unknown,
  ctx: HandlerContext,
  timeoutMs = 25000
): Promise<RunResult> {
  const start = Date.now();
  const context = vm.createContext({
    console: { log: (m: unknown) => ctx.log(String(m)) },
    fetch: safeFetch,
    __ctx: { llm: ctx.llm, fetch: safeFetch, log: ctx.log },
    __input: input,
  });
  const wrapped = `
    (async () => {
      ${handlerSource}
      if (typeof handle !== "function") throw new Error("handler must define handle()");
      return await handle(__input, __ctx);
    })()
  `;
  try {
    const script = new vm.Script(wrapped);
    const promise: Promise<unknown> = script.runInContext(context, { timeout: timeoutMs });
    const output = await promise;
    return { ok: true, output, durationMs: Date.now() - start };
  } catch (e) {
    return { ok: false, error: (e as Error).message, durationMs: Date.now() - start };
  }
}

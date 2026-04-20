const BWL_BASE = process.env.BWL_API_BASE_URL ?? "https://beta-api.buildwithlocus.com/v1";

let _token: string | null = null;
let _tokenExpiresAt = 0;

export async function bwlToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiresAt) return _token;
  const r = await fetch(`${BWL_BASE}/auth/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey: process.env.LOCUS_API_KEY }),
  });
  const j = await r.json();
  if (!j.token) throw new Error("bwl auth failed: " + JSON.stringify(j));
  _token = j.token as string;
  _tokenExpiresAt = Date.now() + 25 * 24 * 3600 * 1000;
  return _token;
}

export async function bwl<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  const token = await bwlToken();
  const r = await fetch(`${BWL_BASE}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await r.text();
  const j = text ? JSON.parse(text) : {};
  if (!r.ok) throw new Error(`bwl ${init.method ?? "GET"} ${path}: ${r.status} ${text}`);
  return j as T;
}

export function bwlWorkspaceId(): string {
  return process.env.BWL_WORKSPACE_ID ?? "ws_8733dd2e";
}

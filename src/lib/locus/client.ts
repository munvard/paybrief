const LOCUS_API_BASE =
  process.env.LOCUS_API_BASE_URL || "https://beta-api.paywithlocus.com/api";
const LOCUS_API_KEY = process.env.LOCUS_API_KEY || "";

export async function locusRequest<T = unknown>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
  } = {}
): Promise<T> {
  const { method = "GET", body } = options;

  const res = await fetch(`${LOCUS_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${LOCUS_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();

  if (!res.ok || json.success === false) {
    throw new Error(
      json.message || json.error || `Locus API error: ${res.status}`
    );
  }

  return json.data ?? json;
}

export async function getBalance(): Promise<{
  wallet_address: string;
  usdc_balance: string;
}> {
  return locusRequest("/pay/balance");
}

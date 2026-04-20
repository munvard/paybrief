import Redis from "ioredis";

let _pub: Redis | null = null;
let _sub: Redis | null = null;

export function getPub(): Redis {
  if (_pub) return _pub;
  _pub = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });
  return _pub;
}

export function getSub(): Redis {
  if (_sub) return _sub;
  _sub = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });
  return _sub;
}

export async function publishEvent(channel: string, payload: unknown) {
  try {
    await getPub().publish(channel, JSON.stringify(payload));
  } catch (e) {
    console.warn(`[redis] publish failed on ${channel}: ${(e as Error).message}`);
  }
}

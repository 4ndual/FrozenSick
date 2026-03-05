/**
 * Cache adapter: uses Vercel KV (Redis) when available, falls back to in-memory.
 * Vercel KV requires KV_REST_API_URL and KV_REST_API_TOKEN env vars.
 */

interface KvClient {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, opts: { ex: number }): Promise<unknown>;
  del(...keys: unknown[]): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
  ping(): Promise<unknown>;
}

let kv: KvClient | null = null;
let kvChecked = false;

const KEY_PREFIX = 'ghcache:';

async function getKv(): Promise<KvClient | null> {
  if (kvChecked) return kv;
  kvChecked = true;
  try {
    const mod = await import('@vercel/kv');
    if (mod.kv) {
      const client = mod.kv as unknown as KvClient;
      await client.ping();
      kv = client;
    }
  } catch {
    kv = null;
  }
  return kv;
}

// ── In-memory fallback ───────────────────────────────────────────────────────

interface MemEntry {
  data: unknown;
  expiresAt: number;
}

const memCache = new Map<string, MemEntry>();

// ── Public API ───────────────────────────────────────────────────────────────

export async function getCached<T>(key: string): Promise<T | null> {
  const redis = await getKv();
  if (redis) {
    const val = await redis.get(`${KEY_PREFIX}${key}`);
    return val as T | null;
  }

  const entry = memCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return entry.data as T;
}

export async function setCache<T>(key: string, data: T, ttlMs: number): Promise<void> {
  const redis = await getKv();
  if (redis) {
    const ttlSec = Math.max(1, Math.round(ttlMs / 1000));
    await redis.set(`${KEY_PREFIX}${key}`, data, { ex: ttlSec });
    return;
  }

  memCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export async function invalidateCache(branch?: string): Promise<void> {
  const redis = await getKv();
  if (redis) {
    if (!branch) {
      const keys = await redis.keys(`${KEY_PREFIX}*`);
      if (keys.length > 0) await redis.del(...keys);
    } else {
      const keys = await redis.keys(`${KEY_PREFIX}*@${branch}*`);
      const branchKeys = await redis.keys(`${KEY_PREFIX}branches`);
      const allKeys = [...keys, ...branchKeys];
      if (allKeys.length > 0) await redis.del(...allKeys);
    }
    return;
  }

  if (!branch) {
    memCache.clear();
    return;
  }
  for (const key of memCache.keys()) {
    if (key.includes(`@${branch}`) || key === 'branches') {
      memCache.delete(key);
    }
  }
}

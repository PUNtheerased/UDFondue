type Bucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, Bucket>();

export type RateLimitOk = {
  ok: true;
  remaining: number;
  backend: "memory" | "redis";
};

export type RateLimitDenied = {
  ok: false;
  retryAfterMs: number;
  backend: "memory" | "redis" | "redis-down";
  reason: "limit" | "unavailable";
};

export type RateLimitResult = RateLimitOk | RateLimitDenied;

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  pruneMemoryBuckets();
  const now = Date.now();
  const current = memoryBuckets.get(key);
  if (!current || current.resetAt < now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, backend: "memory" };
  }
  if (current.count >= limit) {
    return {
      ok: false,
      retryAfterMs: current.resetAt - now,
      backend: "memory",
      reason: "limit"
    };
  }
  current.count += 1;
  return { ok: true, remaining: limit - current.count, backend: "memory" };
}

function pruneMemoryBuckets() {
  if (memoryBuckets.size < 2000) return;
  const now = Date.now();
  const stale: string[] = [];
  memoryBuckets.forEach((bucket, key) => {
    if (bucket.resetAt < now) stale.push(key);
  });
  stale.forEach((key) => memoryBuckets.delete(key));
}

function upstashConfigured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstashCommand(command: (string | number)[]) {
  const base = String(process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || "");
  const res = await fetch(`${base}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command),
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
  const data = (await res.json()) as { result?: number | string | null };
  return data.result;
}

function unavailable(): RateLimitDenied {
  return { ok: false, retryAfterMs: 30_000, backend: "redis-down", reason: "unavailable" };
}

async function redisRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const count = Number(await upstashCommand(["INCR", redisKey]));
  if (!count || Number.isNaN(count)) throw new Error("Upstash INCR failed");
  try {
    const set = await upstashCommand(["EXPIRE", redisKey, windowSec, "NX"]);
    if (set === 0 || set === null) {
      const ttl = Number(await upstashCommand(["TTL", redisKey]));
      if (ttl < 0) await upstashCommand(["EXPIRE", redisKey, windowSec]);
    }
  } catch {
    await upstashCommand(["EXPIRE", redisKey, windowSec]);
  }
  if (count > limit) {
    return { ok: false, retryAfterMs: windowMs, backend: "redis", reason: "limit" };
  }
  return { ok: true, remaining: Math.max(0, limit - count), backend: "redis" };
}

/**
 * Shared rate limit. When Upstash is configured, a Redis outage fails closed
 * so a backend blip cannot disable the limit.
 */
export async function rateLimit(key: string, limit = 5, windowMs = 10 * 60 * 1000): Promise<RateLimitResult> {
  if (upstashConfigured()) {
    try {
      return await redisRateLimit(key, limit, windowMs);
    } catch (err) {
      console.error("redis rateLimit fail closed", err);
      return unavailable();
    }
  }
  return memoryRateLimit(key, limit, windowMs);
}

/** Read the current count without incrementing. Redis errors fail closed. */
export async function isRateLimited(key: string, limit: number) {
  if (upstashConfigured()) {
    try {
      const count = Number(await upstashCommand(["GET", `rl:${key}`])) || 0;
      return count >= limit;
    } catch (err) {
      console.error("redis rateLimit peek fail closed", err);
      return true;
    }
  }
  const current = memoryBuckets.get(key);
  if (!current || current.resetAt < Date.now()) return false;
  return current.count >= limit;
}

export function rateLimitMessage(result: RateLimitDenied, normal: string) {
  if (result.reason === "unavailable") {
    return "ระบบป้องกันสแปมชั่วคราวไม่พร้อม ลองใหม่อีกสักครู่";
  }
  return normal;
}

export function rateLimitStatus(result: RateLimitDenied) {
  return result.reason === "unavailable" ? 503 : 429;
}

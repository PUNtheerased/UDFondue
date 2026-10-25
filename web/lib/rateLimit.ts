type Bucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, Bucket>();

function memoryRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = memoryBuckets.get(key);
  if (!current || current.resetAt < now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const, remaining: limit - 1, backend: "memory" as const };
  }
  if (current.count >= limit) {
    return {
      ok: false as const,
      retryAfterMs: current.resetAt - now,
      backend: "memory" as const
    };
  }
  current.count += 1;
  return { ok: true as const, remaining: limit - current.count, backend: "memory" as const };
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

async function redisRateLimit(key: string, limit: number, windowMs: number) {
  const redisKey = `rl:${key}`;
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const count = Number(await upstashCommand(["INCR", redisKey]));
  if (!count || Number.isNaN(count)) throw new Error("Upstash INCR failed");
  if (count === 1) {
    await upstashCommand(["EXPIRE", redisKey, windowSec]);
  }
  if (count > limit) {
    return { ok: false as const, retryAfterMs: windowMs, backend: "redis" as const };
  }
  return { ok: true as const, remaining: Math.max(0, limit - count), backend: "redis" as const };
}

/**
 * Rate limit กลางด้วย Upstash Redis ถ้ามี env
 * ไม่มี Redis → ใช้หน่วยความจำ (soft limit ต่อ instance)
 */
export async function rateLimit(key: string, limit = 5, windowMs = 10 * 60 * 1000) {
  if (upstashConfigured()) {
    try {
      return await redisRateLimit(key, limit, windowMs);
    } catch (err) {
      console.error("redis rateLimit fallback to memory", err);
    }
  }
  return memoryRateLimit(key, limit, windowMs);
}

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit = 5, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true as const, remaining: limit - 1 };
  }
  if (current.count >= limit) {
    return { ok: false as const, retryAfterMs: current.resetAt - now };
  }
  current.count += 1;
  return { ok: true as const, remaining: limit - current.count };
}

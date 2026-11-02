/** True when running the production Next.js build (Vercel production / `next start`). */
export function isProdRuntime() {
  return process.env.NODE_ENV === "production";
}

/** Browser on localhost — skip LIFF so login ไม่พาไป endpoint บน Vercel */
export function isBrowserLocalhost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

/**
 * Accept `dev:` LINE tokens only in local `next dev`.
 * Never on Vercel, never when NODE_ENV is production.
 * Set ALLOW_DEV_LINE_AUTH=0 to force it off even locally.
 */
export function allowDevLineAuth() {
  if (process.env.ALLOW_DEV_LINE_AUTH === "0") return false;
  if (process.env.VERCEL || process.env.VERCEL_ENV) return false;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

/**
 * Client-side stand-in for LIFF.
 * Production builds do not bypass, even if the hostname is localhost,
 * unless NEXT_PUBLIC_ALLOW_DEV_LINE_AUTH=1 is set at build time.
 */
export function allowLocalLineBypass() {
  if (typeof window === "undefined") return false;
  if (!isBrowserLocalhost()) return false;
  if (process.env.NEXT_PUBLIC_ALLOW_DEV_LINE_AUTH === "0") return false;
  if (!isProdRuntime()) return true;
  return process.env.NEXT_PUBLIC_ALLOW_DEV_LINE_AUTH === "1";
}

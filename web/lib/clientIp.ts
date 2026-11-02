/**
 * Client IP for rate limits.
 * On Vercel the platform sets `x-real-ip` and appends the connecting address
 * to `x-forwarded-for`. The first XFF entry is client-controlled, so it is ignored.
 */
export function getClientIp(headers: Headers) {
  const real = firstIp(headers.get("x-real-ip"));
  if (real) return real;

  const forwarded = headers.get("x-forwarded-for") || "";
  const parts = forwarded
    .split(",")
    .map((part) => normalizeIp(part))
    .filter(Boolean);
  if (parts.length === 0) return "unknown";
  return parts[parts.length - 1];
}

function firstIp(raw: string | null) {
  if (!raw) return "";
  const ip = normalizeIp(raw.split(",")[0] || "");
  return ip;
}

function normalizeIp(raw: string) {
  let ip = String(raw || "").trim();
  if (!ip) return "";
  if (ip.startsWith("[")) {
    const end = ip.indexOf("]");
    ip = end > 0 ? ip.slice(1, end) : ip;
  } else if (ip.includes(".") && ip.includes(":")) {
    ip = ip.slice(0, ip.lastIndexOf(":"));
  }
  if (ip.length > 80) return "";
  if (!/^[0-9a-f:.]+$/i.test(ip)) return "";
  return ip;
}

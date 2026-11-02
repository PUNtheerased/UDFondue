import crypto from "crypto";

/** Compare strings without leaking the first differing character via timing. */
export function safeEqualString(a: string, b: string) {
  const left = crypto.createHash("sha256").update(String(a)).digest();
  const right = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}

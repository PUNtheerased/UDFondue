import crypto from "crypto";
import { safeEqualString } from "./safeEqual";

const MIN_SECRET_LENGTH = 16;

/** Returns the session secret, or null when it is missing, short, or the old dev fallback. */
export function adminSessionSecret() {
  const secret = String(process.env.ADMIN_SESSION_SECRET || "");
  if (secret.length < MIN_SECRET_LENGTH) return null;
  if (secret === "dev-secret") return null;
  return secret;
}

function sign(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function createAdminSessionToken(subject: string) {
  const secret = adminSessionSecret();
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not configured");
  }
  const exp = Date.now() + 8 * 60 * 60 * 1000;
  const payload = `${subject}.${exp}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyAdminSessionToken(token: string | undefined) {
  const secret = adminSessionSecret();
  if (!secret || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [subject, expStr, sig] = parts;
  if (!subject || !/^\d+$/.test(expStr) || !sig) return null;
  const expected = sign(`${subject}.${expStr}`, secret);
  if (!safeEqualString(sig, expected)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return null;
  return subject;
}

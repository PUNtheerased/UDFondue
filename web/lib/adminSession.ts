import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE = "udfondue_admin";
const MODE_COOKIE = "udfondue_nimda_mode";

export type NimdaMode = "admin" | "dev";

function sign(value: string) {
  const secret = process.env.ADMIN_SESSION_SECRET || "dev-secret";
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function createAdminSessionToken(subject: string) {
  const exp = Date.now() + 8 * 60 * 60 * 1000;
  const payload = `${subject}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSessionToken(token: string | undefined) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [subject, expStr, sig] = parts;
  const payload = `${subject}.${expStr}`;
  if (sig !== sign(payload)) return null;
  const exp = Number(expStr);
  if (!exp || Date.now() > exp) return null;
  return subject;
}

export function getAdminSession() {
  const jar = cookies();
  return verifyAdminSessionToken(jar.get(COOKIE)?.value);
}

export function adminCookieName() {
  return COOKIE;
}

export function nimdaModeCookieName() {
  return MODE_COOKIE;
}

export function getNimdaMode(): NimdaMode {
  const jar = cookies();
  const raw = jar.get(MODE_COOKIE)?.value;
  return raw === "dev" ? "dev" : "admin";
}

export function assertDevMode() {
  if (getNimdaMode() !== "dev") {
    throw new Error("ต้องเป็นโหมด Dev");
  }
}

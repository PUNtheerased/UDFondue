import { cookies } from "next/headers";
import { createAdminSessionToken, verifyAdminSessionToken } from "@/lib/sessionToken";

const COOKIE = "udfondue_admin";
const MODE_COOKIE = "udfondue_nimda_mode";

export type NimdaMode = "admin" | "dev";

export { createAdminSessionToken, verifyAdminSessionToken };

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

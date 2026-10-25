import { allowLocalLineBypass } from "@/lib/runtime";

type LiffLike = {
  isLoggedIn?: () => boolean;
  getIDToken?: () => string | null;
  getProfile?: () => Promise<{ userId: string; displayName: string }>;
};

function getLiff(): LiffLike | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { liff?: LiffLike }).liff;
}

export async function getClientIdToken(): Promise<string> {
  if (allowLocalLineBypass()) {
    return "dev:U-TEST-USER-ID";
  }
  const liff = getLiff();
  if (!liff) return "";
  try {
    if (!liff.isLoggedIn?.()) return "";
    return liff.getIDToken?.() || "";
  } catch {
    return "";
  }
}

export async function getClientLineProfile(): Promise<{ userId: string; displayName: string } | null> {
  if (allowLocalLineBypass()) {
    return { userId: "U-TEST-USER-ID", displayName: "ผู้ใช้งานจำลอง" };
  }
  const liff = getLiff();
  if (!liff?.getProfile) return null;
  try {
    if (!liff.isLoggedIn?.()) return null;
    const profile = await liff.getProfile();
    return { userId: profile.userId, displayName: profile.displayName };
  } catch {
    return null;
  }
}

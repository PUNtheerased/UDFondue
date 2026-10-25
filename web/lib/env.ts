export function getGasUrl() {
  return process.env.GAS_WEB_APP_URL || "";
}

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://ud-fondue.vercel.app";
}

export function getAdminLineIds(): string[] {
  return String(process.env.ADMIN_LINE_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

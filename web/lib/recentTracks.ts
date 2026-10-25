const KEY = "udfondue_recent_tracks_v1";
const MAX = 5;

export function loadRecentTracks(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(list) ? list.filter(Boolean).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function rememberTrackId(submitId: string) {
  if (typeof window === "undefined" || !submitId) return;
  const id = String(submitId).trim().toUpperCase();
  if (!id) return;
  const prev = loadRecentTracks().filter((x) => x !== id);
  localStorage.setItem(KEY, JSON.stringify([id, ...prev].slice(0, MAX)));
}

export function normalizeSubmitIdInput(raw: string) {
  let s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  if (!s) return "";
  if (/^UDF-/.test(s)) return s;
  if (/^[A-Z0-9]{6,12}$/.test(s)) return `UDF-${s}`;
  return s;
}

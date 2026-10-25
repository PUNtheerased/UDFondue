import { getGasUrl } from "./env";

export async function callGas<T = Record<string, unknown>>(
  payload: Record<string, unknown>
): Promise<T> {
  const url = getGasUrl();
  if (!url) {
    throw new Error("GAS_WEB_APP_URL is not configured");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed || trimmed.charAt(0) === "<") {
    throw new Error("GAS returned invalid response");
  }

  return JSON.parse(trimmed) as T;
}

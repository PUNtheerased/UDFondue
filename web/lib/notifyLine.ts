import { callGas } from "@/lib/gas";

/** Ask GAS to push LINE only (no Sheets write). */
export async function notifyLine(payload: Record<string, unknown>) {
  try {
    return await callGas({
      action: "notifyLine",
      ...payload
    });
  } catch (err) {
    console.error("notifyLine failed", err);
    return { status: "error", message: err instanceof Error ? err.message : "notify failed" };
  }
}

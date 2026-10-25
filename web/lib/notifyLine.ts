import { callGas } from "@/lib/gas";
import { buildTrackUrl, pushLineText } from "@/lib/linePush";

/**
 * แจ้ง LINE: พยายาม push จาก Next (env token) ก่อน
 * แล้วค่อยเรียก GAS สำหรับกลุ่ม / สำรอง
 */
export async function notifyLine(payload: Record<string, unknown>) {
  const kind = String(payload.kind || "");
  const submitId = String(payload.submitId || "");
  const lineId = String(payload.lineId || "");
  const trackToken = String(payload.trackToken || "");
  const trackUrl =
    String(payload.trackUrl || "") || buildTrackUrl(submitId, trackToken || undefined);

  try {
    if (kind === "submit" && lineId) {
      const text = [
        "รับเรื่องแล้ว",
        `• เลขที่ติดตาม: ${submitId || "—"}`,
        `• ประเภท: ${payload.category || "—"}`,
        `• สถานะ: ${payload.status || "รับเรื่องแล้ว"}`,
        "",
        "ติดตามสถานะ:",
        trackUrl
      ].join("\n");
      const pushed = await pushLineText(lineId, text);
      // กลุ่มซ่อม / คิวยังให้ GAS จัดการ (ใช้ Script Properties token)
      await callGas({
        action: "notifyLine",
        kind: "submitGroupsOnly",
        skipUserPush: true,
        ...payload
      }).catch(() => null);
      return pushed.ok
        ? { status: "success", via: "next" }
        : { status: "success", via: "gas_groups", linePush: pushed };
    }

    if (kind === "status" && lineId) {
      const lines = [
        "อัปเดตสถานะเรื่องของคุณ",
        `• เลขที่ติดตาม: ${submitId || "—"}`,
        `• สถานะปัจจุบัน: ${payload.status || "—"}`
      ];
      const note = String(payload.studentNote || payload.adminNote || "");
      if (note) lines.push(`• ข้อความจากครู: ${note}`);
      lines.push("", "ดูรายละเอียด:", trackUrl);
      const pushed = await pushLineText(lineId, lines.join("\n"));
      return pushed.ok
        ? { status: "success", via: "next" }
        : { status: "error", message: pushed.reason, detail: "detail" in pushed ? pushed.detail : "" };
    }

    if (kind === "lf_claim" && lineId) {
      const text = [
        "มีคนสนใจของที่คุณแจ้งพบ",
        `• เลขที่: ${submitId}`,
        String(payload.message || "เปิดหน้าติดตามเพื่อสร้างรหัสตอนนัดรับของ"),
        "",
        "ดูรายละเอียด:",
        trackUrl
      ].join("\n");
      const pushed = await pushLineText(lineId, text);
      return pushed.ok
        ? { status: "success", via: "next" }
        : { status: "error", message: pushed.reason };
    }

    // janitor / อื่น ๆ — ให้ GAS ยิงกลุ่ม
    return await callGas({
      action: "notifyLine",
      ...payload
    });
  } catch (err) {
    console.error("notifyLine failed", err);
    return { status: "error", message: err instanceof Error ? err.message : "notify failed" };
  }
}

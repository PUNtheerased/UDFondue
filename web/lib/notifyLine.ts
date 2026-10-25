import { callGas } from "@/lib/gas";
import { buildTrackUrl, pushLineText } from "@/lib/linePush";

function statusEmoji(status: string) {
  if (status.includes("เสร็จ") || status.includes("ปิด")) return "🟢";
  if (status.includes("ดำเนิน") || status.includes("รอ")) return "🟠";
  return "🟡";
}

export function buildSubmitThanksMessage(opts: {
  submitId: string;
  category: string;
  status?: string;
  trackUrl: string;
}) {
  const status = opts.status || "รับเรื่องแล้ว";
  return [
    "🙏 ขอบคุณสำหรับการแจ้งเรื่องครับ/ค่ะ!",
    "ทางเราได้รับข้อมูลของท่านเรียบร้อยแล้ว",
    "📌 สรุปรายละเอียดการแจ้งเรื่อง",
    `• รหัสติดตาม: ${opts.submitId || "—"}`,
    `• หมวดหมู่: ${opts.category || "—"}`,
    `• สถานะปัจจุบัน: ${statusEmoji(status)} ${status}`,
    "",
    "🔍 ติดตามสถานะหรือเช็กความคืบหน้าได้ที่:",
    `👉 ${opts.trackUrl}`
  ].join("\n");
}

/**
 * แจ้ง LINE: พยายาม push จาก Next (env token) ก่อน
 * แล้วค่อยเรียก GAS สำหรับกลุ่ม / สำรอง
 */
export async function notifyLine(payload: Record<string, unknown>) {
  const kind = String(payload.kind || "");
  const submitId = String(payload.submitId || "");
  const lineId = String(payload.lineId || "");
  const trackToken = String(payload.trackToken || "");
  // ลิงก์ติดตามแบบสาธารณะตามตัวอย่าง (ไม่บังคับแนบ token ในข้อความต้อนรับ)
  const trackUrl =
    String(payload.trackUrl || "") ||
    buildTrackUrl(submitId, undefined);

  try {
    if (kind === "submit" && lineId) {
      const text = buildSubmitThanksMessage({
        submitId,
        category: String(payload.category || ""),
        status: String(payload.status || "รับเรื่องแล้ว"),
        trackUrl
      });
      const pushed = await pushLineText(lineId, text);
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
      const status = String(payload.status || "—");
      const lines = [
        "อัปเดตสถานะเรื่องของคุณ",
        `• รหัสติดตาม: ${submitId || "—"}`,
        `• สถานะปัจจุบัน: ${statusEmoji(status)} ${status}`
      ];
      const note = String(payload.studentNote || payload.adminNote || "");
      if (note) lines.push(`• ข้อความจากครู: ${note}`);
      lines.push("", "🔍 ดูรายละเอียด:", `👉 ${buildTrackUrl(submitId, trackToken || undefined)}`);
      const pushed = await pushLineText(lineId, lines.join("\n"));
      return pushed.ok
        ? { status: "success", via: "next" }
        : { status: "error", message: pushed.reason, detail: "detail" in pushed ? pushed.detail : "" };
    }

    if (kind === "lf_claim" && lineId) {
      const text = [
        "มีคนสนใจของที่คุณแจ้งพบ",
        `• รหัสติดตาม: ${submitId}`,
        String(payload.message || "เปิดหน้าติดตามเพื่อสร้างรหัสตอนนัดรับของ"),
        "",
        "🔍 ดูรายละเอียด:",
        `👉 ${trackUrl}`
      ].join("\n");
      const pushed = await pushLineText(lineId, text);
      return pushed.ok
        ? { status: "success", via: "next" }
        : { status: "error", message: pushed.reason };
    }

    return await callGas({
      action: "notifyLine",
      ...payload
    });
  } catch (err) {
    console.error("notifyLine failed", err);
    return { status: "error", message: err instanceof Error ? err.message : "notify failed" };
  }
}

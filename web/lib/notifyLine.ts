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

export type NotifyLineResult = {
  status: "success" | "error" | "partial";
  via?: string;
  pushed?: boolean;
  groupNotifyOk?: boolean;
  message?: string;
  detail?: string;
};

/**
 * แจ้ง LINE: พยายาม push จาก Next (env token) ก่อน
 * แล้วค่อยเรียก GAS สำหรับกลุ่ม / สำรอง
 */
export async function notifyLine(payload: Record<string, unknown>): Promise<NotifyLineResult> {
  const kind = String(payload.kind || "");
  const submitId = String(payload.submitId || "");
  const lineId = String(payload.lineId || "");
  const trackToken = String(payload.trackToken || "");
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
      let groupNotifyOk = false;
      try {
        await callGas({
          action: "notifyLine",
          kind: "submitGroupsOnly",
          skipUserPush: true,
          ...payload
        });
        groupNotifyOk = true;
      } catch (err) {
        console.error("notifyLine group failed", err);
        groupNotifyOk = false;
      }

      if (pushed.ok && groupNotifyOk) {
        return { status: "success", via: "next", pushed: true, groupNotifyOk: true };
      }
      if (pushed.ok) {
        return {
          status: "partial",
          via: "next",
          pushed: true,
          groupNotifyOk: false,
          message: "ส่งถึงผู้ใช้แล้ว แต่แจ้งกลุ่มไม่สำเร็จ"
        };
      }
      return {
        status: "partial",
        via: "gas_groups",
        pushed: false,
        groupNotifyOk,
        message: pushed.reason || "ส่ง LINE ถึงผู้ใช้ไม่สำเร็จ",
        detail: "detail" in pushed ? String(pushed.detail || "") : undefined
      };
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
      if (pushed.ok) {
        return { status: "success", via: "next", pushed: true };
      }
      try {
        await callGas({ action: "notifyLine", ...payload });
        return {
          status: "partial",
          via: "gas_fallback",
          pushed: false,
          message: "Next push ล้ม — ส่งผ่าน GAS แล้ว"
        };
      } catch (err) {
        return {
          status: "error",
          pushed: false,
          message: pushed.reason || (err instanceof Error ? err.message : "notify failed")
        };
      }
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
      if (pushed.ok) {
        return { status: "success", via: "next", pushed: true };
      }
      try {
        await callGas({ action: "notifyLine", ...payload });
        return {
          status: "partial",
          via: "gas_fallback",
          pushed: false,
          message: "Next push ล้ม — ส่งผ่าน GAS แล้ว"
        };
      } catch (err) {
        return {
          status: "error",
          pushed: false,
          message: pushed.reason || (err instanceof Error ? err.message : "notify failed")
        };
      }
    }

    const gas = (await callGas({
      action: "notifyLine",
      ...payload
    })) as { status?: string; message?: string };
    return {
      status: gas.status === "success" ? "success" : "error",
      via: "gas",
      message: gas.message
    };
  } catch (err) {
    console.error("notifyLine failed", err);
    return { status: "error", message: err instanceof Error ? err.message : "notify failed" };
  }
}

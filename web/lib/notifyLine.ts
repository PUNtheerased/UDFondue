import { callGas } from "@/lib/gas";
import { buildTrackUrl, pushLineText } from "@/lib/linePush";

/** สร้าง emoji จาก code point — กันไฟล์/บิลด์ทำให้โชว์เป็น \\uD83D\\uDE4F */
const EMOJI = {
  pray: String.fromCodePoint(0x1f64f),
  pin: String.fromCodePoint(0x1f4cc),
  search: String.fromCodePoint(0x1f50d),
  point: String.fromCodePoint(0x1f449),
  yellow: String.fromCodePoint(0x1f7e1),
  orange: String.fromCodePoint(0x1f7e0),
  green: String.fromCodePoint(0x1f7e2)
};

function statusEmoji(status: string) {
  if (status.includes("เสร็จ") || status.includes("ปิด")) return EMOJI.green;
  if (status.includes("ดำเนิน") || status.includes("รอ")) return EMOJI.orange;
  return EMOJI.yellow;
}

export function buildSubmitThanksMessage(opts: {
  submitId: string;
  category: string;
  status?: string;
  trackUrl: string;
}) {
  const status = opts.status || "รับเรื่องแล้ว";
  return [
    `${EMOJI.pray} ขอบคุณสำหรับการแจ้งเรื่องครับ/ค่ะ!`,
    "ทางเราได้รับข้อมูลของท่านเรียบร้อยแล้ว",
    `${EMOJI.pin} สรุปรายละเอียดการแจ้งเรื่อง`,
    `• รหัสติดตาม: ${opts.submitId || "—"}`,
    `• หมวดหมู่: ${opts.category || "—"}`,
    `• สถานะปัจจุบัน: ${statusEmoji(status)} ${status}`,
    "",
    `${EMOJI.search} ติดตามสถานะหรือเช็กความคืบหน้าได้ที่:`,
    `${EMOJI.point} ${opts.trackUrl}`
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
      if (note) lines.push(`• ข้อความจากผู้ดูแลระบบ: ${note}`);
      lines.push(
        "",
        `${EMOJI.search} ดูรายละเอียด:`,
        `${EMOJI.point} ${buildTrackUrl(submitId, trackToken || undefined)}`
      );
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
        `${EMOJI.search} ดูรายละเอียด:`,
        `${EMOJI.point} ${trackUrl}`
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

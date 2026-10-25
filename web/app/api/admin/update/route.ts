import { NextRequest, NextResponse } from "next/server";
import { assertDevMode, getAdminSession, getNimdaMode } from "@/lib/adminSession";
import { callGas } from "@/lib/gas";
import { notifyLine } from "@/lib/notifyLine";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import {
  cancelHandoff,
  hideTicket,
  mergeTickets,
  unlockHandoff,
  updateTicketStatus
} from "@/lib/ticketsDb";

export async function POST(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ status: "error", message: "เข้าสู่ระบบก่อน" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const action = body.action || "adminUpdate";
    const mode = getNimdaMode();
    const byRole = mode === "dev" ? "dev" : "teacher";

    if (isTicketsDbReady()) {
      if (action === "adminMergeTickets") {
        try {
          assertDevMode();
        } catch {
          return NextResponse.json({ status: "error", message: "รวมเคสใช้ได้เฉพาะโหมด Dev" }, { status: 403 });
        }
        const into = String(body.mergeIntoId || body.submitId || "");
        const fromIds = String(body.mergeFromIds || body.mergeIds || "")
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
        await mergeTickets(into, fromIds, byRole);
        return NextResponse.json({ status: "success", message: "รวมเคสแล้ว" });
      }

      if (action === "adminModerationHide") {
        await hideTicket(String(body.submitId || ""), byRole);
        return NextResponse.json({ status: "success", message: "ซ่อนรายการแล้ว" });
      }

      if (action === "assignJanitor") {
        const submitId = String(body.submitId || "");
        const row = await updateTicketStatus({
          submitId,
          status: "กำลังดำเนินการ",
          assignedTo: "janitor",
          studentNote: body.studentNote || "ส่งต่อภารโรงแล้ว กำลังดำเนินการ",
          byRole
        });
        await notifyLine({
          kind: "janitor",
          assignedGroup: "FACILITY",
          submitId,
          category: row.category,
          building: row.building,
          zone: row.zone,
          detail: row.detail,
          imageUrl: row.image_url
        });
        return NextResponse.json({ status: "success", message: "ส่งต่อภารโรงแล้ว" });
      }

      if (action === "unlockHandoff") {
        try {
          assertDevMode();
        } catch {
          return NextResponse.json({ status: "error", message: "ปลดล็อกรหัสใช้ได้เฉพาะโหมด Dev" }, { status: 403 });
        }
        await unlockHandoff(String(body.submitId || ""));
        return NextResponse.json({ status: "success", message: "ปลดล็อกรหัสแล้ว" });
      }

      if (action === "forceCancelHandoff") {
        await cancelHandoff(String(body.submitId || ""), "", true);
        return NextResponse.json({ status: "success", message: "ยกเลิกเคลมแล้ว" });
      }

      // adminUpdate
      const submitId = String(body.submitId || "");
      const note = body.studentNote ?? body.adminNote ?? "";
      const row = await updateTicketStatus({
        submitId,
        status: body.status,
        studentNote: note,
        afterImageUrls: body.afterImageUrls || [],
        byRole
      });

      let lineNotify: Awaited<ReturnType<typeof notifyLine>> | null = null;
      if (body.status && row.line_id) {
        lineNotify = await notifyLine({
          kind: "status",
          lineId: row.line_id,
          submitId,
          status: body.status,
          studentNote: note,
          trackToken: row.track_token
        });
        if (lineNotify.status === "error") {
          console.error("admin status LINE notify failed", lineNotify);
        }
      }

      return NextResponse.json({
        status: "success",
        message:
          lineNotify && lineNotify.status !== "success"
            ? `บันทึกแล้ว แต่แจ้ง LINE ไม่ครบ: ${lineNotify.message || lineNotify.status}`
            : "บันทึกแล้ว",
        lineNotify
      });
    }

    const gasToken = session.startsWith("gas:") ? session.slice(4) : "session";
    const result = await callGas({
      action: body.action || "adminUpdate",
      adminToken: gasToken,
      submitId: body.submitId,
      status: body.status,
      adminNote: body.studentNote || body.adminNote,
      afterImageUrls: body.afterImageUrls || [],
      mergeIntoId: body.mergeIntoId,
      mergeFromIds: body.mergeFromIds || [],
      password: body.password
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Admin update failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

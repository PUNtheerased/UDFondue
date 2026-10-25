import { NextRequest, NextResponse } from "next/server";
import { verifyLineIdToken } from "@/lib/lineAuth";
import { mirrorTicketToSheet } from "@/lib/mirrorSheet";
import { notifyLine } from "@/lib/notifyLine";
import { rateLimit } from "@/lib/rateLimit";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import { confirmHandoffCode, getTicketBySubmitId } from "@/lib/ticketsDb";

export async function POST(req: NextRequest) {
  if (!isTicketsDbReady()) {
    return NextResponse.json({ status: "error", message: "ระบบยังไม่พร้อม" }, { status: 503 });
  }

  try {
    const body = await req.json();
    const lineAuth = await verifyLineIdToken(String(body.idToken || ""));
    if (!lineAuth.ok) {
      return NextResponse.json({ status: "error", message: lineAuth.message }, { status: 403 });
    }
    const rl = await rateLimit(`lf-confirm:${lineAuth.sub}`, 12, 10 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json({ status: "error", message: "ลองบ่อยเกินไป" }, { status: 429 });
    }

    const submitId = String(body.submitId || body.foundSubmitId || "");
    const code = String(body.code || "");
    const ticket = await confirmHandoffCode(submitId, lineAuth.sub, code);
    const full = await getTicketBySubmitId(submitId);
    await mirrorTicketToSheet(submitId, full);

    if (full?.line_id) {
      await notifyLine({
        kind: "status",
        lineId: full.line_id,
        submitId,
        status: "เสร็จสิ้น",
        studentNote: "รับของเรียบร้อยแล้ว",
        trackToken: full.track_token
      });
    }
    await notifyLine({
      kind: "status",
      lineId: lineAuth.sub,
      submitId,
      status: "เสร็จสิ้น",
      studentNote: "ยืนยันรับของแล้ว",
      trackToken: full?.track_token || ""
    });

    return NextResponse.json({
      status: "success",
      message: "ยืนยันรับของแล้ว — ปิดเรื่องเรียบร้อย",
      report: ticket ? { submitId: ticket.submit_id, status: ticket.status } : null
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Confirm failed";
    return NextResponse.json({ status: "error", message }, { status: 400 });
  }
}

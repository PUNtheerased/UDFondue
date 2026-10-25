import { NextRequest, NextResponse } from "next/server";
import { verifyLineIdToken } from "@/lib/lineAuth";
import { notifyLine } from "@/lib/notifyLine";
import { rateLimit } from "@/lib/rateLimit";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import { claimFoundItem, getTicketBySubmitId, handoffToPublic } from "@/lib/ticketsDb";

export async function POST(req: NextRequest) {
  if (!isTicketsDbReady()) {
    return NextResponse.json(
      { status: "error", message: "ระบบเคลมยังไม่พร้อม — ตั้งค่า Supabase ก่อน" },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();
    const lineAuth = await verifyLineIdToken(String(body.idToken || ""));
    if (!lineAuth.ok) {
      return NextResponse.json({ status: "error", message: lineAuth.message }, { status: 403 });
    }
    const rl = rateLimit(`lf-claim:${lineAuth.sub}`, 10, 10 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json({ status: "error", message: "ลองบ่อยเกินไป รอสักครู่" }, { status: 429 });
    }

    const submitId = String(body.submitId || body.foundSubmitId || "");
    const handoff = await claimFoundItem(submitId, lineAuth.sub);
    const ticket = await getTicketBySubmitId(submitId);
    if (ticket?.line_id) {
      await notifyLine({
        kind: "lf_claim",
        lineId: ticket.line_id,
        submitId,
        message: "มีคนเคลมว่าของชิ้นนี้เป็นของเขา — เปิดหน้าติดตามเพื่อสร้างรหัสตอนนัดรับ"
      });
    }

    return NextResponse.json({
      status: "success",
      handoff: handoffToPublic(handoff, lineAuth.sub)
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Claim failed";
    return NextResponse.json({ status: "error", message }, { status: 400 });
  }
}

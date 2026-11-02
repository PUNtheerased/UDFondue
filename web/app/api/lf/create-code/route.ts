import { NextRequest, NextResponse } from "next/server";
import { verifyLineIdToken } from "@/lib/lineAuth";
import { publicMessage } from "@/lib/publicMessage";
import { rateLimit, rateLimitMessage, rateLimitStatus } from "@/lib/rateLimit";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import { createHandoffCode, handoffToPublic } from "@/lib/ticketsDb";

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
    const rl = await rateLimit(`lf-code:${lineAuth.sub}`, 8, 10 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: rateLimitMessage(rl, "สร้างรหัสบ่อยเกินไป") },
        { status: rateLimitStatus(rl) }
      );
    }

    const submitId = String(body.submitId || body.foundSubmitId || "");
    const { handoff, code, expiresAt } = await createHandoffCode(submitId, lineAuth.sub);

    return NextResponse.json({
      status: "success",
      code,
      expiresAt,
      handoff: handoffToPublic(handoff, lineAuth.sub),
      message: "โชว์รหัสนี้ให้อีกฝั่งกรอก — อย่าส่งในแชทถ้ายังไม่ได้นัดเจอ"
    });
  } catch (err) {
    const message = publicMessage(err, "สร้างรหัสไม่สำเร็จ");
    return NextResponse.json({ status: "error", message }, { status: message === "สร้างรหัสไม่สำเร็จ" ? 500 : 400 });
  }
}

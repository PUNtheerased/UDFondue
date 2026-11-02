import { NextRequest, NextResponse } from "next/server";
import { callGas } from "@/lib/gas";
import { getClientIp } from "@/lib/clientIp";
import { verifyLineIdToken } from "@/lib/lineAuth";
import { mirrorTicketToSheet, shouldMirrorUpvote } from "@/lib/mirrorSheet";
import { publicMessage } from "@/lib/publicMessage";
import { rateLimit, rateLimitMessage, rateLimitStatus } from "@/lib/rateLimit";
import { isValidSubmitId } from "@/lib/submitValidation";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import { upvoteTicket } from "@/lib/ticketsDb";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const ip = getClientIp(req.headers);
    const source = (body || {}) as Record<string, unknown>;
    const lineAuth = await verifyLineIdToken(String(source.idToken || ""));
    if (!lineAuth.ok) {
      return NextResponse.json({ status: "error", message: lineAuth.message }, { status: 403 });
    }

    const rl = await rateLimit(`upvote:${ip}:${lineAuth.sub}`, 20, 10 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: rateLimitMessage(rl, "กดบ่อยเกินไป") },
        { status: rateLimitStatus(rl) }
      );
    }

    const submitId = String(source.submitId || "").trim().toUpperCase();
    if (!isValidSubmitId(submitId)) {
      return NextResponse.json({ status: "error", message: "เลขที่แจ้งไม่ถูกต้อง" }, { status: 400 });
    }

    if (isTicketsDbReady()) {
      const result = await upvoteTicket(submitId, lineAuth.sub);
      if (!result.already && shouldMirrorUpvote(submitId)) {
        await mirrorTicketToSheet(submitId);
      }
      return NextResponse.json({
        status: "success",
        message: result.already ? "โหวตไปแล้ว" : "โหวตแล้ว",
        upvoteCount: result.upvoteCount,
        already: result.already
      });
    }

    const result = await callGas({
      action: "upvoteTicket",
      submitId,
      lineId: lineAuth.sub
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: publicMessage(err, "โหวตไม่สำเร็จ") },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { callGas } from "@/lib/gas";
import { verifyLineIdToken } from "@/lib/lineAuth";
import { rateLimit } from "@/lib/rateLimit";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import { upvoteTicket } from "@/lib/ticketsDb";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const lineAuth = await verifyLineIdToken(String(body.idToken || ""));
    if (!lineAuth.ok) {
      return NextResponse.json({ status: "error", message: lineAuth.message }, { status: 403 });
    }

    const rl = rateLimit(`upvote:${ip}:${lineAuth.sub}`, 20, 10 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json({ status: "error", message: "กดบ่อยเกินไป" }, { status: 429 });
    }

    if (isTicketsDbReady()) {
      const result = await upvoteTicket(String(body.submitId || ""), lineAuth.sub);
      return NextResponse.json({
        status: "success",
        message: result.already ? "โหวตไปแล้ว" : "โหวตแล้ว",
        upvoteCount: result.upvoteCount,
        already: result.already
      });
    }

    const result = await callGas({
      action: "upvoteTicket",
      submitId: body.submitId,
      lineId: lineAuth.sub
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upvote failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { verifyLineIdToken } from "@/lib/lineAuth";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import { cancelHandoff } from "@/lib/ticketsDb";

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
    await cancelHandoff(String(body.submitId || body.foundSubmitId || ""), lineAuth.sub, false);
    return NextResponse.json({ status: "success", message: "ยกเลิกเคลมแล้ว" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cancel failed";
    return NextResponse.json({ status: "error", message }, { status: 400 });
  }
}

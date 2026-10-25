import { NextRequest, NextResponse } from "next/server";
import { assertDevMode, getAdminSession, getNimdaMode } from "@/lib/adminSession";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import { getSiteSettings, setSiteSetting } from "@/lib/ticketsDb";

export async function GET() {
  try {
    const settings = await getSiteSettings();
    return NextResponse.json({ status: "success", settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ status: "error", message: "เข้าสู่ระบบก่อน" }, { status: 401 });
  }
  try {
    assertDevMode();
  } catch {
    return NextResponse.json({ status: "error", message: "แก้ข้อความเว็บได้เฉพาะโหมด Dev" }, { status: 403 });
  }
  if (!isTicketsDbReady()) {
    return NextResponse.json({ status: "error", message: "ยังไม่ได้ตั้งค่า Supabase" }, { status: 503 });
  }

  try {
    const body = await req.json();
    const entries = body.settings && typeof body.settings === "object" ? body.settings : body;
    for (const [key, value] of Object.entries(entries)) {
      if (typeof key === "string" && typeof value === "string") {
        await setSiteSetting(key, value);
      }
    }
    const settings = await getSiteSettings();
    return NextResponse.json({ status: "success", settings, mode: getNimdaMode() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { assertDevMode, getAdminSession } from "@/lib/adminSession";
import { callGas } from "@/lib/gas";
import { getSupabaseAdmin, isTicketsDbReady } from "@/lib/supabaseAdmin";

/** Dev only — ล้าง tickets / handoff / history ใน Supabase (+ ตัวเลือกเคลียร์ชีต) */
export async function POST(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ status: "error", message: "เข้าสู่ระบบก่อนนะ" }, { status: 401 });
  }
  try {
    assertDevMode();
  } catch {
    return NextResponse.json({ status: "error", message: "ล้างฐานข้อมูลได้เฉพาะโหมด Dev" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const confirm = String(body.confirm || "");
    if (confirm !== "ล้างข้อมูลทั้งหมด") {
      return NextResponse.json(
        {
          status: "error",
          message: 'พิมพ์ยืนยันว่า "ล้างข้อมูลทั้งหมด" ก่อน'
        },
        { status: 400 }
      );
    }

    const cleared: string[] = [];

    if (isTicketsDbReady()) {
      const sb = getSupabaseAdmin();
      await sb.from("lf_handoffs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      cleared.push("lf_handoffs");
      await sb.from("ticket_status_history").delete().gte("id", 0);
      cleared.push("ticket_status_history");
      await sb.from("tickets").delete().neq("submit_id", "");
      cleared.push("tickets");
    }

    if (body.clearSheet) {
      try {
        const gasToken = session.startsWith("gas:") ? session.slice(4) : "session";
        await callGas({
          action: "adminPurgeSheet",
          adminToken: gasToken,
          confirm
        });
        cleared.push("sheet");
      } catch (err) {
        console.error("purge sheet", err);
      }
    }

    return NextResponse.json({
      status: "success",
      message: "ล้างฐานข้อมูลแล้ว",
      cleared
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Purge failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

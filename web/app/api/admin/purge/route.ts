import { NextRequest, NextResponse } from "next/server";
import { assertDevMode, getAdminSession } from "@/lib/adminSession";
import { publicMessage } from "@/lib/publicMessage";
import { callGas } from "@/lib/gas";
import { getSupabaseAdmin, isTicketsDbReady } from "@/lib/supabaseAdmin";

/** Dev only — ล้าง tickets / handoff / history ใน Supabase (+ ตัวเลือกเคลียร์ชีต) */
export async function POST(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ status: "error", message: "เข้าสู่ระบบก่อน" }, { status: 401 });
  }
  try {
    assertDevMode();
  } catch {
    return NextResponse.json({ status: "error", message: "ล้างฐานข้อมูลได้เฉพาะโหมด Dev" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const confirm = String(body.confirm || "");
    if (confirm !== "delete-database") {
      return NextResponse.json(
        {
          status: "error",
          message: 'พิมพ์ยืนยันว่า "delete-database" ก่อน'
        },
        { status: 400 }
      );
    }

    const cleared: string[] = [];
    const warnings: string[] = [];

    if (isTicketsDbReady()) {
      const sb = getSupabaseAdmin();

      // ลบมือทีละตาราง — ดึง id ก่อนแล้วลบ (กัน filter .neq พลาด)
      const { data: handoffRows, error: handoffListErr } = await sb.from("lf_handoffs").select("id");
      if (handoffListErr) {
        warnings.push(`อ่าน lf_handoffs ไม่สำเร็จ: ${handoffListErr.message}`);
      } else if ((handoffRows || []).length) {
        const { error } = await sb
          .from("lf_handoffs")
          .delete()
          .in(
            "id",
            handoffRows!.map((r) => r.id as string)
          );
        if (error) warnings.push(`ลบ lf_handoffs ไม่สำเร็จ: ${error.message}`);
        else cleared.push("lf_handoffs");
      } else {
        cleared.push("lf_handoffs");
      }

      const { data: histRows, error: histListErr } = await sb
        .from("ticket_status_history")
        .select("id");
      if (histListErr) {
        warnings.push(`อ่าน ticket_status_history ไม่สำเร็จ: ${histListErr.message}`);
      } else if ((histRows || []).length) {
        const { error } = await sb
          .from("ticket_status_history")
          .delete()
          .in(
            "id",
            histRows!.map((r) => r.id as number)
          );
        if (error) warnings.push(`ลบ ticket_status_history ไม่สำเร็จ: ${error.message}`);
        else cleared.push("ticket_status_history");
      } else {
        cleared.push("ticket_status_history");
      }

      const { data: ticketRows, error: ticketListErr } = await sb
        .from("tickets")
        .select("submit_id");
      if (ticketListErr) {
        warnings.push(`อ่าน tickets ไม่สำเร็จ: ${ticketListErr.message}`);
      } else if ((ticketRows || []).length) {
        const { error } = await sb
          .from("tickets")
          .delete()
          .in(
            "submit_id",
            ticketRows!.map((r) => r.submit_id as string)
          );
        if (error) warnings.push(`ลบ tickets ไม่สำเร็จ: ${error.message}`);
        else cleared.push("tickets");
      } else {
        cleared.push("tickets");
      }

      const { count, error: countErr } = await sb
        .from("tickets")
        .select("submit_id", { count: "exact", head: true });
      if (countErr) {
        warnings.push(`เช็ค tickets หลังลบไม่สำเร็จ: ${countErr.message}`);
      } else if ((count || 0) > 0) {
        warnings.push(`ยังเหลือ tickets ใน Supabase ${count} รายการ`);
      }
    }

    if (body.clearSheet) {
      try {
        const pin = process.env.ADMIN_PIN || "";
        if (!pin) {
          warnings.push("ล้างชีตไม่ได้: ไม่มี ADMIN_PIN ใน env");
        } else {
          const auth = await callGas<{
            status: string;
            adminToken?: string;
            message?: string;
          }>({
            action: "adminAuth",
            password: pin
          });
          if (auth.status !== "success" || !auth.adminToken) {
            warnings.push(
              auth.message
                ? `ล้างชีตไม่ได้: ${auth.message}`
                : "ล้างชีตไม่ได้: ได้ adminToken จาก GAS ไม่สำเร็จ"
            );
          } else {
            const purged = await callGas<{ status?: string; message?: string }>({
              action: "adminPurgeSheet",
              adminToken: auth.adminToken,
              confirm
            });
            if (purged.status !== "success") {
              warnings.push(purged.message || "ล้างชีตไม่สำเร็จ");
            } else {
              cleared.push("sheet");
            }
          }
        }
      } catch (err) {
        console.error("purge sheet", err);
        warnings.push(publicMessage(err, "ล้างชีตไม่สำเร็จ"));
      }
    }

    const ok = warnings.length === 0;
    return NextResponse.json({
      status: ok ? "success" : "partial",
      message: ok
        ? "ล้างฐานข้อมูลแล้ว"
        : `ล้างบางส่วนแล้ว — ${warnings.join("; ")}`,
      cleared,
      warnings
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: publicMessage(err, "ล้างข้อมูลไม่สำเร็จ") },
      { status: 500 }
    );
  }
}

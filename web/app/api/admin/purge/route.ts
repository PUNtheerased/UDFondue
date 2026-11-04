import { NextRequest, NextResponse } from "next/server";
import { assertDevMode, getAdminSession } from "@/lib/adminSession";
import { publicMessage } from "@/lib/publicMessage";
import { callGas } from "@/lib/gas";
import { getSupabaseAdmin, getSupabaseHost, isTicketsDbReady } from "@/lib/supabaseAdmin";

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
    const dbHost = getSupabaseHost();
    let ticketsBefore = 0;
    let ticketsAfter = -1;

    if (isTicketsDbReady()) {
      const sb = getSupabaseAdmin();

      const before = await sb.from("tickets").select("submit_id", { count: "exact", head: true });
      ticketsBefore = before.count || 0;

      // 1) RPC truncate ถ้ามีฟังก์ชัน
      const rpc = await sb.rpc("admin_purge_ticket_tables");
      if (!rpc.error && rpc.data) {
        const result = rpc.data as { ok?: boolean; tickets_before?: number; tickets_after?: number };
        cleared.push("tickets", "lf_handoffs", "ticket_status_history", "rpc:admin_purge_ticket_tables");
        ticketsAfter = Number(result.tickets_after ?? 0);
        if (!result.ok) {
          warnings.push(`truncate แล้วยังเหลือ tickets ${ticketsAfter} รายการ`);
        }
      } else {
        // 2) fallback ลบทีละแถว
        if (rpc.error && !String(rpc.error.message || "").includes("Could not find the function")) {
          warnings.push(`RPC purge: ${rpc.error.message}`);
        }

        const { data: handoffRows, error: handoffListErr } = await sb.from("lf_handoffs").select("id");
        if (handoffListErr) warnings.push(`อ่าน lf_handoffs ไม่สำเร็จ: ${handoffListErr.message}`);
        else if ((handoffRows || []).length) {
          const { error } = await sb.from("lf_handoffs").delete().in(
            "id",
            handoffRows!.map((r) => r.id as string)
          );
          if (error) warnings.push(`ลบ lf_handoffs ไม่สำเร็จ: ${error.message}`);
          else cleared.push("lf_handoffs");
        } else cleared.push("lf_handoffs");

        const { data: histRows, error: histListErr } = await sb
          .from("ticket_status_history")
          .select("id");
        if (histListErr) warnings.push(`อ่าน ticket_status_history ไม่สำเร็จ: ${histListErr.message}`);
        else if ((histRows || []).length) {
          const { error } = await sb.from("ticket_status_history").delete().in(
            "id",
            histRows!.map((r) => r.id as number)
          );
          if (error) warnings.push(`ลบ ticket_status_history ไม่สำเร็จ: ${error.message}`);
          else cleared.push("ticket_status_history");
        } else cleared.push("ticket_status_history");

        // ลบทุกแถวที่ created_at มีค่า (ครอบคลุมทั้งตาราง)
        const { error: delErr } = await sb
          .from("tickets")
          .delete()
          .gte("created_at", "1970-01-01");
        if (delErr) warnings.push(`ลบ tickets ไม่สำเร็จ: ${delErr.message}`);
        else cleared.push("tickets");
      }

      const after = await sb.from("tickets").select("submit_id", { count: "exact", head: true });
      if (after.error) {
        warnings.push(`เช็ค tickets หลังลบไม่สำเร็จ: ${after.error.message}`);
      } else {
        ticketsAfter = after.count || 0;
        if (ticketsAfter > 0) {
          warnings.push(`ยังเหลือ tickets ใน Supabase ${ticketsAfter} รายการ (host: ${dbHost})`);
        }
      }
    } else {
      warnings.push("Supabase ยังไม่พร้อม (ไม่มี URL/SERVICE_ROLE)");
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
        ? `ล้างฐานข้อมูลแล้ว (${dbHost || "supabase"} · ก่อน ${ticketsBefore} → หลัง ${ticketsAfter})`
        : `ล้างบางส่วนแล้ว — ${warnings.join("; ")}`,
      cleared,
      warnings,
      dbHost,
      ticketsBefore,
      ticketsAfter
    });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: publicMessage(err, "ล้างข้อมูลไม่สำเร็จ") },
      { status: 500 }
    );
  }
}

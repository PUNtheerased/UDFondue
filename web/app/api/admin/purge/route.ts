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
      const steps: Array<{ label: string; run: () => PromiseLike<{ error: { message: string } | null }> }> = [
        {
          label: "lf_handoffs",
          run: () => sb.from("lf_handoffs").delete().neq("id", "00000000-0000-0000-0000-000000000000")
        },
        {
          label: "ticket_status_history",
          run: () => sb.from("ticket_status_history").delete().gte("id", 0)
        },
        {
          label: "tickets",
          run: () => sb.from("tickets").delete().neq("submit_id", "")
        }
      ];
      for (const step of steps) {
        const { error } = await step.run();
        if (error) {
          warnings.push(`ลบ ${step.label} ไม่สำเร็จ: ${error.message}`);
        } else {
          cleared.push(step.label);
        }
      }
      // ยืนยันว่า tickets ว่างจริง
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

import { NextRequest, NextResponse } from "next/server";
import { callGas } from "@/lib/gas";
import { stripPublicReports } from "@/lib/stripPublic";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import { listPublicLostFound, rowToPublic } from "@/lib/ticketsDb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const lfType = req.nextUrl.searchParams.get("lfType") || "";
    const building = req.nextUrl.searchParams.get("building") || "";
    let reports: Record<string, unknown>[] = [];
    let backend = "none";

    if (isTicketsDbReady()) {
      try {
        let rows = await listPublicLostFound();
        if (lfType) rows = rows.filter((r) => r.lf_type === lfType);
        if (building) rows = rows.filter((r) => r.building === building);
        reports = stripPublicReports(
          rows.map((r) => rowToPublic(r) as unknown as Record<string, unknown>)
        );
        backend = "supabase";
        // สำเร็จแม้ว่าง — ไม่ดึง Sheet เก่ามาทับ
        return NextResponse.json(
          { status: "success", reports, backend },
          { headers: { "Cache-Control": "no-store" } }
        );
      } catch (err) {
        console.error("lost-found supabase", err);
        // ตก GAS เฉพาะเมื่อ Supabase error จริง
      }
    }

    try {
      const result = (await callGas({
        action: "getPublicLostFound",
        lfType,
        building
      })) as { status?: string; reports?: Record<string, unknown>[] };
      reports = stripPublicReports(result.reports || []);
      backend = backend === "supabase" ? "supabase+gas" : "gas";
    } catch (err) {
      console.error("lost-found gas", err);
      if (reports.length === 0) {
        const message = err instanceof Error ? err.message : "Lost-found fetch failed";
        return NextResponse.json({ status: "error", message }, { status: 500 });
      }
    }

    return NextResponse.json(
      { status: "success", reports, backend },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lost-found fetch failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

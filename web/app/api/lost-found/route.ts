import { NextRequest, NextResponse } from "next/server";
import { callGas } from "@/lib/gas";
import { publicMessage } from "@/lib/publicMessage";
import { toPublicLostFound } from "@/lib/publicProjection";
import { stripPublicReports } from "@/lib/stripPublic";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import { listPublicLostFound } from "@/lib/ticketsDb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const lfType = req.nextUrl.searchParams.get("lfType") || "";
    const building = req.nextUrl.searchParams.get("building") || "";

    // Supabase เป็นแหล่งจริง — ว่างแล้วต้องว่าง ไม่ดึง Sheet เก่ามาโชว์
    if (isTicketsDbReady()) {
      try {
        let rows = await listPublicLostFound();
        if (lfType) rows = rows.filter((r) => r.lf_type === lfType);
        if (building) rows = rows.filter((r) => r.building === building);
        const reports = rows.map((row) => toPublicLostFound(row) as unknown as Record<string, unknown>);
        return NextResponse.json(
          { status: "success", reports, backend: "supabase" },
          { headers: { "Cache-Control": "no-store" } }
        );
      } catch (err) {
        console.error("lost-found supabase", err);
        return NextResponse.json(
          { status: "error", message: publicMessage(err, "โหลดกระดานของหายไม่สำเร็จ") },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // ไม่มี Supabase เท่านั้นถึงใช้ GAS
    try {
      const result = (await callGas({
        action: "getPublicLostFound",
        lfType,
        building
      })) as { status?: string; reports?: Record<string, unknown>[] };
      const reports = stripPublicReports(result.reports || []);
      return NextResponse.json(
        { status: "success", reports, backend: "gas" },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch (err) {
      console.error("lost-found gas", err);
      return NextResponse.json(
        { status: "error", message: publicMessage(err, "โหลดกระดานของหายไม่สำเร็จ") },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: publicMessage(err, "โหลดกระดานของหายไม่สำเร็จ") },
      { status: 500 }
    );
  }
}

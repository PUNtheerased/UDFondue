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
    let reports: Record<string, unknown>[] = [];
    let backend = "none";

    if (isTicketsDbReady()) {
      try {
        let rows = await listPublicLostFound();
        if (lfType) rows = rows.filter((r) => r.lf_type === lfType);
        if (building) rows = rows.filter((r) => r.building === building);
        reports = rows.map((row) => toPublicLostFound(row) as unknown as Record<string, unknown>);
        backend = "supabase";
        return NextResponse.json(
          { status: "success", reports, backend },
          { headers: { "Cache-Control": "no-store" } }
        );
      } catch (err) {
        console.error("lost-found supabase", err);
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
        return NextResponse.json(
          { status: "error", message: publicMessage(err, "โหลดกระดานของหายไม่สำเร็จ") },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { status: "success", reports, backend },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: publicMessage(err, "โหลดกระดานของหายไม่สำเร็จ") },
      { status: 500 }
    );
  }
}

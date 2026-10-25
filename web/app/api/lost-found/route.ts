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

    if (isTicketsDbReady()) {
      let rows = await listPublicLostFound();
      if (lfType) rows = rows.filter((r) => r.lf_type === lfType);
      if (building) rows = rows.filter((r) => r.building === building);
      const reports = stripPublicReports(
        rows.map((r) => rowToPublic(r) as unknown as Record<string, unknown>)
      );
      return NextResponse.json({ status: "success", reports });
    }

    const result = (await callGas({
      action: "getPublicLostFound",
      lfType,
      building
    })) as { status?: string; reports?: Record<string, unknown>[] };
    return NextResponse.json({
      ...result,
      reports: stripPublicReports(result.reports || [])
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lost-found fetch failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

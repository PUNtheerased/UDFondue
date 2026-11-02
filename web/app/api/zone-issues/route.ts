import { NextRequest, NextResponse } from "next/server";
import { callGas } from "@/lib/gas";
import { publicMessage } from "@/lib/publicMessage";
import { toZoneIssuePublic, zoneIssueFromUnknown } from "@/lib/publicProjection";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import { listZoneIssues } from "@/lib/ticketsDb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const building = (req.nextUrl.searchParams.get("building") || "").trim().slice(0, 80);
    const zone = (req.nextUrl.searchParams.get("zone") || "").trim().slice(0, 40);
    if (!building || !zone) {
      return NextResponse.json({ status: "success", reports: [] });
    }

    if (isTicketsDbReady()) {
      const rows = await listZoneIssues(building, zone);
      return NextResponse.json({
        status: "success",
        reports: rows.map((row) => toZoneIssuePublic(row))
      });
    }

    const result = (await callGas({
      action: "getZoneActiveIssues",
      building,
      zone
    })) as { status?: string; reports?: Record<string, unknown>[] };
    const reports = Array.isArray(result.reports) ? result.reports.map((row) => zoneIssueFromUnknown(row)) : [];
    return NextResponse.json({ status: "success", reports });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: publicMessage(err, "โหลดเรื่องในจุดนี้ไม่สำเร็จ") },
      { status: 500 }
    );
  }
}

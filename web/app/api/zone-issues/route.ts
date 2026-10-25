import { NextRequest, NextResponse } from "next/server";
import { callGas } from "@/lib/gas";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import { listZoneIssues, rowToPublic } from "@/lib/ticketsDb";

export async function GET(req: NextRequest) {
  try {
    const building = req.nextUrl.searchParams.get("building") || "";
    const zone = req.nextUrl.searchParams.get("zone") || "";
    if (!building || !zone) {
      return NextResponse.json({ status: "success", reports: [] });
    }

    if (isTicketsDbReady()) {
      const rows = await listZoneIssues(building, zone);
      return NextResponse.json({
        status: "success",
        reports: rows.map((r) => rowToPublic(r))
      });
    }

    const result = await callGas({
      action: "getZoneActiveIssues",
      building,
      zone
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Zone issues failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

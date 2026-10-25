import { NextRequest, NextResponse } from "next/server";
import { callGas } from "@/lib/gas";

export async function GET(req: NextRequest) {
  try {
    const building = req.nextUrl.searchParams.get("building") || "";
    const zone = req.nextUrl.searchParams.get("zone") || "";
    if (!building || !zone) {
      return NextResponse.json({ status: "success", reports: [] });
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

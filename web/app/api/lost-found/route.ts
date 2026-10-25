import { NextRequest, NextResponse } from "next/server";
import { callGas } from "@/lib/gas";

export const revalidate = 60;

export async function GET(req: NextRequest) {
  try {
    const lfType = req.nextUrl.searchParams.get("lfType") || "";
    const building = req.nextUrl.searchParams.get("building") || "";
    const result = await callGas({
      action: "getPublicLostFound",
      lfType,
      building
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lost-found fetch failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

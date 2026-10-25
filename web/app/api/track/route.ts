import { NextRequest, NextResponse } from "next/server";
import { callGas } from "@/lib/gas";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "trackPublicDetail";

    if (action === "trackList") {
      const result = await callGas({
        action: "trackList",
        lineId: body.lineId
      });
      return NextResponse.json(result);
    }

    if (action === "trackDetail") {
      const result = await callGas({
        action: "trackDetail",
        lineId: body.lineId,
        submitId: body.submitId
      });
      return NextResponse.json(result);
    }

    if (action === "trackLookup") {
      const result = await callGas({
        action: "trackLookup",
        submitId: body.submitId
      });
      return NextResponse.json(result);
    }

    const result = await callGas({
      action: "trackPublicDetail",
      submitId: body.submitId,
      trackToken: body.trackToken
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Track failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { callGas } from "@/lib/gas";
import { stripPublicReport, stripPublicReports } from "@/lib/stripPublic";

type GasTrack = {
  status?: string;
  message?: string;
  report?: Record<string, unknown>;
  reports?: Record<string, unknown>[];
  [key: string]: unknown;
};

function sanitizeTrackResult(result: GasTrack, listOwned = false) {
  if (result.report) {
    const safe = stripPublicReport(result.report);
    // Owner list may keep trackToken for deep links only in trackList response
    if (!listOwned) delete safe.trackToken;
    result = { ...result, report: safe };
  }
  if (result.reports) {
    result = {
      ...result,
      reports: listOwned
        ? result.reports.map((r) => {
            const safe = stripPublicReport(r);
            // keep trackToken for "เรื่องของฉัน" deep links
            if (r.trackToken) safe.trackToken = r.trackToken;
            return safe;
          })
        : stripPublicReports(result.reports)
    };
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "trackPublicDetail";

    if (action === "trackList") {
      const result = (await callGas({
        action: "trackList",
        lineId: body.lineId
      })) as GasTrack;
      return NextResponse.json(sanitizeTrackResult(result, true));
    }

    if (action === "trackDetail") {
      const result = (await callGas({
        action: "trackDetail",
        lineId: body.lineId,
        submitId: body.submitId
      })) as GasTrack;
      return NextResponse.json(sanitizeTrackResult(result, true));
    }

    if (action === "trackLookup") {
      const result = (await callGas({
        action: "trackLookup",
        submitId: body.submitId
      })) as GasTrack;
      return NextResponse.json(sanitizeTrackResult(result, false));
    }

    const result = (await callGas({
      action: "trackPublicDetail",
      submitId: body.submitId,
      trackToken: body.trackToken
    })) as GasTrack;
    return NextResponse.json(sanitizeTrackResult(result, false));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Track failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

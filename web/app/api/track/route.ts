import { NextRequest, NextResponse } from "next/server";
import { callGas } from "@/lib/gas";
import { verifyLineIdToken } from "@/lib/lineAuth";
import { isProdRuntime } from "@/lib/runtime";
import { stripPublicReport, stripPublicReports } from "@/lib/stripPublic";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import {
  getActiveHandoff,
  getHandoffForUser,
  getHistory,
  getTicketBySubmitId,
  handoffToPublic,
  listTicketsByLineId,
  rowToPublic
} from "@/lib/ticketsDb";

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
    if (!listOwned) delete safe.trackToken;
    result = { ...result, report: safe };
  }
  if (result.reports) {
    result = {
      ...result,
      reports: listOwned
        ? result.reports.map((r) => {
            const safe = stripPublicReport(r);
            if (r.trackToken) safe.trackToken = r.trackToken;
            return safe;
          })
        : stripPublicReports(result.reports)
    };
  }
  return result;
}

function normSubmitId(raw: unknown) {
  return String(raw || "").trim().toUpperCase();
}

async function enrichReport(submitId: string, lineId?: string, full = false) {
  const row = await getTicketBySubmitId(submitId);
  if (!row || row.merged_to_id) return null;
  const history = await getHistory(submitId);
  const handoff = await getActiveHandoff(submitId);
  const pub = rowToPublic(row, { includeSecrets: full });
  pub.statusHistory = history;
  if (handoff) pub.handoff = handoffToPublic(handoff, lineId);
  if (!full) {
    delete pub.trackToken;
    delete pub.lineId;
    delete pub.lfSecretDetail;
    delete pub.studentNo;
  }
  return pub;
}

async function resolveViewerLineId(body: Record<string, unknown>) {
  if (body.idToken) {
    const auth = await verifyLineIdToken(String(body.idToken));
    if (!auth.ok) return { ok: false as const, message: auth.message };
    return { ok: true as const, lineId: auth.sub };
  }
  if (!isProdRuntime() && body.lineId) {
    return { ok: true as const, lineId: String(body.lineId) };
  }
  return { ok: false as const, message: "เข้าสู่ระบบ LINE ก่อน" };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "trackPublicDetail";

    if (isTicketsDbReady()) {
      if (action === "trackList") {
        const viewer = await resolveViewerLineId(body);
        if (!viewer.ok) {
          return NextResponse.json({ status: "error", message: viewer.message }, { status: 401 });
        }
        const lineId = viewer.lineId;
        const rows = await listTicketsByLineId(lineId);
        const reports = [];
        for (const row of rows) {
          const pub = rowToPublic(row, { includeSecrets: true });
          pub.statusHistory = await getHistory(row.submit_id);
          const handoff = await getActiveHandoff(row.submit_id);
          if (handoff) pub.handoff = handoffToPublic(handoff, lineId);
          const safe = stripPublicReport({ ...pub } as Record<string, unknown>);
          safe.trackToken = row.track_token;
          reports.push(safe);
        }
        return NextResponse.json({ status: "success", reports });
      }

      if (action === "trackDetail") {
        const viewer = await resolveViewerLineId(body);
        if (!viewer.ok) {
          return NextResponse.json({ status: "error", message: viewer.message }, { status: 401 });
        }
        const lineId = viewer.lineId;
        const submitId = normSubmitId(body.submitId);
        const row = await getTicketBySubmitId(submitId);
        if (!row || row.line_id !== lineId) {
          return NextResponse.json({ status: "error", message: "ไม่พบเรื่องนี้" }, { status: 404 });
        }
        const report = await enrichReport(submitId, lineId, true);
        const safe = stripPublicReport({ ...report } as Record<string, unknown>);
        safe.trackToken = row.track_token;
        return NextResponse.json({ status: "success", report: safe });
      }

      if (action === "trackLookup") {
        const submitId = normSubmitId(body.submitId);
        const row = await getTicketBySubmitId(submitId);
        if (!row || row.merged_to_id) {
          return NextResponse.json({ status: "error", message: "ไม่พบเลขที่แจ้งนี้" }, { status: 404 });
        }
        if (body.idToken) {
          const auth = await verifyLineIdToken(String(body.idToken));
          if (auth.ok && auth.sub === row.line_id) {
            const report = await enrichReport(submitId, auth.sub, true);
            const safe = stripPublicReport({ ...report } as Record<string, unknown>);
            safe.trackToken = row.track_token;
            return NextResponse.json({ status: "success", report: safe });
          }
        }
        return NextResponse.json({
          status: "success",
          report: {
            submitId: row.submit_id,
            status: row.status,
            category: row.category,
            date: row.date_th,
            time: row.time_th,
            building: row.building,
            zone: row.zone,
            isPublicSummary: true
          }
        });
      }

      // trackPublicDetail
      const submitId = normSubmitId(body.submitId);
      const trackToken = String(body.trackToken || "");
      const row = await getTicketBySubmitId(submitId);
      if (!row || row.merged_to_id) {
        return NextResponse.json({ status: "error", message: "ไม่พบเลขที่แจ้งนี้" }, { status: 404 });
      }

      let viewerLineId = "";
      let isOwner = false;
      if (body.idToken) {
        const auth = await verifyLineIdToken(String(body.idToken));
        if (auth.ok) {
          viewerLineId = auth.sub;
          isOwner = auth.sub === row.line_id;
        }
      }
      const tokenOk = !!trackToken && trackToken === row.track_token;
      const full = tokenOk || isOwner;
      if (tokenOk && !viewerLineId) viewerLineId = row.line_id;

      if (!full) {
        const handoff =
          (viewerLineId && (await getHandoffForUser(submitId, viewerLineId))) ||
          (await getActiveHandoff(submitId));
        const isParty =
          !!viewerLineId &&
          handoff &&
          (handoff.claimant_line_id === viewerLineId || handoff.holder_line_id === viewerLineId);
        return NextResponse.json({
          status: "success",
          report: {
            submitId: row.submit_id,
            status: row.status,
            category: row.category,
            lfType: row.lf_type,
            date: row.date_th,
            time: row.time_th,
            building: row.building,
            zone: row.zone,
            // ไม่ส่ง studentNote ในสรุปสาธารณะ
            isPublicSummary: !isParty,
            detail: isParty ? row.detail : undefined,
            studentNote: isParty ? row.student_note : undefined,
            handoff: handoff && viewerLineId ? handoffToPublic(handoff, viewerLineId) : null
          }
        });
      }
      const report = await enrichReport(submitId, viewerLineId || row.line_id, true);
      return NextResponse.json({
        status: "success",
        report: stripPublicReport(report as unknown as Record<string, unknown>)
      });
    }

    // Production: ไม่มี Supabase SoT — ปิด GAS track ที่เชื่อ lineId ดิบ
    if (isProdRuntime()) {
      return NextResponse.json(
        {
          status: "error",
          message: "ระบบติดตามยังไม่พร้อม (ต้องตั้ง SUPABASE_SERVICE_ROLE)",
          code: "TRACK_DB_REQUIRED"
        },
        { status: 503 }
      );
    }

    // Dev fallback เท่านั้น — ต้องมี idToken ก่อนส่ง lineId
    if (action === "trackList" || action === "trackDetail") {
      const viewer = await resolveViewerLineId(body);
      if (!viewer.ok) {
        return NextResponse.json({ status: "error", message: viewer.message }, { status: 401 });
      }
      const result = (await callGas({
        action,
        lineId: viewer.lineId,
        submitId: normSubmitId(body.submitId)
      })) as GasTrack;
      return NextResponse.json(sanitizeTrackResult(result, true));
    }

    if (action === "trackLookup") {
      const result = (await callGas({
        action: "trackLookup",
        submitId: normSubmitId(body.submitId)
      })) as GasTrack;
      return NextResponse.json(sanitizeTrackResult(result, false));
    }

    const result = (await callGas({
      action: "trackPublicDetail",
      submitId: normSubmitId(body.submitId),
      trackToken: body.trackToken
    })) as GasTrack;
    return NextResponse.json(sanitizeTrackResult(result, false));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Track failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

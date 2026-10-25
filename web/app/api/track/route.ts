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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || "trackPublicDetail";

    if (isTicketsDbReady()) {
      if (action === "trackList") {
        let lineId = "";
        if (body.idToken) {
          const auth = await verifyLineIdToken(String(body.idToken));
          if (!auth.ok) {
            return NextResponse.json({ status: "error", message: auth.message }, { status: 401 });
          }
          lineId = auth.sub;
        } else if (!isProdRuntime() && body.lineId) {
          lineId = String(body.lineId);
        }
        if (!lineId) {
          return NextResponse.json(
            { status: "error", message: "เข้าสู่ระบบ LINE ก่อนเพื่อดูเรื่องของตัวเอง" },
            { status: 401 }
          );
        }
        const rows = await listTicketsByLineId(lineId);
        const reports = [];
        for (const row of rows) {
          const pub = rowToPublic(row, { includeSecrets: true });
          pub.statusHistory = await getHistory(row.submit_id);
          const handoff = await getActiveHandoff(row.submit_id);
          if (handoff) pub.handoff = handoffToPublic(handoff, lineId);
          const safe = stripPublicReport({ ...pub } as Record<string, unknown>);
          // เจ้าของเรื่องเก็บ token ไว้เปิดดูละเอียดจากลิงก์
          safe.trackToken = row.track_token;
          reports.push(safe);
        }
        return NextResponse.json({ status: "success", reports });
      }

      if (action === "trackDetail") {
        let lineId = "";
        if (body.idToken) {
          const auth = await verifyLineIdToken(String(body.idToken));
          if (!auth.ok) {
            return NextResponse.json({ status: "error", message: auth.message }, { status: 401 });
          }
          lineId = auth.sub;
        } else if (!isProdRuntime() && body.lineId) {
          lineId = String(body.lineId);
        }
        const submitId = String(body.submitId || "");
        const row = await getTicketBySubmitId(submitId);
        if (!lineId || !row || row.line_id !== lineId) {
          return NextResponse.json({ status: "error", message: "ไม่พบเรื่องนี้" }, { status: 404 });
        }
        const report = await enrichReport(submitId, lineId, true);
        const safe = stripPublicReport({ ...report } as Record<string, unknown>);
        safe.trackToken = row.track_token;
        return NextResponse.json({ status: "success", report: safe });
      }

      if (action === "trackLookup") {
        const submitId = String(body.submitId || "").trim().toUpperCase();
        const row = await getTicketBySubmitId(submitId);
        if (!row || row.merged_to_id) {
          return NextResponse.json({ status: "error", message: "ไม่พบเลขที่แจ้งนี้" }, { status: 404 });
        }
        // ถ้าล็อกอิน LINE และเป็นเจ้าของเรื่อง — ส่งรายละเอียดเต็มเลย
        if (body.idToken) {
          const auth = await verifyLineIdToken(String(body.idToken));
          if (auth.ok && auth.sub === row.line_id) {
            const report = await enrichReport(submitId, auth.sub, true);
            const safe = stripPublicReport({ ...report } as Record<string, unknown>);
            safe.trackToken = row.track_token;
            return NextResponse.json({ status: "success", report: safe });
          }
        }
        const summary = {
          submitId: row.submit_id,
          status: row.status,
          category: row.category,
          date: row.date_th,
          time: row.time_th,
          building: row.building,
          zone: row.zone,
          isPublicSummary: true
        };
        return NextResponse.json({ status: "success", report: summary });
      }

      // trackPublicDetail — เต็มเมื่อมี trackToken ถูกต้อง หรือเป็นเจ้าของที่ล็อกอิน LINE
      const submitId = String(body.submitId || "");
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
            studentNote: row.student_note,
            isPublicSummary: !isParty,
            detail: isParty ? row.detail : undefined,
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

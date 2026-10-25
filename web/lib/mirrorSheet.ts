import { callGas } from "@/lib/gas";
import type { TicketRow } from "@/lib/ticketTypes";
import { getHistory, getTicketBySubmitId } from "@/lib/ticketsDb";

/** ส่งแถว tickets ไปอัปเดต Sheets (best-effort) */
export async function mirrorTicketToSheet(submitId: string, row?: TicketRow | null) {
  try {
    const ticket = row || (await getTicketBySubmitId(submitId));
    if (!ticket) return { ok: false as const, message: "ไม่พบเรื่อง" };

    let statusHistory = "";
    try {
      const history = await getHistory(submitId);
      statusHistory = JSON.stringify(
        history.map((h) => ({ status: h.status, at: h.at, by: h.by || "" }))
      );
    } catch {
      /* ignore */
    }

    await callGas({
      action: "mirrorUpdate",
      submitId: ticket.submit_id,
      lineId: ticket.line_id,
      name: ticket.name,
      room: ticket.room,
      studentNo: ticket.student_no,
      category: ticket.category,
      detail: ticket.detail,
      imageUrls: String(ticket.image_url || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      imageCount: ticket.image_count,
      isAnonymous: ticket.is_anonymous,
      contactOptional: ticket.contact_optional,
      building: ticket.building,
      zone: ticket.zone,
      locationNote: ticket.location_note,
      gpsLat: ticket.gps_lat,
      gpsLng: ticket.gps_lng,
      lfType: ticket.lf_type,
      lfWhen: ticket.lf_when,
      lfReturnPoint: ticket.lf_return_point,
      lfSecretDetail: ticket.lf_secret_detail,
      isPublicShowcase: ticket.is_public_showcase,
      trackToken: ticket.track_token,
      upvoteCount: ticket.upvote_count,
      upvotedLineIds: ticket.upvoted_line_ids,
      mergedToId: ticket.merged_to_id,
      assignedGroup: ticket.assigned_group,
      assignedTo: ticket.assigned_to,
      status: ticket.status,
      studentNote: ticket.student_note,
      adminNote: ticket.admin_note,
      afterImageUrl: ticket.after_image_url,
      afterImageCount: ticket.after_image_count,
      statusHistory,
      imageStorage: ticket.image_storage || "supabase",
      dateTh: ticket.date_th,
      timeTh: ticket.time_th
    });
    return { ok: true as const };
  } catch (err) {
    console.error("mirrorTicketToSheet", submitId, err);
    return {
      ok: false as const,
      message: err instanceof Error ? err.message : "mirror failed"
    };
  }
}

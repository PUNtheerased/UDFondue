import type { TicketRow } from "./ticketTypes";

export type ZoneIssuePublic = {
  submitId: string;
  category: string;
  detail: string;
  status: string;
  building: string;
  zone: string;
  upvoteCount: number;
  date: string;
  time: string;
};

/** Public "me too" card. Identity, photos, notes, and exact location text stay off this payload. */
export function toZoneIssuePublic(row: TicketRow): ZoneIssuePublic {
  return {
    submitId: clip(row.submit_id, 20),
    category: clip(row.category, 80),
    detail: clip(collapse(row.detail), 120),
    status: clip(row.status, 40),
    building: clip(row.building, 80),
    zone: clip(row.zone, 40),
    upvoteCount: Number(row.upvote_count) || 0,
    date: clip(row.date_th, 40),
    time: clip(row.time_th, 40)
  };
}

/** Drop any extra keys a fallback backend might attach. */
export function zoneIssueFromUnknown(raw: Record<string, unknown>): ZoneIssuePublic {
  return {
    submitId: clip(raw.submitId, 20),
    category: clip(raw.category, 80),
    detail: clip(raw.detail, 120),
    status: clip(raw.status, 40),
    building: clip(raw.building, 80),
    zone: clip(raw.zone, 40),
    upvoteCount: Number(raw.upvoteCount) || 0,
    date: clip(raw.date, 40),
    time: clip(raw.time, 40)
  };
}

/** Lost & found board: item photo and description, never the reporter's name or private notes. */
export function toPublicLostFound(row: TicketRow) {
  return {
    submitId: row.submit_id,
    category: clip(row.category, 80),
    detail: clip(row.detail, 200),
    status: row.status,
    building: row.building,
    zone: row.zone,
    lfType: row.lf_type,
    lfWhen: row.lf_when,
    lfReturnPoint: row.lf_return_point,
    imageUrl: row.image_url,
    date: row.date_th,
    time: row.time_th,
    name: row.is_anonymous ? "ไม่ประสงค์ออกนาม" : "ผู้แจ้ง"
  };
}

function collapse(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function clip(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

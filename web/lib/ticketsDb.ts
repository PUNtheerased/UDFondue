import crypto from "crypto";
import { getSupabaseAdmin, isTicketsDbReady } from "@/lib/supabaseAdmin";
import {
  HANDOFF_CODE_TTL_MS,
  HANDOFF_MAX_ATTEMPTS,
  HandoffPublic,
  HandoffRow,
  TicketPublic,
  TicketRow
} from "@/lib/ticketTypes";

function thParts(d = new Date()) {
  const date = d.toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok" });
  const time = d.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour12: false });
  return { date, time };
}

export function resolveAssignedGroup(category: string) {
  const cat = String(category || "");
  if (cat.startsWith("ตามหาของหาย") || cat.startsWith("พบของ") || cat.includes("ของหาย")) {
    return "LOST_FOUND";
  }
  if (cat.startsWith("เสนอความคิดเห็น")) return "COUNCIL";
  if (cat.startsWith("ปัญหา")) return "FACILITY";
  return "GENERAL";
}

export function newTrackToken() {
  return crypto.randomBytes(16).toString("hex");
}

export function hashPickupCode(code: string, submitId: string) {
  const salt = process.env.ADMIN_SESSION_SECRET || "udfondue-handoff";
  return crypto.createHash("sha256").update(`${salt}:${submitId}:${code}`).digest("hex");
}

export function generatePickupCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function rowToPublic(row: TicketRow, opts?: { includeSecrets?: boolean }): TicketPublic {
  const out: TicketPublic = {
    submitId: row.submit_id,
    status: row.status,
    category: row.category,
    detail: row.detail,
    name: row.is_anonymous ? "ไม่ประสงค์ออกนาม" : row.name,
    room: row.is_anonymous ? "" : row.room,
    building: row.building,
    zone: row.zone,
    locationNote: row.location_note,
    date: row.date_th,
    time: row.time_th,
    upvoteCount: row.upvote_count,
    studentNote: row.student_note,
    adminNote: row.student_note || row.admin_note,
    lfType: row.lf_type,
    lfWhen: row.lf_when,
    lfReturnPoint: row.lf_return_point,
    isAnonymous: row.is_anonymous,
    isPublicShowcase: row.is_public_showcase,
    imageUrl: row.image_url,
    afterImageUrl: row.after_image_url,
    mergedToId: row.merged_to_id || undefined,
    assignedGroup: row.assigned_group,
    assignedTo: row.assigned_to,
    urgency: row.urgency,
    statusUpdated: row.status_updated || undefined
  };
  if (opts?.includeSecrets) {
    out.lineId = row.line_id;
    out.studentNo = row.student_no;
    out.lfSecretDetail = row.lf_secret_detail;
    out.trackToken = row.track_token;
    out.adminNote = row.admin_note;
    out.studentNote = row.student_note;
    out.contactOptional = row.contact_optional || undefined;
    out.gpsLat = row.gps_lat || undefined;
    out.gpsLng = row.gps_lng || undefined;
  }
  return out;
}

export async function appendHistory(
  submitId: string,
  status: string,
  byRole: string,
  note = ""
) {
  const sb = getSupabaseAdmin();
  await sb.from("ticket_status_history").insert({
    submit_id: submitId,
    status,
    by_role: byRole,
    note
  });
}

export async function getHistory(submitId: string) {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("ticket_status_history")
    .select("status, note, by_role, at")
    .eq("submit_id", submitId)
    .order("at", { ascending: true });
  return (data || []).map((h) => ({
    status: h.status as string,
    at: h.at as string,
    note: (h.note as string) || undefined,
    by: (h.by_role as string) || undefined
  }));
}

export type CreateTicketInput = {
  submitId: string;
  lineId: string;
  name: string;
  room: string;
  studentNo: string;
  category: string;
  detail: string;
  imageUrls: string[];
  isAnonymous: boolean;
  contactOptional: string;
  building: string;
  zone: string;
  locationNote: string;
  gpsLat: string;
  gpsLng: string;
  lfType: string;
  lfWhen: string;
  lfReturnPoint: string;
  lfSecretDetail: string;
  isPublicShowcase: boolean;
  urgency?: string;
};

export async function createTicket(input: CreateTicketInput) {
  if (!isTicketsDbReady()) throw new Error("Tickets DB not ready");
  const sb = getSupabaseAdmin();
  const trackToken = newTrackToken();
  const { date, time } = thParts();
  const assignedGroup = resolveAssignedGroup(input.category);
  const isLf =
    !!input.lfType ||
    input.category.startsWith("ตามหาของหาย") ||
    input.category.includes("ของหาย");
  const showcase =
    input.isPublicShowcase === true ||
    (isLf && input.isPublicShowcase !== false);

  const row: Partial<TicketRow> = {
    submit_id: input.submitId,
    line_id: input.lineId,
    name: input.name,
    room: input.room,
    student_no: input.studentNo,
    category: input.category,
    detail: input.detail,
    image_count: input.imageUrls.length,
    image_url: input.imageUrls.join("\n"),
    status: "รับเรื่องแล้ว",
    admin_note: "",
    student_note: "",
    status_updated: new Date().toISOString(),
    is_anonymous: input.isAnonymous,
    contact_optional: input.contactOptional,
    building: input.building,
    zone: input.zone,
    location_note: input.locationNote,
    gps_lat: input.gpsLat,
    gps_lng: input.gpsLng,
    lf_type: input.lfType,
    lf_when: input.lfWhen,
    lf_return_point: input.lfReturnPoint,
    lf_secret_detail: input.lfSecretDetail,
    is_public_showcase: showcase,
    track_token: trackToken,
    upvote_count: 0,
    upvoted_line_ids: "",
    merged_to_id: "",
    assigned_group: assignedGroup,
    assigned_to: "",
    urgency: input.urgency || "ปกติ",
    after_image_count: 0,
    after_image_url: "",
    image_storage: input.imageUrls.length ? "supabase" : "",
    date_th: date,
    time_th: time
  };

  const { data, error } = await sb.from("tickets").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  await appendHistory(input.submitId, "รับเรื่องแล้ว", "system");
  return { row: data as TicketRow, trackToken, assignedGroup };
}

export async function getTicketBySubmitId(submitId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("tickets").select("*").eq("submit_id", submitId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TicketRow) || null;
}

export async function listTicketsByLineId(lineId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("tickets")
    .select("*")
    .eq("line_id", lineId)
    .eq("merged_to_id", "")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data || []) as TicketRow[];
}

export async function listPublicLostFound() {
  const sb = getSupabaseAdmin();
  const closed = new Set(["เสร็จสิ้น", "ปิดเรื่อง", "REJECTED_MODERATION"]);
  const { data, error } = await sb
    .from("tickets")
    .select("*")
    .eq("is_public_showcase", true)
    .order("created_at", { ascending: false })
    .limit(150);
  if (error) throw new Error(error.message);
  return ((data || []) as TicketRow[]).filter((r) => {
    if (closed.has(r.status)) return false;
    if (r.merged_to_id) return false;
    const isLf =
      !!r.lf_type ||
      String(r.category || "").includes("ของหาย") ||
      String(r.category || "").startsWith("ตามหาของหาย");
    return isLf;
  });
}

export async function listAdminTickets(opts?: { filterStatus?: string; search?: string }) {
  const sb = getSupabaseAdmin();
  let q = sb.from("tickets").select("*").eq("merged_to_id", "").order("created_at", { ascending: false }).limit(300);
  if (opts?.filterStatus) q = q.eq("status", opts.filterStatus);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = (data || []) as TicketRow[];
  const search = (opts?.search || "").trim().toLowerCase();
  if (search) {
    rows = rows.filter((r) =>
      [r.submit_id, r.detail, r.category, r.name, r.building, r.zone, r.lf_secret_detail]
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }
  return rows;
}

export async function updateTicketStatus(opts: {
  submitId: string;
  status?: string;
  studentNote?: string;
  adminNote?: string;
  afterImageUrls?: string[];
  assignedTo?: string;
  isPublicShowcase?: boolean;
  byRole: string;
}) {
  const sb = getSupabaseAdmin();
  const existing = await getTicketBySubmitId(opts.submitId);
  if (!existing) throw new Error("ไม่พบเลขที่แจ้ง");

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    status_updated: new Date().toISOString()
  };
  if (opts.status) patch.status = opts.status;
  if (opts.studentNote !== undefined) {
    patch.student_note = opts.studentNote;
    patch.admin_note = opts.studentNote;
  } else if (opts.adminNote !== undefined) {
    patch.admin_note = opts.adminNote;
    patch.student_note = opts.adminNote;
  }
  if (opts.afterImageUrls) {
    patch.after_image_url = opts.afterImageUrls.join("\n");
    patch.after_image_count = opts.afterImageUrls.length;
  }
  if (opts.assignedTo !== undefined) patch.assigned_to = opts.assignedTo;
  if (opts.isPublicShowcase !== undefined) patch.is_public_showcase = opts.isPublicShowcase;

  const closed = opts.status === "เสร็จสิ้น" || opts.status === "ปิดเรื่อง" || opts.status === "REJECTED_MODERATION";
  if (closed) patch.is_public_showcase = false;

  const { data, error } = await sb.from("tickets").update(patch).eq("submit_id", opts.submitId).select("*").single();
  if (error) throw new Error(error.message);

  if (opts.status && opts.status !== existing.status) {
    await appendHistory(opts.submitId, opts.status, opts.byRole, opts.studentNote || opts.adminNote || "");
  } else if (opts.studentNote || opts.adminNote) {
    await appendHistory(opts.submitId, existing.status, opts.byRole, opts.studentNote || opts.adminNote || "");
  }

  return data as TicketRow;
}

export async function hideTicket(submitId: string, byRole: string) {
  return updateTicketStatus({
    submitId,
    status: "REJECTED_MODERATION",
    isPublicShowcase: false,
    byRole
  });
}

export async function mergeTickets(intoId: string, fromIds: string[], byRole: string) {
  const sb = getSupabaseAdmin();
  const into = await getTicketBySubmitId(intoId);
  if (!into) throw new Error("ไม่พบเคสปลายทาง");
  let upvote = into.upvote_count || 0;
  for (const id of fromIds) {
    if (!id || id === intoId) continue;
    const from = await getTicketBySubmitId(id);
    if (!from) continue;
    upvote += from.upvote_count || 0;
    await sb
      .from("tickets")
      .update({
        merged_to_id: intoId,
        is_public_showcase: false,
        status: "ปิดเรื่อง",
        updated_at: new Date().toISOString()
      })
      .eq("submit_id", id);
    await appendHistory(id, "ปิดเรื่อง", byRole, `รวมเข้า ${intoId}`);
  }
  await sb.from("tickets").update({ upvote_count: upvote, updated_at: new Date().toISOString() }).eq("submit_id", intoId);
  await appendHistory(intoId, into.status, byRole, `รวมเคส: ${fromIds.join(", ")}`);
  return getTicketBySubmitId(intoId);
}

export async function getActiveHandoff(foundSubmitId: string) {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("lf_handoffs")
    .select("*")
    .eq("found_submit_id", foundSubmitId)
    .in("status", ["claimed", "code_active", "locked"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as HandoffRow) || null;
}

/** รวม expired — สำหรับสร้างรหัสใหม่หลังหมดอายุ */
export async function getHandoffForCodeCreate(foundSubmitId: string) {
  const active = await getActiveHandoff(foundSubmitId);
  if (active) return active;
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("lf_handoffs")
    .select("*")
    .eq("found_submit_id", foundSubmitId)
    .eq("status", "expired")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as HandoffRow) || null;
}

export async function getHandoffForUser(foundSubmitId: string, lineId: string) {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("lf_handoffs")
    .select("*")
    .eq("found_submit_id", foundSubmitId)
    .or(`claimant_line_id.eq.${lineId},holder_line_id.eq.${lineId}`)
    .in("status", ["claimed", "code_active", "locked", "expired"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as HandoffRow) || null;
}

export function handoffToPublic(h: HandoffRow, lineId?: string): HandoffPublic {
  const isClaimant = !!lineId && h.claimant_line_id === lineId;
  const isHolder = !!lineId && h.holder_line_id === lineId;
  return {
    id: h.id,
    foundSubmitId: h.found_submit_id,
    status: h.status,
    attemptCount: h.attempt_count,
    maxAttempts: HANDOFF_MAX_ATTEMPTS,
    codeExpiresAt: h.code_expires_at,
    isClaimant,
    isHolder,
    canCreateCode: isHolder && (h.status === "claimed" || h.status === "locked" || h.status === "expired"),
    canConfirm: isClaimant && h.status === "code_active"
  };
}

export async function claimFoundItem(foundSubmitId: string, claimantLineId: string) {
  const ticket = await getTicketBySubmitId(foundSubmitId);
  if (!ticket) throw new Error("ไม่พบรายการ");
  if (ticket.lf_type !== "แจ้งพบของหาย") throw new Error("เคลมได้เฉพาะรายการพบของ");
  if (!ticket.is_public_showcase) throw new Error("รายการนี้ไม่เปิดรับเคลมแล้ว");
  if (ticket.line_id === claimantLineId) throw new Error("ไม่สามารถเคลมของที่ตัวเองแจ้งพบได้");

  const active = await getActiveHandoff(foundSubmitId);
  if (active && active.claimant_line_id !== claimantLineId) {
    throw new Error("มีคนเคลมรายการนี้อยู่แล้ว");
  }
  if (active && active.claimant_line_id === claimantLineId) {
    return active;
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("lf_handoffs")
    .insert({
      found_submit_id: foundSubmitId,
      claimant_line_id: claimantLineId,
      holder_line_id: ticket.line_id,
      status: "claimed"
    })
    .select("*")
    .single();
  if (error) {
    // unique partial index / (found, claimant) — มีคนเคลมอยู่แล้ว
    if (error.code === "23505") {
      throw new Error("มีคนเคลมรายการนี้อยู่แล้ว");
    }
    throw new Error(error.message);
  }

  await updateTicketStatus({
    submitId: foundSubmitId,
    status: "กำลังดำเนินการ",
    byRole: "student"
  });

  return data as HandoffRow;
}

export async function createHandoffCode(foundSubmitId: string, holderLineId: string) {
  const ticket = await getTicketBySubmitId(foundSubmitId);
  if (!ticket) throw new Error("ไม่พบรายการ");
  if (ticket.line_id !== holderLineId) throw new Error("เฉพาะผู้ถือของสร้างรหัสได้");

  let handoff = await getHandoffForCodeCreate(foundSubmitId);
  if (!handoff) throw new Error("ยังไม่มีคนเคลม — รอเจ้าของกดนี่ของฉันก่อน");
  if (handoff.holder_line_id !== holderLineId) throw new Error("ไม่มีสิทธิ์สร้างรหัส");
  // ห้ามทับรหัสที่ยังใช้งานอยู่ — เฉพาะ claimed / locked / expired
  if (handoff.status === "code_active") {
    if (handoff.code_expires_at && Date.now() > new Date(handoff.code_expires_at).getTime()) {
      const sbExp = getSupabaseAdmin();
      await sbExp
        .from("lf_handoffs")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", handoff.id);
      handoff = { ...handoff, status: "expired" };
    } else {
      throw new Error("มีรหัสใช้อยู่แล้ว — รอหมดอายุหรือให้อีกฝั่งใส่รหัสก่อน");
    }
  }
  if (!["claimed", "locked", "expired"].includes(handoff.status)) {
    throw new Error("สถานะนี้สร้างรหัสไม่ได้");
  }

  const code = generatePickupCode();
  const codeHash = hashPickupCode(code, foundSubmitId);
  const expires = new Date(Date.now() + HANDOFF_CODE_TTL_MS).toISOString();
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("lf_handoffs")
    .update({
      status: "code_active",
      code_hash: codeHash,
      code_expires_at: expires,
      attempt_count: 0,
      locked_at: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", handoff.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { handoff: data as HandoffRow, code, expiresAt: expires };
}

export async function confirmHandoffCode(foundSubmitId: string, claimantLineId: string, code: string) {
  const handoff = await getActiveHandoff(foundSubmitId);
  if (!handoff) throw new Error("ไม่พบการเคลม");
  if (handoff.claimant_line_id !== claimantLineId) throw new Error("เฉพาะผู้เคลมใส่รหัสได้");
  if (handoff.status === "locked") throw new Error("รหัสถูกล็อกแล้ว ให้ฝั่งผู้ถือของสร้างรหัสใหม่");
  if (handoff.status !== "code_active") throw new Error("ยังไม่มีรหัสใช้งาน — ให้ฝั่งผู้ถือของสร้างก่อน");
  if (handoff.code_expires_at && Date.now() > new Date(handoff.code_expires_at).getTime()) {
    const sb = getSupabaseAdmin();
    await sb.from("lf_handoffs").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", handoff.id);
    throw new Error("รหัสหมดอายุแล้ว ให้ฝั่งผู้ถือของสร้างใหม่");
  }

  const sb = getSupabaseAdmin();
  const ok = hashPickupCode(String(code).trim(), foundSubmitId) === handoff.code_hash;
  if (!ok) {
    const attempts = (handoff.attempt_count || 0) + 1;
    const locked = attempts >= HANDOFF_MAX_ATTEMPTS;
    await sb
      .from("lf_handoffs")
      .update({
        attempt_count: attempts,
        status: locked ? "locked" : "code_active",
        locked_at: locked ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq("id", handoff.id);
    if (locked) throw new Error("ใส่ผิดครบ 3 ครั้งแล้ว — ให้ฝั่งผู้ถือของสร้างรหัสใหม่");
    throw new Error(`รหัสไม่ถูกต้อง เหลืออีก ${HANDOFF_MAX_ATTEMPTS - attempts} ครั้ง`);
  }

  await sb
    .from("lf_handoffs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", handoff.id);

  await updateTicketStatus({
    submitId: foundSubmitId,
    status: "เสร็จสิ้น",
    isPublicShowcase: false,
    studentNote: "รับของเรียบร้อยแล้ว",
    byRole: "handoff"
  });

  return getTicketBySubmitId(foundSubmitId);
}

export async function cancelHandoff(foundSubmitId: string, lineId: string, force = false) {
  const handoff = await getActiveHandoff(foundSubmitId);
  if (!handoff) throw new Error("ไม่พบการเคลม");
  if (!force && handoff.claimant_line_id !== lineId && handoff.holder_line_id !== lineId) {
    throw new Error("ไม่มีสิทธิ์ยกเลิก");
  }
  const sb = getSupabaseAdmin();
  await sb
    .from("lf_handoffs")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", handoff.id);
  await updateTicketStatus({
    submitId: foundSubmitId,
    status: "รับเรื่องแล้ว",
    byRole: force ? "teacher" : "student"
  });
}

export async function unlockHandoff(foundSubmitId: string) {
  const handoff = await getActiveHandoff(foundSubmitId);
  if (!handoff) throw new Error("ไม่พบการเคลม");
  const sb = getSupabaseAdmin();
  await sb
    .from("lf_handoffs")
    .update({
      status: "claimed",
      code_hash: "",
      code_expires_at: null,
      attempt_count: 0,
      locked_at: null,
      updated_at: new Date().toISOString()
    })
    .eq("id", handoff.id);
}

export async function getSiteSettings() {
  if (!isTicketsDbReady()) return {} as Record<string, string>;
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("site_settings").select("key, value");
  const out: Record<string, string> = {};
  for (const row of data || []) out[row.key as string] = row.value as string;
  return out;
}

export async function setSiteSetting(key: string, value: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("site_settings").upsert({
    key,
    value,
    updated_at: new Date().toISOString()
  });
  if (error) throw new Error(error.message);
}

export async function listZoneIssues(building: string, zone: string) {
  const sb = getSupabaseAdmin();
  const closed = new Set(["เสร็จสิ้น", "ปิดเรื่อง", "REJECTED_MODERATION"]);
  const { data, error } = await sb
    .from("tickets")
    .select("*")
    .eq("building", building)
    .eq("zone", zone)
    .eq("merged_to_id", "")
    .like("category", "ปัญหา%")
    .order("upvote_count", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return ((data || []) as TicketRow[]).filter((r) => !closed.has(r.status)).slice(0, 20);
}

export async function upvoteTicket(submitId: string, lineId: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc("upvote_ticket", {
    p_submit_id: submitId,
    p_line_id: lineId
  });
  if (error) {
    // ยังไม่รัน upvote-rpc.sql — fallback แบบเดิม (อาจแข่งกันเสียคะแนน)
    if (error.message?.includes("upvote_ticket") || error.code === "PGRST202") {
      const ticket = await getTicketBySubmitId(submitId);
      if (!ticket) throw new Error("ไม่พบเรื่อง");
      const voters = String(ticket.upvoted_line_ids || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (voters.includes(lineId)) {
        return { upvoteCount: ticket.upvote_count, already: true };
      }
      voters.push(lineId);
      const { error: upErr } = await sb
        .from("tickets")
        .update({
          upvote_count: voters.length,
          upvoted_line_ids: voters.join(","),
          updated_at: new Date().toISOString()
        })
        .eq("submit_id", submitId);
      if (upErr) throw new Error(upErr.message);
      return { upvoteCount: voters.length, already: false };
    }
    throw new Error(error.message);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    upvoteCount: Number(row?.upvote_count ?? 0),
    already: !!row?.already
  };
}

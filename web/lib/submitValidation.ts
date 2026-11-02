import crypto from "crypto";

export const SUBMIT_ID_RE = /^UDF-[A-Z0-9]{8}$/;

const LIMITS = {
  category: 80,
  otherCategory: 80,
  detail: 4000,
  name: 80,
  room: 32,
  studentNo: 16,
  contactOptional: 160,
  building: 80,
  zone: 40,
  locationNote: 200,
  gps: 32,
  lfType: 40,
  lfWhen: 40,
  lfReturnPoint: 80,
  lfSecretDetail: 500
} as const;

export type SubmitFields = {
  submitId: string;
  category: string;
  otherCategory: string;
  detail: string;
  name: string;
  room: string;
  studentNo: string;
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
  urgency: string;
  isAnonymous: boolean;
  isPublicShowcase: boolean;
};

export function generateSubmitId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = crypto.randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[bytes[i] % chars.length];
  return `UDF-${code}`;
}

export function isValidSubmitId(id: string) {
  return SUBMIT_ID_RE.test(id);
}

export function parseSubmitBody(body: unknown): { ok: true; value: SubmitFields } | { ok: false; message: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "ข้อมูลที่ส่งมาไม่ถูกต้อง" };
  }
  const src = body as Record<string, unknown>;

  const rawId = readString(src.submitId, 32);
  if (!rawId.ok) return rawId;
  let submitId = rawId.value.trim().toUpperCase();
  if (!submitId) submitId = generateSubmitId();
  if (!isValidSubmitId(submitId)) {
    return { ok: false, message: "เลขที่แจ้งไม่ถูกต้อง" };
  }

  const categoryRaw = readString(src.category, LIMITS.category);
  if (!categoryRaw.ok) return categoryRaw;
  const other = readString(src.otherCategory, LIMITS.otherCategory);
  if (!other.ok) return other;
  let category = categoryRaw.value.trim();
  if (!category) return { ok: false, message: "เลือกประเภทเรื่องก่อน" };
  if (category === "other" || category === "อื่นๆ") {
    const custom = other.value.trim();
    if (!custom) return { ok: false, message: "พิมพ์หัวข้ออื่นๆ ก่อน" };
    category = `อื่นๆ: ${custom}`.slice(0, 120);
  }

  const detail = readString(src.detail, LIMITS.detail);
  if (!detail.ok) return detail;
  if (!detail.value.trim()) return { ok: false, message: "กรอกรายละเอียดก่อนส่ง" };

  const fields = {
    name: readString(src.name, LIMITS.name),
    room: readString(src.room, LIMITS.room),
    studentNo: readString(src.studentNo, LIMITS.studentNo),
    contactOptional: readString(src.contactOptional, LIMITS.contactOptional),
    building: readString(src.building, LIMITS.building),
    zone: readString(src.zone, LIMITS.zone),
    locationNote: readString(src.locationNote, LIMITS.locationNote),
    gpsLat: readString(src.gpsLat, LIMITS.gps),
    gpsLng: readString(src.gpsLng, LIMITS.gps),
    lfType: readString(src.lfType, LIMITS.lfType),
    lfWhen: readString(src.lfWhen, LIMITS.lfWhen),
    lfReturnPoint: readString(src.lfReturnPoint, LIMITS.lfReturnPoint),
    lfSecretDetail: readString(src.lfSecretDetail, LIMITS.lfSecretDetail)
  };
  for (const parsed of Object.values(fields)) {
    if (!parsed.ok) return parsed;
  }
  const okFields = fields as { [K in keyof typeof fields]: { ok: true; value: string } };

  const urgencyRaw = readString(src.urgency, 20);
  if (!urgencyRaw.ok) return urgencyRaw;
  const urgency = urgencyRaw.value.trim() === "เร่งด่วน" ? "เร่งด่วน" : "ปกติ";

  return {
    ok: true,
    value: {
      submitId,
      category,
      otherCategory: other.value.trim(),
      detail: detail.value.trim(),
      name: okFields.name.value.trim(),
      room: okFields.room.value.trim(),
      studentNo: okFields.studentNo.value.trim(),
      contactOptional: okFields.contactOptional.value.trim(),
      building: okFields.building.value.trim(),
      zone: okFields.zone.value.trim(),
      locationNote: okFields.locationNote.value.trim(),
      gpsLat: okFields.gpsLat.value.trim(),
      gpsLng: okFields.gpsLng.value.trim(),
      lfType: okFields.lfType.value.trim(),
      lfWhen: okFields.lfWhen.value.trim(),
      lfReturnPoint: okFields.lfReturnPoint.value.trim(),
      lfSecretDetail: okFields.lfSecretDetail.value.trim(),
      urgency,
      isAnonymous: asBool(src.isAnonymous),
      isPublicShowcase: src.isPublicShowcase !== false && src.isPublicShowcase !== "false"
    }
  };
}

function readString(
  value: unknown,
  max: number
): { ok: true; value: string } | { ok: false; message: string } {
  if (value == null) return { ok: true, value: "" };
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
    return { ok: false, message: "รูปแบบข้อมูลไม่ถูกต้อง" };
  }
  const text = String(value);
  if (text.length > max) {
    return { ok: false, message: `ข้อความยาวเกิน ${max} ตัวอักษร` };
  }
  return { ok: true, value: text };
}

function asBool(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

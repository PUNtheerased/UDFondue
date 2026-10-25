/** Strip secrets before returning public track / lost-found payloads. */
const SECRET_KEYS = [
  "lineId",
  "lfSecretDetail",
  "contactOptional",
  "upvotedLineIds",
  "trackToken",
  "debug",
  "gpsLat",
  "gpsLng",
  "studentNo"
];

export function stripPublicReport<T extends Record<string, unknown>>(report: T): T {
  const out = { ...report } as Record<string, unknown>;
  for (const key of SECRET_KEYS) {
    delete out[key];
  }
  if (out.isPublicSummary) {
    delete out.detail;
    delete out.imageUrl;
    delete out.afterImageUrl;
    delete out.adminNote;
    delete out.name;
    delete out.room;
    delete out.locationNote;
  } else if (out.isAnonymous) {
    out.name = "ไม่ประสงค์ออกนาม";
    out.room = "";
    delete out.studentNo;
  }
  return out as T;
}

export function stripPublicReports<T extends Record<string, unknown>>(reports: T[]): T[] {
  return (reports || []).map((r) => stripPublicReport(r));
}

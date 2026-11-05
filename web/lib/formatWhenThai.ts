/** แปลงวันเวลาให้อ่านง่ายสำหรับครู/นักเรียน เช่น "5 พ.ย. 2569 เวลา 16:45" */

const TH_MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค."
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatParts(day: number, monthIndex: number, yearCE: number, hour?: number, minute?: number) {
  const be = yearCE > 2400 ? yearCE : yearCE + 543;
  const datePart = `${day} ${TH_MONTHS_SHORT[monthIndex]} ${be}`;
  if (hour == null || Number.isNaN(hour)) return datePart;
  const m = minute == null || Number.isNaN(minute) ? 0 : minute;
  return `${datePart} เวลา ${pad2(hour)}:${pad2(m)} น.`;
}

/** datetime-local / ISO แบบไม่มีโซน: 2026-11-05T16:45 หรือ 2026-11-05 16:45:00 */
function parseIsoLocal(raw: string) {
  const m = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (!m) return null;
  return {
    year: Number(m[1]),
    monthIndex: Number(m[2]) - 1,
    day: Number(m[3]),
    hour: m[4] != null ? Number(m[4]) : undefined,
    minute: m[5] != null ? Number(m[5]) : undefined
  };
}

/** รูปแบบไทยสั้น ๆ: 5/11/2569 หรือ 5/11/2569 18:45:36 */
function parseThaiSlash(raw: string) {
  const m = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (!m) return null;
  const year = Number(m[3]);
  return {
    year: year > 2400 ? year - 543 : year,
    monthIndex: Number(m[2]) - 1,
    day: Number(m[1]),
    hour: m[4] != null ? Number(m[4]) : undefined,
    minute: m[5] != null ? Number(m[5]) : undefined
  };
}

export function formatWhenThai(raw?: string | null, fallbackDate?: string, fallbackTime?: string) {
  const primary = String(raw || "").trim();
  const stamp = primary || `${fallbackDate || ""} ${fallbackTime || ""}`.trim();
  if (!stamp) return "";

  const parsed = parseIsoLocal(stamp) || parseThaiSlash(stamp);
  if (parsed && parsed.monthIndex >= 0 && parsed.monthIndex < 12) {
    return formatParts(parsed.day, parsed.monthIndex, parsed.year, parsed.hour, parsed.minute);
  }

  // ถ้ามี date + time แยกกัน แต่รวมแล้ว parse ไม่ได้ ลองแยก parse
  if (fallbackDate || fallbackTime) {
    const d = parseThaiSlash(String(fallbackDate || "").trim()) || parseIsoLocal(String(fallbackDate || "").trim());
    const t = String(fallbackTime || "").trim().match(/^(\d{1,2}):(\d{2})/);
    if (d) {
      return formatParts(
        d.day,
        d.monthIndex,
        d.year,
        t ? Number(t[1]) : d.hour,
        t ? Number(t[2]) : d.minute
      );
    }
  }

  return stamp;
}

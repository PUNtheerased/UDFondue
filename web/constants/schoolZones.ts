export type ZoneOption = { building: string; zones: string[] };

export type BuildingGroup = { label: string; buildings: string[] };

/** จัดกลุ่มตามแผนที่โรงเรียนอุดมดรุณี — ยุบห้องย่อยเข้าอาคารหลัก */
export const BUILDING_GROUPS: BuildingGroup[] = [
  {
    label: "อาคารเรียนหลัก",
    buildings: [
      "อาคาร 1 สัตบุตย์",
      "อาคาร 2 พุทธรักษา",
      "อาคาร 3 ปาริชาติ",
      "อาคาร 4 ราชพฤกษ์",
      "อาคาร 5 อุดมวิทย์",
      "อาคารปัญญาพัฒน์",
      "อาคารศิลปศึกษา",
      "อาคารการงานอาชีพฯ / พฤกษศาสตร์"
    ]
  },
  {
    label: "อาคารกิจกรรม บริการ และส่วนกลาง",
    // เรียงจุดที่มักแจ้งปัญหาก่อน
    buildings: [
      "โรงอาหาร",
      "อาคารเอนกประสงค์ (โดม)",
      "หอประชุมนพมาศ",
      "หอสมุดดิจิทัล",
      "อาคารพยาบาล",
      "อาคารจิตเมตตา ดาวนภา",
      "อาคารประชาสัมพันธ์",
      "ศาลา 80 ปี"
    ]
  },
  {
    label: "พื้นที่กลางแจ้งและสิ่งอำนวยความสะดวก",
    buildings: [
      "สนามกีฬา / ลู่วิ่ง",
      "โซนห้องน้ำนักเรียน",
      "ลานพิชญ์ภิรมย์",
      "สวนป่า",
      "ลานอนุสาวรีย์องค์แม่นพมาศ",
      "อื่นๆ (ระบุในรายละเอียด)"
    ]
  }
];

/** อาคารเรียนหลัก 1–5 มี 4 ชั้น */
export const MAIN_BUILDING_FLOORS = ["ชั้น 1", "ชั้น 2", "ชั้น 3", "ชั้น 4"];

export const OTHER_PLACE_FLOOR = "อื่นๆ";

export const SCHOOL_BUILDINGS = BUILDING_GROUPS.flatMap((g) => g.buildings);

/** อาคาร 1–5 เท่านั้นที่ใช้เลือกชั้น 1–4 */
export function isMainClassroomBuilding(building: string) {
  return /^อาคาร [1-5]\b/.test(building || "");
}

export function floorsForBuilding(building: string) {
  if (isMainClassroomBuilding(building)) return [...MAIN_BUILDING_FLOORS];
  return [OTHER_PLACE_FLOOR];
}

/** ใช้กับ logic เดิมที่อิง building + zones */
export const SCHOOL_ZONES: ZoneOption[] = SCHOOL_BUILDINGS.map((building) => ({
  building,
  zones: floorsForBuilding(building)
}));

/** จุดรับคืน — ใช้กับแจ้งพบของหายเท่านั้น */
export const LF_RETURN_POINTS = [
  "ห้องสภานักเรียน",
  "ห้องประชาสัมพันธ์",
  "ถือไว้เอง",
  "อื่นๆ"
];

export const CATEGORIES = [
  { value: "ปัญหาที่พบ", label: "ปัญหาที่พบ" },
  { value: "ตามหาของหาย", label: "ตามหาของหาย" },
  { value: "เสนอความคิดเห็นต่อสภานักเรียน", label: "เสนอความคิดเห็นต่อสภานักเรียน" },
  { value: "อื่นๆ", label: "อื่นๆ — ระบุหัวข้อเอง" }
];

export const STATUS_OPTIONS = [
  "รับเรื่องแล้ว",
  "กำลังดำเนินการ",
  "รอข้อมูลเพิ่ม",
  "เสร็จสิ้น",
  "ปิดเรื่อง",
  "REJECTED_MODERATION"
];

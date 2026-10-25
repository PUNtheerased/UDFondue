const BLOCKLIST = [
  "ควย",
  "เหี้ย",
  "สัส",
  "หี",
  "เย็ด",
  "fuck",
  "shit",
  "บ้าเอ้ย"
];

export function containsProfanity(text: string) {
  const lower = String(text || "").toLowerCase();
  return BLOCKLIST.some((word) => lower.includes(word.toLowerCase()));
}

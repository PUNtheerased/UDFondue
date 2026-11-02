const BLOCKLIST = [
  "ควย",
  "เหี้ย",
  "สัส",
  "หี",
  "เย็ด",
  "fuck",
  "shit",
  "bitch",
  "บ้าเอ้ย",
  "หน้าหี",
  "ไอ้สัตว์"
];

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "i",
  "+": "t"
};

/** Fold obfuscation (spaces, dots, leet, zero-width, repeated letters) before matching. */
export function normalizeForModeration(text: string) {
  let folded = "";
  const source = String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, "");
  for (const ch of source) folded += LEET[ch] ?? ch;
  folded = folded.replace(/[^0-9a-z\u0E00-\u0E7F]+/g, "");
  folded = folded.replace(/(.)\1{2,}/g, "$1$1");
  return folded;
}

export function containsProfanity(text: string) {
  const folded = normalizeForModeration(text);
  if (!folded) return false;
  return BLOCKLIST.some((word) => {
    const needle = normalizeForModeration(word);
    return !!needle && folded.includes(needle);
  });
}

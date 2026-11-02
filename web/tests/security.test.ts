import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getClientIp } from "../lib/clientIp";
import { sniffImage } from "../lib/imageSniff";
import { containsProfanity, normalizeForModeration } from "../lib/profanity";
import { isSafePublic } from "../lib/publicMessage";
import { toZoneIssuePublic, zoneIssueFromUnknown } from "../lib/publicProjection";
import { isRateLimited, rateLimit } from "../lib/rateLimit";
import { safeEqualString } from "../lib/safeEqual";
import { createAdminSessionToken, verifyAdminSessionToken } from "../lib/sessionToken";
import { isValidSubmitId, parseSubmitBody } from "../lib/submitValidation";
import type { TicketRow } from "../lib/ticketTypes";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("safeEqualString", () => {
  it("matches equal strings and rejects others", () => {
    assert.equal(safeEqualString("abc", "abc"), true);
    assert.equal(safeEqualString("abc", "abd"), false);
    assert.equal(safeEqualString("abc", "abcd"), false);
  });
});

describe("session tokens", () => {
  it("refuses the old dev-secret fallback and a short secret", () => {
    process.env.ADMIN_SESSION_SECRET = "dev-secret";
    assert.throws(() => createAdminSessionToken("pin:admin"));
    process.env.ADMIN_SESSION_SECRET = "short";
    assert.throws(() => createAdminSessionToken("pin:admin"));
    assert.equal(verifyAdminSessionToken("pin:admin.1.dead"), null);
  });

  it("round-trips a signed token and rejects tampering", () => {
    process.env.ADMIN_SESSION_SECRET = "test-secret-at-least-16";
    const token = createAdminSessionToken("pin:admin");
    assert.equal(verifyAdminSessionToken(token), "pin:admin");
    const [subject, exp, sig] = token.split(".");
    assert.equal(verifyAdminSessionToken(`${subject}.${exp}.${sig.slice(0, -1)}a`), null);
  });
});

describe("image sniff", () => {
  it("accepts jpeg png and webp magic bytes", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const webp = Buffer.from("RIFF0000WEBP", "ascii");
    assert.equal(sniffImage(jpeg)?.ext, "jpg");
    assert.equal(sniffImage(png)?.mime, "image/png");
    assert.equal(sniffImage(webp)?.mime, "image/webp");
  });

  it("rejects svg even when labeled as an image", () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    assert.equal(sniffImage(svg), null);
  });
});

describe("profanity", () => {
  it("catches spaced, dotted, leet, and zero-width bypasses", () => {
    assert.equal(containsProfanity("hello"), false);
    assert.equal(containsProfanity("ควย"), true);
    assert.equal(containsProfanity("ค.ว.ย"), true);
    assert.equal(containsProfanity("ค ว ย"), true);
    assert.equal(containsProfanity("sh1t"), true);
    assert.equal(containsProfanity("f.u.c.k"), true);
    assert.equal(containsProfanity("shi\u200bt"), true);
    assert.equal(normalizeForModeration("S H I T"), "shit");
  });
});

describe("submit validation", () => {
  it("rejects a client-supplied id that is not UDF-########", () => {
    const bad = parseSubmitBody({
      submitId: "'; drop table tickets;--",
      category: "ปัญหาที่พบ",
      detail: "น้ำรั่ว"
    });
    assert.equal(bad.ok, false);
    assert.equal(isValidSubmitId("UDF-AB12CD34"), true);
  });

  it("trims and caps fields and keeps a valid id", () => {
    const ok = parseSubmitBody({
      submitId: "udf-ab12cd34",
      category: "ปัญหาที่พบ",
      detail: "  น้ำรั่วที่อ่าง  ",
      urgency: "เร่งด่วน",
      detailExtra: { nope: true }
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.value.submitId, "UDF-AB12CD34");
      assert.equal(ok.value.detail, "น้ำรั่วที่อ่าง");
      assert.equal(ok.value.urgency, "เร่งด่วน");
    }
    const long = parseSubmitBody({
      category: "ปัญหาที่พบ",
      detail: "ก".repeat(4001)
    });
    assert.equal(long.ok, false);
  });
});

describe("zone issues", () => {
  it("drops name, room, photos, and admin notes", () => {
    const row = {
      submit_id: "UDF-AAAAAAAA",
      category: "ปัญหาที่พบ",
      detail: "ก๊อกน้ำรั่วหน้าห้อง",
      status: "รับเรื่องแล้ว",
      building: "อาคาร 1",
      zone: "ชั้น 2",
      upvote_count: 3,
      date_th: "2 พ.ย.",
      time_th: "10:00",
      name: "สมชาย",
      room: "5/6",
      is_anonymous: false,
      admin_note: "ซ่อมวันศุกร์",
      student_note: "รอช่าง",
      image_url: "https://example.com/a.jpg",
      line_id: "Usecret",
      track_token: "tok"
    } as TicketRow;
    const pub = toZoneIssuePublic(row);
    assert.deepEqual(Object.keys(pub).sort(), [
      "building",
      "category",
      "date",
      "detail",
      "status",
      "submitId",
      "time",
      "upvoteCount",
      "zone"
    ]);
    assert.equal(JSON.stringify(pub).includes("สมชาย"), false);
    assert.equal(JSON.stringify(pub).includes("ซ่อม"), false);
    const fromGas = zoneIssueFromUnknown({
      ...pub,
      name: "สมชาย",
      adminNote: "ลับ",
      imageUrl: "https://example.com/a.jpg"
    });
    assert.equal(JSON.stringify(fromGas).includes("สมชาย"), false);
    assert.equal(JSON.stringify(fromGas).includes("image"), false);
  });
});

describe("client ip", () => {
  it("prefers x-real-ip and otherwise the last forwarded address", () => {
    const spoofed = new Headers({
      "x-forwarded-for": "1.2.3.4, 5.6.7.8",
      "x-real-ip": "9.9.9.9"
    });
    assert.equal(getClientIp(spoofed), "9.9.9.9");
    const forwarded = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    assert.equal(getClientIp(forwarded), "5.6.7.8");
  });
});

describe("rate limit", () => {
  it("fails closed when Upstash is configured but unreachable", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    const original = global.fetch;
    global.fetch = (async () => {
      throw new Error("down");
    }) as typeof fetch;
    try {
      const result = await rateLimit(`test:${Math.random()}`, 5, 1000);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.reason, "unavailable");
      assert.equal(await isRateLimited(`peek:${Math.random()}`, 1), true);
    } finally {
      global.fetch = original;
    }
  });
});

describe("public errors", () => {
  it("keeps Thai business errors and hides driver errors", () => {
    assert.equal(isSafePublic("ไม่พบเลขที่แจ้ง"), true);
    assert.equal(isSafePublic("duplicate key value violates unique constraint"), false);
    assert.equal(isSafePublic("JWT expired"), false);
  });
});

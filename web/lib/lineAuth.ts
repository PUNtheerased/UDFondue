import { isProdRuntime } from "./runtime";

export async function verifyLineIdToken(idToken: string) {
  const channelId = process.env.LINE_CHANNEL_ID;
  if (!idToken) {
    return { ok: false as const, message: "ไม่พบการเข้าสู่ระบบ LINE กรุณาเปิดใหม่จากแอป LINE" };
  }

  // localhost / next dev: รับโทเค็นจำลอง แม้มี LINE_CHANNEL_ID ใน .env
  if (idToken.startsWith("dev:")) {
    if (!isProdRuntime()) {
      return {
        ok: true as const,
        sub: idToken.slice(4) || "U-TEST-USER-ID",
        name: "ผู้ใช้ทดสอบ"
      };
    }
    return { ok: false as const, message: "ไม่สามารถยืนยันตัวตนได้ กรุณาเปิดฟอร์มจากแอป LINE" };
  }

  if (!channelId) {
    return {
      ok: false as const,
      message: "ระบบยืนยันตัวตน LINE ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล"
    };
  }

  const body = new URLSearchParams();
  body.set("id_token", idToken);
  body.set("client_id", channelId);

  const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    // มักเกิดเมื่อ LINE_CHANNEL_ID ไม่ตรงกับ channel ของ LIFF หรือยังไม่เปิด openid
    return {
      ok: false as const,
      message:
        "ยืนยันตัวตน LINE ไม่ผ่าน — ตรวจว่า LIFF เปิด Scope openid และ LINE_CHANNEL_ID เป็น Channel ID ของบอทนี้ จากนั้นเปิดฟอร์มใหม่จาก LINE",
      detail: errText
    };
  }

  const data = (await res.json()) as { sub?: string; name?: string; exp?: number };
  if (!data.sub) {
    return { ok: false as const, message: "ไม่สามารถยืนยันตัวตน LINE ได้" };
  }

  return {
    ok: true as const,
    sub: data.sub,
    name: data.name || ""
  };
}

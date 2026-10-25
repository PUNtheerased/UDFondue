import { isProdRuntime } from "./runtime";

export async function verifyLineIdToken(idToken: string) {
  const channelId = process.env.LINE_CHANNEL_ID;
  if (!idToken) {
    return { ok: false as const, message: "ไม่พบการเข้าสู่ระบบ LINE กรุณาเปิดใหม่จากแอป LINE" };
  }

  if (!channelId) {
    if (!isProdRuntime() && idToken.startsWith("dev:")) {
      return {
        ok: true as const,
        sub: idToken.slice(4),
        name: "ผู้ใช้ทดสอบ"
      };
    }
    return {
      ok: false as const,
      message: "ระบบยืนยันตัวตน LINE ยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล"
    };
  }

  if (idToken.startsWith("dev:")) {
    return { ok: false as const, message: "ไม่สามารถยืนยันตัวตนได้ กรุณาเปิดฟอร์มจากแอป LINE" };
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
    return {
      ok: false as const,
      message: "เซสชัน LINE หมดอายุ กรุณาปิดหน้าต่างแล้วเปิดใหม่จากแอป LINE"
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

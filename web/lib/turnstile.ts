import { isProdRuntime } from "./runtime";

export async function verifyTurnstile(token: string, ip?: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (!isProdRuntime() && token === "dev-bypass") {
      return { ok: true as const };
    }
    return {
      ok: false as const,
      message: "ระบบยืนยันตัวตนยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล"
    };
  }

  if (!token || token === "dev-bypass") {
    return { ok: false as const, message: "กรุณายืนยันว่าคุณไม่ใช่บอท แล้วลองใหม่อีกครั้ง" };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body
  });
  const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
  if (!data.success) {
    return {
      ok: false as const,
      message: "การยืนยันไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      codes: data["error-codes"] || []
    };
  }
  return { ok: true as const };
}

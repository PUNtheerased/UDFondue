import { allowLocalLineBypass } from "@/lib/runtime";

type LiffLike = {
  init: (opts: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (opts?: { redirectUri?: string }) => void;
  getProfile: () => Promise<{ userId: string; displayName: string }>;
  getIDToken?: () => string | null;
};

function getLiff(): LiffLike | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { liff?: LiffLike }).liff;
}

/** รอ SDK จาก layout แล้ว init — คืน true ถ้าใช้ LIFF จริง */
export async function ensureLiff(liffId: string): Promise<{
  ok: boolean;
  bypass: boolean;
  message?: string;
  liff?: LiffLike;
}> {
  if (allowLocalLineBypass()) {
    return { ok: true, bypass: true };
  }

  const id = String(liffId || "").trim();
  if (!id) {
    return {
      ok: false,
      bypass: false,
      message: "ระบบยังไม่ได้ตั้งค่า LIFF — เปิดจากแอป LINE หรือติดต่อผู้ดูแล"
    };
  }

  for (let i = 0; i < 30; i++) {
    if (getLiff()) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  const liff = getLiff();
  if (!liff) {
    return {
      ok: false,
      bypass: false,
      message: "โหลด LINE ไม่สำเร็จ ลองรีเฟรชหน้า หรือเปิดจากแอป LINE"
    };
  }

  try {
    await liff.init({ liffId: id });
    return { ok: true, bypass: false, liff };
  } catch (err) {
    return {
      ok: false,
      bypass: false,
      message: err instanceof Error ? err.message : "เข้าสู่ระบบ LINE ไม่สำเร็จ"
    };
  }
}

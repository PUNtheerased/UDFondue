import { allowLocalLineBypass } from "@/lib/runtime";

type LiffLike = {
  init: (opts: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (opts?: { redirectUri?: string }) => void;
  getProfile: () => Promise<{ userId: string; displayName: string }>;
  getIDToken?: () => string | null;
};

type EnsureResult = {
  ok: boolean;
  bypass: boolean;
  message?: string;
  liff?: LiffLike;
};

const cache = new Map<string, Promise<EnsureResult>>();

function getLiff(): LiffLike | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { liff?: LiffLike }).liff;
}

/** รอ SDK จาก layout แล้ว init ครั้งเดียวต่อ liffId ในแท็บนี้ */
export async function ensureLiff(liffId: string): Promise<EnsureResult> {
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

  const existing = cache.get(id);
  if (existing) return existing;

  const pending = (async (): Promise<EnsureResult> => {
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
      const message = err instanceof Error ? err.message : "เข้าสู่ระบบ LINE ไม่สำเร็จ";
      // init ซ้ำหลังสำเร็จมัก error — ถ้า logged in แล้วถือว่าใช้ได้
      if (liff.isLoggedIn?.()) {
        return { ok: true, bypass: false, liff };
      }
      return { ok: false, bypass: false, message };
    }
  })();

  cache.set(id, pending);
  try {
    const result = await pending;
    if (!result.ok) cache.delete(id);
    return result;
  } catch (err) {
    cache.delete(id);
    throw err;
  }
}

import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, createAdminSessionToken, nimdaModeCookieName } from "@/lib/adminSession";
import { getAdminLineIds } from "@/lib/env";
import { verifyLineIdToken } from "@/lib/lineAuth";
import { callGas } from "@/lib/gas";
import { rateLimit } from "@/lib/rateLimit";

function setSessionCookies(res: NextResponse, subject: string) {
  res.cookies.set(adminCookieName(), createAdminSessionToken(subject), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60
  });
  res.cookies.set(nimdaModeCookieName(), "admin", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 8 * 60 * 60
  });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  try {
    const body = await req.json();
    const pin = String(body.password || body.pin || "");
    const idToken = String(body.idToken || "");
    const adminPin = process.env.ADMIN_PIN || "";
    const adminLineIds = getAdminLineIds();

    const guard = rateLimit(`admin-login-guard:${ip}`, 5, 15 * 60 * 1000);
    if (!guard.ok) {
      return NextResponse.json(
        {
          status: "error",
          message: "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่",
          code: "RATE_LIMIT"
        },
        { status: 429 }
      );
    }

    // LINE allowlist — ออก session ทันที ไม่พึ่ง GAS
    if (idToken) {
      const auth = await verifyLineIdToken(idToken);
      if (!auth.ok) {
        return NextResponse.json({ status: "error", message: auth.message }, { status: 403 });
      }
      if (adminLineIds.length === 0 || !adminLineIds.includes(auth.sub)) {
        return NextResponse.json({ status: "error", message: "ไม่มีสิทธิ์แอดมิน" }, { status: 403 });
      }
      const res = NextResponse.json({ status: "success", mode: "admin", via: "line" });
      setSessionCookies(res, `line:${auth.sub}`);
      return res;
    }

    // PIN — ยืนยันกับ GAS (Script Property ADMIN_PASSWORD) เมื่อมี GAS
    if (pin && adminPin && pin === adminPin) {
      try {
        const gas = await callGas<{ status: string; adminToken?: string; message?: string }>({
          action: "adminAuth",
          password: pin
        });
        if (gas.status === "success" && gas.adminToken) {
          const res = NextResponse.json({ status: "success", mode: "admin", via: "pin+gas" });
          setSessionCookies(res, `gas:${gas.adminToken}`);
          return res;
        }
      } catch (err) {
        console.error("adminAuth gas", err);
      }
      // GAS ไม่พร้อม แต่ PIN ตรง env — อนุญาต session ฝั่ง Next
      const res = NextResponse.json({ status: "success", mode: "admin", via: "pin" });
      setSessionCookies(res, `pin:admin`);
      return res;
    }

    return NextResponse.json({ status: "error", message: "รหัสผ่านไม่ถูกต้อง" }, { status: 403 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

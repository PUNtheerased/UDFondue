import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, createAdminSessionToken, nimdaModeCookieName } from "@/lib/adminSession";
import { getAdminLineIds } from "@/lib/env";
import { verifyLineIdToken } from "@/lib/lineAuth";
import { callGas } from "@/lib/gas";
import { rateLimit } from "@/lib/rateLimit";

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

    let authorized = false;

    if (idToken) {
      const auth = await verifyLineIdToken(idToken);
      if (!auth.ok) {
        return NextResponse.json({ status: "error", message: auth.message }, { status: 403 });
      }
      if (adminLineIds.length === 0 || !adminLineIds.includes(auth.sub)) {
        return NextResponse.json({ status: "error", message: "ไม่มีสิทธิ์แอดมิน" }, { status: 403 });
      }
      authorized = true;
    } else if (pin && adminPin && pin === adminPin) {
      authorized = true;
    }

    if (!authorized) {
      return NextResponse.json({ status: "error", message: "รหัสผ่านไม่ถูกต้อง" }, { status: 403 });
    }

    const gas = await callGas<{ status: string; adminToken?: string; message?: string }>({
      action: "adminAuth",
      password: pin || adminPin
    });
    if (gas.status !== "success" || !gas.adminToken) {
      return NextResponse.json({ status: "error", message: gas.message || "รหัสผ่านไม่ถูกต้อง" }, { status: 403 });
    }

    const token = createAdminSessionToken(`gas:${gas.adminToken}`);
    const res = NextResponse.json({ status: "success", mode: "admin" });
    res.cookies.set(adminCookieName(), token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 8 * 60 * 60
    });
    // ค่าเริ่มต้นหลังล็อกอิน = Admin
    res.cookies.set(nimdaModeCookieName(), "admin", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 8 * 60 * 60
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

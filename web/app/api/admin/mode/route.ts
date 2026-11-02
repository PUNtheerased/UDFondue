import { NextRequest, NextResponse } from "next/server";
import {
  getAdminSession,
  getNimdaMode,
  nimdaModeCookieName,
  type NimdaMode
} from "@/lib/adminSession";
import { getClientIp } from "@/lib/clientIp";
import { publicMessage } from "@/lib/publicMessage";
import { isRateLimited, rateLimit } from "@/lib/rateLimit";
import { safeEqualString } from "@/lib/safeEqual";

export async function GET() {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ status: "error", message: "เข้าสู่ระบบก่อน" }, { status: 401 });
  }
  return NextResponse.json({ status: "success", mode: getNimdaMode() });
}

export async function POST(req: NextRequest) {
  const session = getAdminSession();
  if (!session) {
    return NextResponse.json({ status: "error", message: "เข้าสู่ระบบก่อน" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const nextMode = String(body.mode || "admin") as NimdaMode;
    if (nextMode !== "admin" && nextMode !== "dev") {
      return NextResponse.json({ status: "error", message: "โหมดไม่ถูกต้อง" }, { status: 400 });
    }

    if (nextMode === "dev") {
      const pin = String(body.devPin || body.password || "");
      const expected = process.env.DEV_PIN || "";
      const ip = getClientIp(req.headers);
      const failKey = `admin-devpin-fail:${ip}`;
      if (await isRateLimited(failKey, 5)) {
        return NextResponse.json(
          { status: "error", message: "พยายามใส่รหัสบ่อยเกินไป กรุณารอสักครู่" },
          { status: 429 }
        );
      }
      if (!expected) {
        return NextResponse.json(
          { status: "error", message: "ยังไม่ได้ตั้ง DEV_PIN ใน environment" },
          { status: 503 }
        );
      }
      if (!safeEqualString(pin, expected)) {
        await rateLimit(failKey, 5, 15 * 60 * 1000);
        return NextResponse.json({ status: "error", message: "รหัส Dev ไม่ถูกต้อง" }, { status: 403 });
      }
    }

    const res = NextResponse.json({ status: "success", mode: nextMode });
    res.cookies.set(nimdaModeCookieName(), nextMode, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 8 * 60 * 60
    });
    return res;
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: publicMessage(err, "สลับโหมดไม่สำเร็จ") },
      { status: 500 }
    );
  }
}

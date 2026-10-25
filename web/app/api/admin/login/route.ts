import { NextRequest, NextResponse } from "next/server";
import { adminCookieName, createAdminSessionToken } from "@/lib/adminSession";
import { getAdminLineIds } from "@/lib/env";
import { verifyLineIdToken } from "@/lib/lineAuth";
import { callGas } from "@/lib/gas";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pin = String(body.password || body.pin || "");
    const idToken = String(body.idToken || "");
    const adminPin = process.env.ADMIN_PIN || "";
    const adminLineIds = getAdminLineIds();

    let subject = "";

    if (idToken) {
      const auth = await verifyLineIdToken(idToken);
      if (!auth.ok) {
        return NextResponse.json({ status: "error", message: auth.message }, { status: 403 });
      }
      if (adminLineIds.length === 0 || !adminLineIds.includes(auth.sub)) {
        return NextResponse.json({ status: "error", message: "ไม่มีสิทธิ์แอดมิน" }, { status: 403 });
      }
    } else if (!(pin && adminPin && pin === adminPin)) {
      return NextResponse.json({ status: "error", message: "รหัสผ่านไม่ถูกต้อง" }, { status: 403 });
    }

    // Always mint GAS admin token for sheet operations
    const gas = await callGas<{ status: string; adminToken?: string; message?: string }>({
      action: "adminAuth",
      password: pin || adminPin
    });
    if (gas.status !== "success" || !gas.adminToken) {
      return NextResponse.json({ status: "error", message: gas.message || "รหัสผ่านไม่ถูกต้อง" }, { status: 403 });
    }
    subject = `gas:${gas.adminToken}`;

    const token = createAdminSessionToken(subject);
    const res = NextResponse.json({ status: "success", subject });
    res.cookies.set(adminCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
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

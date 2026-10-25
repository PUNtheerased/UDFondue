import { NextRequest, NextResponse } from "next/server";
import { callGas } from "@/lib/gas";
import { verifyTurnstile } from "@/lib/turnstile";
import { verifyLineIdToken } from "@/lib/lineAuth";
import { rateLimit } from "@/lib/rateLimit";
import { containsProfanity } from "@/lib/profanity";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    const turnstile = await verifyTurnstile(String(body.turnstileToken || ""), ip);
    if (!turnstile.ok) {
      return NextResponse.json(
        { status: "error", message: turnstile.message, code: "TURNSTILE" },
        { status: 403 }
      );
    }

    const idToken = String(body.idToken || "");
    const lineAuth = await verifyLineIdToken(idToken);
    if (!lineAuth.ok) {
      return NextResponse.json(
        { status: "error", message: lineAuth.message, code: "LIFF_TOKEN" },
        { status: 403 }
      );
    }

    const rl = rateLimit(`submit:${ip}:${lineAuth.sub}`, 5, 10 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { status: "error", message: "ส่งบ่อยเกินไป กรุณารอสักครู่", code: "RATE_LIMIT" },
        { status: 429 }
      );
    }

    const detail = String(body.detail || "");
    const category = String(body.category || "");
    if (containsProfanity(detail) || containsProfanity(category) || containsProfanity(String(body.otherCategory || ""))) {
      return NextResponse.json(
        { status: "error", message: "พบข้อความไม่เหมาะสม กรุณาแก้ไขก่อนส่ง", code: "PROFANITY" },
        { status: 400 }
      );
    }

    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.map(String) : [];

    const result = await callGas({
      action: "submit",
      submitId: body.submitId,
      lineId: lineAuth.sub,
      name: body.isAnonymous ? "ไม่ประสงค์ออกนาม" : body.name || lineAuth.name || "ไม่ระบุชื่อ",
      room: body.isAnonymous ? "" : body.room || "",
      studentNo: body.isAnonymous ? "" : body.studentNo || "",
      category,
      otherCategory: body.otherCategory || "",
      detail,
      imageCount: imageUrls.length,
      imageUrls,
      isAnonymous: !!body.isAnonymous,
      contactOptional: body.contactOptional || "",
      building: body.building || "",
      zone: body.zone || "",
      locationNote: body.locationNote || "",
      gpsLat: body.gpsLat || "",
      gpsLng: body.gpsLng || "",
      lfType: body.lfType || "",
      lfWhen: body.lfWhen || "",
      lfReturnPoint: body.lfReturnPoint || "",
      lfSecretDetail: body.lfSecretDetail || "",
      isPublicShowcase: !!body.isPublicShowcase,
      imageStorage: "supabase"
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Submit failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

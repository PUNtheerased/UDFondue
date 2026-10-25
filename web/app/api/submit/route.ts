import { NextRequest, NextResponse } from "next/server";
import { callGas } from "@/lib/gas";
import { verifyTurnstile } from "@/lib/turnstile";
import { verifyLineIdToken } from "@/lib/lineAuth";
import { rateLimit } from "@/lib/rateLimit";
import { containsProfanity } from "@/lib/profanity";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import { createTicket } from "@/lib/ticketsDb";
import { notifyLine } from "@/lib/notifyLine";

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

    const rlIp = rateLimit(`submit:ip:${ip}`, 12, 10 * 60 * 1000);
    const rlLine = rateLimit(`submit:line:${lineAuth.sub}`, 5, 10 * 60 * 1000);
    if (!rlIp.ok || !rlLine.ok) {
      return NextResponse.json(
        { status: "error", message: "ส่งเรื่องบ่อยเกินไป รอสักครู่แล้วลองใหม่นะ", code: "RATE_LIMIT" },
        { status: 429 }
      );
    }

    let category = String(body.category || "");
    const detail = String(body.detail || "");
    if (category === "other" || category === "อื่นๆ") {
      category = "อื่นๆ: " + (body.otherCategory || "ไม่ระบุหัวข้อ");
    }
    if (containsProfanity(detail) || containsProfanity(category) || containsProfanity(String(body.otherCategory || ""))) {
      return NextResponse.json(
        {
          status: "error",
          message: "พบข้อความไม่เหมาะสม ลองแก้ถ้อยคำให้อ่านง่ายขึ้นก่อนส่งนะ",
          code: "PROFANITY"
        },
        { status: 400 }
      );
    }

    const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.map(String) : [];
    const submitId = String(body.submitId || "").trim();
    if (!submitId) {
      return NextResponse.json({ status: "error", message: "ไม่มีเลขที่แจ้ง" }, { status: 400 });
    }

    const name = body.isAnonymous ? "ไม่ประสงค์ออกนาม" : body.name || lineAuth.name || "ไม่ระบุชื่อ";
    const room = body.isAnonymous ? "" : body.room || "";
    const studentNo = body.isAnonymous ? "" : body.studentNo || "";

    if (isTicketsDbReady()) {
      const { trackToken, assignedGroup } = await createTicket({
        submitId,
        lineId: lineAuth.sub,
        name,
        room,
        studentNo,
        category,
        detail,
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
        isPublicShowcase: body.isPublicShowcase !== false,
        urgency: body.urgency || "ปกติ"
      });

      // Mirror ลง Sheets สำรอง (ไม่ยิง LINE ที่นี่)
      try {
        await callGas({
          action: "mirrorSubmit",
          submitId,
          lineId: lineAuth.sub,
          name,
          room,
          studentNo,
          category,
          detail,
          imageUrls,
          imageCount: imageUrls.length,
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
          isPublicShowcase: body.isPublicShowcase !== false,
          trackToken,
          assignedGroup,
          status: "รับเรื่องแล้ว",
          imageStorage: "supabase"
        });
      } catch (mirrorErr) {
        console.error("mirrorSubmit failed", mirrorErr);
      }

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
      await notifyLine({
        kind: "submit",
        lineId: lineAuth.sub,
        submitId,
        category,
        status: "รับเรื่องแล้ว",
        trackToken,
        assignedGroup,
        building: body.building || "",
        zone: body.zone || "",
        detail,
        trackUrl: `${siteUrl}/track/${encodeURIComponent(submitId)}?t=${trackToken}`
      });

      return NextResponse.json({
        status: "success",
        message: "บันทึกเรียบร้อย",
        submitId,
        trackToken,
        trackUrl: `/track/${encodeURIComponent(submitId)}?t=${trackToken}`
      });
    }

    // Fallback: Sheets via GAS
    const result = await callGas({
      action: "submit",
      submitId,
      lineId: lineAuth.sub,
      name,
      room,
      studentNo,
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

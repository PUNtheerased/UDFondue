import { NextRequest, NextResponse } from "next/server";
import { callGas } from "@/lib/gas";
import { verifyTurnstile } from "@/lib/turnstile";
import { verifyLineIdToken } from "@/lib/lineAuth";
import { getClientIp } from "@/lib/clientIp";
import { containsProfanity } from "@/lib/profanity";
import { publicMessage } from "@/lib/publicMessage";
import { rateLimit, rateLimitMessage, rateLimitStatus } from "@/lib/rateLimit";
import { parseSubmitBody } from "@/lib/submitValidation";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import { createTicket, getTicketBySubmitId } from "@/lib/ticketsDb";
import { notifyLine } from "@/lib/notifyLine";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = parseSubmitBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ status: "error", message: parsed.message }, { status: 400 });
    }
    const fields = parsed.value;
    const ip = getClientIp(req.headers);
    const source = (body || {}) as Record<string, unknown>;

    const turnstile = await verifyTurnstile(String(source.turnstileToken || ""), ip);
    if (!turnstile.ok) {
      return NextResponse.json(
        { status: "error", message: turnstile.message, code: "TURNSTILE" },
        { status: 403 }
      );
    }

    const idToken = String(source.idToken || "");
    const lineAuth = await verifyLineIdToken(idToken);
    if (!lineAuth.ok) {
      return NextResponse.json(
        { status: "error", message: lineAuth.message, code: "LIFF_TOKEN" },
        { status: 403 }
      );
    }

    const rlIp = await rateLimit(`submit:ip:${ip}`, 12, 10 * 60 * 1000);
    if (!rlIp.ok) {
      return NextResponse.json(
        {
          status: "error",
          message: rateLimitMessage(rlIp, "ส่งเรื่องบ่อยเกินไป รอสักครู่แล้วลองใหม่"),
          code: "RATE_LIMIT"
        },
        { status: rateLimitStatus(rlIp) }
      );
    }
    const rlLine = await rateLimit(`submit:line:${lineAuth.sub}`, 5, 10 * 60 * 1000);
    if (!rlLine.ok) {
      return NextResponse.json(
        {
          status: "error",
          message: rateLimitMessage(rlLine, "ส่งเรื่องบ่อยเกินไป รอสักครู่แล้วลองใหม่"),
          code: "RATE_LIMIT"
        },
        { status: rateLimitStatus(rlLine) }
      );
    }

    const textBlob = [
      fields.category,
      fields.otherCategory,
      fields.detail,
      fields.name,
      fields.room,
      fields.locationNote,
      fields.contactOptional,
      fields.lfSecretDetail,
      fields.lfReturnPoint
    ].join("\n");
    if (containsProfanity(textBlob)) {
      return NextResponse.json(
        {
          status: "error",
          message: "พบข้อความไม่เหมาะสม ลองแก้ถ้อยคำให้อ่านง่ายขึ้นก่อนส่ง",
          code: "PROFANITY"
        },
        { status: 400 }
      );
    }

    const rawImageUrls: string[] = Array.isArray(source.imageUrls)
      ? source.imageUrls.map((v: unknown) => String(v))
      : [];
    const supabaseBase = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
    const allowPrefix = supabaseBase
      ? `${supabaseBase}/storage/v1/object/public/udfondue-images/`
      : "";
    const imageUrls = rawImageUrls
      .map((u: string) => u.trim())
      .filter((u: string) => {
        if (!u || u.startsWith("blob:") || u.startsWith("data:")) return false;
        if (!allowPrefix) return false;
        return u.startsWith(allowPrefix) && !u.includes("..");
      })
      .slice(0, 5);

    const name = fields.isAnonymous ? "ไม่ประสงค์ออกนาม" : fields.name || lineAuth.name || "ไม่ระบุชื่อ";
    const room = fields.isAnonymous ? "" : fields.room;
    const studentNo = fields.isAnonymous ? "" : fields.studentNo;
    const submitId = fields.submitId;

    if (isTicketsDbReady()) {
      const existing = await getTicketBySubmitId(submitId);
      if (existing) {
        if (existing.line_id !== lineAuth.sub) {
          return NextResponse.json({ status: "error", message: "เลขที่แจ้งนี้ถูกใช้แล้ว" }, { status: 409 });
        }
        return NextResponse.json({
          status: "success",
          message: "บันทึกเรียบร้อย",
          submitId,
          trackToken: existing.track_token,
          trackUrl: `/track/${encodeURIComponent(submitId)}?t=${existing.track_token}`
        });
      }

      let created: Awaited<ReturnType<typeof createTicket>>;
      try {
        created = await createTicket({
          submitId,
          lineId: lineAuth.sub,
          name,
          room,
          studentNo,
          category: fields.category,
          detail: fields.detail,
          imageUrls,
          isAnonymous: fields.isAnonymous,
          contactOptional: fields.contactOptional,
          building: fields.building,
          zone: fields.zone,
          locationNote: fields.locationNote,
          gpsLat: fields.gpsLat,
          gpsLng: fields.gpsLng,
          lfType: fields.lfType,
          lfWhen: fields.lfWhen,
          lfReturnPoint: fields.lfReturnPoint,
          lfSecretDetail: fields.lfSecretDetail,
          isPublicShowcase: fields.isPublicShowcase,
          urgency: fields.urgency
        });
      } catch (err) {
        const again = await getTicketBySubmitId(submitId).catch(() => null);
        if (again && again.line_id === lineAuth.sub) {
          return NextResponse.json({
            status: "success",
            message: "บันทึกเรียบร้อย",
            submitId,
            trackToken: again.track_token,
            trackUrl: `/track/${encodeURIComponent(submitId)}?t=${again.track_token}`
          });
        }
        throw err;
      }
      const { trackToken, assignedGroup } = created;

      try {
        await callGas({
          action: "mirrorSubmit",
          submitId,
          lineId: lineAuth.sub,
          name,
          room,
          studentNo,
          category: fields.category,
          detail: fields.detail,
          imageUrls,
          imageCount: imageUrls.length,
          isAnonymous: fields.isAnonymous,
          contactOptional: fields.contactOptional,
          building: fields.building,
          zone: fields.zone,
          locationNote: fields.locationNote,
          gpsLat: fields.gpsLat,
          gpsLng: fields.gpsLng,
          lfType: fields.lfType,
          lfWhen: fields.lfWhen,
          lfReturnPoint: fields.lfReturnPoint,
          lfSecretDetail: fields.lfSecretDetail,
          isPublicShowcase: fields.isPublicShowcase,
          trackToken,
          assignedGroup,
          status: "รับเรื่องแล้ว",
          imageStorage: "supabase"
        });
      } catch (mirrorErr) {
        console.error("mirrorSubmit failed", mirrorErr);
      }

      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
      await notifyLine({
        kind: "submit",
        lineId: lineAuth.sub,
        submitId,
        category: fields.category,
        status: "รับเรื่องแล้ว",
        trackToken,
        assignedGroup,
        building: fields.building,
        zone: fields.zone,
        detail: fields.detail,
        trackUrl: `${siteUrl}/track/${encodeURIComponent(submitId)}`
      });

      return NextResponse.json({
        status: "success",
        message: "บันทึกเรียบร้อย",
        submitId,
        trackToken,
        trackUrl: `/track/${encodeURIComponent(submitId)}?t=${trackToken}`
      });
    }

    const result = await callGas({
      action: "submit",
      submitId,
      lineId: lineAuth.sub,
      name,
      room,
      studentNo,
      category: fields.category,
      detail: fields.detail,
      imageCount: imageUrls.length,
      imageUrls,
      isAnonymous: fields.isAnonymous,
      contactOptional: fields.contactOptional,
      building: fields.building,
      zone: fields.zone,
      locationNote: fields.locationNote,
      gpsLat: fields.gpsLat,
      gpsLng: fields.gpsLng,
      lfType: fields.lfType,
      lfWhen: fields.lfWhen,
      lfReturnPoint: fields.lfReturnPoint,
      lfSecretDetail: fields.lfSecretDetail,
      isPublicShowcase: fields.isPublicShowcase,
      imageStorage: "supabase"
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: publicMessage(err, "ส่งเรื่องไม่สำเร็จ กรุณาลองใหม่") },
      { status: 500 }
    );
  }
}

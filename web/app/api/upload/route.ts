import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminSession";
import { getClientIp } from "@/lib/clientIp";
import { sniffImage } from "@/lib/imageSniff";
import { verifyLineIdToken } from "@/lib/lineAuth";
import { publicMessage } from "@/lib/publicMessage";
import { rateLimit, rateLimitMessage, rateLimitStatus } from "@/lib/rateLimit";
import { getSupabaseAdmin, isTicketsDbReady } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const MAX_BYTES = 2.5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    if (!isTicketsDbReady()) {
      return NextResponse.json(
        { status: "error", message: "ระบบอัปโหลดยังไม่พร้อม (ต้องมี Supabase service role)" },
        { status: 503 }
      );
    }

    const ip = getClientIp(req.headers);
    const form = await req.formData();
    const file = form.get("file");
    const folderRaw = String(form.get("folder") || "tickets");
    const folder = folderRaw === "after" ? "after" : "tickets";
    const idToken = String(form.get("idToken") || "");

    let actor = "";
    const admin = getAdminSession();
    if (admin && folder === "after") {
      actor = `admin:${admin}`;
    } else {
      const auth = await verifyLineIdToken(idToken);
      if (!auth.ok) {
        return NextResponse.json({ status: "error", message: auth.message }, { status: 403 });
      }
      actor = auth.sub;
    }

    const rl = await rateLimit(`upload:${actor}:${ip}`, 30, 10 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        {
          status: "error",
          message: rateLimitMessage(rl, "อัปโหลดบ่อยเกินไป รอสักครู่"),
          code: "RATE_LIMIT"
        },
        { status: rateLimitStatus(rl) }
      );
    }

    if (!(file instanceof Blob) || file.size <= 0) {
      return NextResponse.json({ status: "error", message: "ไม่มีไฟล์" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ status: "error", message: "ไฟล์ใหญ่เกินไป" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sniffed = sniffImage(buffer);
    if (!sniffed) {
      return NextResponse.json(
        { status: "error", message: "อัปโหลดได้เฉพาะรูป jpg, png หรือ webp" },
        { status: 400 }
      );
    }

    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${sniffed.ext}`;

    const sb = getSupabaseAdmin();
    const { error } = await sb.storage.from("udfondue-images").upload(path, buffer, {
      cacheControl: "3600",
      upsert: false,
      contentType: sniffed.mime
    });
    if (error) {
      console.error("upload storage", error);
      return NextResponse.json({ status: "error", message: "อัปโหลดรูปไม่สำเร็จ" }, { status: 500 });
    }

    const { data } = sb.storage.from("udfondue-images").getPublicUrl(path);
    return NextResponse.json({ status: "success", url: data.publicUrl, path });
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: publicMessage(err, "อัปโหลดรูปไม่สำเร็จ") },
      { status: 500 }
    );
  }
}

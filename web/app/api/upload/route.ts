import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminSession";
import { verifyLineIdToken } from "@/lib/lineAuth";
import { rateLimit } from "@/lib/rateLimit";
import { getSupabaseAdmin, isTicketsDbReady } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const MAX_BYTES = 2.5 * 1024 * 1024; // หลัง compress ฝั่ง client โดยปกติเล็กกว่านี้

export async function POST(req: NextRequest) {
  try {
    if (!isTicketsDbReady()) {
      return NextResponse.json(
        { status: "error", message: "ระบบอัปโหลดยังไม่พร้อม (ต้องมี Supabase service role)" },
        { status: 503 }
      );
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
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
        { status: "error", message: "อัปโหลดบ่อยเกินไป รอสักครู่", code: "RATE_LIMIT" },
        { status: 429 }
      );
    }

    if (!(file instanceof Blob) || file.size <= 0) {
      return NextResponse.json({ status: "error", message: "ไม่มีไฟล์" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ status: "error", message: "ไฟล์ใหญ่เกินไป" }, { status: 400 });
    }

    const type = file.type || "image/jpeg";
    if (!type.startsWith("image/")) {
      return NextResponse.json({ status: "error", message: "อัปโหลดได้เฉพาะรูป" }, { status: 400 });
    }

    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const sb = getSupabaseAdmin();
    const { error } = await sb.storage.from("udfondue-images").upload(path, buffer, {
      cacheControl: "3600",
      upsert: false,
      contentType: type.startsWith("image/") ? type : "image/jpeg"
    });
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    const { data } = sb.storage.from("udfondue-images").getPublicUrl(path);
    return NextResponse.json({ status: "success", url: data.publicUrl, path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

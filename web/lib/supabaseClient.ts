import { createClient, SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowser() {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }
  browserClient = createClient(url, key);
  return browserClient;
}

export function isSupabaseConfigured() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/**
 * อัปโหลดผ่าน /api/upload (service role) — ต้องมี idToken หรือ cookie แอดมิน
 */
export async function uploadTicketImage(
  file: File,
  folder: "tickets" | "after" = "tickets",
  idToken?: string
) {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  if (idToken) form.append("idToken", idToken);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: form,
    credentials: "include"
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== "success" || !data.url) {
    throw new Error(data.message || "อัปโหลดไม่สำเร็จ");
  }
  return String(data.url);
}

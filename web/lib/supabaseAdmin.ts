import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * อ่าน env แบบ dynamic กัน Next.js inline NEXT_PUBLIC_* ตอน build
 * (เคยทำให้ Vercel ชี้คนละโปรเจกต์กับค่าที่ตั้งใน Dashboard)
 */
function readEnv(name: string) {
  return String(process.env[name] || "").trim();
}

export function getSupabaseUrl() {
  return (readEnv("SUPABASE_URL") || readEnv("NEXT_PUBLIC_SUPABASE_URL")).replace(/\/$/, "");
}

export function getSupabaseServiceRole() {
  return readEnv("SUPABASE_SERVICE_ROLE");
}

export function getSupabaseHost() {
  try {
    const url = getSupabaseUrl();
    return url ? new URL(url).host : "";
  } catch {
    return "";
  }
}

/** True when service role is available — Supabase is source of truth. */
export function isTicketsDbReady() {
  return !!(getSupabaseUrl() && getSupabaseServiceRole());
}

let adminClient: SupabaseClient | null = null;
let adminClientKey = "";

export function getSupabaseAdmin() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceRole();
  if (!url || !key) {
    throw new Error("Supabase service role is not configured");
  }
  const cacheKey = `${url}::${key.slice(0, 12)}`;
  if (adminClient && adminClientKey === cacheKey) return adminClient;
  adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  adminClientKey = cacheKey;
  return adminClient;
}

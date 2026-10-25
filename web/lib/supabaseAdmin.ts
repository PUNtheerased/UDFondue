import { createClient, SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

/** True when service role is available — Supabase is source of truth. */
export function isTicketsDbReady() {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE
  );
}

export function getSupabaseAdmin() {
  if (adminClient) return adminClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error("Supabase service role is not configured");
  }
  adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return adminClient;
}

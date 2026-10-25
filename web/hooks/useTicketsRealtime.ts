"use client";

import { useEffect } from "react";
import { isSupabaseConfigured, getSupabaseBrowser } from "@/lib/supabaseClient";

/**
 * ดึงข้อมูลใหม่เมื่อ tickets เปลี่ยน
 * - พยายาม subscribe Realtime (หลัง harden RLS อาจไม่ได้รับ event จากตาราง tickets)
 * - ใช้ polling เป็นหลักเพื่อให้ Nimda / L&F / track ยังอัปเดตได้
 */
export function useTicketsRealtime(
  onChange: () => void,
  enabled = true,
  pollMs = 20000
) {
  useEffect(() => {
    if (!enabled) return;

    let channel: ReturnType<ReturnType<typeof getSupabaseBrowser>["channel"]> | null = null;
    if (isSupabaseConfigured()) {
      try {
        const sb = getSupabaseBrowser();
        channel = sb
          .channel(`tickets-realtime-${Math.random().toString(36).slice(2)}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "tickets" },
            () => onChange()
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "lf_handoffs" },
            () => onChange()
          )
          .subscribe();
      } catch {
        // Supabase not configured in browser
      }
    }

    const timer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      onChange();
    }, Math.max(8000, pollMs));

    return () => {
      window.clearInterval(timer);
      if (channel) {
        try {
          getSupabaseBrowser().removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [onChange, enabled, pollMs]);
}

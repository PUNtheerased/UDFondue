"use client";

import { useEffect } from "react";
import { isSupabaseConfigured, getSupabaseBrowser } from "@/lib/supabaseClient";

/** Subscribe to tickets table changes; call onChange to refetch. */
export function useTicketsRealtime(onChange: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled || !isSupabaseConfigured()) return;
    let channel: ReturnType<ReturnType<typeof getSupabaseBrowser>["channel"]> | null = null;
    try {
      const sb = getSupabaseBrowser();
      channel = sb
        .channel("tickets-realtime")
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
    return () => {
      if (channel) {
        try {
          getSupabaseBrowser().removeChannel(channel);
        } catch {
          /* ignore */
        }
      }
    };
  }, [onChange, enabled]);
}

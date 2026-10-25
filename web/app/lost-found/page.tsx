import { SCHOOL_BUILDINGS } from "@/constants/schoolZones";
import { LostFoundClient } from "@/components/LostFoundClient";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import { listPublicLostFound, rowToPublic } from "@/lib/ticketsDb";
import { getGasUrl } from "@/lib/env";
import { stripPublicReports } from "@/lib/stripPublic";

export const dynamic = "force-dynamic";

async function fetchLostFound() {
  let reports: Record<string, unknown>[] = [];

  if (isTicketsDbReady()) {
    try {
      const rows = await listPublicLostFound();
      reports = stripPublicReports(
        rows.map((r) => rowToPublic(r) as unknown as Record<string, unknown>)
      );
    } catch {
      reports = [];
    }
  }

  if (reports.length === 0) {
    const gasUrl = getGasUrl();
    if (gasUrl) {
      try {
        const res = await fetch(gasUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "getPublicLostFound" }),
          cache: "no-store"
        });
        const text = await res.text();
        if (text.trim() && !text.trim().startsWith("<")) {
          const data = JSON.parse(text);
          reports = data.reports || [];
        }
      } catch {
        /* keep empty */
      }
    }
  }

  return { reports };
}

export default async function LostFoundPage() {
  const { reports } = await fetchLostFound();
  return (
    <LostFoundClient
      initialReports={reports as never}
      buildings={SCHOOL_BUILDINGS}
    />
  );
}

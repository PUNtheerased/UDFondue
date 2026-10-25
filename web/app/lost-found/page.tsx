import { SCHOOL_BUILDINGS } from "@/constants/schoolZones";
import { LostFoundClient } from "@/components/LostFoundClient";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import { listPublicLostFound, rowToPublic } from "@/lib/ticketsDb";
import { getGasUrl } from "@/lib/env";
import { stripPublicReports } from "@/lib/stripPublic";

export const dynamic = "force-dynamic";

async function fetchLostFound() {
  if (isTicketsDbReady()) {
    try {
      const rows = await listPublicLostFound();
      return {
        reports: stripPublicReports(
          rows.map((r) => rowToPublic(r) as unknown as Record<string, unknown>)
        )
      };
    } catch {
      return { reports: [] as Record<string, unknown>[] };
    }
  }

  const gasUrl = getGasUrl();
  if (!gasUrl) return { reports: [] as Record<string, unknown>[] };
  try {
    const res = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "getPublicLostFound" }),
      cache: "no-store"
    });
    const text = await res.text();
    if (!text.trim() || text.trim().startsWith("<")) return { reports: [] };
    const data = JSON.parse(text);
    return { reports: data.reports || [] };
  } catch {
    return { reports: [] };
  }
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

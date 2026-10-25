import { SCHOOL_BUILDINGS } from "@/constants/schoolZones";
import { LostFoundClient } from "@/components/LostFoundClient";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import { listPublicLostFound, rowToPublic } from "@/lib/ticketsDb";
import { callGas } from "@/lib/gas";
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
    } catch (err) {
      console.error("lost-found page supabase", err);
      // fall through to GAS only on error
    }
  }

  try {
    const data = (await callGas({ action: "getPublicLostFound" })) as {
      reports?: Record<string, unknown>[];
    };
    return { reports: stripPublicReports(data.reports || []) };
  } catch (err) {
    console.error("lost-found page gas", err);
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

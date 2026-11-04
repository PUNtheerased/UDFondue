import { SCHOOL_BUILDINGS } from "@/constants/schoolZones";
import { LostFoundClient } from "@/components/LostFoundClient";
import { isTicketsDbReady } from "@/lib/supabaseAdmin";
import { listPublicLostFound } from "@/lib/ticketsDb";
import { callGas } from "@/lib/gas";
import { toPublicLostFound } from "@/lib/publicProjection";
import { stripPublicReports } from "@/lib/stripPublic";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function fetchLostFound() {
  // Supabase เป็น SoT — ล้าง DB แล้วกระดานต้องว่าง ไม่ fallback ไป Sheet
  if (isTicketsDbReady()) {
    try {
      const rows = await listPublicLostFound();
      return {
        reports: rows.map((r) => toPublicLostFound(r) as unknown as Record<string, unknown>)
      };
    } catch (err) {
      console.error("lost-found page supabase", err);
      return { reports: [] };
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

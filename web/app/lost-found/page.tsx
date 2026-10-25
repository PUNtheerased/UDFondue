import { SCHOOL_ZONES } from "@/constants/schoolZones";
import { LostFoundClient } from "@/components/LostFoundClient";
import { getGasUrl } from "@/lib/env";

export const revalidate = 60;

async function fetchLostFound() {
  const gasUrl = getGasUrl();
  if (!gasUrl) return { reports: [] as Record<string, unknown>[] };
  try {
    const res = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "getPublicLostFound" }),
      next: { revalidate: 60 }
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
      initialReports={reports}
      buildings={SCHOOL_ZONES.map((z) => z.building)}
    />
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { TicketDetailView, TrackReport } from "@/components/TicketDetailView";
import { rememberTrackId } from "@/lib/recentTracks";
import { getClientIdToken } from "@/lib/clientLine";
import { useTicketsRealtime } from "@/hooks/useTicketsRealtime";

export function TrackClient({ ticketId }: { ticketId: string }) {
  const search = useSearchParams();
  const [report, setReport] = useState<TrackReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");
    const token = search.get("t") || "";
    try {
      const idToken = await getClientIdToken();
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          token || idToken
            ? {
                action: "trackPublicDetail",
                submitId: ticketId,
                trackToken: token || undefined,
                idToken: idToken || undefined
              }
            : {
                action: "trackLookup",
                submitId: ticketId
              }
        )
      });
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message || "โหลดไม่สำเร็จ");
      setReport(data.report);
      rememberTrackId(ticketId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [ticketId, search]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useTicketsRealtime(load, true);

  if (loading && !report) {
    return <div className="min-h-dvh flex items-center justify-center text-gray-400">กำลังโหลด...</div>;
  }

  if ((error || !report) && !report) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-4 gap-3">
        <p className="text-red-600 text-center">{error || "ไม่พบเรื่อง"}</p>
        <Link href="/track" className="text-blue-800 underline text-sm">
          กลับไปค้นหาเลขที่แจ้ง
        </Link>
      </div>
    );
  }

  if (!report) return null;

  return <TicketDetailView report={report} onRefresh={load} />;
}

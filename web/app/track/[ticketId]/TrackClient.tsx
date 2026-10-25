"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { StatusTimeline } from "@/components/StatusTimeline";
import Link from "next/link";

type Report = {
  submitId: string;
  status: string;
  statusUpdated?: string;
  statusHistory?: Array<{ status: string; at: string; note?: string }> | string;
  category: string;
  detail: string;
  date?: string;
  time?: string;
  name?: string;
  room?: string;
  studentNo?: string;
  building?: string;
  zone?: string;
  imageUrl?: string;
  afterImageUrl?: string;
  adminNote?: string;
  isAnonymous?: boolean;
};

function splitUrls(raw?: string) {
  return String(raw || "")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("http"));
}

export function TrackClient({ ticketId }: { ticketId: string }) {
  const search = useSearchParams();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "trackPublicDetail",
            submitId: ticketId,
            trackToken: search.get("t") || ""
          })
        });
        const data = await res.json();
        if (data.status !== "success") throw new Error(data.message || "โหลดไม่สำเร็จ");
        setReport(data.report);
      } catch (err) {
        setError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [ticketId, search]);

  if (loading) {
    return <div className="min-h-dvh flex items-center justify-center text-gray-400">กำลังโหลด...</div>;
  }

  if (error || !report) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-4 gap-3">
        <p className="text-red-600">{error || "ไม่พบเรื่อง"}</p>
        <Link href="/lost-found" className="text-blue-800 underline text-sm">
          ไปกระดานของหาย
        </Link>
      </div>
    );
  }

  const before = splitUrls(report.imageUrl);
  const after = splitUrls(report.afterImageUrl);

  return (
    <div className="min-h-dvh pb-safe">
      <header className="bg-gradient-to-r from-blue-900 to-blue-700 text-white px-6 py-6">
        <p className="text-xs text-blue-100">ติดตามสถานะ</p>
        <h1 className="text-xl font-bold font-mono">{report.submitId}</h1>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <section className="bg-white rounded-2xl p-4">
          <StatusTimeline status={report.status} history={report.statusHistory} />
        </section>
        <section className="bg-white rounded-2xl p-4 space-y-2 text-sm">
          <p className="font-semibold text-lg">{report.category}</p>
          <p className="text-gray-600 whitespace-pre-wrap">{report.detail}</p>
          <p className="text-xs text-gray-400">
            {report.date} {report.time}
          </p>
          <p className="text-xs text-gray-500">
            {report.isAnonymous
              ? "ไม่ประสงค์ออกนาม"
              : `${report.name || "-"} · ห้อง ${report.room || "-"}`}
          </p>
          {(report.building || report.zone) && (
            <p className="text-xs text-gray-500">
              สถานที่: {report.building} / {report.zone}
            </p>
          )}
          {report.adminNote && (
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-blue-800">หมายเหตุเจ้าหน้าที่</p>
              <p>{report.adminNote}</p>
            </div>
          )}
        </section>
        {before.length > 0 && (
          <section className="bg-white rounded-2xl p-4 space-y-2">
            <h2 className="font-semibold">รูปก่อนแก้ไข</h2>
            <div className="grid grid-cols-2 gap-2">
              {before.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="before" className="rounded-xl border object-cover w-full h-40" />
              ))}
            </div>
          </section>
        )}
        {after.length > 0 && (
          <section className="bg-white rounded-2xl p-4 space-y-2">
            <h2 className="font-semibold">รูปหลังแก้ไข</h2>
            <div className="grid grid-cols-2 gap-2">
              {after.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="after" className="rounded-xl border object-cover w-full h-40" />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

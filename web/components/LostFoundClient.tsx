"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Report = {
  submitId: string;
  trackToken?: string;
  lfType?: string;
  detail?: string;
  building?: string;
  zone?: string;
  lfWhen?: string;
  lfReturnPoint?: string;
  imageUrl?: string;
  date?: string;
};

export function LostFoundClient({
  initialReports,
  buildings
}: {
  initialReports: Report[];
  buildings: string[];
}) {
  const [tab, setTab] = useState<"แจ้งทำของหาย" | "แจ้งพบของหาย">("แจ้งทำของหาย");
  const [building, setBuilding] = useState("");

  const filtered = useMemo(() => {
    return (initialReports || []).filter((r) => {
      if (r.lfType && r.lfType !== tab) return false;
      if (building && r.building !== building) return false;
      return true;
    });
  }, [initialReports, tab, building]);

  return (
    <div className="min-h-dvh pb-safe">
      <header className="bg-gradient-to-r from-blue-900 to-blue-700 text-white px-6 py-6">
        <h1 className="text-xl font-bold">กระดานของหาย</h1>
        <p className="text-sm text-blue-100">รายการสาธารณะของโรงเรียน — ข้อมูลยืนยันเจ้าของไม่แสดงที่นี่</p>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        <div className="flex gap-2">
          {(["แจ้งทำของหาย", "แจ้งพบของหาย"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold ${
                tab === t ? "bg-blue-800 text-white" : "bg-white border"
              }`}
            >
              {t === "แจ้งทำของหาย" ? "ตามหาของหาย" : "พบของรอเจ้าของ"}
            </button>
          ))}
        </div>
        <select
          className="w-full border rounded-xl px-3 py-2 bg-white"
          value={building}
          onChange={(e) => setBuilding(e.target.value)}
        >
          <option value="">ทุกอาคาร</option>
          {buildings.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        <div className="space-y-3">
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 py-10">ยังไม่มีรายการ</p>
          )}
          {filtered.map((r) => {
            const img = String(r.imageUrl || "")
              .split("\n")
              .find((u) => u.startsWith("http"));
            return (
              <article key={r.submitId} className="bg-white rounded-2xl border p-4 space-y-2">
                {img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" className="w-full h-44 object-cover rounded-xl" />
                )}
                <p className="font-semibold">{r.detail}</p>
                <p className="text-xs text-gray-500">
                  {r.building} / {r.zone} · {r.lfWhen || r.date}
                </p>
                {r.lfReturnPoint && (
                  <p className="text-xs text-blue-800">จุดรับคืน: {r.lfReturnPoint}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <Link
                    href={`/track/${r.submitId}${r.trackToken ? `?t=${r.trackToken}` : ""}`}
                    className="text-sm text-blue-800 font-semibold"
                  >
                    ดูสถานะ
                  </Link>
                  <span className="text-sm text-gray-400">|</span>
                  <span className="text-sm text-gray-600">ติดต่อรับคืนที่จุดรับคืนเพื่อยืนยันตัวตน</span>
                </div>
              </article>
            );
          })}
        </div>
        <Link href="/" className="block text-center text-blue-800 text-sm underline py-4">
          แจ้งเรื่องใหม่
        </Link>
      </main>
    </div>
  );
}

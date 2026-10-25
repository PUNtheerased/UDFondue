"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getClientIdToken } from "@/lib/clientLine";
import { useTicketsRealtime } from "@/hooks/useTicketsRealtime";

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
  status?: string;
};

export function LostFoundClient({
  initialReports,
  buildings
}: {
  initialReports: Report[];
  buildings: string[];
}) {
  const [reports, setReports] = useState<Report[]>(initialReports || []);
  const [tab, setTab] = useState<"แจ้งทำของหาย" | "แจ้งพบของหาย">("แจ้งทำของหาย");
  const [building, setBuilding] = useState("");
  const [keyword, setKeyword] = useState("");
  const [busyId, setBusyId] = useState("");
  const [toast, setToast] = useState("");

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/lost-found");
      const data = await res.json();
      if (data.status === "success") setReports(data.reports || []);
    } catch {
      /* keep current */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useTicketsRealtime(refresh, true);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return (reports || []).filter((r) => {
      if (r.lfType && r.lfType !== tab) return false;
      if (building && r.building !== building) return false;
      if (!q) return true;
      const hay = [r.detail, r.building, r.zone, r.lfReturnPoint, r.submitId]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [reports, tab, building, keyword]);

  async function claim(submitId: string) {
    setBusyId(submitId);
    setToast("");
    try {
      const idToken = await getClientIdToken();
      if (!idToken) throw new Error("เปิดจากแอป LINE ก่อนนะ");
      const res = await fetch("/api/lf/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submitId, idToken })
      });
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message || "เคลมไม่สำเร็จ");
      setToast("เคลมแล้ว — นัดรับกับผู้พบ แล้วให้เขาสร้างรหัสบนเครื่องเขา");
      refresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "เคลมไม่สำเร็จ");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="min-h-dvh pb-safe">
      <header className="bg-gradient-to-r from-blue-900 to-blue-700 text-white px-6 py-6">
        <h1 className="text-xl font-bold">กระดานของหาย</h1>
        <p className="text-sm text-blue-100">Lost & Found</p>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {toast && (
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-sm text-blue-900">
            {toast}
          </div>
        )}
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
        <input
          className="w-full border rounded-xl px-3 py-2 bg-white"
          placeholder="ค้นหา เช่น กุญแจ, บัตรนักเรียน, กระบอกน้ำ"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
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
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-800 text-xl">
                ⌕
              </div>
              <p className="font-semibold text-slate-800">ยังไม่มีรายการตอนนี้</p>
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                ลองเปลี่ยนตัวกรอง หรือไปแจ้งของหาย / พบของที่ฟอร์ม
              </p>
              <Link
                href="/?category=%E0%B8%95%E0%B8%B2%E0%B8%A1%E0%B8%AB%E0%B8%B2%E0%B8%82%E0%B8%AD%E0%B8%87%E0%B8%AB%E0%B8%B2%E0%B8%A2"
                className="mt-4 inline-flex rounded-2xl bg-blue-800 px-5 py-2.5 text-sm font-semibold text-white"
              >
                ไปแจ้งของหาย / พบของ
              </Link>
            </div>
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
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Link
                    href={`/track/${r.submitId}`}
                    className="text-sm text-blue-800 font-semibold"
                  >
                    ดูสถานะ
                  </Link>
                  {tab === "แจ้งพบของหาย" && (
                    <>
                      <span className="text-sm text-gray-400">|</span>
                      <button
                        type="button"
                        disabled={busyId === r.submitId}
                        className="text-sm font-semibold text-blue-800 disabled:opacity-50"
                        onClick={() => claim(r.submitId)}
                      >
                        นี่ของฉัน
                      </button>
                    </>
                  )}
                  {tab === "แจ้งทำของหาย" && (
                    <>
                      <span className="text-sm text-gray-400">|</span>
                      <span className="text-sm text-gray-600">นัดรับ หรือเคลมจากรายการพบของ</span>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}

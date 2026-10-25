"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type MyTicket = {
  submitId: string;
  status: string;
  category: string;
  detail?: string;
  date?: string;
  trackUrl?: string;
  trackToken?: string;
};

function normalizeSubmitId(raw: string) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function TrackHome() {
  const router = useRouter();
  const [tab, setTab] = useState<"search" | "mine">("search");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lineId, setLineId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mine, setMine] = useState<MyTicket[]>([]);
  const [mineLoading, setMineLoading] = useState(false);
  const [mineError, setMineError] = useState("");

  useEffect(() => {
    async function initLiff() {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID_TRACK || "";
      try {
        if (!window.liff || !liffId) return;
        await window.liff.init({ liffId });
        if (!window.liff.isLoggedIn()) return;
        const profile = await window.liff.getProfile();
        setLineId(profile.userId);
        setDisplayName(profile.displayName);
      } catch {
        // เปิดนอก LINE ได้ — ค้นหาด้วยเลขที่อย่างเดียว
      }
    }
    initLiff();
  }, []);

  useEffect(() => {
    if (tab !== "mine" || !lineId) return;
    let cancelled = false;
    async function loadMine() {
      setMineLoading(true);
      setMineError("");
      try {
        const res = await fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "trackList", lineId })
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.status !== "success") throw new Error(data.message || "โหลดไม่สำเร็จ");
        setMine(data.reports || []);
      } catch (err) {
        if (!cancelled) {
          setMineError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
        }
      } finally {
        if (!cancelled) setMineLoading(false);
      }
    }
    loadMine();
    return () => {
      cancelled = true;
    };
  }, [tab, lineId]);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setError("");
    const submitId = normalizeSubmitId(query);
    if (!submitId) {
      setError("กรุณากรอกเลขที่แจ้ง");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trackLookup", submitId })
      });
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message || "ไม่พบเลขที่แจ้งนี้");
      router.push(`/track/${encodeURIComponent(submitId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ค้นหาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  function loginLine() {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID_TRACK || "";
    if (!window.liff || !liffId) {
      setMineError("กรุณาเปิดหน้านี้จากแอป LINE เพื่อดูเรื่องของท่าน");
      return;
    }
    window.liff.login();
  }

  return (
    <div className="min-h-dvh pb-safe">
      <header className="bg-gradient-to-r from-blue-900 to-blue-700 text-white px-6 py-8 text-center">
        <h1 className="text-2xl font-bold">ติดตามสถานะ</h1>
        <p className="text-sm text-blue-100 mt-1">ค้นหาด้วยเลขที่แจ้ง หรือดูเรื่องของท่าน</p>
      </header>

      <main className="max-w-xl mx-auto px-4 py-5 space-y-4">
        <div className="flex gap-2">
          <button
            type="button"
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${
              tab === "search" ? "bg-blue-800 text-white" : "bg-white border"
            }`}
            onClick={() => setTab("search")}
          >
            ค้นหาเลขที่แจ้ง
          </button>
          <button
            type="button"
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${
              tab === "mine" ? "bg-blue-800 text-white" : "bg-white border"
            }`}
            onClick={() => setTab("mine")}
          >
            เรื่องของฉัน
          </button>
        </div>

        {tab === "search" && (
          <section className="bg-white rounded-2xl p-5 space-y-3">
            <p className="text-sm text-gray-600">
              กรอกเลขที่ติดตามที่ได้รับหลังแจ้งเรื่อง เช่น <span className="font-mono">UDF-XXXXXXXX</span>
            </p>
            <form onSubmit={onSearch} className="space-y-3">
              <input
                className="w-full border rounded-xl px-3 py-3 font-mono tracking-wide"
                placeholder="UDF-XXXXXXXX"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoCapitalize="characters"
                autoCorrect="off"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-800 text-white py-3 rounded-xl font-semibold disabled:opacity-60"
              >
                {loading ? "กำลังค้นหา..." : "ค้นหา"}
              </button>
            </form>
          </section>
        )}

        {tab === "mine" && (
          <section className="bg-white rounded-2xl p-5 space-y-3">
            {!lineId ? (
              <div className="text-center space-y-3 py-4">
                <p className="text-sm text-gray-600">เข้าสู่ระบบด้วย LINE เพื่อดูรายการที่ท่านแจ้งไว้</p>
                <button
                  type="button"
                  onClick={loginLine}
                  className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold"
                >
                  เข้าสู่ระบบ LINE
                </button>
                {mineError && <p className="text-sm text-red-600">{mineError}</p>}
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500">
                  ผู้ใช้: {displayName || "LINE"} · {mine.length} รายการ
                </p>
                {mineLoading && <p className="text-center text-gray-400 py-6">กำลังโหลด...</p>}
                {mineError && <p className="text-sm text-red-600">{mineError}</p>}
                {!mineLoading && mine.length === 0 && (
                  <p className="text-center text-gray-400 py-8">ยังไม่มีเรื่องที่แจ้งไว้</p>
                )}
                <div className="space-y-2">
                  {mine.map((r) => (
                    <Link
                      key={r.submitId}
                      href={
                        r.trackToken
                          ? `/track/${encodeURIComponent(r.submitId)}?t=${encodeURIComponent(r.trackToken)}`
                          : `/track/${encodeURIComponent(r.submitId)}`
                      }
                      className="block border rounded-xl p-3 hover:border-blue-300"
                    >
                      <div className="flex justify-between gap-2">
                        <p className="font-mono text-sm font-semibold">{r.submitId}</p>
                        <span className="text-xs bg-blue-50 text-blue-800 px-2 py-0.5 rounded-full shrink-0">
                          {r.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{r.category}</p>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{r.detail}</p>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        <p className="text-center text-sm text-gray-500">
          <Link href="/" className="text-blue-800 underline">
            แจ้งเรื่องใหม่
          </Link>
          {" · "}
          <Link href="/lost-found" className="text-blue-800 underline">
            กระดานของหาย
          </Link>
        </p>
      </main>
    </div>
  );
}

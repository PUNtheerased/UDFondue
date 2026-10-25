"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loadRecentTracks, normalizeSubmitIdInput, rememberTrackId } from "@/lib/recentTracks";
import { ensureLiff } from "@/lib/ensureLiff";
import { getClientIdToken } from "@/lib/clientLine";

type MyTicket = {
  submitId: string;
  status: string;
  category: string;
  detail?: string;
  date?: string;
  trackUrl?: string;
  trackToken?: string;
};

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
  const [loginBusy, setLoginBusy] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(loadRecentTracks());
  }, []);

  useEffect(() => {
    async function boot() {
      if (typeof window !== "undefined") {
        const q = new URLSearchParams(window.location.search);
        if (q.get("tab") === "mine") setTab("mine");
      }
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID_TRACK || "";
      const ready = await ensureLiff(liffId);
      if (ready.bypass) {
        setLineId("U-TEST-USER-ID");
        setDisplayName("ผู้ใช้งานจำลอง");
        return;
      }
      if (!ready.ok || !ready.liff) return;
      try {
        if (!ready.liff.isLoggedIn()) return;
        const profile = await ready.liff.getProfile();
        setLineId(profile.userId);
        setDisplayName(profile.displayName);
        // กลับจาก LINE login → เปิดแท็บเรื่องของฉัน
        if (typeof window !== "undefined") {
          const q = new URLSearchParams(window.location.search);
          if (q.get("tab") === "mine" || q.has("liffClientId") || q.has("code")) {
            setTab("mine");
          }
        }
      } catch {
        // เปิดนอก LINE ได้
      }
    }
    boot();
  }, []);

  useEffect(() => {
    if (tab !== "mine" || !lineId) return;
    let cancelled = false;
    async function loadMine() {
      setMineLoading(true);
      setMineError("");
      try {
        const idToken = await getClientIdToken();
        const res = await fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "trackList",
            idToken: idToken || undefined,
            lineId: idToken ? undefined : lineId
          })
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

  async function goLookup(raw: string) {
    setError("");
    const submitId = normalizeSubmitIdInput(raw);
    if (!submitId) {
      setError("กรุณากรอกเลขที่แจ้ง");
      return;
    }
    setQuery(submitId);
    setLoading(true);
    try {
      const idToken = await getClientIdToken();
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "trackLookup",
          submitId,
          idToken: idToken || undefined
        })
      });
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message || "ไม่พบเลขที่แจ้งนี้");
      rememberTrackId(submitId);
      setRecent(loadRecentTracks());
      const token = data.report?.trackToken as string | undefined;
      const href = token
        ? `/track/${encodeURIComponent(submitId)}?t=${encodeURIComponent(token)}`
        : `/track/${encodeURIComponent(submitId)}`;
      router.push(href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ค้นหาไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await goLookup(query);
  }

  async function loginLine() {
    setMineError("");
    setLoginBusy(true);
    try {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID_TRACK || "";
      const ready = await ensureLiff(liffId);
      if (ready.bypass) {
        setLineId("U-TEST-USER-ID");
        setDisplayName("ผู้ใช้งานจำลอง");
        setTab("mine");
        return;
      }
      if (!ready.ok || !ready.liff) {
        setMineError(ready.message || "เข้าสู่ระบบ LINE ไม่สำเร็จ");
        return;
      }
      if (ready.liff.isLoggedIn()) {
        const profile = await ready.liff.getProfile();
        setLineId(profile.userId);
        setDisplayName(profile.displayName);
        setTab("mine");
        return;
      }
      // กลับมาแท็บเรื่องของฉันหลังล็อกอิน
      const redirectUri =
        typeof window !== "undefined"
          ? `${window.location.origin}/track?tab=mine`
          : undefined;
      ready.liff.login(redirectUri ? { redirectUri } : undefined);
    } catch (err) {
      setMineError(err instanceof Error ? err.message : "เข้าสู่ระบบ LINE ไม่สำเร็จ");
    } finally {
      setLoginBusy(false);
    }
  }

  return (
    <div className="min-h-dvh pb-safe">
      <header className="bg-gradient-to-r from-blue-900 to-blue-700 text-white px-6 py-8 text-center">
        <h1 className="text-2xl font-bold">ติดตามสถานะ</h1>
        <p className="text-sm text-blue-100 mt-1">ค้นด้วยเลขที่แจ้ง หรือดูเรื่องของตัวเอง</p>
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
              กรอกเลขที่ติดตาม เช่น <span className="font-mono">UDF-XXXXXXXX</span>
            </p>
            <form onSubmit={onSearch} className="space-y-3">
              <input
                className="w-full border rounded-xl px-3 py-3 font-mono tracking-wide uppercase"
                placeholder="UDF-XXXXXXXX"
                value={query}
                onChange={(e) => setQuery(e.target.value.toUpperCase())}
                onBlur={() => setQuery(normalizeSubmitIdInput(query))}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
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
            {recent.length > 0 && (
              <div className="pt-1">
                <p className="text-xs text-gray-500 mb-2">ค้นหาล่าสุด</p>
                <div className="flex flex-wrap gap-2">
                  {recent.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 font-mono text-xs text-blue-900"
                      onClick={() => goLookup(id)}
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "mine" && (
          <section className="bg-white rounded-2xl p-5 space-y-3">
            {!lineId ? (
              <div className="text-center space-y-3 py-4">
                <p className="text-sm text-gray-600">เข้าสู่ระบบด้วย LINE เพื่อดูรายการที่แจ้งไว้</p>
                <button
                  type="button"
                  onClick={loginLine}
                  disabled={loginBusy}
                  className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-60"
                >
                  {loginBusy ? "กำลังเปิด LINE..." : "เข้าสู่ระบบ LINE"}
                </button>
                {mineError && <p className="text-sm text-red-600">{mineError}</p>}
                <p className="text-xs text-gray-400">
                  ถ้ากดแล้วไม่ไปต่อ ลองเปิดหน้านี้จากในแอป LINE โดยตรง
                </p>
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
                      onClick={() => rememberTrackId(r.submitId)}
                    >
                      <div className="flex justify-between gap-2">
                        <p className="font-mono text-sm font-semibold">{r.submitId}</p>
                        <span className="text-xs bg-blue-50 text-blue-800 px-2 py-0.5 rounded-full shrink-0">
                          {r.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{r.category}</p>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{r.detail}</p>
                      <p className="text-xs text-blue-700 mt-2 font-medium">ดูรายละเอียด →</p>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

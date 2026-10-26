"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { STATUS_OPTIONS } from "@/constants/schoolZones";
import { compressImageForUpload } from "@/lib/compressImage";
import { isSupabaseConfigured, uploadTicketImage } from "@/lib/supabaseClient";
import { useTicketsRealtime } from "@/hooks/useTicketsRealtime";

type Report = {
  submitId: string;
  status: string;
  category: string;
  detail: string;
  name?: string;
  room?: string;
  studentNo?: string;
  building?: string;
  zone?: string;
  date?: string;
  time?: string;
  upvoteCount?: number;
  adminNote?: string;
  studentNote?: string;
  lfSecretDetail?: string;
  lfType?: string;
  isAnonymous?: boolean;
  imageUrl?: string;
  afterImageUrl?: string;
  mergedToId?: string;
  assignedTo?: string;
  urgency?: string;
  handoff?: { status?: string } | null;
};

const KANBAN = ["รับเรื่องแล้ว", "กำลังดำเนินการ", "รอข้อมูลเพิ่ม", "เสร็จสิ้น"];
const KANBAN_OTHER = "อื่นๆ";

export function NimdaApp() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [mode, setMode] = useState<"admin" | "dev">("admin");
  const [devPin, setDevPin] = useState("");
  const [showDevPin, setShowDevPin] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [view, setView] = useState<"table" | "kanban" | "site">("table");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Report | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNote, setEditNote] = useState("");
  const [afterUrls, setAfterUrls] = useState<string[]>([]);
  const [mergeIds, setMergeIds] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [siteSettings, setSiteSettings] = useState<Record<string, string>>({});
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [purgeSheet, setPurgeSheet] = useState(true);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    if (!silent) setBusy(true);
    try {
      const res = await fetch("/api/admin/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filterStatus, search })
      });
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message || "โหลดไม่สำเร็จ");
      setReports(data.reports || []);
      if (data.mode === "admin" || data.mode === "dev") setMode(data.mode);
      setAuthed(true);
    } catch (err) {
      if (!silent) {
        setLoginError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
        setAuthed(false);
      }
    } finally {
      if (!silent) setBusy(false);
    }
  }, [filterStatus, search]);

  const loadSilent = useCallback(() => {
    load({ silent: true }).catch(() => {});
  }, [load]);

  async function login() {
    setLoginError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (data.status !== "success") {
      setLoginError(data.message || "เข้าสู่ระบบไม่สำเร็จ");
      return;
    }
    setMode("admin");
    setAuthed(true);
    await load();
  }

  async function switchMode(next: "admin" | "dev") {
    if (next === "admin") {
      const res = await fetch("/api/admin/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "admin" })
      });
      const data = await res.json();
      if (data.status === "success") {
        setMode("admin");
        setShowDevPin(false);
        setToast("โหมด Admin");
      }
      return;
    }
    setShowDevPin(true);
  }

  async function confirmDevMode() {
    const res = await fetch("/api/admin/mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "dev", devPin })
    });
    const data = await res.json();
    if (data.status !== "success") {
      setToast(data.message || "รหัส Dev ไม่ถูกต้อง");
      return;
    }
    setMode("dev");
    setShowDevPin(false);
    setDevPin("");
    setToast("โหมด Dev — ระวังการแก้ข้อมูล");
  }

  async function loadSiteSettings() {
    const res = await fetch("/api/admin/site-settings");
    const data = await res.json();
    if (data.status === "success") setSiteSettings(data.settings || {});
  }

  async function saveSiteSettings() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: siteSettings })
      });
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message);
      setToast("บันทึกข้อความเว็บแล้ว");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function purgeDatabase() {
    if (purgeConfirm !== "ล้างข้อมูลทั้งหมด") {
      setToast('พิมพ์ว่า "ล้างข้อมูลทั้งหมด" เพื่อยืนยัน');
      return;
    }
    if (!window.confirm("ล้างฐานข้อมูลจริง ๆ ใช่ไหม? กู้คืนไม่ได้")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm: purgeConfirm,
          clearSheet: purgeSheet
        })
      });
      const data = await res.json();
      if (data.status !== "success" && data.status !== "partial") {
        throw new Error(data.message || "ล้างไม่สำเร็จ");
      }
      setToast(data.message || "ล้างฐานข้อมูลแล้ว");
      setPurgeConfirm("");
      setSelected(null);
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "ล้างไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  // ไม่พึ่ง anon Realtime สำหรับเรื่องส่วนตัว — poll ทุก 15 วิ (silent ไม่สลับ busy)
  useTicketsRealtime(loadSilent, authed, 15000);

  useEffect(() => {
    if (view === "site") loadSiteSettings();
  }, [view]);

  const sorted = useMemo(() => {
    return [...reports].sort((a, b) => (b.upvoteCount || 0) - (a.upvoteCount || 0));
  }, [reports]);

  function openDetail(r: Report) {
    setSelected(r);
    setEditStatus(r.status);
    setEditNote(r.studentNote || r.adminNote || "");
    setAfterUrls(
      String(r.afterImageUrl || "")
        .split("\n")
        .filter((u) => u.startsWith("http"))
    );
    setMergeIds("");
  }

  async function saveUpdate() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adminUpdate",
          submitId: selected.submitId,
          status: editStatus,
          studentNote: editNote,
          afterImageUrls: afterUrls
        })
      });
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message);
      setToast("บันทึกแล้ว");
      setSelected(null);
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function assignJanitor() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assignJanitor",
          submitId: selected.submitId,
          studentNote: editNote || "ดำเนินการต่อแล้ว กำลังดำเนินการ"
        })
      });
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message);
      setToast("ดำเนินการต่อแล้ว");
      setSelected(null);
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "ส่งต่อไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function mergeTickets() {
    if (!selected || !mergeIds.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adminMergeTickets",
          mergeIntoId: selected.submitId,
          mergeFromIds: mergeIds.split(/[\s,]+/).filter(Boolean)
        })
      });
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message);
      setToast("รวมเคสแล้ว");
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "รวมเคสไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function hideModeration() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adminModerationHide",
          submitId: selected.submitId
        })
      });
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message);
      setToast("ซ่อนรายการแล้ว");
      setSelected(null);
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function unlockHandoff() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlockHandoff", submitId: selected.submitId })
      });
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message);
      setToast("ปลดล็อกรหัสแล้ว");
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function forceCancelHandoff() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "forceCancelHandoff", submitId: selected.submitId })
      });
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message);
      setToast("ยกเลิกเคลมแล้ว");
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function onAfterFiles(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const compressed = await compressImageForUpload(file);
      if (isSupabaseConfigured()) {
        // cookie แอดมิน → /api/upload (folder after)
        const url = await uploadTicketImage(compressed, "after");
        setAfterUrls((prev) => [...prev, url]);
      } else {
        setAfterUrls((prev) => [...prev, URL.createObjectURL(compressed)]);
      }
    }
  }

  function exportCsv() {
    const headers = [
      "submitId",
      "date",
      "time",
      "status",
      "category",
      "building",
      "zone",
      "upvoteCount",
      "urgency",
      "assignedTo",
      "detail"
    ];
    const rows = sorted.map((r) =>
      [
        r.submitId,
        r.date,
        r.time,
        r.status,
        r.category,
        r.building,
        r.zone,
        r.upvoteCount || 0,
        r.urgency || "",
        r.assignedTo || "",
        `"${String(r.detail || "").replace(/"/g, '""')}"`
      ].join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8"
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `udfondue-export-${Date.now()}.csv`;
    a.click();
  }

  if (!authed) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-8 space-y-4">
          <h1 className="text-xl font-bold text-center">สำหรับครู / เจ้าหน้าที่</h1>
          <p className="text-xs text-gray-500 text-center">ดูคิว คุมสถานะ และดำเนินการต่อ</p>
          <input
            type="password"
            className="w-full border rounded-xl px-3 py-3"
            placeholder="รหัสผ่าน"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
          />
          {loginError && <p className="text-sm text-red-600 text-center">{loginError}</p>}
          <button
            type="button"
            className="w-full bg-blue-800 text-white py-3 rounded-xl font-semibold"
            onClick={login}
          >
            เข้าสู่ระบบ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pb-safe">
      <header className="bg-gradient-to-r from-blue-900 to-blue-700 text-white px-4 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap gap-2 items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">จัดการเรื่องแจ้ง</h1>
            <p className="text-xs text-blue-100">โหมด {mode === "dev" ? "Dev" : "Admin"}</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex rounded-lg overflow-hidden border border-white/30 text-sm">
              <button
                type="button"
                className={`px-3 py-1.5 ${mode === "admin" ? "bg-white text-blue-900" : "bg-white/10"}`}
                onClick={() => switchMode("admin")}
              >
                Admin
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 ${mode === "dev" ? "bg-amber-300 text-amber-950" : "bg-white/10"}`}
                onClick={() => switchMode("dev")}
              >
                Dev
              </button>
            </div>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-sm ${view === "table" ? "bg-white text-blue-900" : "bg-white/20"}`}
              onClick={() => setView("table")}
            >
              รายการ
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-sm ${view === "kanban" ? "bg-white text-blue-900" : "bg-white/20"}`}
              onClick={() => setView("kanban")}
            >
              แยกสถานะ
            </button>
            {mode === "dev" && (
              <button
                type="button"
                className={`px-3 py-1.5 rounded-lg text-sm ${view === "site" ? "bg-white text-blue-900" : "bg-white/20"}`}
                onClick={() => setView("site")}
              >
                ข้อความเว็บ
              </button>
            )}
            <button type="button" className="px-3 py-1.5 rounded-lg text-sm bg-white/20" onClick={exportCsv}>
              Export CSV
            </button>
            <button type="button" className="px-3 py-1.5 rounded-lg text-sm bg-white/20" onClick={load}>
              รีเฟรช
            </button>
          </div>
        </div>
      </header>

      {showDevPin && (
        <div className="max-w-6xl mx-auto px-4 pt-3">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <p className="text-sm text-amber-900 flex-1">ใส่รหัส Dev เพื่อเปิดโหมดแก้ได้ทุกอย่าง</p>
            <input
              type="password"
              className="border rounded-xl px-3 py-2"
              placeholder="DEV_PIN"
              value={devPin}
              onChange={(e) => setDevPin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmDevMode()}
            />
            <button type="button" className="bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-semibold" onClick={confirmDevMode}>
              เปิด Dev
            </button>
            <button type="button" className="text-sm underline text-amber-900" onClick={() => setShowDevPin(false)}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 py-4 space-y-4">
        {view !== "site" && (
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="border rounded-xl px-3 py-2 bg-white"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">ทุกสถานะ</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              className="flex-1 border rounded-xl px-3 py-2"
              placeholder="ค้นหาเลขที่ / รายละเอียด / อาคาร"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
            <button type="button" className="bg-blue-800 text-white px-4 py-2 rounded-xl" onClick={load}>
              ค้นหา
            </button>
          </div>
        )}

        {view === "site" && mode === "dev" && (
          <div className="bg-white rounded-2xl border p-4 space-y-3">
            <h2 className="font-bold">ข้อความบนเว็บนักเรียน</h2>
            {(
              [
                ["announce_home", "ประกาศหน้าแรก"],
                ["track_blurb", "คำอธิบายหน้าติดตาม"],
                ["lost_found_blurb", "คำอธิบายกระดานของหาย"],
                ["submit_success", "ข้อความหลังส่งเรื่องสำเร็จ"]
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-sm space-y-1">
                <span className="font-semibold text-slate-700">{label}</span>
                <textarea
                  className="w-full border rounded-xl px-3 py-2"
                  rows={2}
                  value={siteSettings[key] || ""}
                  onChange={(e) => setSiteSettings((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </label>
            ))}
            <button
              type="button"
              disabled={busy}
              className="bg-blue-800 text-white px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
              onClick={saveSiteSettings}
            >
              บันทึกข้อความเว็บ
            </button>

            <div className="border-t pt-4 mt-2 space-y-2">
              <h3 className="font-bold text-red-800">ล้างฐานข้อมูล (อันตราย)</h3>
              <p className="text-xs text-slate-500">
                ลบ tickets / ประวัติ / เคลมใน Supabase — พิมพ์ยืนยันก่อนกด
              </p>
              <input
                className="w-full border border-red-200 rounded-xl px-3 py-2"
                placeholder='พิมพ์ว่า ล้างข้อมูลทั้งหมด'
                value={purgeConfirm}
                onChange={(e) => setPurgeConfirm(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={purgeSheet}
                  onChange={(e) => setPurgeSheet(e.target.checked)}
                />
                ล้าง Google Sheet ด้วย
              </label>
              <button
                type="button"
                disabled={busy}
                className="w-full bg-red-700 text-white py-2.5 rounded-xl font-semibold disabled:opacity-50"
                onClick={purgeDatabase}
              >
                ล้าง database
              </button>
            </div>
          </div>
        )}

        {view === "table" && (
          <div className="space-y-2">
            {sorted.map((r) => (
              <button
                key={r.submitId}
                type="button"
                onClick={() => openDetail(r)}
                className="w-full text-left bg-white border rounded-2xl p-4 hover:border-blue-300"
              >
                <div className="flex justify-between gap-2">
                  <p className="font-semibold">{r.category}</p>
                  <span className="text-xs bg-blue-50 text-blue-800 px-2 py-0.5 rounded-full">{r.status}</span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2 mt-1">{r.detail}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {r.submitId} · +{r.upvoteCount || 0} · {r.building}/{r.zone}
                  {r.urgency === "เร่งด่วน" ? " · เร่งด่วน" : ""}
                  {r.assignedTo === "janitor" ? " · ดำเนินการต่อแล้ว" : ""}
                  {r.handoff?.status ? ` · เคลม:${r.handoff.status}` : ""}
                </p>
              </button>
            ))}
            {!busy && sorted.length === 0 && (
              <p className="text-center text-sm text-gray-500 py-8">ยังไม่มีรายการ</p>
            )}
          </div>
        )}

        {view === "kanban" && (
          <div className="grid md:grid-cols-5 gap-3 overflow-x-auto">
            {[...KANBAN, KANBAN_OTHER].map((col) => (
              <div key={col} className="bg-gray-100 rounded-2xl p-2 min-w-[220px]">
                <p className="text-sm font-bold px-2 py-2">{col}</p>
                <div className="space-y-2">
                  {sorted
                    .filter((r) =>
                      col === KANBAN_OTHER ? !KANBAN.includes(r.status) : r.status === col
                    )
                    .map((r) => (
                      <button
                        key={r.submitId}
                        type="button"
                        onClick={() => openDetail(r)}
                        className="w-full text-left bg-white rounded-xl p-3 shadow-sm"
                      >
                        <p className="text-sm font-semibold line-clamp-2">{r.detail}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {col === KANBAN_OTHER ? `${r.status} · ` : ""}+{r.upvoteCount || 0}
                        </p>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center sm:p-6">
          <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setSelected(null)} />
          <div className="relative z-10 w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto p-5 space-y-3">
            <h3 className="font-bold text-lg">{selected.submitId}</h3>
            <p className="text-sm whitespace-pre-wrap">{selected.detail}</p>
            {selected.lfSecretDetail && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
                <p className="font-semibold text-amber-900">ข้อมูลลับยืนยันเจ้าของ</p>
                <p>{selected.lfSecretDetail}</p>
              </div>
            )}
            <select
              className="w-full border rounded-xl px-3 py-2"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <textarea
              className="w-full border rounded-xl px-3 py-2"
              rows={3}
              placeholder="ข้อความถึงนักเรียน (เห็นบนหน้าติดตาม)"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
            />
            <div>
              <p className="text-sm font-semibold mb-1">รูปหลังดำเนินการ</p>
              <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => onAfterFiles(e.target.files)} />
              <div className="flex flex-wrap gap-2 mt-2">
                {afterUrls.map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={u} src={u} alt="" className="w-20 h-20 object-cover rounded-lg border" />
                ))}
              </div>
            </div>

            <button
              type="button"
              className="w-full border border-blue-800 text-blue-800 py-2.5 rounded-xl text-sm font-semibold"
              disabled={busy}
              onClick={assignJanitor}
            >
              ดำเนินการต่อ
            </button>

            <button
              type="button"
              className="w-full border rounded-xl py-2 text-sm"
              disabled={busy}
              onClick={forceCancelHandoff}
            >
              ยกเลิกเคลมของหาย
            </button>

            {mode === "dev" && (
              <div className="space-y-2 border-t pt-3">
                <p className="text-xs font-semibold text-amber-800">Dev เท่านั้น</p>
                <div>
                  <p className="text-sm font-semibold mb-1">รวมเคสซ้ำ (ใส่เลขที่คั่นด้วย comma)</p>
                  <input
                    className="w-full border rounded-xl px-3 py-2"
                    value={mergeIds}
                    onChange={(e) => setMergeIds(e.target.value)}
                    placeholder="UDF-XXXX, UDF-YYYY"
                  />
                  <button type="button" className="mt-2 text-sm text-blue-800 font-semibold" onClick={mergeTickets}>
                    รวมเข้าเคสนี้
                  </button>
                </div>
                <button type="button" className="text-sm text-amber-800 underline" onClick={unlockHandoff}>
                  ปลดล็อกรหัสรับของ
                </button>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className="flex-1 bg-blue-800 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
                disabled={busy}
                onClick={saveUpdate}
              >
                บันทึก
              </button>
              <button type="button" className="px-4 py-3 border rounded-xl text-red-700" onClick={hideModeration}>
                ซ่อน
              </button>
              <button type="button" className="px-4 py-3 border rounded-xl" onClick={() => setSelected(null)}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-full z-[60]">
          {toast}
        </div>
      )}
    </div>
  );
}

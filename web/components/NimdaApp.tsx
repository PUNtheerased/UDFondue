"use client";

import { useEffect, useMemo, useState } from "react";
import imageCompression from "browser-image-compression";
import { STATUS_OPTIONS } from "@/constants/schoolZones";
import { isSupabaseConfigured, uploadTicketImage } from "@/lib/supabaseClient";

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
  lfSecretDetail?: string;
  lfType?: string;
  isAnonymous?: boolean;
  imageUrl?: string;
  afterImageUrl?: string;
  mergedToId?: string;
};

const KANBAN = ["รับเรื่องแล้ว", "กำลังดำเนินการ", "รอข้อมูลเพิ่ม", "เสร็จสิ้น"];

export function NimdaApp() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [view, setView] = useState<"table" | "kanban">("table");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Report | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNote, setEditNote] = useState("");
  const [afterUrls, setAfterUrls] = useState<string[]>([]);
  const [mergeIds, setMergeIds] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

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
    setAuthed(true);
    await load();
  }

  async function load() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filterStatus, search })
      });
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message || "โหลดไม่สำเร็จ");
      setReports(data.reports || []);
      setAuthed(true);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
      setAuthed(false);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(() => {
    return [...reports].sort((a, b) => (b.upvoteCount || 0) - (a.upvoteCount || 0));
  }, [reports]);

  function openDetail(r: Report) {
    setSelected(r);
    setEditStatus(r.status);
    setEditNote(r.adminNote || "");
    setAfterUrls(
      String(r.afterImageUrl || "")
        .split("\n")
        .filter((u) => u.startsWith("http"))
    );
    setMergeIds("");
  }

  async function saveUpdate() {
    if (!selected) return;
    if ((editStatus === "เสร็จสิ้น" || editStatus === "ปิดเรื่อง") && afterUrls.length === 0) {
      setToast("แนะนำแนบรูป After ก่อนปิดเคส");
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adminUpdate",
          submitId: selected.submitId,
          status: editStatus,
          adminNote: editNote,
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
      setToast("ซ่อนเคสแล้ว");
      setSelected(null);
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
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1280,
        fileType: "image/jpeg",
        initialQuality: 0.75
      });
      if (isSupabaseConfigured()) {
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
          <h1 className="text-xl font-bold text-center">UDFondue — สำหรับเจ้าหน้าที่</h1>
          <p className="text-xs text-gray-500 text-center">หน้านี้สำหรับครู/เจ้าหน้าที่เท่านั้น</p>
          <input
            type="password"
            className="w-full border rounded-xl px-3 py-3"
            placeholder="รหัสผ่านเจ้าหน้าที่"
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
            <p className="text-xs text-blue-100">Nimda Pro</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-sm ${view === "table" ? "bg-white text-blue-900" : "bg-white/20"}`}
              onClick={() => setView("table")}
            >
              ตาราง
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-sm ${view === "kanban" ? "bg-white text-blue-900" : "bg-white/20"}`}
              onClick={() => setView("kanban")}
            >
              Kanban
            </button>
            <button type="button" className="px-3 py-1.5 rounded-lg text-sm bg-white/20" onClick={exportCsv}>
              Export CSV
            </button>
            <button type="button" className="px-3 py-1.5 rounded-lg text-sm bg-white/20" onClick={load}>
              รีเฟรช
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 space-y-4">
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
            placeholder="ค้นหา..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <button type="button" className="bg-blue-800 text-white px-4 py-2 rounded-xl" onClick={load}>
            ค้นหา
          </button>
        </div>

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
                </p>
              </button>
            ))}
          </div>
        )}

        {view === "kanban" && (
          <div className="grid md:grid-cols-4 gap-3 overflow-x-auto">
            {KANBAN.map((col) => (
              <div key={col} className="bg-gray-100 rounded-2xl p-2 min-w-[220px]">
                <p className="text-sm font-bold px-2 py-2">{col}</p>
                <div className="space-y-2">
                  {sorted
                    .filter((r) => r.status === col)
                    .map((r) => (
                      <button
                        key={r.submitId}
                        type="button"
                        onClick={() => openDetail(r)}
                        className="w-full text-left bg-white rounded-xl p-3 shadow-sm"
                      >
                        <p className="text-sm font-semibold line-clamp-2">{r.detail}</p>
                        <p className="text-xs text-gray-400 mt-1">+{r.upvoteCount || 0}</p>
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
              placeholder="หมายเหตุเจ้าหน้าที่"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
            />
            <div>
              <p className="text-sm font-semibold mb-1">รูป After</p>
              <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={(e) => onAfterFiles(e.target.files)} />
              <div className="flex flex-wrap gap-2 mt-2">
                {afterUrls.map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={u} src={u} alt="" className="w-20 h-20 object-cover rounded-lg border" />
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">Merge เคสซ้ำ (ใส่ Submit ID คั่นด้วย comma)</p>
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

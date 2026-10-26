"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BUILDING_GROUPS,
  CATEGORIES,
  floorsForBuilding,
  isMainClassroomBuilding,
  LF_RETURN_POINTS
} from "@/constants/schoolZones";
import { clearDraft, FormDraft, loadDraft, useFormDraft } from "@/hooks/useFormDraft";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { compressImageForUpload } from "@/lib/compressImage";
import { rememberTrackId } from "@/lib/recentTracks";
import { isSupabaseConfigured, uploadTicketImage } from "@/lib/supabaseClient";
import { TurnstileWidget, type TurnstileHandle } from "@/components/Turnstile";
import { allowLocalLineBypass } from "@/lib/runtime";

declare global {
  interface Window {
    liff?: {
      init: (opts: { liffId: string }) => Promise<void>;
      isLoggedIn: () => boolean;
      login: (opts?: { redirectUri?: string }) => void;
      logout: () => void;
      getProfile: () => Promise<{ userId: string; displayName: string }>;
      getIDToken: () => string | null;
      isInClient?: () => boolean;
      closeWindow?: () => void;
    };
  }
}

type UploadedImage = {
  id: string;
  preview: string;
  url?: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  file?: File;
};

type ZoneIssue = {
  submitId: string;
  category: string;
  detail: string;
  status: string;
  upvoteCount?: number;
};

function generateSubmitId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return "UDF-" + code;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function ReportForm() {
  const online = useOnlineStatus();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState("");
  const [otherCategory, setOtherCategory] = useState("");
  const [detail, setDetail] = useState("");
  const [building, setBuilding] = useState("");
  const [zone, setZone] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [room, setRoom] = useState("");
  const [studentNo, setStudentNo] = useState("");
  const [contactOptional, setContactOptional] = useState("");
  const [lfType, setLfType] = useState("");
  const [lfWhen, setLfWhen] = useState("");
  const [lfReturnPoint, setLfReturnPoint] = useState("");
  const [lfSecretDetail, setLfSecretDetail] = useState("");
  const [isPublicShowcase, setIsPublicShowcase] = useState(true);
  const [urgency, setUrgency] = useState("ปกติ");
  const [gpsLat, setGpsLat] = useState("");
  const [gpsLng, setGpsLng] = useState("");
  const [name, setName] = useState("");
  const [lineId, setLineId] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef<TurnstileHandle>(null);
  const [zoneIssues, setZoneIssues] = useState<ZoneIssue[]>([]);
  const [upvotedIds, setUpvotedIds] = useState<Record<string, true>>({});
  const [upvoteBusyId, setUpvoteBusyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [successId, setSuccessId] = useState("");
  const [trackUrl, setTrackUrl] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [pendingDraft, setPendingDraft] = useState<FormDraft | null>(null);

  const isMainBuilding = isMainClassroomBuilding(building);
  const floorChoices = building ? floorsForBuilding(building) : [];
  const roomPlaceholder = !zone
    ? "เลือกชั้นก่อน"
    : "เลขห้อง เช่น 123";

  const draft: FormDraft = {
    step,
    category,
    otherCategory,
    detail,
    building,
    zone,
    locationNote,
    isAnonymous,
    room,
    studentNo,
    contactOptional,
    lfType,
    lfWhen,
    lfReturnPoint,
    lfSecretDetail,
    isPublicShowcase,
    urgency,
    gpsLat,
    gpsLng
  };
  // อย่าเขียนทับร่างระหว่างรอให้ผู้ใช้เลือกใน popup
  useFormDraft(draft, !successId && !pendingDraft);

  function applyDraft(saved: FormDraft) {
    setStep(saved.step || 1);
    setCategory(saved.category || "");
    setOtherCategory(saved.otherCategory || "");
    setDetail(saved.detail || "");
    setBuilding(saved.building || "");
    setZone(saved.zone || "");
    setLocationNote(saved.locationNote || "");
    setIsAnonymous(!!saved.isAnonymous);
    setRoom(saved.room || "");
    setStudentNo(saved.studentNo || "");
    setContactOptional(saved.contactOptional || "");
    setLfType(saved.lfType || "");
    setLfWhen(saved.lfWhen || "");
    setLfReturnPoint(saved.lfReturnPoint || "");
    setLfSecretDetail(saved.lfSecretDetail || "");
    setIsPublicShowcase(saved.isPublicShowcase !== false);
    setGpsLat(saved.gpsLat || "");
    setGpsLng(saved.gpsLng || "");
  }

  useEffect(() => {
    const saved = loadDraft();
    if (saved && (saved.category || saved.detail || saved.building)) {
      setPendingDraft(saved);
    }
    try {
      const cat = new URLSearchParams(window.location.search).get("category");
      if (cat && CATEGORIES.some((c) => c.value === cat)) {
        setCategory(cat);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Android / browser Back ใน wizard = ถอย step ไม่ปิด LIFF
  useEffect(() => {
    if (successId || pendingDraft) return;
    try {
      window.history.pushState({ udfStep: step }, "");
    } catch {
      /* ignore */
    }
    const onPop = () => {
      setStep((current) => {
        if (current <= 1) return 1;
        const next = current - 1;
        queueMicrotask(() => {
          try {
            window.history.pushState({ udfStep: next }, "");
          } catch {
            /* ignore */
          }
        });
        return next;
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [step, successId, pendingDraft]);

  useEffect(() => {
    async function initLiff() {
      // localhost: ไม่ init/login LIFF — endpoint ชี้ Vercel จะพาออกจากเครื่องตลอด
      if (allowLocalLineBypass()) {
        setName("ผู้ใช้งานจำลอง");
        setLineId("U-TEST-USER-ID");
        return;
      }

      const liffId = String(process.env.NEXT_PUBLIC_LIFF_ID_REPORT || "").trim();
      try {
        if (!liffId) {
          setError(
            "ระบบยังไม่ได้ตั้งค่า LIFF ID — ให้ใส่ NEXT_PUBLIC_LIFF_ID_REPORT บน Vercel แล้ว Redeploy"
          );
          return;
        }
        if (!window.liff) {
          // รอ SDK จาก layout โหลดสักครู่
          await new Promise((r) => setTimeout(r, 400));
        }
        if (!window.liff) {
          setError("โหลด LINE LIFF ไม่สำเร็จ กรุณาเปิดใหม่จากแอป LINE");
          return;
        }
        await window.liff.init({ liffId });
        if (!window.liff.isLoggedIn()) {
          window.liff.login();
          return;
        }
        // ไม่มี ID Token = มักยังไม่เปิด Scope "openid" หรือต้อง login ใหม่หลังเปิด scope
        if (!window.liff.getIDToken()) {
          try {
            window.liff.logout();
          } catch {
            /* ignore */
          }
          window.liff.login();
          return;
        }
        const profile = await window.liff.getProfile();
        setName(profile.displayName);
        setLineId(profile.userId);
        setError("");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/liffId/i.test(msg)) {
          setError(
            "ระบบยังไม่ได้ตั้งค่า LIFF ID — ตรวจ NEXT_PUBLIC_LIFF_ID_REPORT บน Vercel แล้ว Redeploy"
          );
        } else {
          setError("เข้าสู่ระบบ LINE ไม่สำเร็จ กรุณาปิดแล้วเปิดใหม่จากแอป LINE");
        }
      }
    }
    initLiff();
  }, []);

  useEffect(() => {
    if (!building || !zone || category === "ตามหาของหาย") {
      setZoneIssues([]);
      return;
    }
    const ctrl = new AbortController();
    fetch(`/api/zone-issues?building=${encodeURIComponent(building)}&zone=${encodeURIComponent(zone)}`, {
      signal: ctrl.signal
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "success") setZoneIssues(data.reports || []);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [building, zone, category]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const uploadOne = useCallback(async (item: UploadedImage, attempt = 1): Promise<UploadedImage> => {
    if (!item.file) return { ...item, status: "error", error: "ไม่มีไฟล์" };
    setImages((prev) =>
      prev.map((img) => (img.id === item.id ? { ...img, status: "uploading", error: undefined } : img))
    );
    try {
      if (!isSupabaseConfigured()) {
        // Dev fallback: object URL only (not persisted)
        const fake = item.preview;
        return { ...item, url: fake, status: "done" };
      }
      const idToken = allowLocalLineBypass()
        ? `dev:${lineId || "U-TEST-USER-ID"}`
        : window.liff?.getIDToken?.() || "";
      if (!idToken && !allowLocalLineBypass()) {
        throw new Error("เข้าสู่ระบบ LINE ก่อนอัปโหลดรูป");
      }
      const url = await uploadTicketImage(item.file, "tickets", idToken || undefined);
      return { ...item, url, status: "done" };
    } catch (err) {
      if (attempt < 3) {
        await sleep(500 * Math.pow(2, attempt - 1));
        return uploadOne(item, attempt + 1);
      }
      return {
        ...item,
        status: "error",
        error: err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ"
      };
    }
  }, [lineId]);

  async function onPickFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const files = Array.from(fileList).slice(0, 5 - images.length);
    for (const file of files) {
      const compressed = await compressImageForUpload(file);
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const preview = URL.createObjectURL(compressed);
      const item: UploadedImage = {
        id,
        preview,
        file: compressed,
        status: "pending"
      };
      setImages((prev) => [...prev, item]);
      const result = await uploadOne(item);
      setImages((prev) => prev.map((img) => (img.id === id ? result : img)));
    }
  }

  async function refreshIdToken() {
    if (allowLocalLineBypass()) {
      return lineId ? `dev:${lineId}` : "dev:U-TEST-USER-ID";
    }

    if (!window.liff) {
      throw new Error("เปิดหน้านี้จากแอป LINE อีกครั้ง");
    }

    let token = window.liff.getIDToken();
    if (!token && !window.liff.isLoggedIn()) {
      window.liff.login();
      throw new Error("กำลังเข้าสู่ระบบ LINE — ยืนยันแล้วกดส่งอีกครั้ง");
    }
    if (!token) {
      // login ซ้ำเพื่อขอ openid / id_token ใหม่
      try {
        window.liff.logout();
      } catch {
        /* ignore */
      }
      window.liff.login();
      throw new Error(
        "ต้องการเข้าสู่ระบบใหม่ (ตรวจว่า LIFF เปิด Scope: profile และ openid แล้ว) จากนั้นกดส่งอีกครั้ง"
      );
    }
    return token;
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target?.preview?.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(target.preview);
        } catch {
          /* ignore */
        }
      }
      return prev.filter((img) => img.id !== id);
    });
  }

  async function upvote(submitId: string) {
    if (upvotedIds[submitId] || upvoteBusyId) return;
    setUpvoteBusyId(submitId);
    try {
      const idToken = await refreshIdToken();
      const res = await fetch("/api/upvote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submitId, idToken })
      });
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message || "อัปโหวตไม่สำเร็จ");

      // นับตามเซิร์ฟเวอร์เท่านั้น — คนละ LINE โหวตได้ครั้งเดียว
      const count = typeof data.upvoteCount === "number" ? data.upvoteCount : undefined;
      setZoneIssues((prev) =>
        prev.map((r) =>
          r.submitId === submitId
            ? { ...r, upvoteCount: count ?? r.upvoteCount ?? 0 }
            : r
        )
      );
      setUpvotedIds((prev) => ({ ...prev, [submitId]: true }));
      showToast(data.already ? "โหวตไปแล้ว" : "บันทึก +1 เรียบร้อย");
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหวตไม่สำเร็จ");
    } finally {
      setUpvoteBusyId("");
    }
  }

  function useGps() {
    if (!navigator.geolocation) {
      setError("อุปกรณ์ไม่รองรับ GPS");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLat(String(pos.coords.latitude));
        setGpsLng(String(pos.coords.longitude));
        showToast("บันทึกพิกัดเสริมแล้ว");
      },
      () => setError("ไม่สามารถอ่านตำแหน่งได้")
    );
  }

  async function submitForm() {
    setError("");
    if (!category) {
      setError("เลือกประเภทเรื่องก่อน");
      setStep(1);
      return;
    }
    if (category === "อื่นๆ" && !otherCategory.trim()) {
      setError("พิมพ์หัวข้ออื่นๆ ก่อนต่อ");
      return;
    }
    if (!detail.trim()) {
      setError("เล่ารายละเอียดสักหน่อย");
      setStep(2);
      return;
    }
    if (!building || !zone) {
      setError("เลือกสถานที่กับชั้นก่อน");
      setStep(2);
      return;
    }
    if (
      (!isMainClassroomBuilding(building) || zone === "อื่นๆ") &&
      !locationNote.trim()
    ) {
      setError("พิมพ์จุดสังเกตในช่องโปรดระบุ");
      setStep(2);
      return;
    }
    if (category === "ตามหาของหาย") {
      if (!lfType || !lfWhen || !detail.trim()) {
        setError("กรอกข้อมูลของหายให้ครบก่อน");
        setStep(2);
        return;
      }
      if (lfType === "แจ้งพบของหาย" && !lfReturnPoint) {
        setError("เลือกจุดรับคืนด้วย");
        setStep(2);
        return;
      }
    }
    if (!isAnonymous && (!room.trim() || !studentNo.trim())) {
      setError("ใส่ห้องกับเลขที่ หรือติ๊กไม่ระบุตัวตน");
      setStep(3);
      return;
    }
    if (images.some((img) => img.status === "uploading")) {
      setError("รูปยังอัปโหลดอยู่ รอแป๊บ");
      return;
    }
    if (images.some((img) => img.status === "error")) {
      setError("มีรูปอัปไม่สำเร็จ — กด Retry ก่อนส่ง");
      return;
    }
    if (!turnstileToken) {
      setError("ยืนยันว่าไม่ใช่บอทก่อนส่ง");
      return;
    }

    setLoading(true);
    setLoadingMsg("กำลังส่งเรื่อง...");
    try {
      const idToken = await refreshIdToken();
      const submitId = generateSubmitId();
      const imageUrls = images.map((img) => img.url).filter(Boolean) as string[];

      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          name,
          lineId,
          submitId,
          imageUrls,
          turnstileToken,
          idToken
        })
      });
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message || "ส่งไม่สำเร็จ");

      clearDraft();
      setSuccessId(submitId);
      rememberTrackId(submitId);
      setTrackUrl(data.trackUrl || `/track/${submitId}?t=${data.trackToken || ""}`);
      if (window.liff?.isInClient?.()) {
        setTimeout(() => window.liff?.closeWindow?.(), 6000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่งไม่สำเร็จ");
      setTurnstileToken("");
      turnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  }

  if (successId) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4 pb-safe">
        <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8 text-center">
          <div className="text-4xl text-blue-800 mb-3">✓</div>
          <h2 className="text-xl font-bold text-blue-900">รับเรื่องเรียบร้อยแล้ว</h2>
          <p className="text-sm text-gray-500 mt-2">รับเรื่องแล้ว — เก็บเลขนี้ไว้ติดตามได้</p>
          <div className="mt-4 bg-blue-50 rounded-xl p-4 text-left">
            <p className="text-xs text-blue-800 font-semibold mb-1">เลขที่ติดตาม</p>
            <p className="font-mono text-sm break-all">{successId}</p>
            <button
              type="button"
              className="mt-3 w-full py-2 rounded-lg border border-blue-800 text-blue-800 text-sm"
              onClick={async () => {
                await navigator.clipboard.writeText(successId);
                showToast("คัดลอกเลขที่แจ้งแล้ว");
              }}
            >
              คัดลอกรหัส
            </button>
            {trackUrl && (
              <a
                href={trackUrl}
                className="mt-2 block w-full py-2 rounded-lg bg-blue-800 text-white text-sm text-center"
              >
                ติดตามสถานะ
              </a>
            )}
          </div>
        </div>
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-full">
            {toast}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col pb-safe">
      {!online && (
        <div className="bg-amber-500 text-white text-center text-sm py-2">
          ออฟไลน์ / สัญญาณเน็ตอ่อน — ข้อมูลร่างยังถูกบันทึกไว้
        </div>
      )}
      {pendingDraft && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px] draft-modal-backdrop"
            aria-label="ปิด"
            onClick={() => {
              applyDraft(pendingDraft);
              setPendingDraft(null);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="draft-modal-title"
            className="relative z-10 w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 draft-modal-panel"
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-800">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path d="M14 3v5h5M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <h2 id="draft-modal-title" className="text-center text-lg font-bold text-slate-900">
              พบร่างที่ค้างไว้
            </h2>
            <p className="mt-2 text-center text-sm text-slate-500 leading-relaxed">
              มีข้อมูลที่กรอกค้างจากครั้งก่อน
              {pendingDraft.category ? (
                <>
                  {" "}
                  (ประเภท: <span className="font-medium text-slate-700">{pendingDraft.category}</span>)
                </>
              ) : null}
              <br />
              ต้องการกรอกต่อหรือเริ่มใหม่?
              <span className="block mt-1 text-xs text-slate-400">รูปแนบต้องเลือกใหม่เสมอ</span>
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                className="w-full rounded-2xl bg-blue-800 py-3.5 text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
                onClick={() => {
                  applyDraft(pendingDraft);
                  setPendingDraft(null);
                  showToast("กู้คืนร่างแล้ว");
                }}
              >
                ใช้ร่างต่อ
              </button>
              <button
                type="button"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-semibold text-slate-700 active:scale-[0.99]"
                onClick={() => {
                  clearDraft();
                  setPendingDraft(null);
                  showToast("เริ่มฟอร์มใหม่แล้ว");
                }}
              >
                เริ่มใหม่
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-gradient-to-r from-blue-900 to-blue-700 text-white px-6 py-8 text-center">
        <h1 className="text-2xl font-bold">UDFondue</h1>
        <p className="text-sm text-blue-100 mt-1">แจ้งปัญหา ของหาย หรือความคิดเห็นได้ที่นี่</p>
        <div className="mt-4 flex justify-center gap-2 text-xs">
          {[1, 2, 3].map((n) => {
            const reachable = n <= step;
            return (
              <button
                key={n}
                type="button"
                disabled={!reachable}
                onClick={() => reachable && setStep(n)}
                className={`px-3 py-1 rounded-full transition ${
                  step === n
                    ? "bg-white text-blue-900"
                    : reachable
                      ? "bg-white/25 text-white"
                      : "bg-white/10 text-white/50"
                }`}
              >
                ขั้นตอนที่ {n}/3
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-5 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {step === 1 && (
          <section className="bg-white rounded-2xl p-4 space-y-3">
            <h2 className="font-bold">เลือกประเภทเรื่อง</h2>
            <div className="grid gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`text-left px-4 py-3 rounded-xl border-2 ${
                    category === c.value ? "border-blue-800 bg-blue-50" : "border-gray-200"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {category === "อื่นๆ" && (
              <input
                className="w-full border rounded-xl px-3 py-2"
                placeholder="ระบุหัวข้อเอง"
                value={otherCategory}
                onChange={(e) => setOtherCategory(e.target.value)}
              />
            )}
            <button
              type="button"
              className="w-full bg-blue-800 text-white py-3 rounded-xl font-semibold"
              onClick={() => setStep(2)}
              disabled={!category}
            >
              ถัดไป
            </button>
          </section>
        )}

        {step === 2 && (
          <section className="bg-white rounded-2xl p-4 space-y-3">
            <h2 className="font-bold">รายละเอียดและสถานที่</h2>
            {category !== "ตามหาของหาย" && (
              <textarea
                className="w-full border rounded-xl px-3 py-2 min-h-[100px]"
                placeholder="อธิบายรายละเอียด เช่น สิ่งที่พบ หรือข้อเสนอแนะ..."
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
              />
            )}
            {category === "ปัญหาที่พบ" && (
              <select
                className="w-full border rounded-xl px-3 py-2"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
              >
                <option value="ปกติ">ความเร่งด่วน: ปกติ</option>
                <option value="เร่งด่วน">เร่งด่วน (เช่น น้ำรั่ว ไฟตก)</option>
              </select>
            )}
            <select
              className="w-full border rounded-xl px-3 py-2"
              value={building}
              onChange={(e) => {
                const next = e.target.value;
                setBuilding(next);
                setLocationNote("");
                // นอกอาคาร 1–5 ใช้ชั้นเป็น "อื่นๆ" ทันที
                if (next && !isMainClassroomBuilding(next)) {
                  setZone("อื่นๆ");
                } else {
                  setZone("");
                }
              }}
            >
              <option value="">เลือกสถานที่</option>
              {BUILDING_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.buildings.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {building && isMainBuilding ? (
              <div className="flex gap-2">
                <select
                  className="w-1/2 border rounded-xl px-3 py-2"
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                >
                  <option value="">เลือกชั้น</option>
                  {floorChoices.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <input
                  className="w-1/2 border rounded-xl px-3 py-2"
                  placeholder={roomPlaceholder}
                  value={locationNote}
                  onChange={(e) => setLocationNote(e.target.value)}
                  disabled={!zone}
                />
              </div>
            ) : building ? (
              <input
                className="w-full border rounded-xl px-3 py-2"
                placeholder="โปรดระบุ"
                value={locationNote}
                onChange={(e) => setLocationNote(e.target.value)}
                required
              />
            ) : null}
            <button type="button" className="text-sm text-blue-800 underline" onClick={useGps}>
              ใช้ตำแหน่งปัจจุบัน (ไม่บังคับ)
            </button>
            {(gpsLat || gpsLng) && (
              <p className="text-xs text-gray-500">
                GPS: {gpsLat}, {gpsLng}
              </p>
            )}

            {zoneIssues.length > 0 && (
              <div className="bg-amber-50 rounded-xl p-3 space-y-2">
                <p className="text-sm font-semibold text-amber-900">มีเรื่องค้างในจุดนี้</p>
                {zoneIssues.slice(0, 5).map((issue) => (
                  <div key={issue.submitId} className="bg-white rounded-lg p-2 text-sm">
                    <p className="font-medium">{issue.category}</p>
                    <p className="text-gray-600 line-clamp-2">{issue.detail}</p>
                    <button
                      type="button"
                      className="mt-2 text-blue-800 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!!upvotedIds[issue.submitId] || upvoteBusyId === issue.submitId}
                      onClick={() => upvote(issue.submitId)}
                    >
                      {upvotedIds[issue.submitId]
                        ? `โหวตแล้ว${issue.upvoteCount ? ` · ${issue.upvoteCount}` : ""}`
                        : upvoteBusyId === issue.submitId
                          ? "กำลังบันทึก..."
                          : `เจอแบบนี้เหมือนกัน (+1)${issue.upvoteCount ? ` · ${issue.upvoteCount}` : ""}`}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {category === "ตามหาของหาย" && (
              <div className="space-y-2 border-t pt-3">
                <p className="font-semibold text-sm">ข้อมูลของหาย</p>
                <select
                  className="w-full border rounded-xl px-3 py-2"
                  value={lfType}
                  onChange={(e) => {
                    const next = e.target.value;
                    setLfType(next);
                    if (next !== "แจ้งพบของหาย") setLfReturnPoint("");
                  }}
                >
                  <option value="">ประเภท</option>
                  <option value="แจ้งทำของหาย">แจ้งทำของหาย</option>
                  <option value="แจ้งพบของหาย">แจ้งพบของหาย</option>
                </select>
                {(lfType === "แจ้งทำของหาย" || lfType === "แจ้งพบของหาย") && (
                  <textarea
                    className="w-full border rounded-xl px-3 py-2 min-h-[88px]"
                    placeholder="อธิบายลักษณะสิ่งของ เช่น รูปร่าง/สี"
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                  />
                )}
                <input
                  type="datetime-local"
                  className="w-full border rounded-xl px-3 py-2"
                  value={lfWhen}
                  onChange={(e) => setLfWhen(e.target.value)}
                />
                {lfType === "แจ้งพบของหาย" && (
                  <select
                    className="w-full border rounded-xl px-3 py-2"
                    value={lfReturnPoint}
                    onChange={(e) => setLfReturnPoint(e.target.value)}
                  >
                    <option value="">จุดรับคืน</option>
                    {LF_RETURN_POINTS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isPublicShowcase}
                    onChange={(e) => setIsPublicShowcase(e.target.checked)}
                  />
                  แสดงบนกระดานของหายสาธารณะ
                </label>
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" className="flex-1 border py-3 rounded-xl" onClick={() => setStep(1)}>
                ย้อนกลับ
              </button>
              <button
                type="button"
                className="flex-1 bg-blue-800 text-white py-3 rounded-xl font-semibold"
                onClick={() => setStep(3)}
              >
                ถัดไป
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="bg-white rounded-2xl p-4 space-y-3">
            <h2 className="font-bold">ตัวตนและรูปภาพ</h2>
            <label className="flex items-start gap-2 text-sm bg-gray-50 rounded-xl p-3">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="mt-1"
              />
              <span>แจ้งแบบไม่ระบุชื่อ</span>
            </label>
            {!isAnonymous && (
              <>
                <input className="w-full border rounded-xl px-3 py-2 bg-gray-50" value={name} readOnly />
                <input
                  className="w-full border rounded-xl px-3 py-2"
                  placeholder="ห้อง เช่น 5/6"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                />
                <input
                  className="w-full border rounded-xl px-3 py-2"
                  placeholder="เลขที่"
                  value={studentNo}
                  onChange={(e) => setStudentNo(e.target.value)}
                />
                <input
                  className="w-full border rounded-xl px-3 py-2"
                  placeholder="ช่องทางติดต่อกลับ (ไม่บังคับ)"
                  value={contactOptional}
                  onChange={(e) => setContactOptional(e.target.value)}
                />
              </>
            )}

            <div>
              <p className="text-sm font-semibold mb-1">แนบรูป (สูงสุด 5)</p>
              <p className="text-xs text-gray-500 mb-2">
                โปรดหลีกเลี่ยงการถ่ายติดใบหน้าของบุคคลอื่นโดยไม่ได้รับอนุญาต เพื่อรักษาความเป็นส่วนตัว
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={(e) => {
                  onPickFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <div className="grid grid-cols-3 gap-2 mt-3">
                {images.map((img) => (
                  <div key={img.id} className="relative rounded-xl overflow-hidden border bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.preview} alt="" className="w-full h-24 object-cover" />
                    <button
                      type="button"
                      aria-label="ลบรูป"
                      className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/70 text-white text-sm font-bold leading-none"
                      onClick={() => removeImage(img.id)}
                    >
                      ×
                    </button>
                    <div className="absolute inset-x-0 bottom-0 bg-black/50 text-white text-[10px] px-1 py-0.5">
                      {img.status}
                    </div>
                    {img.status === "error" && (
                      <button
                        type="button"
                        className="absolute inset-0 bg-red-900/40 text-white text-xs font-bold"
                        onClick={async () => {
                          const result = await uploadOne(img);
                          setImages((prev) => prev.map((x) => (x.id === img.id ? result : x)));
                        }}
                      >
                        Retry
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <TurnstileWidget ref={turnstileRef} onToken={setTurnstileToken} />

            <div className="flex gap-2 pb-4">
              <button type="button" className="flex-1 border py-3 rounded-xl" onClick={() => setStep(2)}>
                ย้อนกลับ
              </button>
              <button
                type="button"
                className="flex-1 bg-blue-800 text-white py-3 rounded-xl font-semibold disabled:opacity-60"
                disabled={loading}
                onClick={submitForm}
              >
                {loading ? loadingMsg || "กำลังส่ง..." : "ส่งเรื่อง"}
              </button>
            </div>
          </section>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-full z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

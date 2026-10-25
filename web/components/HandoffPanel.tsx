"use client";

import { useState } from "react";
import { getClientIdToken } from "@/lib/clientLine";

export type HandoffInfo = {
  id: string;
  foundSubmitId: string;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  codeExpiresAt?: string | null;
  isClaimant?: boolean;
  isHolder?: boolean;
  canCreateCode?: boolean;
  canConfirm?: boolean;
};

export function HandoffPanel({
  submitId,
  lfType,
  handoff,
  onUpdated
}: {
  submitId: string;
  lfType?: string;
  handoff?: HandoffInfo | null;
  onUpdated?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [codeShown, setCodeShown] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [inputCode, setInputCode] = useState("");
  const [toast, setToast] = useState("");

  if (lfType !== "แจ้งพบของหาย" && !handoff) return null;

  async function run(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const idToken = await getClientIdToken();
      if (!idToken) throw new Error("เปิดจากแอป LINE ก่อน");
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, idToken, submitId })
      });
      const data = await res.json();
      if (data.status !== "success") throw new Error(data.message || "ไม่สำเร็จ");
      if (data.code) {
        setCodeShown(data.code);
        setExpiresAt(data.expiresAt || "");
      }
      setToast(data.message || "เรียบร้อย");
      onUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-white rounded-2xl p-4 space-y-3 border border-blue-100">
      <h2 className="font-semibold text-blue-900">รับของด้วยรหัส</h2>
      <p className="text-xs text-gray-500 leading-relaxed">
        ผู้ถือของสร้างรหัสบนเครื่องตัวเอง · เจ้าของกรอกบนอีกเครื่อง · รหัสใช้ได้ 1 ชั่วโมง ผิดได้ไม่เกิน 3 ครั้ง
      </p>

      {handoff && (
        <p className="text-xs text-slate-600">
          สถานะเคลม: <span className="font-semibold">{handoff.status}</span>
          {handoff.status === "code_active" && handoff.attemptCount > 0
            ? ` · ลองผิดแล้ว ${handoff.attemptCount}/${handoff.maxAttempts}`
            : ""}
        </p>
      )}

      {codeShown && (
        <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 text-center">
          <p className="text-xs text-blue-800 mb-1">รหัสรับของ (โชว์ให้อีกฝั่งดู)</p>
          <p className="font-mono text-3xl font-bold tracking-[0.3em] text-blue-900">{codeShown}</p>
          {expiresAt && (
            <p className="text-xs text-gray-500 mt-2">
              หมดอายุ {new Date(expiresAt).toLocaleString("th-TH")}
            </p>
          )}
        </div>
      )}

      {(!handoff || handoff.canCreateCode || handoff.isHolder) && lfType === "แจ้งพบของหาย" && (
        <button
          type="button"
          disabled={busy}
          className="w-full rounded-xl bg-blue-800 text-white py-2.5 text-sm font-semibold disabled:opacity-50"
          onClick={() => run("/api/lf/create-code", {})}
        >
          สร้างรหัสรับของ
        </button>
      )}

      {(handoff?.canConfirm || handoff?.isClaimant) && (
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded-xl px-3 py-2 font-mono tracking-widest text-center"
            placeholder="กรอกรหัส 6 หลัก"
            maxLength={6}
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <button
            type="button"
            disabled={busy || inputCode.length < 6}
            className="px-4 rounded-xl bg-blue-800 text-white text-sm font-semibold disabled:opacity-50"
            onClick={() => run("/api/lf/confirm", { code: inputCode })}
          >
            ยืนยันรับแล้ว
          </button>
        </div>
      )}

      {handoff && (handoff.isClaimant || handoff.isHolder) && handoff.status !== "completed" && (
        <button
          type="button"
          disabled={busy}
          className="w-full text-sm text-red-700 underline"
          onClick={() => run("/api/lf/cancel", {})}
        >
          ยกเลิกเคลม
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {toast && !error && <p className="text-sm text-green-700">{toast}</p>}
    </section>
  );
}

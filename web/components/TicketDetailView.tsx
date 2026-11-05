"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { StatusTimeline } from "@/components/StatusTimeline";
import { HandoffPanel, HandoffInfo } from "@/components/HandoffPanel";
import { formatWhenThai } from "@/lib/formatWhenThai";

export type TrackReport = {
  submitId: string;
  status: string;
  statusUpdated?: string;
  statusHistory?: Array<{ status: string; at: string; note?: string }> | string;
  category: string;
  detail?: string;
  date?: string;
  time?: string;
  name?: string;
  room?: string;
  studentNo?: string;
  building?: string;
  zone?: string;
  locationNote?: string;
  imageUrl?: string;
  afterImageUrl?: string;
  adminNote?: string;
  studentNote?: string;
  lfType?: string;
  lfWhen?: string;
  lfReturnPoint?: string;
  isAnonymous?: boolean;
  isPublicSummary?: boolean;
  handoff?: HandoffInfo | null;
};

function splitUrls(raw?: string) {
  return String(raw || "")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("http"));
}

function Field({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  if (!children) return null;
  return (
    <div className="border-b border-slate-100 last:border-0 py-3 first:pt-0 last:pb-0">
      <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
      <div className="text-base text-slate-900 leading-relaxed break-words">{children}</div>
    </div>
  );
}

function placeText(report: TrackReport) {
  const parts = [report.building, report.zone, report.locationNote].filter(Boolean);
  return parts.length ? parts.join(" · ") : "";
}

function whenText(report: TrackReport) {
  return formatWhenThai(report.lfWhen, report.date, report.time);
}

export function TicketDetailView({
  report,
  showBackLink = true,
  onRefresh
}: {
  report: TrackReport;
  showBackLink?: boolean;
  onRefresh?: () => void;
}) {
  const summary = !!report.isPublicSummary;
  const before = splitUrls(report.imageUrl);
  const after = splitUrls(report.afterImageUrl);
  const noteToStudent = report.studentNote || report.adminNote;
  const place = placeText(report);
  const when = whenText(report);
  const reporter =
    !summary &&
    (report.isAnonymous
      ? "ไม่ประสงค์ออกนาม"
      : [report.name, report.room ? `ห้อง ${report.room}` : ""].filter(Boolean).join(" · "));

  return (
    <div className="min-h-dvh pb-safe bg-slate-50">
      <header className="bg-gradient-to-r from-blue-900 to-blue-700 text-white px-5 py-5">
        <p className="text-sm text-blue-100">ติดตามสถานะ</p>
        <h1 className="text-2xl font-bold font-mono tracking-wide mt-1">{report.submitId}</h1>
        {showBackLink && (
          <Link href="/track" className="inline-block mt-3 text-sm text-blue-100 underline underline-offset-2">
            ค้นหาเลขที่อื่น
          </Link>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <section className="bg-white rounded-2xl p-4 shadow-sm">
          <StatusTimeline status={report.status} history={report.statusHistory} />
        </section>

        <section className="bg-white rounded-2xl p-5 shadow-sm">
          <Field label="เรื่องอะไร">
            <span className="font-semibold text-lg">{report.category}</span>
            {report.lfType ? (
              <span className="block text-base text-slate-700 mt-1">{report.lfType}</span>
            ) : null}
          </Field>

          {place ? <Field label="ที่ไหน">{place}</Field> : null}
          {when ? <Field label="เมื่อไหร่">{when}</Field> : null}

          {report.detail?.trim() ? (
            <Field label="รายละเอียด">
              <p className="whitespace-pre-wrap">{report.detail.trim()}</p>
            </Field>
          ) : null}

          {report.lfReturnPoint?.trim() ? (
            <Field label="จุดรับคืน">{report.lfReturnPoint.trim()}</Field>
          ) : null}

          {reporter ? <Field label="ผู้แจ้ง">{reporter}</Field> : null}
        </section>

        {noteToStudent ? (
          <section className="bg-blue-50 border border-blue-100 rounded-2xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-blue-900 mb-2">ข้อความจากผู้ดูแล</p>
            <p className="text-base text-blue-950 whitespace-pre-wrap leading-relaxed">{noteToStudent}</p>
          </section>
        ) : null}

        {!summary && (
          <HandoffPanel
            submitId={report.submitId}
            lfType={report.lfType}
            handoff={report.handoff}
            onUpdated={onRefresh}
          />
        )}

        {before.length > 0 && (
          <section className="bg-white rounded-2xl p-5 space-y-3 shadow-sm">
            <h2 className="text-base font-semibold text-slate-800">รูปที่แนบมา</h2>
            <div className="grid grid-cols-2 gap-3">
              {before.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt="รูปที่แจ้งมา"
                  className="rounded-xl border object-cover w-full h-44"
                />
              ))}
            </div>
          </section>
        )}

        {after.length > 0 && (
          <section className="bg-white rounded-2xl p-5 space-y-3 shadow-sm">
            <h2 className="text-base font-semibold text-slate-800">รูปหลังดำเนินการ</h2>
            <div className="grid grid-cols-2 gap-3">
              {after.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt="รูปหลังดำเนินการ"
                  className="rounded-xl border object-cover w-full h-44"
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

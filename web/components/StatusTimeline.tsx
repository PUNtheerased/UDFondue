"use client";

import { STATUS_OPTIONS } from "@/constants/schoolZones";

type HistoryItem = { status: string; at: string; note?: string };

const FLOW = STATUS_OPTIONS.filter((s) => s !== "REJECTED_MODERATION");

export function StatusTimeline({
  status,
  history
}: {
  status: string;
  history?: HistoryItem[] | string;
}) {
  let items: HistoryItem[] = [];
  if (typeof history === "string" && history) {
    try {
      items = JSON.parse(history);
    } catch {
      items = [];
    }
  } else if (Array.isArray(history)) {
    items = history;
  }

  const currentIdx = Math.max(0, FLOW.indexOf(status));

  return (
    <ol className="space-y-3">
      {FLOW.map((step, idx) => {
        const done = idx <= currentIdx && status !== "REJECTED_MODERATION";
        const hist = items.filter((h) => h.status === step).pop();
        return (
          <li key={step} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`w-3 h-3 rounded-full mt-1 ${done ? "bg-blue-800" : "bg-gray-300"}`}
              />
              {idx < FLOW.length - 1 && (
                <span className={`w-0.5 flex-1 min-h-[20px] ${done ? "bg-blue-300" : "bg-gray-200"}`} />
              )}
            </div>
            <div className="pb-2">
              <p className={`text-sm font-semibold ${done ? "text-gray-900" : "text-gray-400"}`}>{step}</p>
              {hist?.at && <p className="text-xs text-gray-400">{hist.at}</p>}
              {hist?.note && <p className="text-xs text-gray-500 mt-0.5">{hist.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BUILDING_GROUPS } from "@/constants/schoolZones";

type Props = {
  value: string;
  onChange: (building: string) => void;
};

export function BuildingPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BUILDING_GROUPS.map((group) => ({
      label: group.label,
      buildings: group.buildings.filter((b) => !q || b.toLowerCase().includes(q))
    })).filter((g) => g.buildings.length > 0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  function pick(name: string) {
    onChange(name);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-3 border rounded-xl px-3 py-3 text-left bg-white ${
          open ? "border-blue-800 ring-2 ring-blue-100" : "border-gray-200"
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-800">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 20V9l8-5 8 5v11M9 20v-6h6v6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-xs text-slate-500">สถานที่ / อาคาร</span>
          <span className={`block text-sm font-medium truncate ${value ? "text-slate-900" : "text-slate-400"}`}>
            {value || "ค้นหาหรือเลือกอาคาร"}
          </span>
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-slate-400 shrink-0" aria-hidden>
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="M20 20l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                placeholder="พิมพ์ชื่อ เช่น โรงอาหาร, อาคาร 3"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  if (e.key === "Enter") {
                    const first = filtered[0]?.buildings[0];
                    if (first) pick(first);
                  }
                }}
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto overscroll-contain" role="listbox">
            {filtered.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-slate-400">ไม่พบสถานที่ที่ตรงกับคำค้น</p>
            )}
            {filtered.map((group) => (
              <div key={group.label}>
                <p className="sticky top-0 bg-slate-50/95 backdrop-blur px-3 py-1.5 text-[11px] font-semibold text-slate-500">
                  {group.label}
                </p>
                {group.buildings.map((b) => {
                  const active = b === value;
                  return (
                    <button
                      key={b}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => pick(b)}
                      className={`w-full text-left px-4 py-2.5 text-sm border-b border-slate-50 last:border-0 ${
                        active ? "bg-blue-50 text-blue-900 font-semibold" : "hover:bg-slate-50 text-slate-800"
                      }`}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {value && (
            <button
              type="button"
              className="w-full border-t border-slate-100 px-4 py-2.5 text-sm text-slate-500 hover:bg-slate-50"
              onClick={() => pick("")}
            >
              ล้างการเลือก
            </button>
          )}
        </div>
      )}
    </div>
  );
}

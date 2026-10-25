"use client";

import { useEffect, useRef } from "react";

const KEY = "udfondue_draft_v1";

export type FormDraft = {
  step: number;
  category: string;
  otherCategory: string;
  detail: string;
  building: string;
  zone: string;
  locationNote: string;
  isAnonymous: boolean;
  room: string;
  studentNo: string;
  contactOptional: string;
  lfType: string;
  lfWhen: string;
  lfReturnPoint: string;
  lfSecretDetail: string;
  isPublicShowcase: boolean;
  gpsLat: string;
  gpsLng: string;
};

export function loadDraft(): FormDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FormDraft;
  } catch {
    return null;
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export function useFormDraft(draft: FormDraft, enabled = true) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(draft));
      } catch {
        // quota exceeded — ignore
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft, enabled]);
}

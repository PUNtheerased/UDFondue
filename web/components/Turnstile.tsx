"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      getResponse: (id?: string) => string;
    };
  }
}

type Props = {
  onToken: (token: string) => void;
};

export function TurnstileWidget({ onToken }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  useEffect(() => {
    if (!siteKey) {
      onToken("dev-bypass");
      return;
    }

    let cancelled = false;
    const tryRender = () => {
      if (cancelled || !ref.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(""),
        theme: "light"
      });
    };

    tryRender();
    const t = setInterval(tryRender, 400);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [siteKey, onToken]);

  if (!siteKey) {
    return (
      <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
        Turnstile ยังไม่ตั้งค่า — ใช้โหมดพัฒนา (dev-bypass)
      </p>
    );
  }

  return <div ref={ref} className="flex justify-center" />;
}

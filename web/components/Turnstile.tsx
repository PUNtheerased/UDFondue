"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
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
  const allowDevBypass = process.env.NODE_ENV !== "production" && !siteKey;

  useEffect(() => {
    if (allowDevBypass) {
      onToken("dev-bypass");
      return;
    }
    if (!siteKey) {
      onToken("");
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
  }, [siteKey, allowDevBypass, onToken]);

  if (allowDevBypass) {
    return (
      <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
        โหมดพัฒนา: ข้ามการยืนยันบอท (ใช้เฉพาะบนเครื่องพัฒนา)
      </p>
    );
  }

  if (!siteKey) {
    return (
      <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
        ระบบยืนยันตัวตนยังไม่พร้อม — กรุณาติดต่อครูหรือผู้ดูแลระบบ
      </p>
    );
  }

  return <div ref={ref} className="flex justify-center" />;
}

"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

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

export type TurnstileHandle = {
  reset: () => void;
};

export const TurnstileWidget = forwardRef<TurnstileHandle, Props>(function TurnstileWidget(
  { onToken },
  ref
) {
  const elRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
  const allowDevBypass = process.env.NODE_ENV !== "production" && !siteKey;

  useImperativeHandle(ref, () => ({
    reset: () => {
      onTokenRef.current("");
      if (allowDevBypass) {
        onTokenRef.current("dev-bypass");
        return;
      }
      if (widgetId.current && window.turnstile) {
        window.turnstile.reset(widgetId.current);
      }
    }
  }));

  useEffect(() => {
    if (allowDevBypass) {
      onTokenRef.current("dev-bypass");
      return;
    }
    if (!siteKey) {
      onTokenRef.current("");
      return;
    }

    let cancelled = false;
    const tryRender = () => {
      if (cancelled || !elRef.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(elRef.current, {
        sitekey: siteKey,
        callback: (token: string) => onTokenRef.current(token),
        "expired-callback": () => onTokenRef.current(""),
        theme: "light"
      });
    };

    tryRender();
    const t = setInterval(tryRender, 400);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [siteKey, allowDevBypass]);

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

  return <div ref={elRef} className="flex justify-center" />;
});

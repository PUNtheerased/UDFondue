"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function IconReport({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 3.5h5.5L18 8v12.5a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M13.5 3.5V8H18" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path d="M9.5 13h5M9.5 16.5h3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="17.5" cy="17.5" r="3.25" fill="currentColor" />
      <path d="M17.5 16v3M16 17.5h3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconTrack({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.25" stroke="currentColor" strokeWidth="1.75" />
      <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path
        d="M11 8.25v3.25l2 1.25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLostFound({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7.5 9.5V8a4.5 4.5 0 0 1 9 0v1.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M6.5 9.5h11a1.5 1.5 0 0 1 1.5 1.5v7a2 2 0 0 1-2 2h-10a2 2 0 0 1-2-2v-7a1.5 1.5 0 0 1 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M12 13v3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

const ITEMS: Array<{
  href: string;
  label: string;
  match: (p: string) => boolean;
  icon: (props: { className?: string }) => ReactNode;
}> = [
  {
    href: "/",
    label: "แจ้งเรื่อง",
    match: (p) => p === "/",
    icon: IconReport
  },
  {
    href: "/track",
    label: "ติดตาม",
    match: (p) => p === "/track" || p.startsWith("/track/"),
    icon: IconTrack
  },
  {
    href: "/lost-found",
    label: "ของหาย",
    match: (p) => p === "/lost-found",
    icon: IconLostFound
  }
];

export function StudentNav() {
  const pathname = usePathname() || "/";
  if (pathname.startsWith("/nimda")) return null;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)]"
      aria-label="เมนูหลัก"
    >
      <div className="mx-auto flex max-w-2xl">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors ${
                active ? "text-blue-800" : "text-slate-400"
              }`}
            >
              <Icon className={`h-6 w-6 ${active ? "opacity-100" : "opacity-90"}`} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

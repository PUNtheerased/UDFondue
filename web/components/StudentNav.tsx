"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "แจ้งเรื่อง", match: (p: string) => p === "/" },
  {
    href: "/track",
    label: "ติดตาม",
    match: (p: string) => p === "/track" || p.startsWith("/track/")
  },
  {
    href: "/lost-found",
    label: "ของหาย",
    match: (p: string) => p === "/lost-found"
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
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 py-3 text-center text-xs font-semibold transition-colors ${
                active ? "text-blue-800" : "text-slate-400"
              }`}
            >
              <span
                className={`mx-auto mb-1 block h-1 w-8 rounded-full ${
                  active ? "bg-blue-800" : "bg-transparent"
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

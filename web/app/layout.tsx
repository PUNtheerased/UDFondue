import type { Metadata, Viewport } from "next";
import { Anuphan } from "next/font/google";
import Script from "next/script";
import { StudentNav } from "@/components/StudentNav";
import "./globals.css";

const anuphan = Anuphan({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "UDFondue | ระบบแจ้งเรื่องนักเรียน",
  description: "แจ้งปัญหา ตามหาของหาย และเสนอความคิดเห็นต่อสภานักเรียน"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1e3a8a"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={`${anuphan.className} min-h-dvh antialiased text-gray-900`}>
        <Script src="https://static.line-scdn.net/liff/edge/2/sdk.js" strategy="beforeInteractive" />
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
        <div className="pb-20">{children}</div>
        <StudentNav />
      </body>
    </html>
  );
}

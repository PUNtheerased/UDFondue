import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { StudentNav } from "@/components/StudentNav";
import "./globals.css";

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh antialiased text-gray-900 font-sans">
        <Script src="https://static.line-scdn.net/liff/edge/2/sdk.js" strategy="beforeInteractive" />
        <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
        <div className="pb-20">{children}</div>
        <StudentNav />
      </body>
    </html>
  );
}

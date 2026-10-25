import type { Metadata, Viewport } from "next";
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
        <link
          href="https://fonts.googleapis.com/css2?family=Anuphan:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script src="https://static.line-scdn.net/liff/edge/2/sdk.js" async />
        <script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          async
          defer
        />
      </head>
      <body className="min-h-dvh antialiased text-gray-900">
        <div className="pb-20">{children}</div>
        <StudentNav />
      </body>
    </html>
  );
}

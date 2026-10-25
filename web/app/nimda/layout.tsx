import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "UDFondue Admin"
};

export default function NimdaLayout({ children }: { children: React.ReactNode }) {
  return children;
}

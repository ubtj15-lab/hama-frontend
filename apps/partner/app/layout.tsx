import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "매장주 대시보드 | HAMA",
  description: "하마 매장주 대시보드",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

// ✅ 전역 플로팅 마이크
import FloatingMic from "./components/FloatingMic";

export const metadata: Metadata = {
  title: "HAMA",
  description: "하마 - 지역 기반 추천 서비스",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily: "Noto Sans KR, system-ui, -apple-system, sans-serif",
          background: "#eef5fb",
        }}
      >
        {/* 페이지 콘텐츠 */}
        {children}

        {/* ✅ 전역 하단 마이크 버튼 (항상 노출) */}
        <FloatingMic />
      </body>
    </html>
  );
}

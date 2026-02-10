import "./globals.css";
import type { Metadata } from "next";
import { AuthSync } from "./_components/AuthSync";
import { UIOverlayProvider } from "./_providers/UIOverlayProvider";

export const metadata: Metadata = {
  title: "HAMA",
  description: "하마 - 지역 기반 추천 서비스",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0 }}>
        <AuthSync />
        <UIOverlayProvider>
          {children}
        </UIOverlayProvider>
      </body>
    </html>
  );
}

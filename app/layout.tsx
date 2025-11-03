// app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "FreeReserve",
  description: "Hama UX (Beta) + 관리자 예약내역",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {/* autoload=false 로 두고, 화면에서 kakao.maps.load(...)로 초기화 */}
        <Script
          src={`//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_APPKEY}&autoload=false&libraries=services,clusterer`}
          strategy="afterInteractive"
        />
        {children}
      </body>
    </html>
  );
}

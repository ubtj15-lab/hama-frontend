import "./globals.css";
import type { Metadata, Viewport } from "next";
import { AuthSync } from "./_components/AuthSync";
import { UIOverlayProvider } from "./_providers/UIOverlayProvider";
import { PwaClient } from "./_components/pwa/PwaClient";

function safeSiteOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").trim();
  if (!raw) return "http://localhost:3000";
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:3000";
  }
}

const siteUrl = safeSiteOrigin();

export const metadata: Metadata = {
  applicationName: "HAMA",
  title: { default: "HAMA", template: "%s · HAMA" },
  description: "하마 - 지역 기반 추천",
  metadataBase: new URL(siteUrl),
  /* app/manifest.ts 가 <link rel="manifest"> 를 주입 */
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HAMA",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2563eb" },
  ],
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const devSwCleanupScript =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_PWA_SW_IN_DEV !== "1"
    ? `(function(){if(typeof navigator==="undefined"||!navigator.serviceWorker)return;navigator.serviceWorker.getRegistrations().then(function(r){return Promise.all(r.map(function(x){return x.unregister();}));});})();`
    : null;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0 }}>
        {devSwCleanupScript ? (
          <script
            // 개발: 예전 SW가 먼저 로드되면 React 자체가 안 뜰 수 있어, hydration 전에 해제
            dangerouslySetInnerHTML={{ __html: devSwCleanupScript }}
          />
        ) : null}
        <AuthSync />
        <UIOverlayProvider>
          {children}
          <PwaClient />
        </UIOverlayProvider>
      </body>
    </html>
  );
}

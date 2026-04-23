import "./globals.css";
import type { Metadata, Viewport } from "next";
import { AuthSync } from "./_components/AuthSync";
import { UIOverlayProvider } from "./_providers/UIOverlayProvider";
import { PwaClient } from "./_components/pwa/PwaClient";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0 }}>
        <AuthSync />
        <UIOverlayProvider>
          {children}
          <PwaClient />
        </UIOverlayProvider>
      </body>
    </html>
  );
}

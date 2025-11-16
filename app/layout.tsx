// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '하마 로컬 검색',
  description: '하마와 함께 로컬 매장을 찾는 서비스',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {/* ✅ 스마트폰에서 화면 크기 제대로 맞추기 */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

// app/pay/page.tsx
import { Suspense } from "react";
import PayPageClient from "./PayPageClient";

export default function PayPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>결제 정보 불러오는 중...</div>}>
      <PayPageClient />
    </Suspense>
  );
}

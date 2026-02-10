// app/pay/PayPageClient.tsx
"use client";

import React, { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function PayPageClient() {
  const router = useRouter();
  const params = useSearchParams();

  // 예시: /pay?storeId=...&amount=...
  const storeId = params.get("storeId") ?? "";
  const amount = params.get("amount") ?? "";

  useEffect(() => {
    // 필요하면 여기서 검증/로깅
    // console.log({ storeId, amount });
  }, [storeId, amount]);

  return (
    <main style={{ minHeight: "100vh", padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>결제</h1>

      <div style={{ marginTop: 12 }}>
        <div>storeId: {storeId}</div>
        <div>amount: {amount}</div>
      </div>

      <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
        <button onClick={() => router.back()}>뒤로</button>
        <button onClick={() => router.push("/")}>홈</button>
      </div>
    </main>
  );
}

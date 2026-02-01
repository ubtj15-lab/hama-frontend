// app/reserve/page.tsx
"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ReservePage() {
  const router = useRouter();
  const sp = useSearchParams();

  const q = sp.get("q") ?? sp.get("query") ?? "";

  useEffect(() => {
    // ✅ 지금은 내부예약 안 쓰니까: 검색으로 보내거나 홈으로 보냄
    if (q.trim()) {
      router.replace(`/search?query=${encodeURIComponent(q.trim())}`);
    } else {
      router.replace(`/`);
    }
  }, [q, router]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F8FAFC" }}>
      <div style={{ width: "100%", maxWidth: 420, padding: 16 }}>
        <div style={{ background: "#fff", borderRadius: 18, padding: 16, boxShadow: "0 12px 30px rgba(15,23,42,0.10)" }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>예약 페이지</div>
          <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
            지금은 내부 예약이 아니라 외부 예약으로 연결 중이야.
            <br />
            검색 결과로 이동하는 중...
          </div>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** 레거시 성공 페이지 — 로그인 상태는 서버 쿠키·/api/me 기준 */
export default function KakaoSuccessClient() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div>로그인 처리중...</div>
    </main>
  );
}

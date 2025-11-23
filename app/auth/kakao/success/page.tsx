"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function KakaoSuccessPage() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    // ?token=...&nickname=...&points=...
    const token = params.get("token");
    const nickname = params.get("nickname");
    const pointsStr = params.get("points");

    if (!token || !nickname) {
      // 뭔가 잘못 들어온 경우 → 홈으로
      router.replace("/");
      return;
    }

    const points = pointsStr ? Number(pointsStr) : 0;

    // 1) JWT 저장 (나중에 API 호출할 때 사용)
    if (typeof window !== "undefined") {
      window.localStorage.setItem("hamaToken", token);
      window.localStorage.setItem(
        "hamaUser",
        JSON.stringify({
          nickname,
          points,
        })
      );
    }

    // 2) 홈으로 이동
    router.replace("/");
  }, [params, router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#eef5fb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Noto Sans KR, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          padding: "24px 20px",
          borderRadius: 20,
          boxShadow: "0 10px 24px rgba(15,23,42,0.18)",
          textAlign: "center",
          maxWidth: 320,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          하마에 로그인 중이에요…
        </div>
        <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
          카카오에서 받은 로그인 정보를
          <br />
          하마 계정에 연결하는 중입니다.
          <br />
          잠시만 기다려 주세요 🙂
        </div>
      </div>
    </main>
  );
}

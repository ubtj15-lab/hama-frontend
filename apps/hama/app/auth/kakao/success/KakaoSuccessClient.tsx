"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function KakaoSuccessClient() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get("token");
    const userId = params.get("user_id");
    const nickname = params.get("nickname");
    const points = params.get("points");

    if (token) localStorage.setItem("hama_token", token);
    if (nickname) localStorage.setItem("hama_nickname", nickname);
    if (points) localStorage.setItem("hama_points", points);
    if (userId) {
      try {
        const prevRaw = localStorage.getItem("hamaUser");
        const prev = prevRaw ? JSON.parse(prevRaw) : {};
        localStorage.setItem(
          "hamaUser",
          JSON.stringify({
            ...prev,
            user_id: userId,
            nickname: nickname ?? prev.nickname ?? "카카오 사용자",
            points: Number(points ?? prev.points ?? 0) || 0,
          })
        );
        localStorage.setItem("hamaLoggedIn", "1");
      } catch (e) {
        console.error("KakaoSuccessClient local user sync failed:", e);
      }
    }

    router.replace("/");
  }, [params, router]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div>로그인 처리중...</div>
    </main>
  );
}

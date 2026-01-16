"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function KakaoSuccessClient() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get("token");
    const nickname = params.get("nickname");
    const points = params.get("points");

    if (token) localStorage.setItem("hama_token", token);
    if (nickname) localStorage.setItem("hama_nickname", nickname);
    if (points) localStorage.setItem("hama_points", points);

    router.replace("/");
  }, [params, router]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div>로그인 처리중...</div>
    </main>
  );
}

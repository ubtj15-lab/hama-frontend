// src/app/page.tsx
"use client";

import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    console.log("[PAGE] client mounted ✅");

    // 아주 눈에 띄는 빨간 박스를 강제로 붙인다 (진짜로 클라이언트에서만 가능)
    const el = document.createElement("div");
    el.id = "CLIENT_MARK";
    el.textContent = "CLIENT OK";
    Object.assign(el.style, {
      position: "fixed",
      left: "50%",
      bottom: "24px",
      transform: "translateX(-50%)",
      zIndex: "2147483647",
      background: "red",
      color: "#fff",
      padding: "10px 16px",
      borderRadius: "10px",
      fontWeight: "bold",
      boxShadow: "0 6px 16px rgba(0,0,0,.25)",
    });
    document.body.appendChild(el);
    return () => el.remove();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <h1>🔧 Client check page</h1>
      <p>이 문구가 보이고, 콘솔에 로그가 뜨며, 아래 빨간 배지가 생겨야 정상!</p>
    </main>
  );
}

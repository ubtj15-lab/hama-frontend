"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#eef5fb",
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: "Noto Sans KR, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            border: "none",
            background: "#ffffff",
            borderRadius: 9999,
            padding: "8px 10px",
            boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
            cursor: "pointer",
          }}
        >
          ⬅️
        </button>
        <h1 style={{ fontSize: 18, margin: 0 }}>설정</h1>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#ffffff",
          borderRadius: 20,
          padding: "24px 18px",
          boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
        }}
      >
        <p style={{ marginBottom: 12, fontSize: 15, fontWeight: 600 }}>
          앱 테마 · 알림 · 버전 정보
        </p>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>
          이 화면에서는 나중에 다크 모드, 알림 설정,
          <br />
          버전 정보 등을 관리할 수 있게 만들 예정이에요.
        </p>
        <p style={{ fontSize: 12, color: "#9ca3af" }}>
          지금은 베타 버전이라서 디자인만 먼저 보여드려요 🙂
        </p>
      </div>
    </main>
  );
}

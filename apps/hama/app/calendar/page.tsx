"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function CalendarPage() {
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
        <h1 style={{ fontSize: 18, margin: 0 }}>하마 캘린더</h1>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#ffffff",
          borderRadius: 20,
          padding: "24px 18px",
          boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
          textAlign: "center",
        }}
      >
        <p style={{ marginBottom: 8, fontSize: 16, fontWeight: 600 }}>
          여행 / 일정 기록 기능
        </p>
        <p style={{ fontSize: 13, color: "#6b7280" }}>
          여기서 가족 여행, 카페 투어, 미용실 예약 일정을
          <br />
          하마 캘린더에 기록할 수 있도록 만들 예정이에요.
          <br />
          현재는 베타 버전이라 준비 중입니다 😊
        </p>
      </div>
    </main>
  );
}

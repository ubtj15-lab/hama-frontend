"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function PayPage() {
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
        <h1 style={{ fontSize: 18, margin: 0 }}>HAMA Pay</h1>
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
          포인트 · 결제 기능
        </p>
        <p style={{ fontSize: 13, color: "#6b7280" }}>
          하마가 추천한 매장에서 결제하면
          <br />
          포인트를 적립하고, 한 번에 결제할 수 있는
          <br />
          HAMA Pay를 구상 중이에요.
          <br />
          지금은 베타 단계라 데모 설명 화면만 제공됩니다.
        </p>
      </div>
    </main>
  );
}

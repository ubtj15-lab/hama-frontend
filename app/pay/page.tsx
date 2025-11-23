"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function PayPage() {
  const router = useRouter();
  const params = useSearchParams();

  // 예약 화면에서 넘어온 값 받기
  const store = params.get("store") || "테스트 매장";
  const date = params.get("date") || "오늘";
  const time = params.get("time") || "15:00";
  const amount = params.get("amount") || "15,000";

  const handleConfirm = () => {
    alert(
      `하마 페이 데모 결제 완료!\n\n매장: ${store}\n날짜: ${date}\n시간: ${time}\n금액: ${amount}원\n\n(실제 결제는 일어나지 않습니다.)`
    );
    router.push("/");
  };

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
      {/* 헤더 */}
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

      {/* 결제 요약 카드 */}
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#ffffff",
          borderRadius: 20,
          padding: "24px 18px",
          boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
          textAlign: "center",
          marginBottom: 20,
        }}
      >
        <p style={{ marginBottom: 10, fontSize: 16, fontWeight: 600 }}>
          결제 정보 확인
        </p>

        <div style={{ fontSize: 14, lineHeight: 1.8 }}>
          <div>매장: {store}</div>
          <div>
            일시: {date} {time}
          </div>
          <div style={{ fontWeight: 600, marginTop: 10 }}>
            결제 금액: {amount}원
          </div>
        </div>

        <p style={{ marginTop: 14, fontSize: 12, color: "#6b7280" }}>
          이 화면은 데모이며 실제 결제는 이루어지지 않습니다.
        </p>
      </div>

      {/* 결제 수단 안내 카드 */}
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#ffffff",
          borderRadius: 20,
          padding: "18px 18px",
          boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
          textAlign: "center",
          marginBottom: 20,
        }}
      >
        <p style={{ marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
          결제 수단 (베타)
        </p>
        <p style={{ fontSize: 12, color: "#6b7280" }}>
          하마 페이 머니 / 카드 결제 등의 기능은
          <br />
          정식 버전에서 제공될 예정이에요.
        </p>
      </div>

      {/* 결제 버튼 */}
      <button
        onClick={handleConfirm}
        style={{
          width: "100%",
          maxWidth: 380,
          borderRadius: 9999,
          border: "none",
          padding: "12px 0",
          background: "#2563eb",
          color: "#ffffff",
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
          boxShadow: "0 6px 18px rgba(37,99,235,0.4)",
        }}
      >
        {amount}원 결제하기
      </button>
    </main>
  );
}

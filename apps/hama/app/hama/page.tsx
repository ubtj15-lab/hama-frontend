"use client";

import React from "react";
import Link from "next/link";

export default function HamaLegacyPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#e5f0ff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Noto Sans KR, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          margin: "0 auto",
          padding: "24px 16px 32px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            borderRadius: 24,
            background: "#ffffff",
            boxShadow: "0 18px 40px rgba(15,23,42,0.18)",
            padding: "24px 20px",
          }}
        >
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 10,
              color: "#111827",
            }}
          >
            하마 이전 버전 페이지 🦛
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "#4b5563",
              lineHeight: 1.6,
              marginBottom: 16,
            }}
          >
            이 페이지는 예전 테스트용 &quot;/hama&quot; 화면이에요.
            <br />
            지금은 새 홈 화면에서만 기능을 사용하고 있어요.
          </p>

          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              padding: "10px 0",
              borderRadius: 999,
              background:
                "linear-gradient(135deg, #2563eb, #4f46e5)",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              boxShadow: "0 10px 20px rgba(37,99,235,0.45)",
            }}
          >
            메인 홈으로 이동하기
          </Link>
        </div>
      </div>
    </main>
  );
}

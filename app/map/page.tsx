// app/map/page.tsx
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MicButton from "../components/MicButton";

export default function MapPage() {
  const router = useRouter();
  const params = useSearchParams();

  const name = params.get("q") ?? "목적지";
  const lat = Number(params.get("lat") ?? 37.566535);
  const lng = Number(params.get("lng") ?? 126.9779692);

  /** 카카오맵 링크 (웹 페이지) */
  const mapUrl = `https://map.kakao.com/link/map/${encodeURIComponent(
    name
  )},${lat},${lng}`;

  /** 길안내 버튼 → 카카오맵 길안내 페이지 */
  const handleNavigate = () => {
    const url = `https://map.kakao.com/link/to/${encodeURIComponent(
      name
    )},${lat},${lng}`;
    window.open(url, "_blank");
  };

  /** 예약 페이지로 이동 */
  const handleReserve = () => {
    router.push(`/reserve?q=${encodeURIComponent(name)}`);
  };

  /** 🎤 음성 명령 처리 */
  const handleVoiceCommand = (text: string) => {
    const t = text.replace(/\s+/g, "");
    if (t.includes("길안내") || t.includes("길찾기") || t.includes("길찾아줘")) {
      handleNavigate();
      return;
    }
    if (t.includes("예약")) {
      handleReserve();
      return;
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#eef5fb",
        padding: "16px 12px 80px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* 상단 바 */}
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 6,
        }}
      >
        <button
          onClick={() => router.back()}
          style={topBtnStyle}
          aria-label="뒤로"
        >
          ⬅️
        </button>
        <h1
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: "#0f172a",
            fontFamily: "Noto Sans KR, sans-serif",
            flex: 1,
            textAlign: "center",
          }}
        >
          지도 / 길안내
        </h1>
        <div style={{ width: 44 }} />
      </div>

      {/* 목적지 카드 */}
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#ffffff",
          borderRadius: 14,
          padding: "10px 12px",
          boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
          fontFamily: "Noto Sans KR, system-ui, sans-serif",
        }}
      >
        <div style={{ fontWeight: 700, color: "#0f172a" }}>{name}</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </div>
      </div>

      {/* 카카오맵 iframe */}
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          height: 520,
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 10px 24px rgba(0,0,0,0.10)",
          background: "#cfe6ff",
        }}
      >
        <iframe
          title="kakao-map"
          src={mapUrl}
          style={{
            width: "100%",
            height: "100%",
            border: "0",
          }}
          loading="lazy"
        />
      </div>

      {/* 버튼들 */}
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          display: "flex",
          gap: 10,
          marginTop: 10,
        }}
      >
        <button
          onClick={handleNavigate}
          style={primaryBtn}
          aria-label="길안내 시작"
        >
          길안내 시작
        </button>
        <button
          onClick={handleReserve}
          style={ghostBtn}
          aria-label="예약 페이지"
        >
          예약하기
        </button>
      </div>

      {/* 🎤 음성 명령 버튼 */}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        <MicButton onResult={handleVoiceCommand} size={52} />
        <div
          style={{
            fontSize: 11,
            color: "#6b7280",
            fontFamily: "Noto Sans KR, system-ui, sans-serif",
            textAlign: "center",
          }}
        >
          “길안내 시작” 또는 “예약해줘” 라고 말해보세요
        </div>
      </div>
    </main>
  );
}

const topBtnStyle: React.CSSProperties = {
  border: "none",
  background: "#fff",
  borderRadius: 12,
  padding: "10px 12px",
  boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
  cursor: "pointer",
};

const primaryBtn: React.CSSProperties = {
  flex: 1,
  height: 48,
  borderRadius: 12,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(37,99,235,0.35)",
};

const ghostBtn: React.CSSProperties = {
  flex: 1,
  height: 48,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 6px 14px rgba(0,0,0,0.06)",
};

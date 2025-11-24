// app/map/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter, useSearchParams } from "next/navigation";
import MicButton from "../components/MicButton";

declare global {
  interface Window {
    kakao: any;
  }
}

export default function MapPage() {
  const router = useRouter();
  const params = useSearchParams();

  const name = params.get("q") ?? "목적지";
  const lat = Number(params.get("lat") ?? 37.566535);
  const lng = Number(params.get("lng") ?? 126.9779692);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  /** Kakao SDK 로드 후 지도 생성 */
  useEffect(() => {
    if (!sdkReady) return;
    if (typeof window === "undefined") return;
    if (!window.kakao || !window.kakao.maps) return;
    if (!mapRef.current) return;

    const container = mapRef.current;

    // 이미 만들어진 맵 있으면 제거 후 재생성
    if (mapInstanceRef.current) {
      mapInstanceRef.current = null;
      container.innerHTML = "";
    }

    const { kakao } = window;
    const center = new kakao.maps.LatLng(lat, lng);

    const map = new kakao.maps.Map(container, {
      center,
      level: 3,
    });

    const marker = new kakao.maps.Marker({ position: center });
    marker.setMap(map);

    const infoWindow = new kakao.maps.InfoWindow({
      content: `<div style="padding:6px 10px;font-size:13px;">${name}</div>`,
    });
    infoWindow.open(map, marker);

    mapInstanceRef.current = map;

    // 모바일에서 레이아웃 확정 후 한 번 더 리레이아웃
    setTimeout(() => {
      map.relayout();
      map.setCenter(center);
    }, 200);
  }, [sdkReady, lat, lng, name]);

  /** 화면 리사이즈/회전 시 리레이아웃 */
  useEffect(() => {
    const handler = () => {
      const map = mapInstanceRef.current;
      if (!map) return;
      const { kakao } = window;
      const center = new kakao.maps.LatLng(lat, lng);
      map.relayout();
      map.setCenter(center);
    };

    window.addEventListener("resize", handler);
    window.addEventListener("orientationchange", handler);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("orientationchange", handler);
    };
  }, [lat, lng]);

  /** 길안내 (카카오맵 링크) */
  const handleNavigate = () => {
    const url = `https://map.kakao.com/link/to/${encodeURIComponent(
      name
    )},${lat},${lng}`;
    window.open(url, "_blank");
  };

  /** 예약 페이지 이동 */
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

      {/* 지도 컨테이너 */}
      <div
        ref={mapRef}
        style={{
          width: "100%",
          maxWidth: 420,
          height: 520, // 모바일에서도 고정 높이
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 10px 24px rgba(0,0,0,0.10)",
          background: "#cfe6ff",
          position: "relative",
        }}
      />

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

      {/* Kakao Maps SDK: autoload 기본값(true) 사용 */}
      <Script
        id="kakao-map-sdk"
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_APP_KEY}`}
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
      />
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

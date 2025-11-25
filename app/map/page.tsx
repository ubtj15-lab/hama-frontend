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
  const mapObjRef = useRef<any | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  // SDK 로드 후 지도 초기화
  useEffect(() => {
    if (!sdkReady || !mapRef.current) return;
    if (!window.kakao?.maps) return;

    window.kakao.maps.load(() => {
      const center = new window.kakao.maps.LatLng(lat, lng);

      const map = new window.kakao.maps.Map(mapRef.current!, {
        center,
        level: 3,
      });
      mapObjRef.current = map;

      const marker = new window.kakao.maps.Marker({ position: center });
      marker.setMap(map);

      const iw = new window.kakao.maps.InfoWindow({
        content: `<div style="padding:6px 10px;font-size:13px;">${name}</div>`,
      });
      iw.open(map, marker);

      // 모바일에서 처음 로드시 레이아웃 강제 재계산
      setTimeout(() => {
        map.relayout();
        map.setCenter(center);
      }, 100);
    });
  }, [sdkReady, lat, lng, name]);

  // 화면 회전 / 주소창 높이 변경 등에 따라 다시 relayout
  useEffect(() => {
    const handleResize = () => {
      if (!mapObjRef.current || !window.kakao?.maps || !mapRef.current) return;
      const center = new window.kakao.maps.LatLng(lat, lng);
      mapObjRef.current.relayout();
      mapObjRef.current.setCenter(center);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [lat, lng]);

  const handleNavigate = () => {
    const url = `https://map.kakao.com/link/to/${encodeURIComponent(
      name
    )},${lat},${lng}`;
    // 전체 창을 카카오맵으로 이동 (앱/웹 자동 연결)
    window.location.href = url;
  };

  const handleReserve = () => {
    router.push(`/reserve?q=${encodeURIComponent(name)}`);
  };

  const handleVoiceCommand = (text: string) => {
    const t = text.replace(/\s+/g, "");
    if (t.includes("길안내") || t.includes("길찾기") || t.includes("길찾아줘")) {
      handleNavigate();
      return;
    }
    if (t.includes("예약")) {
      handleReserve();
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
        <button onClick={() => router.back()} style={topBtnStyle} aria-label="뒤로">
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

      {/* 지도 영역 */}
      <div
        ref={mapRef}
        style={{
          width: "100%",
          maxWidth: 420,
          height: 520,
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 10px 24px rgba(0,0,0,0.10)",
          background: "#cfe6ff", // 로딩 중일 땐 이 파란색만 보임
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
        <button onClick={handleNavigate} style={primaryBtn} aria-label="길안내 시작">
          길안내 시작
        </button>
        <button onClick={handleReserve} style={ghostBtn} aria-label="예약 페이지">
          예약하기
        </button>
      </div>

      {/* 음성 명령 버튼 */}
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

      {/* Kakao Maps SDK */}
      <Script
        id="kakao-map-sdk"
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_APP_KEY}&autoload=false`}
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
  boxShadow: "0 8px 18px rgba(37,99,235,.35)",
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

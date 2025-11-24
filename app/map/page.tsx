"use client";

import React, { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter, useSearchParams } from "next/navigation";
import MicButton from "../components/MicButton";

/** Kakao 타입 전역 선언 */
declare global {
  interface Window {
    kakao: any;
  }
}

export default function MapPage() {
  const router = useRouter();
  const params = useSearchParams();

  // URL 파라미터 (검색 카드/추천 카드에서 넘어옴)
  const name = params.get("q") ?? "목적지";
  const lat = Number(params.get("lat") ?? 37.566535);
  const lng = Number(params.get("lng") ?? 126.9779692);

  const mapRef = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);

  /** SDK 로드 후 지도 초기화 */
  useEffect(() => {
    if (!sdkReady || !mapRef.current) return;
    if (!window.kakao?.maps) return;

    let map: any = null;
    let relayout: (() => void) | null = null;

    window.kakao.maps.load(() => {
      const center = new window.kakao.maps.LatLng(lat, lng);

      map = new window.kakao.maps.Map(mapRef.current!, {
        center,
        level: 3,
      });

      const marker = new window.kakao.maps.Marker({ position: center });
      marker.setMap(map);

      const iw = new window.kakao.maps.InfoWindow({
        content: `<div style="padding:6px 10px;font-size:13px;">${name}</div>`,
      });
      iw.open(map, marker);

      // 🔥 모바일에서 처음 로딩 시 레이아웃이 안 맞는 경우를 위한 보정
      relayout = () => {
        if (!map) return;
        map.relayout();
        map.setCenter(center);
      };

      // 살짝 딜레이 후 한 번 더 레이아웃 계산
      setTimeout(relayout, 120);

      // 화면 회전/리사이즈에도 다시 맞춰주기
      window.addEventListener("resize", relayout);
    });

    // cleanup
    return () => {
      if (relayout) {
        window.removeEventListener("resize", relayout);
      }
    };
  }, [sdkReady, lat, lng, name]);

  /** 길안내(카카오맵 링크) */
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
    // "길안내", "길 찾아줘" 등 포함되면
    if (t.includes("길안내") || t.includes("길찾기") || t.includes("길찾아줘")) {
      handleNavigate();
      return;
    }
    // "예약", "예약해줘" 등 포함되면
    if (t.includes("예약")) {
      handleReserve();
      return;
    }
    // 그 외엔 그냥 무시 (원하면 토스트/alert로 안내 가능)
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

      {/* 지도 */}
      <div
        ref={mapRef}
        style={{
          width: "100%",
          maxWidth: 420,
          height: 520, // 고정 높이 (모바일에서도 안전)
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 10px 24px rgba(0,0,0,0.10)",
          background: "#cfe6ff",
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
  boxShadow: "0 8px 18px rgba(37,99,235,.35)`,
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

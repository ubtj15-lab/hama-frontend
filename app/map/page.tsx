"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MicButton from "../components/MicButton";
import loadKakaoSdk from "../../utils/loadKakaoSdk";

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

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any | null>(null);

  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0); // 재시도용 트리거

  const initMap = () => {
    if (!mapRef.current) return;

    setMapLoading(true);
    setMapError(null);

    loadKakaoSdk(() => {
      try {
        if (!window.kakao || !window.kakao.maps) {
          setMapError("카카오 지도를 불러오지 못했어요.");
          setMapLoading(false);
          return;
        }

        const kakao = window.kakao;
        const center = new kakao.maps.LatLng(lat, lng);
        const container = mapRef.current!;

        const map = new kakao.maps.Map(container, {
          center,
          level: 3,
        });
        mapInstanceRef.current = map;

        const marker = new kakao.maps.Marker({ position: center });
        marker.setMap(map);

        const iw = new kakao.maps.InfoWindow({
          content: `<div style="padding:6px 10px;font-size:13px;">${name}</div>`,
        });
        iw.open(map, marker);

        setTimeout(() => {
          map.relayout();
          map.setCenter(center);
        }, 150);

        setMapLoading(false);
      } catch (e) {
        console.error("[MAP] initMap error", e);
        setMapError("지도를 그리는 중 오류가 발생했어요.");
        setMapLoading(false);
      }
    });
  };

  useEffect(() => {
    initMap();
    // retryToken 바뀔 때마다 다시 시도
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, name, retryToken]);

  useEffect(() => {
    const handleResize = () => {
      const map = mapInstanceRef.current;
      if (!map) return;
      map.relayout();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  const handleNavigate = () => {
    const url = `https://map.kakao.com/link/to/${encodeURIComponent(
      name
    )},${lat},${lng}`;
    window.open(url, "_blank");
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
      return;
    }
  };

  const handleRetry = () => {
    setRetryToken((x) => x + 1);
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
          style={{
            border: "none",
            background: "#fff",
            borderRadius: 12,
            padding: "10px 12px",
            boxShadow: "0 6px 14px rgba(0,0,0,0.08)",
            cursor: "pointer",
          }}
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

      <div
        style={{
          width: "100%",
          maxWidth: 420,
          position: "relative",
        }}
      >
        <div
          ref={mapRef}
          style={{
            width: "100%",
            height: 520,
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: "0 10px 24px rgba(0,0,0,0.10)",
            background: "#cfe6ff",
          }}
        />

        {(mapLoading || mapError) && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 18,
              background: "rgba(239,246,255,0.9)",
              fontFamily: "Noto Sans KR, system-ui, sans-serif",
              fontSize: 13,
              color: "#1f2937",
              padding: "0 16px",
              textAlign: "center",
            }}
          >
            {mapLoading && <div>지도를 불러오는 중이에요…</div>}
            {mapError && (
              <>
                <div style={{ marginBottom: 8 }}>{mapError}</div>
                <button
                  type="button"
                  onClick={handleRetry}
                  style={{
                    border: "none",
                    borderRadius: 9999,
                    padding: "6px 16px",
                    background: "#2563eb",
                    color: "#fff",
                    fontSize: 12,
                    cursor: "pointer",
                    boxShadow: "0 4px 10px rgba(37,99,235,0.4)",
                  }}
                >
                  다시 시도하기
                </button>
              </>
            )}
          </div>
        )}
      </div>

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
          style={{
            flex: 1,
            height: 48,
            borderRadius: 12,
            border: "none",
            background: "#2563eb",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 8px 18px rgba(37,99,235,.35)",
          }}
          aria-label="길안내 시작"
        >
          길안내 시작
        </button>
        <button
          onClick={handleReserve}
          style={{
            flex: 1,
            height: 48,
            borderRadius: 12,
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#0f172a",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 6px 14px rgba(0,0,0,0.06)",
          }}
          aria-label="예약 페이지"
        >
          예약하기
        </button>
      </div>

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

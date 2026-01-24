"use client";

import { useEffect, useState } from "react";

export type HomeMode = "recommend" | "explore";

type Loc = { lat: number; lng: number };

export function useHomeMode() {
  const [mode, setMode] = useState<HomeMode>("recommend");
  const [loc, setLoc] = useState<Loc | null>(null);
  const [isLocLoading, setIsLocLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function run() {
      setIsLocLoading(true);

      if (!("geolocation" in navigator)) {
        if (alive) {
          setLoc(null);
          setMode("recommend");
          setIsLocLoading(false);
        }
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (!alive) return;

          setLoc({ lat, lng });

          // 🔥 여기서 /api/local/reverse 를 사용해서 지역 판별
          try {
            const res = await fetch(`/api/local/reverse?lat=${lat}&lng=${lng}`, { cache: "no-store" });
            const json = await res.json();

            const text = JSON.stringify(json ?? {}).toLowerCase();

            // ✅ “오산/동탄” 판별 (너 서비스 기준으로 키워드만 잡으면 됨)
            const isOsan = text.includes("오산");
            const isDongtan = text.includes("동탄");

            setMode(isOsan || isDongtan ? "recommend" : "explore");
          } catch {
            // reverse 실패해도 기본은 추천 모드
            setMode("recommend");
          } finally {
            setIsLocLoading(false);
          }
        },
        () => {
          if (!alive) return;
          setLoc(null);
          setMode("recommend");
          setIsLocLoading(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    run();
    return () => {
      alive = false;
    };
  }, []);

  return { mode, loc, isLocLoading };
}

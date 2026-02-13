"use client";

import { useEffect, useState } from "react";

export function useGeoLocation() {
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("geolocation" in navigator)) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        // 위치 권한 거부/실패는 그냥 null 유지
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  return loc;
}

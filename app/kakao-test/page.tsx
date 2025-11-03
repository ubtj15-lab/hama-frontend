"use client";
import { useEffect } from "react";
// ★ 경로 주의: lib 폴더가 app 바로 아래라면 ↓ 그대로.
// 만약 src/app 구조면 "../../lib/loadKakao" 로 바꿔줘!
import { loadKakao } from "../lib/loadKakao";

export default function KakaoTestPage() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_KAKAO_APP_KEY!;
    loadKakao(key).then(() => {
      const w = window as any;
      const el = document.getElementById("map")!;
      const map = new w.kakao.maps.Map(
        el,
        { center: new w.kakao.maps.LatLng(37.5665, 126.9780), level: 4 }
      );
      new w.kakao.maps.Marker({
        position: new w.kakao.maps.LatLng(37.5665, 126.9780),
        map,
      });
    });
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 8, fontWeight: 700 }}>🗺️ Kakao Map Test</div>
      <div
        id="map"
        style={{
          width: "100%",
          height: "420px",   // ← 높이 필수!
          border: "2px solid #ddd",
          borderRadius: 12,
        }}
      />
    </div>
  );
}

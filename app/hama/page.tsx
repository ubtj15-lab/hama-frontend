// app/hama/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
// (네가 쓰는 import 그대로 유지: loadKakaoSdk, MicButton, QuickReserve 등)

// ====== 헬퍼들(카테고리 매핑/스마트검색 등)은 여기 위쪽에 두기 ======
const CATEGORY_MAP: Record<string, string> = {
  카페: "CE7",
  편의점: "CS2",
  음식점: "FD6",
  식당: "FD6",
  약국: "PM9",
  주차장: "PK6",
  병원: "HP8",
  마트: "MT1",
};

function inferCategory(text: string): string | undefined {
  const t = text.toLowerCase();
  for (const k of Object.keys(CATEGORY_MAP)) {
    if (t.includes(k.toLowerCase())) return CATEGORY_MAP[k];
  }
  return undefined;
}

async function smartSearch(
  text: string,
  center: kakao.maps.LatLng,
  radius = 1500
): Promise<{
  data: kakao.maps.services.PlacesSearchResult;
  status: kakao.maps.services.Status;
}> {
  const ps = new kakao.maps.services.Places();
  const category = inferCategory(text);
  const keyword = text.replace(/\s+/g, " ").trim();

  const once = (r: number) =>
    new Promise<{
      data: kakao.maps.services.PlacesSearchResult;
      status: kakao.maps.services.Status;
    }>((resolve) => {
      if (category) {
        ps.categorySearch(
          category,
          (data, status) => resolve({ data, status }),
          { location: center, radius: r }
        );
      } else {
        ps.keywordSearch(
          keyword,
          (data, status) => resolve({ data, status }),
          { location: center, radius: r }
        );
      }
    });

  let { data, status } = await once(radius);
  if (status === kakao.maps.services.Status.OK && data.length > 0) {
    return { data, status };
  }
  const r2 = Math.min(radius < 3000 ? radius + 1000 : radius + 3000, 10000);
  ({ data, status } = await once(r2));
  return { data, status };
}
// ====== 헬퍼 끝 ======


// ✅ 여기 **반드시** 리액트 컴포넌트를 기본 내보내기!
export default function HamaPage() {
  // 기존에 쓰던 상태/refs/이벤트 등 유지
  // const mapRef = useRef<HTMLDivElement>(null);
  // useEffect(()=>{ ... },[]);

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      {/* 네가 사용하던 지도/마이크 버튼/빠른예약 컴포넌트 그대로 */}
      {/* <div ref={mapRef} style={{ width: "100%", height: "100%" }} /> */}
      {/* <MicButton onSpeech={(text)=>{ ... smartSearch(text, center) }} /> */}
    </div>
  );
}

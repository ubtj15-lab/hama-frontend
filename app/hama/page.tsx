// app/hama/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
// 실제 프로젝트에 맞게 주석 풀고 경로 맞춰줘!
// import { loadKakaoSdk } from "@/lib/kakao";
// import MicButton from "@/components/MicButton";
// import QuickReserve from "@/components/QuickReserve";

declare const kakao: any;

// ===== 카테고리 매핑 (원래 쓰던 거 그대로) =====
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

// ===== 스마트 검색 헬퍼 =====
type SmartSearchParams = {
  text: string;
  center: any;      // 타입 귀찮으면 any 로 완화
  radius?: number;
};

type SmartSearchResult = {
  data: any;
  status: any;
};

async function smartSearch({
  text,
  center,
  radius = 1500,
}: SmartSearchParams): Promise<SmartSearchResult> {
  if (typeof window === "undefined" || !window.kakao) {
    throw new Error("카카오 지도 SDK가 로드되지 않았습니다.");
  }

  const ps = new kakao.maps.services.Places();

  // 한 번 검색하는 헬퍼
  const once = (r: number): Promise<SmartSearchResult> =>
    new Promise((resolve) => {
      const options = {
        location: center,
        radius: r,
      };

      ps.keywordSearch(
        text,
        (data: any, status: any) => {
          resolve({ data, status });
        },
        options
      );
    });

  // 1차 검색
  let { data, status } = await once(radius);

  if (status === kakao.maps.services.Status.OK && data.length > 0) {
    return { data, status };
  }

  // 1차에 결과 없으면 반경 늘려서 한 번 더
  const r2 = Math.min(radius < 3000 ? radius + 1000 : radius + 3000, 10000);
  ({ data, status } = await once(r2));

  return { data, status };
}
// ===== 헬퍼 끝 =====


// ✅ 리액트 컴포넌트 (HamaPage)
export default function HamaPage() {
  // 예시: 기존에 쓰던 상태/refs 그대로 다시 채워 넣어
  // const mapRef = useRef<HTMLDivElement | null>(null);
  // const [center, setCenter] = useState<any>(null);

  // useEffect(() => {
  //   // loadKakaoSdk 로드하고 지도 띄우는 로직 …
  // }, []);

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      {/* 여기 안에 네가 원래 쓰던 지도 / 검색 UI / MicButton 등 다시 넣어주면 됨 */}

      {/* 예시 */}
      {/* <div ref={mapRef} style={{ width: "100%", height: "100%" }} /> */}
      {/* <MicButton onResult={(text) => smartSearch({ text, center })} /> */}
    </div>
  );
}

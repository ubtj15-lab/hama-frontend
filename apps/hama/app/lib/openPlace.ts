// app/lib/openPlace.ts
"use client";

import type { HomeCard } from "@/lib/storeTypes";

type Provider = "naver" | "kakao";

function normalize(v?: string | null) {
  return String(v ?? "").trim();
}

export function openPlace(card: Partial<HomeCard>, provider: Provider) {
  if (typeof window === "undefined") return;

  const anyCard = card as any;

  const name = normalize(anyCard?.name);
  const naverPlaceId = normalize(anyCard?.naver_place_id);
  const kakaoUrl = normalize(anyCard?.kakao_place_url);

  // ✅ 1) 네이버: place id 있으면 그걸 최우선
  if (provider === "naver") {
    if (naverPlaceId) {
      window.open(`https://m.place.naver.com/place/${encodeURIComponent(naverPlaceId)}`, "_blank", "noopener,noreferrer");
      return;
    }
    // 없으면 검색으로
    if (name) {
      window.open(`https://m.search.naver.com/search.naver?query=${encodeURIComponent(name)}`, "_blank", "noopener,noreferrer");
      return;
    }
    return;
  }

  // ✅ 2) 카카오: place url 있으면 그걸 최우선
  if (provider === "kakao") {
    if (kakaoUrl) {
      window.open(kakaoUrl, "_blank", "noopener,noreferrer");
      return;
    }
    // 없으면 검색으로
    if (name) {
      window.open(`https://m.map.kakao.com/actions/searchView?q=${encodeURIComponent(name)}`, "_blank", "noopener,noreferrer");
      return;
    }
    return;
  }
}

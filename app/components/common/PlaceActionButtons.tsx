"use client";

import React from "react";
import { openNaverPlace } from "@/lib/openNaverPlace";
import { openKakaoPlace } from "@/lib/openKakaoPlace";
import type { HomeCard } from "@/lib/storeTypes";

type Props = {
  card: HomeCard;
  className?: string;
};

export default function PlaceActionButtons({ card }: Props) {
  const anyCard = card as any;

  // ✅ DB/모델이 섞여있어도 안전하게 받기
  const name = String(anyCard?.name ?? "").trim();

  const naverPlaceId = String(anyCard?.naver_place_id ?? anyCard?.naverPlaceId ?? "").trim();
  const naverPlaceUrl = String(anyCard?.naver_place_url ?? anyCard?.naverPlaceUrl ?? "").trim();

  const kakaoPlaceUrl = String(anyCard?.kakao_place_url ?? anyCard?.kakaoPlaceUrl ?? "").trim();

  const hasNaver = !!naverPlaceUrl || !!naverPlaceId;
  const hasKakao = !!kakaoPlaceUrl;

  // ✅ 둘 다 없으면 아예 숨김(UX 원칙)
  if (!hasNaver && !hasKakao) return null;

  return (
    <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
      {hasNaver && (
        <button
          type="button"
          onClick={() => {
            // 1) URL 있으면 URL 우선(네이버 me 링크 등)
            if (naverPlaceUrl) {
              window.open(naverPlaceUrl, "_blank", "noopener,noreferrer");
              return;
            }
            // 2) 없으면 placeId로 상세 시도 → fallback 검색
            openNaverPlace({ name, naverPlaceId: naverPlaceId || null });
          }}
          style={{
            flex: 1,
            height: 44,
            borderRadius: 12,
            border: "none",
            background: "#03C75A",
            color: "#fff",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          네이버에서 보기
        </button>
      )}

      {hasKakao && (
        <button
          type="button"
          onClick={() => {
            openKakaoPlace({ name, kakaoPlaceUrl: kakaoPlaceUrl || null });
          }}
          style={{
            flex: 1,
            height: 44,
            borderRadius: 12,
            border: "none",
            background: "#FEE500",
            color: "#000",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          카카오맵에서 보기
        </button>
      )}
    </div>
  );
}

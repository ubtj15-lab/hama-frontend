"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import type { HomeCard } from "@/lib/storeTypes";
import { logEvent } from "@/lib/logEvent";
import {
  buildKakaoPlaceUrl,
  buildKakaoDirectionsUrl,
  buildNaverPlaceUrl,
  buildNaverSearchUrl,
} from "@/lib/placeLinks";

type Props = {
  card: HomeCard;
  onClose: () => void;
};

function openNewTab(url: string) {
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    window.location.href = url;
  }
}

export default function CardDetailOverlay({ card, onClose }: Props) {
  const anyCard = card as any;
  const imageUrl: string | undefined =
    anyCard.imageUrl ?? anyCard.image ?? anyCard.image_url ?? undefined;

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  };

  const naverPlaceUrl = useMemo(() => buildNaverPlaceUrl(card), [card]);
  const kakaoPlaceUrl = useMemo(() => buildKakaoPlaceUrl(card), [card]);
  const kakaoDirectionsUrl = useMemo(() => buildKakaoDirectionsUrl(card), [card]);

  // ✅ 라벨 자동: naver_place_id 있으면 “네이버 상세”, 없으면 “네이버 검색”
  const naverLabel = naverPlaceUrl ? "네이버 상세" : "네이버 검색";

  // ✅ 카카오도 placeUrl 있으면 “카카오 장소”, 없으면 “카카오 길안내(좌표 있을 때)”로
  const kakaoLabel = kakaoPlaceUrl ? "카카오 장소" : kakaoDirectionsUrl ? "카카오 길안내" : "카카오 검색";

  const handleNaverClick = () => {
    logEvent("place_open_naver", { id: anyCard?.id, name: anyCard?.name });

    if (naverPlaceUrl) {
      openNewTab(naverPlaceUrl);
      return;
    }

    // ✅ fallback: 네이버 검색
    const url = buildNaverSearchUrl(card);
    showToast("네이버 링크가 없어서 검색으로 열었어!");
    openNewTab(url);
  };

  const handleKakaoClick = () => {
    logEvent("place_open_kakao", { id: anyCard?.id, name: anyCard?.name });

    if (kakaoPlaceUrl) {
      openNewTab(kakaoPlaceUrl);
      return;
    }

    if (kakaoDirectionsUrl) {
      showToast("카카오 장소 링크가 없어서 길안내로 열었어!");
      openNewTab(kakaoDirectionsUrl);
      return;
    }

    // ✅ 최후 fallback: 네이버 검색(카카오 검색 UX가 오베에서 더 흔들려서)
    const url = buildNaverSearchUrl(card);
    showToast("링크 정보가 부족해서 네이버 검색으로 열었어!");
    openNewTab(url);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(15,23,42,0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* 바깥 클릭 닫기 */}
      <div onClick={onClose} style={{ position: "absolute", inset: 0 }} />

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 430,
          height: "100%",
          maxHeight: 820,
          padding: "16px 12px 16px",
          boxSizing: "border-box",
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: 32,
            overflow: "hidden",
            background: "#111827",
            boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 이미지 */}
          <div style={{ position: "absolute", inset: 0 }}>
            {imageUrl ? (
              <Image src={imageUrl} alt={anyCard.name ?? "place"} fill style={{ objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "#0b1220" }} />
            )}
          </div>

          {/* 상단 뒤로 */}
          <button
            type="button"
            onClick={onClose}
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              width: 36,
              height: 36,
              borderRadius: 999,
              border: "none",
              background: "rgba(15,23,42,0.6)",
              color: "#f9fafb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 10,
            }}
          >
            ←
          </button>

          {/* 하단 그라데이션 + 텍스트 */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: "22px 20px 130px",
              background:
                "linear-gradient(180deg, rgba(15,23,42,0) 0%, rgba(15,23,42,0.85) 75%, rgba(15,23,42,0.92) 100%)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 900, color: "#f9fafb", marginBottom: 8 }}>
              {anyCard.name}
            </div>
            <div style={{ fontSize: 12, color: "#cbd5e1" }}>
              {(anyCard.categoryLabel ?? anyCard.category) ? `${anyCard.categoryLabel ?? anyCard.category}` : ""}
            </div>

            {/* ✅ 상태 힌트(오베용, 작게) */}
            <div style={{ marginTop: 10, fontSize: 11, color: "rgba(226,232,240,0.85)" }}>
              {naverPlaceUrl ? "• 네이버 상세 링크 있음" : "• 네이버 ID 없음 → 검색으로 열림"}
              <br />
              {kakaoPlaceUrl
                ? "• 카카오 장소 링크 있음"
                : kakaoDirectionsUrl
                ? "• 카카오 장소 링크 없음 → 길안내로 열림"
                : "• 카카오 링크/좌표 부족 → 검색으로 열림"}
            </div>
          </div>

          {/* ✅ 하단 액션바: 2버튼으로 통일 */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: "0 16px",
              paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
              zIndex: 20,
            }}
          >
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={handleNaverClick}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 999,
                  border: "none",
                  background: "rgba(249,250,251,0.95)",
                  color: "#111827",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: "pointer",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {naverLabel}
              </button>

              <button
                type="button"
                onClick={handleKakaoClick}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 999,
                  border: "none",
                  background: "rgba(15,23,42,0.85)",
                  color: "#f9fafb",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: "pointer",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {kakaoLabel}
              </button>
            </div>
          </div>

          {/* ✅ 토스트 */}
          {toast && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: 88,
                transform: "translateX(-50%)",
                padding: "10px 12px",
                borderRadius: 999,
                background: "rgba(15,23,42,0.88)",
                color: "#f9fafb",
                fontSize: 12,
                fontWeight: 800,
                boxShadow: "0 10px 25px rgba(0,0,0,0.35)",
                zIndex: 50,
                pointerEvents: "none",
                maxWidth: 320,
                textAlign: "center",
              }}
            >
              {toast}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

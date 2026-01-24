"use client";

import React from "react";
import Image from "next/image";
import type { CardInfo, Category } from "../_hooks/useSearchStores";

function labelOfCategory(category: Category): string {
  if (category === "cafe") return "카페";
  if (category === "restaurant") return "식당";
  if (category === "salon") return "미용실";
  return "액티비티";
}

function fallbackImageByCategory(category: Category) {
  if (category === "restaurant") return "/images/fallback/restaurant.jpg";
  if (category === "cafe") return "/images/fallback/cafe.jpg";
  if (category === "salon") return "/images/fallback/beauty.jpg";
  return "/images/fallback/activity.jpg";
}

type Props = {
  query: string;
  hasMyLocation: boolean;
  pageIndex: number;
  pages: CardInfo[][];
  selected: CardInfo | null;
  others: CardInfo[];
  swipeDirection: "left" | "right" | null;
  onBack: () => void;
  onOpenExpanded: (id: string) => void;
  onOpenKakaoPlace: (card: CardInfo) => void;
  onGoToPage: (index: number) => void;
  onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: (e: React.TouchEvent<HTMLDivElement>) => void;
};

export default function SearchCards(props: Props) {
  const {
    query,
    hasMyLocation,
    pageIndex,
    pages,
    selected,
    others,
    swipeDirection,
    onBack,
    onOpenExpanded,
    onOpenKakaoPlace,
    onGoToPage,
    onTouchStart,
    onTouchEnd,
  } = props;

  const hasCards = !!selected;

  return (
    <>
      {/* 상단 바 */}
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          marginTop: 0,
          maxHeight: 60,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
        }}
      >
        <button
          onClick={onBack}
          style={{
            border: "none",
            background: "#ffffff",
            borderRadius: 12,
            padding: "8px 10px",
            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.08)",
            cursor: "pointer",
          }}
        >
          ⬅️
        </button>

        <div
          style={{
            flex: 1,
            marginLeft: 8,
            padding: "8px 12px",
            borderRadius: 9999,
            background: "#ffffff",
            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.08)",
            fontSize: 13,
            color: "#4b5563",
            fontFamily: "Noto Sans KR, system-ui, sans-serif",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {query
            ? `“${query}” 검색 결과${
                hasCards ? ` · ${labelOfCategory(selected!.categoryNorm)}` : ""
              }${hasMyLocation ? " · 내 위치 기준" : ""}`
            : "하마 추천 장소"}
        </div>
      </div>

      {/* 카드 영역 */}
      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          transform:
            swipeDirection === "left"
              ? "translateX(-16px)"
              : swipeDirection === "right"
              ? "translateX(16px)"
              : "translateX(0)",
          transition: "transform 0.22s ease-out",
        }}
      >
        {/* 카드가 없으면 Empty 카드 표시 */}
        {!hasCards ? (
          <div
            style={{
              width: 316,
              height: 269,
              borderRadius: 24,
              overflow: "hidden",
              position: "relative",
              boxShadow: "0 6px 18px rgba(0, 0, 0, 0.18)",
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Noto Sans KR, system-ui, sans-serif",
              color: "#6b7280",
              fontSize: 14,
            }}
          >
            추천 카드가 없어요
          </div>
        ) : (
          <>
            {/* 큰 카드 1 */}
            <div
              onClick={() => onOpenExpanded(selected!.id)}
              style={{
                width: 316,
                height: 269,
                borderRadius: 24,
                overflow: "hidden",
                position: "relative",
                boxShadow: "0 6px 18px rgba(0, 0, 0, 0.2)",
                cursor: "pointer",
                background: "#dbeafe",
              }}
            >
              <Image
                src={
                  selected!.image_url ||
                  fallbackImageByCategory(selected!.categoryNorm)
                }
                alt={selected!.name}
                fill
                sizes="316px"
                style={{ objectFit: "cover" }}
              />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenKakaoPlace(selected!);
                }}
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  border: "none",
                  borderRadius: 9999,
                  padding: "6px 10px",
                  background: "rgba(255,255,255,0.95)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "Noto Sans KR, system-ui, sans-serif",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
                }}
              >
                {labelOfCategory(selected!.categoryNorm)}정보보기
              </button>

              <div
                style={{
                  position: "absolute",
                  left: 12,
                  bottom: 12,
                  padding: "6px 10px",
                  borderRadius: 9999,
                  background: "rgba(15,23,42,0.75)",
                  color: "#f9fafb",
                  fontSize: 12,
                  fontFamily: "Noto Sans KR, system-ui, sans-serif",
                }}
              >
                {selected!.name} · {labelOfCategory(selected!.categoryNorm)}
                {selected!.distanceKm != null
                  ? ` · ${selected!.distanceKm.toFixed(1)}km`
                  : ""}
              </div>
            </div>

            {/* 작은 카드 2 */}
            <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
              {others.slice(0, 2).map((card) => (
                <div
                  key={card.id}
                  onClick={() => onOpenExpanded(card.id)}
                  style={{
                    width: 156,
                    height: 165,
                    borderRadius: 24,
                    overflow: "hidden",
                    position: "relative",
                    boxShadow: "0 6px 18px rgba(0, 0, 0, 0.2)",
                    cursor: "pointer",
                    background: "#dbeafe",
                  }}
                >
                  <Image
                    src={
                      card.image_url ||
                      fallbackImageByCategory(card.categoryNorm)
                    }
                    alt={card.name}
                    fill
                    sizes="156px"
                    style={{ objectFit: "cover" }}
                  />

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenKakaoPlace(card);
                    }}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      border: "none",
                      borderRadius: 9999,
                      padding: "5px 8px",
                      background: "rgba(255,255,255,0.95)",
                      cursor: "pointer",
                      fontSize: 11,
                      fontFamily: "Noto Sans KR, system-ui, sans-serif",
                      boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
                    }}
                  >
                    {labelOfCategory(card.categoryNorm)}정보보기
                  </button>

                  <div
                    style={{
                      position: "absolute",
                      left: 10,
                      bottom: 10,
                      padding: "4px 8px",
                      borderRadius: 9999,
                      background: "rgba(15,23,42,0.75)",
                      color: "#f9fafb",
                      fontFamily: "Noto Sans KR, system-ui, sans-serif",
                      fontSize: 11,
                    }}
                  >
                    {card.name}
                    {card.distanceKm != null
                      ? ` · ${card.distanceKm.toFixed(1)}km`
                      : ""}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ✅ 페이지 점(3개) — 반드시 return 내부에 있어야 함 */}
        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          {[0, 1, 2].map((i) => {
            const hasPage = (pages?.[i]?.length ?? 0) > 0;
            return (
              <button
                key={i}
                onClick={() => onGoToPage(i)}
                disabled={!hasPage}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  border: "none",
                  cursor: hasPage ? "pointer" : "default",
                  background: hasPage
                    ? i === pageIndex
                      ? "#2563eb"
                      : "rgba(148,163,184,0.7)"
                    : "rgba(209,213,219,0.8)",
                  transform: i === pageIndex && hasPage ? "scale(1.2)" : "scale(1)",
                  transition: "background 0.2s ease, transform 0.2s ease",
                }}
                aria-label={`page-${i + 1}`}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}

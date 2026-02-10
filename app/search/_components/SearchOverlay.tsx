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
  if (category === "restaurant") return "/images/category/restaurant.jpg";
  if (category === "cafe") return "/images/category/cafe.jpg";
  if (category === "salon") return "/images/category/salon.jpg";
  return "/images/category/activity.jpg";
}

type Props = {
  visible: boolean;
  expanded: boolean;
  detailOpen: boolean;
  reserveStep: 0 | 1 | 2;
  reserveDate: string | null;
  reserveTime: string | null;
  selected: CardInfo | null;
  onClose: () => void;
  onOpenKakaoPlace: (card: CardInfo) => void;
  onGoToMap: (card: CardInfo) => void;
  onReserveClick: () => void;
  onRate: () => void;
  onToggleDetail: () => void;
  onOverlayScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  setReserveDate: (v: string) => void;
  setReserveTime: (v: string) => void;
  isSaved?: (storeId: string) => boolean;
  onToggleSaved?: (storeId: string) => void;
};

export default function SearchOverlay(props: Props) {
  const {
    visible,
    expanded,
    reserveStep,
    reserveDate,
    reserveTime,
    selected,
    onClose,
    onOpenKakaoPlace,
    onGoToMap,
    onOverlayScroll,
    setReserveDate,
    setReserveTime,
    isSaved,
    onToggleSaved,
  } = props;

  if (!visible || !selected) return null;

  const dateOptions = [
    { label: "오늘", value: "오늘" },
    { label: "내일", value: "내일" },
    { label: "모레", value: "모레" },
  ];
  const timeOptions = ["11:00", "13:00", "15:00", "17:00", "19:00"];

  const openInNewTab = (url: string) => {
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {}
  };

  const openNaver = (name: string) => {
    const q = encodeURIComponent(name);
    const isMobile =
      typeof window !== "undefined" && window.matchMedia?.("(max-width: 768px)")?.matches;
    const url = isMobile
      ? `https://m.search.naver.com/search.naver?query=${q}`
      : `https://search.naver.com/search.naver?query=${q}`;
    openInNewTab(url);
  };

  return (
    <div
      onScroll={onOverlayScroll}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 3000,
        background: "rgba(15,23,42,0.75)",
        backdropFilter: "blur(6px)",
        overflowY: "auto",
        opacity: expanded ? 1 : 0,
        transition: "opacity 0.28s ease",
      }}
    >
      <div
        style={{
          minHeight: "100vh",
          padding: "24px 12px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
        }}
      >
        {/* 메인 카드 */}
        <div
          style={{
            width: "100%",
            maxWidth: 430,
            height: "calc(100vh - 150px)",
            borderRadius: 26,
            overflow: "hidden",
            position: "relative",
            boxShadow: "0 14px 40px rgba(0, 0, 0, 0.55)",
            background: "#000",
            opacity: expanded ? 1 : 0,
            transform: expanded ? "translateY(0) scale(1)" : "translateY(40px) scale(0.95)",
            transition: "opacity 0.3s ease, transform 0.3s ease",
          }}
        >
          <Image
            src={selected.image_url || fallbackImageByCategory(selected.categoryNorm)}
            alt={selected.name}
            fill
            sizes="430px"
            style={{ objectFit: "cover" }}
          />

          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              width: 32,
              height: 32,
              borderRadius: "9999px",
              border: "none",
              background: "rgba(15,23,42,0.8)",
              color: "#f9fafb",
              cursor: "pointer",
              boxShadow: "0 4px 10px rgba(0, 0, 0, 0.4)",
            }}
          >
            ←
          </button>

          {onToggleSaved && selected && (
            <button
              onClick={() => onToggleSaved(selected.id)}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                width: 32,
                height: 32,
                borderRadius: "9999px",
                border: "none",
                background: "rgba(15,23,42,0.8)",
                color: isSaved?.(selected.id) ? "#f43f5e" : "#f9fafb",
                cursor: "pointer",
                boxShadow: "0 4px 10px rgba(0, 0, 0, 0.4)",
                fontSize: 16,
              }}
            >
              {isSaved?.(selected.id) ? "♥" : "♡"}
            </button>
          )}

          <button
            onClick={() => onOpenKakaoPlace(selected)}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              border: "none",
              borderRadius: 9999,
              padding: "7px 12px",
              background: "rgba(255,255,255,0.95)",
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "Noto Sans KR, system-ui, sans-serif",
              boxShadow: "0 10px 28px rgba(0,0,0,0.25)",
            }}
          >
            {labelOfCategory(selected.categoryNorm)}정보보기
          </button>

          <div
            style={{
              position: "absolute",
              left: 14,
              bottom: 18,
              padding: "6px 12px",
              borderRadius: 9999,
              background: "rgba(15,23,42,0.8)",
              color: "#f9fafb",
              fontSize: 13,
              fontFamily: "Noto Sans KR, system-ui, sans-serif",
            }}
          >
            {selected.name} · {labelOfCategory(selected.categoryNorm)}
            {selected.distanceKm != null ? ` · ${selected.distanceKm.toFixed(1)}km` : ""}
          </div>
        </div>

        {/* 버튼 2개 (길안내 / 네이버로 보기) */}
        <div
          style={{
            width: "100%",
            maxWidth: 430,
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            marginTop: 14,
            opacity: expanded ? 1 : 0,
            transform: expanded ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.3s ease 0.03s, transform 0.3s ease 0.03s",
          }}
        >
          <button
            type="button"
            onClick={() => onGoToMap(selected)}
            style={{
              flex: 1,
              border: "none",
              borderRadius: 9999,
              padding: "11px 0",
              background: "#f3f4f6",
              fontSize: 14,
              fontFamily: "Noto Sans KR, system-ui, sans-serif",
              cursor: "pointer",
              color: "#111827",
              fontWeight: 800,
            }}
          >
            길안내
          </button>

          <button
            type="button"
            onClick={() => openNaver(selected.name)}
            style={{
              flex: 1,
              border: "none",
              borderRadius: 9999,
              padding: "11px 0",
              background: "#f3f4f6",
              fontSize: 14,
              fontFamily: "Noto Sans KR, system-ui, sans-serif",
              cursor: "pointer",
              color: "#111827",
              fontWeight: 800,
            }}
          >
            네이버로 보기
          </button>
        </div>

        {/* (기존 예약 패널은 남겨둠: 지금은 버튼이 없어서 안 열릴 뿐, 나중에 예약요청 붙일 때 다시 사용 가능) */}
        {reserveStep > 0 && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 126,
              display: "flex",
              justifyContent: "center",
              pointerEvents: "auto",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 430,
                borderRadius: 24,
                background: "#f9fafb",
                boxShadow: "0 10px 28px rgba(15,23,42,0.45)",
                padding: "14px 16px 16px",
                fontFamily: "Noto Sans KR, system-ui, sans-serif",
                fontSize: 13,
                color: "#111827",
              }}
            >
              {reserveStep === 1 && (
                <>
                  <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 14 }}>{selected.name} 예약하기</div>
                  <div style={{ marginBottom: 12, color: "#4b5563", fontSize: 12 }}>
                    날짜와 시간을 선택해 주세요. (베타 테스트 화면)
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, marginBottom: 6, color: "#6b7280" }}>날짜 선택</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {dateOptions.map((d) => (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => setReserveDate(d.value)}
                          style={{
                            flex: 1,
                            borderRadius: 9999,
                            border: "none",
                            padding: "6px 0",
                            fontSize: 12,
                            cursor: "pointer",
                            background: reserveDate === d.value ? "#2563eb" : "#e5e7eb",
                            color: reserveDate === d.value ? "#ffffff" : "#111827",
                          }}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, marginBottom: 6, color: "#6b7280" }}>시간 선택</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {timeOptions.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setReserveTime(t)}
                          style={{
                            flexBasis: "30%",
                            borderRadius: 9999,
                            border: "none",
                            padding: "6px 0",
                            fontSize: 12,
                            cursor: "pointer",
                            background: reserveTime === t ? "#2563eb" : "#e5e7eb",
                            color: reserveTime === t ? "#ffffff" : "#111827",
                            textAlign: "center",
                          }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {reserveStep === 2 && (
                <>
                  <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 14 }}>예약이 완료된 것처럼 보여주는 화면입니다</div>
                  <div style={{ marginBottom: 10, color: "#4b5563", fontSize: 12 }}>
                    베타 테스트용으로 <b>{reserveDate} {reserveTime}</b>에 예약한 것처럼 표시돼요.
                  </div>
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: 12,
                      background: "#e5f2ff",
                      fontSize: 12,
                      color: "#1f2937",
                    }}
                  >
                    • 매장: {selected.name}
                    <br />
                    • 날짜: {reserveDate}
                    <br />
                    • 시간: {reserveTime}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

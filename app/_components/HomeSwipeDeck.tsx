"use client";

import React, { useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import { logEvent } from "@/lib/logEvent";

type Props = {
  cards: HomeCard[];
  homeTab: HomeTabKey;
  isLoading: boolean;
  onOpenCard: (card: HomeCard) => void;
  onAddPoints: (amount: number, reason: string) => void;
};

export default function HomeSwipeDeck({
  cards,
  homeTab,
  isLoading,
  onOpenCard,
  onAddPoints,
}: Props) {
  const total = cards.length;

  const [activeIndex, setActiveIndex] = useState(0);

  // 드래그 상태
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const movedRef = useRef(false);

  const SWIPE_THRESHOLD = 60;
  const MOVE_DEADZONE = 6;

  // activeIndex 안전 보정
  if (activeIndex > Math.max(0, total - 1)) {
    // 렌더 중 setState는 피하려고 memo로 처리
  }

  const safeIndex = useMemo(() => {
    if (total <= 0) return 0;
    return Math.min(Math.max(activeIndex, 0), total - 1);
  }, [activeIndex, total]);

  const hasPrev = total > 0 && safeIndex > 0;
  const hasNext = total > 0 && safeIndex < total - 1;

  const prevCard = hasPrev ? cards[safeIndex - 1] : null;
  const currCard = total > 0 ? cards[safeIndex] : null;
  const nextCard = hasNext ? cards[safeIndex + 1] : null;

  const goPrev = () => setActiveIndex((v) => Math.max(0, v - 1));
  const goNext = () => setActiveIndex((v) => Math.min(total - 1, v + 1));

  const getImageUrl = (card: HomeCard | null) => {
    if (!card) return undefined;
    const anyCard = card as any;
    return (anyCard.imageUrl ?? anyCard.image ?? undefined) as string | undefined;
  };

  const baseShadow = "0 22px 45px rgba(15,23,42,0.26)";
  const sideShadow = "0 14px 30px rgba(15,23,42,0.18)";

  const renderCard = (card: HomeCard, mode: "prev" | "curr" | "next") => {
    const anyCard = card as any;
    const imageUrl = getImageUrl(card);

    const styleByMode: React.CSSProperties =
      mode === "curr"
        ? {
            zIndex: 30,
            opacity: 1,
            transform: `translateX(${dragX}px) scale(1)`,
            boxShadow: baseShadow,
          }
        : mode === "prev"
        ? {
            zIndex: 20,
            opacity: 0.55,
            transform: "translateX(-56px) scale(0.92)",
            boxShadow: sideShadow,
          }
        : {
            zIndex: 10,
            opacity: 0.55,
            transform: "translateX(56px) scale(0.92)",
            boxShadow: sideShadow,
          };

    const onClick = () => {
      // prev/next는 "옆으로 넘기기"
      if (mode === "prev") return goPrev();
      if (mode === "next") return goNext();

      // curr는 디테일 열기
      onOpenCard(card);
      logEvent("home_card_open", { id: anyCard.id, name: anyCard.name, tab: homeTab });
      onAddPoints(2, "홈 추천 카드 열람");
    };

    return (
      <button
        key={String(anyCard.id ?? `${mode}-${safeIndex}`)}
        type="button"
        onClick={onClick}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          borderRadius: 28,
          border: "none",
          padding: 0,
          cursor: "pointer",
          background: "#ffffff",
          overflow: "hidden",
          transition: isDragging ? "none" : "transform 0.22s ease, opacity 0.22s ease",
          ...styleByMode,
        }}
      >
        <div style={{ position: "relative", width: "100%", height: "70%", background: "#dbeafe" }}>
          {imageUrl && <Image src={imageUrl} alt={anyCard.name ?? "place"} fill style={{ objectFit: "cover" }} />}
        </div>

        <div style={{ padding: 16, textAlign: "left" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#111827", marginBottom: 6 }}>
            {anyCard.name}
          </div>
          <div style={{ fontSize: 12, color: "#6B7280" }}>
            {anyCard.categoryLabel ?? anyCard.category}
          </div>
        </div>
      </button>
    );
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "100%", overflow: "visible" }}>
        <div
          // ✅ 스와이프 핸들러는 “드래그로 판정될 때만” 개입
          onPointerDown={(e) => {
            if (total <= 1) return;

            setIsDragging(true);
            movedRef.current = false;
            startXRef.current = e.clientX;

            // 모바일/터치에서 스와이프 안정성 위해 캡처
            try {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } catch {}
          }}
          onPointerMove={(e) => {
            if (!isDragging) return;
            const dx = e.clientX - startXRef.current;

            if (Math.abs(dx) > MOVE_DEADZONE) movedRef.current = true;

            const clamped = Math.max(-140, Math.min(140, dx));
            setDragX(clamped);
          }}
          onPointerUp={() => {
            if (!isDragging) return;
            setIsDragging(false);

            // ✅ 움직임 거의 없으면 “클릭”로 보고 스와이프 처리 안 함
            if (!movedRef.current) {
              setDragX(0);
              return;
            }

            const dx = dragX;
            if (Math.abs(dx) >= SWIPE_THRESHOLD) {
              if (dx < 0) goNext();
              else goPrev();
            }

            setDragX(0);
          }}
          onPointerCancel={() => {
            setIsDragging(false);
            setDragX(0);
          }}
          style={{
            width: "100%",
            maxWidth: 320,
            aspectRatio: "1 / 1",
            position: "relative",
            overflow: "visible",
            margin: "0 auto",
            touchAction: "pan-y", // 세로 스크롤은 살리고, 가로는 우리가 처리
            userSelect: "none",
          }}
        >
          {/* 로딩 */}
          {isLoading && (
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 28,
                background: "#ffffff",
                boxShadow: "0 18px 45px rgba(15,23,42,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6B7280",
                fontWeight: 800,
              }}
            >
              불러오는 중...
            </div>
          )}

          {/* 비어있음 */}
          {!isLoading && total === 0 && (
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 28,
                background: "#ffffff",
                boxShadow: "0 18px 45px rgba(15,23,42,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6B7280",
                fontWeight: 800,
              }}
            >
              추천 카드가 없어요
            </div>
          )}

          {/* 카드 */}
          {!isLoading && prevCard && renderCard(prevCard, "prev")}
          {!isLoading && currCard && renderCard(currCard, "curr")}
          {!isLoading && nextCard && renderCard(nextCard, "next")}
        </div>
      </div>

      {/* 인디케이터 */}
      <div
        style={{
          marginTop: 18,
          marginBottom: 28,
          display: "flex",
          justifyContent: "center",
          gap: 6,
        }}
      >
        {cards.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveIndex(idx)}
            style={{
              width: idx === safeIndex ? 16 : 8,
              height: 8,
              borderRadius: 999,
              border: "none",
              padding: 0,
              background: idx === safeIndex ? "#2563EB" : "rgba(148,163,184,0.6)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          />
        ))}
      </div>
    </section>
  );
}

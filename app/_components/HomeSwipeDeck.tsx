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

export default function HomeSwipeDeck({ cards, homeTab, isLoading, onOpenCard, onAddPoints }: Props) {
  const total = cards.length;

  const [activeIndex, setActiveIndex] = useState(0);

  // --- swipe state
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);

  const SWIPE_THRESHOLD = 60;
  const DRAG_CLAMP = 140;

  // activeIndex 보정(데이터 갱신으로 길이 줄었을 때)
  React.useEffect(() => {
    const max = Math.max(0, total - 1);
    if (activeIndex > max) setActiveIndex(max);
    if (activeIndex < 0) setActiveIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const hasPrev = total > 0 && activeIndex > 0;
  const hasNext = total > 0 && activeIndex < total - 1;

  const prevCard = hasPrev ? cards[activeIndex - 1] : null;
  const currCard = total > 0 ? cards[activeIndex] : null;
  const nextCard = hasNext ? cards[activeIndex + 1] : null;

  const goNext = () => setActiveIndex((v) => Math.min(total - 1, v + 1));
  const goPrev = () => setActiveIndex((v) => Math.max(0, v - 1));

  const getImageUrl = (card: HomeCard | null) => {
    if (!card) return undefined;
    const anyCard = card as any;
    return (anyCard.imageUrl ?? anyCard.image ?? undefined) as string | undefined;
  };

  const dragRatio = Math.max(-1, Math.min(1, dragX / 140));
  const currDrag = dragX;
  const sideDrag = dragX * 0.25;

  const renderCard = (card: HomeCard, mode: "prev" | "curr" | "next") => {
    const anyCard = card as any;
    const imageUrl = getImageUrl(card);

    const baseShadow = "0 22px 45px rgba(15,23,42,0.26)";
    const sideShadow = "0 14px 30px rgba(15,23,42,0.18)";
    const transition = isDragging ? "none" : "transform 0.22s ease, opacity 0.22s ease";

    const styleByMode: React.CSSProperties =
      mode === "curr"
        ? {
            zIndex: 30,
            opacity: 1,
            transform: `translateX(${currDrag}px) rotate(${dragRatio * 1.2}deg) scale(1)`,
            boxShadow: baseShadow,
          }
        : mode === "prev"
        ? {
            zIndex: 20,
            opacity: 0.55,
            transform: `translateX(${-56 + sideDrag}px) scale(0.92)`,
            boxShadow: sideShadow,
          }
        : {
            zIndex: 10,
            opacity: 0.55,
            transform: `translateX(${56 + sideDrag}px) scale(0.92)`,
            boxShadow: sideShadow,
          };

    const onClick = () => {
      if (mode === "prev") return goPrev();
      if (mode === "next") return goNext();

      onOpenCard(card);
      logEvent("home_card_open", { id: anyCard.id, name: anyCard.name, tab: homeTab });
      onAddPoints(2, "홈 추천 카드 열람");
    };

    return (
      <button
        key={String(anyCard.id ?? `${mode}-${activeIndex}`)}
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
          transition,
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

          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 10 }}>
            {anyCard.categoryLabel ?? anyCard.category}
          </div>

          <div style={{ fontSize: 13, color: "#111827", fontWeight: 700 }}>
            {anyCard.mood ?? anyCard.moodText ?? ""}
          </div>
        </div>
      </button>
    );
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (total <= 1) return;

    setIsDragging(true);
    startXRef.current = e.clientX;
    setDragX(0);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {}
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - startXRef.current;
    const clamped = Math.max(-DRAG_CLAMP, Math.min(DRAG_CLAMP, dx));
    setDragX(clamped);
  };

  const finish = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const dx = dragX;
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      if (dx < 0 && hasNext) goNext();
      if (dx > 0 && hasPrev) goPrev();
    }
    setDragX(0);
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "100%", overflow: "visible" }}>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finish}
          onPointerCancel={finish}
          style={{
            width: "100%",
            maxWidth: 320,
            aspectRatio: "1 / 1",
            position: "relative",
            overflow: "visible",
            margin: "0 auto",
            touchAction: "pan-y",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
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

          {!isLoading && prevCard && renderCard(prevCard, "prev")}
          {!isLoading && currCard && renderCard(currCard, "curr")}
          {!isLoading && nextCard && renderCard(nextCard, "next")}
        </div>
      </div>

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
              width: idx === activeIndex ? 16 : 8,
              height: 8,
              borderRadius: 999,
              border: "none",
              padding: 0,
              background: idx === activeIndex ? "#2563EB" : "rgba(148,163,184,0.6)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          />
        ))}
      </div>
    </section>
  );
}

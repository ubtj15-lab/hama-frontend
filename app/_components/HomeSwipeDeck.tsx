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
  onAddPoints?: (amount: number, reason: string) => void;

  // 옵션: 외부에서 activeIndex 제어하고 싶으면 추후 확장 가능
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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

  const pointerIdRef = useRef<number | null>(null);
  const capturedRef = useRef(false);
  const dragMovedRef = useRef(false);
  const dragStartXRef = useRef(0);

  const SWIPE_THRESHOLD = 60;

  // activeIndex 보정
  React.useEffect(() => {
    const max = Math.max(0, total - 1);
    setActiveIndex((prev) => {
      if (prev > max) return max;
      if (prev < 0) return 0;
      return prev;
    });
  }, [total]);

  // 탭 바뀔 때 첫 카드로
  React.useEffect(() => {
    setActiveIndex(0);
    setDragX(0);
  }, [homeTab]);

  const hasPrev = total > 0 && activeIndex > 0;
  const hasNext = total > 0 && activeIndex < total - 1;

  const prevCard = hasPrev ? cards[activeIndex - 1] : null;
  const currCard = total > 0 ? cards[activeIndex] : null;
  const nextCard = hasNext ? cards[activeIndex + 1] : null;

  const getImageUrl = (card: HomeCard | null) => {
    if (!card) return undefined;
    const anyCard = card as any;
    return (anyCard.imageUrl ?? anyCard.image ?? undefined) as string | undefined;
  };

  const goNext = () => {
    if (!hasNext) return;
    setActiveIndex((v) => Math.min(total - 1, v + 1));
  };

  const goPrev = () => {
    if (!hasPrev) return;
    setActiveIndex((v) => Math.max(0, v - 1));
  };

  const stackStyles = useMemo(() => {
    const baseShadow = "0 22px 45px rgba(15,23,42,0.26)";
    const sideShadow = "0 14px 30px rgba(15,23,42,0.18)";

    // 현재 카드 드래그(이동) 효과: 살짝 따라오게
    // dragX가 음수면 다음 쪽으로 밀기, 양수면 이전 쪽으로 밀기
    const currTranslate = clamp(dragX * 0.9, -120, 120);
    const currScale = 1 - Math.min(Math.abs(dragX) / 1200, 0.03);

    // 옆 카드가 조금 더 보이게: dragX에 따라 약간 더 등장
    const sidePeek = clamp(Math.abs(dragX) * 0.12, 0, 12);

    return {
      baseShadow,
      sideShadow,
      curr: {
        zIndex: 30,
        opacity: 1,
        transform: `translateX(${currTranslate}px) scale(${currScale})`,
        boxShadow: baseShadow,
      } as React.CSSProperties,
      prev: {
        zIndex: 20,
        opacity: hasPrev ? 0.55 : 0,
        transform: `translateX(-56px - ${sidePeek}px) scale(0.92)`,
        boxShadow: sideShadow,
        pointerEvents: hasPrev ? ("auto" as const) : ("none" as const),
      } as unknown as React.CSSProperties,
      next: {
        zIndex: 10,
        opacity: hasNext ? 0.55 : 0,
        transform: `translateX(56px + ${sidePeek}px) scale(0.92)`,
        boxShadow: sideShadow,
        pointerEvents: hasNext ? ("auto" as const) : ("none" as const),
      } as unknown as React.CSSProperties,
    };
  }, [dragX, hasPrev, hasNext]);

  const renderCard = (card: HomeCard, mode: "prev" | "curr" | "next") => {
    const anyCard = card as any;
    const imageUrl = getImageUrl(card);

    const styleByMode =
      mode === "curr" ? stackStyles.curr : mode === "prev" ? stackStyles.prev : stackStyles.next;

    const onClick = () => {
      // ✅ 드래그로 움직였으면 클릭 무시 (PC에서 클릭 오작동 방지)
      if (mode === "curr" && dragMovedRef.current) return;

      if (mode === "prev") {
        goPrev();
        return;
      }
      if (mode === "next") {
        goNext();
        return;
      }

      // curr 오픈
      onOpenCard(card);
      logEvent("home_card_open", { id: anyCard.id, name: anyCard.name, tab: homeTab });
      onAddPoints?.(2, "홈 추천 카드 열람");
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
          transition: "transform 0.22s ease, opacity 0.22s ease, box-shadow 0.22s ease",
          ...styleByMode,
        }}
      >
        <div style={{ position: "relative", width: "100%", height: "70%", background: "#dbeafe" }}>
          {imageUrl && (
            <Image
              src={imageUrl}
              alt={anyCard.name ?? "place"}
              fill
              sizes="(max-width: 430px) 320px, 320px"
              style={{ objectFit: "cover" }}
              priority={mode === "curr"}
            />
          )}
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

  return (
    <section style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "100%", overflow: "visible" }}>
        <div
          // ✅ 포인터 캡처를 "드래그라고 확정"되면 그때만 잡는다 (PC 클릭 살리기 핵심)
          onPointerDown={(e) => {
            if (total <= 1) return;

            pointerIdRef.current = e.pointerId;
            capturedRef.current = false;
            dragMovedRef.current = false;
            dragStartXRef.current = e.clientX;

            setDragX(0);
          }}
          onPointerMove={(e) => {
            if (pointerIdRef.current === null) return;

            const dx = e.clientX - dragStartXRef.current;

            // ✅ 드래그 확정(몇 px 이상) 되었을 때만 capture
            if (!capturedRef.current && Math.abs(dx) > 6) {
              capturedRef.current = true;
              dragMovedRef.current = true;
              try {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              } catch {}
            }

            // 캡처된 상태에서만 dragX 반영
            if (capturedRef.current) {
              setDragX(clamp(dx, -140, 140));
            }
          }}
          onPointerUp={(e) => {
            if (pointerIdRef.current === null) return;

            if (capturedRef.current) {
              const dx = dragX;

              if (Math.abs(dx) >= SWIPE_THRESHOLD) {
                if (dx < 0) goNext();
                else goPrev();
              }

              try {
                (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
              } catch {}
            }

            pointerIdRef.current = null;
            capturedRef.current = false;
            setDragX(0);
          }}
          onPointerCancel={() => {
            pointerIdRef.current = null;
            capturedRef.current = false;
            setDragX(0);
          }}
          style={{
            width: "100%",
            maxWidth: 320,
            aspectRatio: "1 / 1",
            position: "relative",
            overflow: "visible",
            margin: "0 auto",
            touchAction: "pan-y",
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

          {/* 카드 스택 */}
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

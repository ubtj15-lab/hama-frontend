"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import { logEvent } from "@/lib/logEvent";
import { openNaverPlace } from "@/lib/openNaverPlace";
import { openKakaoPlace } from "@/lib/openKakaoPlace";

type Mode = "recommend" | "explore";

type Props = {
  cards: HomeCard[];
  homeTab: HomeTabKey;
  mode: Mode;
  isLoading: boolean;
  onOpenCard: (card: HomeCard) => void;
  onAddPoints?: (amount: number, reason: string) => void;
};

const SWIPE_THRESHOLD = 60;
const DRAG_LIMIT = 140;

export default function HomeSwipeDeck({
  cards,
  homeTab,
  mode,
  isLoading,
  onOpenCard,
  onAddPoints,
}: Props) {
  const [stableCards, setStableCards] = useState<HomeCard[]>([]);

  useEffect(() => {
    if (Array.isArray(cards) && cards.length > 0) {
      setStableCards(cards);
    }
  }, [cards]);

  const list = useMemo<HomeCard[]>(() => {
    if (isLoading) return [];
    return stableCards.length > 0 ? stableCards : Array.isArray(cards) ? cards : [];
  }, [isLoading, stableCards, cards]);

  const total = list.length;
  const [activeIndex, setActiveIndex] = useState(0);

  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef(0);
  const movedRef = useRef(false);

  useEffect(() => {
    setActiveIndex(0);
    setDragX(0);
    setIsDragging(false);
    movedRef.current = false;
  }, [homeTab, mode]);

  useEffect(() => {
    if (total <= 0) return;
    setActiveIndex((idx) => Math.min(idx, total - 1));
  }, [total]);

  const hasPrev = total > 0 && activeIndex > 0;
  const hasNext = total > 0 && activeIndex < total - 1;

  const prevCard = hasPrev ? list[activeIndex - 1] : null;
  const currCard = total > 0 ? list[activeIndex] : null;
  const nextCard = hasNext ? list[activeIndex + 1] : null;

  const deckLabel = useMemo(() => {
    if (mode === "explore") return "지금 있는 곳 기준으로 가까운 장소를 보여드릴게요.";
    return "하마가 자신 있는 지역 추천이에요.";
  }, [mode]);

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

  const goPrev = () => {
    if (!hasPrev) return;
    setActiveIndex((v) => Math.max(0, v - 1));
    onAddPoints?.(1, "카드 넘김");
    logEvent("home_card_swipe", { dir: "prev", tab: homeTab, mode, index: activeIndex - 1 });
  };

  const goNext = () => {
    if (!hasNext) return;
    setActiveIndex((v) => Math.min(total - 1, v + 1));
    onAddPoints?.(1, "카드 넘김");
    logEvent("home_card_swipe", { dir: "next", tab: homeTab, mode, index: activeIndex + 1 });
  };

  const getImageUrl = (card: HomeCard | null) => {
    if (!card) return undefined;
    const anyCard = card as any;
    return (anyCard.imageUrl ?? anyCard.image ?? anyCard.image_url ?? undefined) as
      | string
      | undefined;
  };

  // ✅ mood/tags 같은 값이 배열/문자열/nullable 어떤 형태로 와도 안전하게 문자열로 변환
  const toText = (v: any): string => {
    if (v == null) return "";
    if (Array.isArray(v)) return v.filter(Boolean).join(" · ");
    if (typeof v === "string") return v;
    return String(v);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (isLoading) return;
    if (total <= 1) return;

    setIsDragging(true);
    movedRef.current = false;
    startXRef.current = e.clientX;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) > 6) movedRef.current = true;

    setDragX(clamp(dx, -DRAG_LIMIT, DRAG_LIMIT));
  };

  const finishDrag = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const dx = dragX;
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      if (dx < 0) goNext();
      else goPrev();
    }
    setDragX(0);
  };

  const onPointerUp = () => finishDrag();
  const onPointerCancel = () => {
    setIsDragging(false);
    setDragX(0);
    movedRef.current = false;
  };

  const renderCard = (card: HomeCard, pos: "prev" | "curr" | "next") => {
    const anyCard = card as any;
    const imageUrl = getImageUrl(card);

    const baseShadow = "0 22px 45px rgba(15,23,42,0.26)";
    const sideShadow = "0 14px 30px rgba(15,23,42,0.18)";

    const isCurr = pos === "curr";
    const isPrev = pos === "prev";

    const currTranslate = isCurr ? dragX : 0;

    const sideOffset = 56;
    const sideTranslate = isPrev ? -sideOffset : sideOffset;

    const sideNudge = clamp(dragX / 10, -8, 8);
    const nudgedSideTranslate =
      pos === "prev" ? sideTranslate + sideNudge : pos === "next" ? sideTranslate + sideNudge : 0;

    const styleByPos: React.CSSProperties =
      pos === "curr"
        ? {
            zIndex: 30,
            opacity: 1,
            transform: `translateX(${currTranslate}px) scale(1)`,
            boxShadow: baseShadow,
          }
        : pos === "prev"
        ? {
            zIndex: 20,
            opacity: 0.55,
            transform: `translateX(${nudgedSideTranslate}px) scale(0.92)`,
            boxShadow: sideShadow,
          }
        : {
            zIndex: 10,
            opacity: 0.55,
            transform: `translateX(${nudgedSideTranslate}px) scale(0.92)`,
            boxShadow: sideShadow,
          };

    const onClick = () => {
      if (movedRef.current) return;

      if (pos === "prev") return goPrev();
      if (pos === "next") return goNext();

      onOpenCard(card);
    };

    // ✅ category + optional distanceKm 안전 표시
    const categoryText = toText(anyCard?.categoryLabel ?? anyCard?.category);
    const distanceKm =
      typeof anyCard?.distanceKm === "number" ? (anyCard.distanceKm as number) : null;

    // ✅ moodText/mood 어떤 형태로 와도 표시
    const moodText = toText(anyCard?.moodText ?? anyCard?.mood);

    // ✅ 네이버/카카오 분기 (둘 다 없으면 버튼 숨김)
    const naverPlaceId = toText(anyCard?.naver_place_id);
    const naverPlaceUrl = toText(anyCard?.naver_place_url);
    const kakaoPlaceUrl = toText(anyCard?.kakao_place_url);

    const hasNaver = !!naverPlaceId || !!naverPlaceUrl;
    const hasKakao = !!kakaoPlaceUrl;

    const handleOpenNaver = (e: React.MouseEvent) => {
      e.stopPropagation();
      openNaverPlace({
        name: toText(anyCard?.name),
        naverPlaceId: naverPlaceId || null,
        naverPlaceUrl: naverPlaceUrl || null,
      });
    };

    const handleOpenKakao = (e: React.MouseEvent) => {
      e.stopPropagation();
      openKakaoPlace({
        name: toText(anyCard?.name),
        kakaoPlaceUrl: kakaoPlaceUrl || null,
      });
    };

    return (
      <button
        key={String(anyCard?.id ?? `${pos}-${activeIndex}`)}
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
          transition: isDragging
            ? "none"
            : "transform 220ms ease, opacity 220ms ease, box-shadow 220ms ease",
          userSelect: "none",
          WebkitTapHighlightColor: "transparent",
          ...styleByPos,
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "70%",
            background: "#dbeafe",
          }}
        >
          {imageUrl && (
            <Image
              src={imageUrl}
              alt={anyCard?.name ?? "place"}
              fill
              style={{ objectFit: "cover" }}
              sizes="(max-width: 430px) 320px, 320px"
              priority={pos === "curr"}
            />
          )}
        </div>

        <div style={{ padding: 16, textAlign: "left" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#111827", marginBottom: 6 }}>
            {anyCard?.name}
          </div>

          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 10 }}>
            {categoryText}
            {distanceKm != null && <> · {distanceKm.toFixed(1)} km</>}
          </div>

          <div style={{ fontSize: 13, color: "#111827", fontWeight: 700 }}>{moodText}</div>

          {(hasNaver || hasKakao) && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {hasNaver && (
                <button
                  type="button"
                  onClick={handleOpenNaver}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 999,
                    border: "none",
                    background: "#03C75A",
                    color: "#fff",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  네이버로 보기
                </button>
              )}

              {hasKakao && (
                <button
                  type="button"
                  onClick={handleOpenKakao}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 999,
                    border: "none",
                    background: "#FEE500",
                    color: "#111827",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  카카오로 보기
                </button>
              )}
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          padding: "0 2px",
          marginBottom: 10,
          color: "#475569",
          fontSize: 12,
          fontWeight: 700,
          textAlign: "center",
        }}
      >
        {deckLabel}
      </div>

      <div style={{ width: "100%", overflow: "visible" }}>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          style={{
            width: "100%",
            maxWidth: 320,
            aspectRatio: "1 / 1",
            position: "relative",
            overflow: "visible",
            margin: "0 auto",
            touchAction: "none",
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

      {!isLoading && total > 0 && (
        <div
          style={{
            marginTop: 18,
            marginBottom: 28,
            display: "flex",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {list.map((_, idx) => (
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
              aria-label={`카드 ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

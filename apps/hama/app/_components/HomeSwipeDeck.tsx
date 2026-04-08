"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { getDefaultCardImage } from "@/lib/defaultCardImage";

import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";
import { logEvent } from "@/lib/logEvent";
import type { IntentionType } from "@/lib/intention";
import { openDirections } from "@/lib/openDirections";

type Mode = "recommend" | "explore";

type Props = {
  cards: HomeCard[];
  homeTab: HomeTabKey;
  mode: Mode;
  intention: IntentionType;
  isLoading: boolean;
  onOpenCard: (card: HomeCard) => void;
  onAddPoints?: (amount: number, reason: string) => void;
};

const SWIPE_THRESHOLD = 60;
const DRAG_LIMIT = 140;

function getPlaceholderImage(card: HomeCard): string {
  const c: any = card as any;

  const category = String(c.category ?? "").toLowerCase();
  const tags: string[] = Array.isArray(c.tags) ? c.tags : [];
  const mood: string[] = Array.isArray(c.mood) ? c.mood : [];

  const text = [...tags, ...mood, String(c.name ?? "")]
    .join(" ")
    .replace(/\s+/g, " ")
    .toLowerCase();

  const isKorean = /한식|국밥|백반|분식|김밥|찌개|삼겹|갈비|해장국|냉면/.test(text);
  const isJapanese = /일식|초밥|스시|라멘|돈카츠|우동|이자카야/.test(text);
  const isChinese = /중식|짜장|짬뽕|탕수육|마라|양꼬치/.test(text);
  const isWestern = /양식|파스타|스테이크|피자|브런치|샐러드|버거/.test(text);

  if (category === "restaurant") {
    if (isKorean) return "/images/placeholders/korean.jpg";
    if (isJapanese) return "/images/placeholders/japanese.jpg";
    if (isChinese) return "/images/placeholders/chinese.jpg";
    if (isWestern) return "/images/placeholders/western.jpg";
    return "/images/placeholders/default.jpg";
  }

  if (category === "cafe") return "/images/placeholders/cafe.jpg";
  if (category === "salon") return "/images/placeholders/salon.jpg";
  if (category === "activity") return "/images/placeholders/activity.jpg";

  return "/images/placeholders/default.jpg";
}

function cardLatLng(card: HomeCard): { lat?: number; lng?: number } {
  const anyCard = card as any;
  const lat =
    typeof anyCard.lat === "number"
      ? anyCard.lat
      : typeof anyCard.latitude === "number"
        ? anyCard.latitude
        : undefined;
  const lng =
    typeof anyCard.lng === "number"
      ? anyCard.lng
      : typeof anyCard.longitude === "number"
        ? anyCard.longitude
        : undefined;
  return { lat, lng };
}

export default function HomeSwipeDeck({
  cards,
  homeTab,
  mode,
  intention,
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
  }, [homeTab, mode, intention]);

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
    const raw =
      (anyCard.imageUrl ?? anyCard.image_url ?? anyCard.image ?? undefined) as string | undefined;

    if (typeof raw === "string" && raw.trim().length > 0) return raw;
    return getPlaceholderImage(card);
  };

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

    const onCardActivate = () => {
      if (movedRef.current) return;

      if (pos === "prev") return goPrev();
      if (pos === "next") return goNext();

      onOpenCard(card);
    };

    const categoryText = toText(anyCard?.categoryLabel ?? anyCard?.category);
    const distanceKm =
      typeof anyCard?.distanceKm === "number" ? (anyCard.distanceKm as number) : null;

    const badge = anyCard?.recommendBadge;
    const reasonFallback = toText(anyCard?.reasonText ?? anyCard?.moodText ?? anyCard?.mood);
    const phoneRaw = typeof anyCard?.phone === "string" ? anyCard.phone.trim() : "";
    const phoneDigits = phoneRaw.replace(/\D/g, "");
    const { lat, lng } = cardLatLng(card);

    return (
      <div
        key={String(anyCard?.id ?? `${pos}-${activeIndex}`)}
        role="button"
        tabIndex={pos === "curr" ? 0 : -1}
        onClick={onCardActivate}
        onKeyDown={(e) => {
          if (pos !== "curr") return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onCardActivate();
          }
        }}
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
            <img
              src={imageUrl}
              alt={anyCard?.name ?? "place"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              loading={pos === "curr" ? "eager" : "lazy"}
              onError={(e) => {
                const fallback = getDefaultCardImage(card);
                const el = e.currentTarget;
                if (el.src !== window.location.origin + fallback) {
                  el.src = fallback;
                }
              }}
            />
          )}
        </div>

        <div style={{ padding: 16, textAlign: "left" }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#111827", marginBottom: 6 }}>
            {anyCard?.name}
          </div>

          <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
            {categoryText}
            {distanceKm != null && <> · {distanceKm.toFixed(1)} km</>}
          </div>

          {badge?.primaryLabel ? (
            <div style={{ marginBottom: 2 }}>
              <span
                style={{
                  display: "inline-block",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: "#EEF2FF",
                  color: "#3730A3",
                  maxWidth: "100%",
                  boxSizing: "border-box",
                }}
              >
                {badge.primaryLabel}
              </span>
              {Array.isArray(badge.shortTags) && badge.shortTags.length > 0 ? (
                <div
                  title={badge.shortTags.join(" · ")}
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#4B5563",
                    lineHeight: 1.3,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {badge.shortTags.join(" · ")}
                </div>
              ) : null}
            </div>
          ) : reasonFallback ? (
            <div
              style={{
                fontSize: 12,
                color: "#6B7280",
                fontWeight: 600,
                lineHeight: 1.35,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={reasonFallback}
            >
              {reasonFallback}
            </div>
          ) : null}

          {isCurr && mode === "recommend" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 12,
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const name = String(anyCard?.name ?? "").trim();
                    logEvent("recommend_directions_click", {
                      id: anyCard?.id,
                      name,
                      tab: homeTab,
                      mode,
                      intention,
                    });
                    openDirections({ name, lat: lat ?? null, lng: lng ?? null });
                  }}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 12,
                    border: "none",
                    background: "#2563EB",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  길찾기
                </button>
                <button
                  type="button"
                  disabled={phoneDigits.length < 8}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (phoneDigits.length < 8) return;
                    logEvent("recommend_phone_click", {
                      id: anyCard?.id,
                      name: String(anyCard?.name ?? "").trim(),
                      tab: homeTab,
                      mode,
                      intention,
                    });
                    window.location.href = `tel:${phoneDigits}`;
                  }}
                  style={{
                    flex: 1,
                    height: 40,
                    borderRadius: 12,
                    border: "none",
                    background: phoneDigits.length < 8 ? "#e5e7eb" : "#0f172a",
                    color: phoneDigits.length < 8 ? "#9ca3af" : "#ffffff",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: phoneDigits.length < 8 ? "not-allowed" : "pointer",
                  }}
                >
                  전화
                </button>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  logEvent("recommend_detail_click", {
                    id: anyCard?.id,
                    name: String(anyCard?.name ?? "").trim(),
                    tab: homeTab,
                    mode,
                    intention,
                  });
                  onOpenCard(card);
                }}
                style={{
                  width: "100%",
                  height: 38,
                  borderRadius: 12,
                  border: "1px solid #2563EB",
                  background: "#ffffff",
                  color: "#2563EB",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                매장 정보
              </button>
            </div>
          )}
        </div>
      </div>
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
              하마가 학습 중이에요
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

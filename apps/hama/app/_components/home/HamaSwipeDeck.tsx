"use client";

import React, { useEffect, useRef, useState } from "react";
import type { HomeCard } from "@/lib/storeTypes";

const GREEN = "#19584A";
const MUTED = "#7E948C";
const LINE = "#D5E3DC";
const IVORY = "#FBFCF9";

type Props = {
  kind: "play" | "food";
  cards: HomeCard[];
  index: number;
  onIndex: (index: number) => void;
  onOpen: (card: HomeCard) => void;
  onReject?: (id: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export function storePhoto(card: HomeCard): string | null {
  const raw = card.image_url || card.imageUrl;
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.startsWith("/images/category/")) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (/^https?:\/\//i.test(value)) return value;
  return null;
}

function categoryText(card: HomeCard): string {
  const label = String(card.categoryLabel ?? "").trim();
  if (/[가-힣]/.test(label)) return label;
  return "";
}

function shortReason(card: HomeCard): string {
  const raw = String(card.reasonText ?? "").trim();
  if (!raw) return "";
  const text = raw.split(" · ").map((part) => part.trim()).filter(Boolean).slice(0, 2).join(" · ");
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}

function distanceText(card: HomeCard): string | null {
  if (typeof card.distanceKm !== "number" || !Number.isFinite(card.distanceKm)) return null;
  return `직선거리 ${card.distanceKm.toFixed(1)}km`;
}

function initialOf(name: string): string {
  const trimmed = name.trim();
  return Array.from(trimmed)[0] ?? "곳";
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);
  return reduced;
}

export function HamaSwipeDeck({ kind, cards, index, onIndex, onOpen, onReject, onRefresh, refreshing = false }: Props) {
  const shown = cards.slice(0, 3);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const reduced = useReducedMotion();
  const gesture = useRef<{ id: number; x: number; y: number; axis: "x" | "y" | null } | null>(null);
  const safeIndex = shown.length === 0 ? 0 : Math.max(0, Math.min(index, shown.length - 1));
  const card = shown[safeIndex];

  useEffect(() => {
    setDrag(0);
    setDragging(false);
  }, [safeIndex, shown.length]);

  if (!card) return null;

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(next, shown.length - 1));
    if (clamped !== safeIndex) onIndex(clamped);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      start.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (start.axis !== "x") return;
    const atEdge = (safeIndex <= 0 && dx > 0) || (safeIndex >= shown.length - 1 && dx < 0);
    setDragging(true);
    setDrag(atEdge ? dx * 0.28 : dx);
  };

  const finishPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = gesture.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const horizontal = start.axis === "x";
    gesture.current = null;
    setDragging(false);
    setDrag(0);
    if (!horizontal) return;
    if (dx <= -48) go(safeIndex + 1);
    else if (dx >= 48) go(safeIndex - 1);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(safeIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(safeIndex - 1);
    }
  };

  const motion = !reduced && !dragging;

  return (
    <section
      className="hama-swipe"
      data-hama-swipe={kind}
      data-hama-card-index={safeIndex}
      data-hama-card-count={shown.length}
      aria-roledescription="carousel"
      aria-label={kind === "food" ? "식사 추천 카드" : "추천 카드"}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <style>{`
        .hama-swipe { position: relative; width: 100%; min-width: 0; outline: none; }
        .hama-swipe:focus-visible { box-shadow: 0 0 0 2px ${GREEN}; border-radius: 22px; }
        .hama-swipe-viewport {
          display: grid;
          width: 100%;
          overflow: hidden;
          border-radius: 22px;
          touch-action: pan-y;
          background: #fff;
        }
        .hama-swipe-track { display: flex; width: 100%; min-width: 0; }
        .hama-swipe-slide { flex: 0 0 100%; width: 100%; min-width: 0; box-sizing: border-box; }
        .hama-swipe-card {
          width: 100%;
          box-sizing: border-box;
          background: #fff;
          border: 1px solid ${LINE};
          border-radius: 22px;
          overflow: hidden;
        }
        .hama-swipe-media { position: relative; aspect-ratio: 4 / 3; background: #E7F0EB; }
        .hama-swipe-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .hama-swipe-fallback {
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          padding: 22px;
          box-sizing: border-box;
          background:
            radial-gradient(120% 80% at 100% 0%, rgba(25, 88, 74, 0.16), transparent 55%),
            linear-gradient(165deg, #F7F3EA 0%, #E4EFE8 100%);
        }
        .hama-swipe-mark {
          margin: 0;
          color: ${GREEN};
          font-family: Georgia, "Iowan Old Style", "Palatino Linotype", Palatino, serif;
          font-size: 84px;
          line-height: 0.8;
          font-weight: 600;
        }
        .hama-swipe-count {
          position: absolute;
          left: 14px;
          bottom: 14px;
          margin: 0;
          padding: 5px 10px;
          border-radius: 999px;
          background: ${IVORY};
          color: ${GREEN};
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
        }
        .hama-swipe-body { padding: 16px 16px 14px; }
        .hama-swipe-name {
          margin: 0;
          color: ${GREEN};
          font-size: 22px;
          line-height: 1.25;
          font-weight: 700;
          letter-spacing: -0.04em;
        }
        .hama-swipe-meta { margin: 6px 0 0; color: ${MUTED}; font-size: 13px; }
        .hama-swipe-reason { margin: 10px 0 0; color: ${GREEN}; font-size: 14px; line-height: 1.5; }
        .hama-swipe-actions {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-top: 14px;
        }
        .hama-swipe-actions div { display: flex; gap: 14px; flex-wrap: wrap; }
        .hama-swipe-actions button {
          border: none;
          background: transparent;
          color: ${GREEN};
          font-size: 13px;
          font-weight: 700;
          padding: 6px 0;
          cursor: pointer;
        }
        .hama-swipe-actions button:disabled { opacity: 0.35; cursor: default; }
        .hama-swipe-refresh {
          width: 100%;
          margin-top: 8px;
          border: 1px solid ${LINE};
          background: ${IVORY};
          color: ${GREEN};
          border-radius: 999px;
          padding: 10px 14px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .hama-swipe-refresh:disabled { opacity: 0.55; cursor: default; }
        @media (min-width: 768px) {
          .hama-swipe-name { font-size: 24px; }
          .hama-swipe-mark { font-size: 96px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hama-swipe-track { transition: none !important; }
        }
      `}</style>
      <div
        ref={viewportRef}
        className="hama-swipe-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
      >
        <div
          className="hama-swipe-track"
          style={{
            transform: `translate3d(calc(${-safeIndex * 100}% + ${drag}px), 0, 0)`,
            transition: motion ? "transform 320ms cubic-bezier(.22,.8,.32,1)" : "none",
          }}
        >
          {shown.map((item, itemIndex) => (
            <div className="hama-swipe-slide" key={item.id} aria-hidden={itemIndex !== safeIndex}>
              <SwipeFace card={item} active={itemIndex === safeIndex} count={shown.length} position={itemIndex} />
            </div>
          ))}
        </div>
      </div>
      <div className="hama-swipe-actions">
        <div>
          <button type="button" aria-label="이전 추천" disabled={safeIndex <= 0} onClick={() => go(safeIndex - 1)}>
            이전
          </button>
          <button type="button" aria-label="다음 추천" disabled={safeIndex >= shown.length - 1} onClick={() => go(safeIndex + 1)}>
            다음
          </button>
        </div>
        <div>
          <button type="button" onClick={() => onOpen(card)}>
            상세 보기
          </button>
          {onReject ? (
            <button type="button" onClick={() => onReject(card.id)}>
              다른 곳
            </button>
          ) : null}
        </div>
      </div>
      {onRefresh ? (
        <button
          type="button"
          className="hama-swipe-refresh"
          data-hama-find-again=""
          disabled={refreshing}
          aria-busy={refreshing}
          onClick={onRefresh}
        >
          {refreshing ? "찾는 중이에요." : "다시 찾기"}
        </button>
      ) : null}
    </section>
  );
}

function SwipeFace({
  card,
  active,
  count,
  position,
}: {
  card: HomeCard;
  active: boolean;
  count: number;
  position: number;
}) {
  const src = storePhoto(card);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);
  const showPhoto = Boolean(src) && !failed;
  const category = categoryText(card);
  const reason = shortReason(card);
  const distance = distanceText(card);
  const meta = [category, distance].filter(Boolean).join(" · ");

  return (
    <article className="hama-swipe-card" data-hama-place-id={active ? card.id : undefined}>
      <div className="hama-swipe-media">
        {showPhoto ? (
          <img src={src!} alt="" data-hama-card-photo="" onError={() => setFailed(true)} />
        ) : (
          <div className="hama-swipe-fallback" data-hama-card-fallback="">
            <p className="hama-swipe-mark">{initialOf(card.name)}</p>
          </div>
        )}
        <p className="hama-swipe-count">
          {position + 1} / {count}
        </p>
      </div>
      <div className="hama-swipe-body">
        <h3 className="hama-swipe-name">{card.name}</h3>
        {meta ? <p className="hama-swipe-meta">{meta}</p> : null}
        {reason ? <p className="hama-swipe-reason">{reason}</p> : null}
      </div>
    </article>
  );
}

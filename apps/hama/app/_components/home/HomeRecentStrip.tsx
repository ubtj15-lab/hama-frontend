"use client";

import React from "react";
import type { HomeCard } from "@/lib/storeTypes";
import { colors, radius, shadow, space, typo } from "@/lib/designTokens";
import { Thumbnail } from "@/_components/common/Thumbnail";
import { getDefaultCardImage } from "@/lib/defaultCardImage";
import { logEvent } from "@/lib/logEvent";
import { HamaEvents } from "@/lib/analytics/events";

type Props = {
  recentCards: HomeCard[];
  savedCards: HomeCard[];
  onOpenPlace: (card: HomeCard) => void;
};

function thumb(c: HomeCard) {
  const u = String((c as Record<string, unknown>).imageUrl ?? (c as Record<string, unknown>).image_url ?? "").trim();
  return u || getDefaultCardImage(c);
}

function Strip({
  title,
  cards,
  empty,
  onPick,
}: {
  title: string;
  cards: HomeCard[];
  empty: string;
  onPick: (c: HomeCard) => void;
}) {
  if (cards.length === 0) {
    return (
      <p style={{ ...typo.caption, color: colors.textMuted, margin: "0 0 12px" }}>
        {empty}
      </p>
    );
  }
  return (
    <div style={{ marginBottom: space.sectionTight }}>
      <h3
        style={{
          ...typo.caption,
          fontWeight: 800,
          color: colors.textSecondary,
          margin: "0 0 10px",
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h3>
      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          paddingBottom: 4,
          marginRight: -space.pageX,
          paddingRight: space.pageX,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {cards.slice(0, 8).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c)}
            style={{
              flex: "0 0 auto",
              width: 104,
              textAlign: "left",
              border: `1px solid ${colors.borderSubtle}`,
              borderRadius: radius.card,
              background: colors.bgCard,
              padding: 8,
              cursor: "pointer",
              boxShadow: shadow.soft,
            }}
          >
            <Thumbnail src={thumb(c)} alt="" size={88} radius={12} />
            <p
              style={{
                ...typo.caption,
                fontWeight: 700,
                color: colors.textPrimary,
                margin: "8px 0 0",
                lineHeight: 1.25,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {c.name}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function HomeRecentStrip({ recentCards, savedCards, onOpenPlace }: Props) {
  const open = (c: HomeCard) => {
    logEvent(HamaEvents.home_recommend_row_click, {
      page: "home",
      kind: "recent_saved_strip",
      place_id: c.id,
    });
    onOpenPlace(c);
  };

  if (recentCards.length === 0 && savedCards.length === 0) return null;

  return (
    <section style={{ marginTop: 8, marginBottom: space.section }}>
      <h2
        style={{
          ...typo.sectionTitle,
          fontSize: 16,
          color: colors.textPrimary,
          margin: "0 0 14px",
        }}
      >
        내가 본 곳 · 저장
      </h2>
      <Strip
        title="최근 본"
        cards={recentCards}
        empty="아직 최근 본 곳이 없어요. 추천 카드를 눌러보면 여기에 쌓여요."
        onPick={open}
      />
      <Strip
        title="저장한 곳"
        cards={savedCards}
        empty="저장한 곳이 없어요. 상세에서 저장해두면 빠르게 돌아올 수 있어요."
        onPick={open}
      />
    </section>
  );
}

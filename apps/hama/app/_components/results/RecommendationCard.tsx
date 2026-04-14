"use client";

import React from "react";
import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { businessStateFromCard, type BusinessState } from "@/lib/recommend/scoreParts";
import { Thumbnail } from "@/_components/common/Thumbnail";
import { colors, radius, shadow, space, typo } from "@/lib/designTokens";
import { getDefaultCardImage } from "@/lib/defaultCardImage";
import { buildRecommendationReason } from "@/lib/recommend/buildRecommendationReason";

function bizLabel(s: BusinessState): string {
  switch (s) {
    case "OPEN":
      return "영업중";
    case "LAST_ORDER_SOON":
      return "라스트오더 임박";
    case "BREAK":
      return "브레이크타임";
    case "CLOSED":
      return "영업 종료";
    default:
      return "영업 정보 확인";
  }
}

function kmLine(card: HomeCard): string {
  const km = card.distanceKm;
  if (typeof km === "number" && Number.isFinite(km)) return `${km < 10 ? km.toFixed(1) : Math.round(km)}km`;
  return "";
}

type Props = {
  card: HomeCard;
  rank: number;
  scenarioObject: ScenarioObject | null;
  onCardClick: () => void;
  onNavigate: () => void;
  onCall: () => void;
};

export function RecommendationCard({
  card,
  rank,
  scenarioObject: _scenarioObject,
  onCardClick,
  onNavigate,
  onCall,
}: Props) {
  const reason = buildRecommendationReason(card, { deckSlot: rank });
  const featured = rank === 0;
  const thumb =
    (card as any).imageUrl ?? (card as any).image_url ?? getDefaultCardImage(card);
  const bs = businessStateFromCard(card);
  const dist = kmLine(card);
  const biz = bizLabel(bs);
  const line2 = [dist, biz].filter(Boolean).join(" · ");
  const phone = String(card.phone ?? "").trim();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardClick();
        }
      }}
      style={{
        display: "flex",
        gap: 12,
        padding: space.cardPadding,
        minHeight: 132,
        borderRadius: radius.largeCard,
        background: colors.bgCard,
        border: featured ? `2px solid ${colors.accentSoft}` : `1px solid ${colors.borderSubtle}`,
        boxShadow: featured ? shadow.elevated : shadow.card,
        cursor: "pointer",
        position: "relative",
      }}
    >
      {featured && (
        <span
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            fontSize: 10,
            fontWeight: 900,
            color: colors.accentOnPrimary,
            background: colors.accentPrimary,
            padding: "4px 8px",
            borderRadius: radius.pill,
            zIndex: 1,
          }}
        >
          가장 추천
        </span>
      )}
      <div style={{ marginTop: featured ? 18 : 0 }}>
        <Thumbnail src={thumb} alt="" size={featured ? 92 : 84} radius={14} />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ ...typo.cardTitle, fontSize: 16, color: colors.textPrimary, lineHeight: 1.25 }}>
          {card.name}
        </div>
        <p style={{ ...typo.cardReason, color: colors.accentStrong, margin: "6px 0 0", lineHeight: 1.35 }}>
          {reason.headline}
        </p>
        <p style={{ ...typo.caption, color: colors.textSecondary, margin: "4px 0 0", lineHeight: 1.45 }}>
          {reason.subline}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {reason.badges.map((t) => (
            <span
              key={t}
              style={{
                ...typo.chip,
                color: colors.tagMutedText,
                background: colors.tagMutedBg,
                padding: "4px 9px",
                borderRadius: radius.chip,
              }}
            >
              {t}
            </span>
          ))}
        </div>
        {line2 && (
          <div style={{ ...typo.caption, color: colors.textMuted, marginTop: 8 }}>{line2}</div>
        )}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: "auto",
            paddingTop: 10,
          }}
        >
          <div style={{ display: "flex", gap: space.chip }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate();
              }}
              style={{
                flex: 1,
                height: 44,
                borderRadius: radius.button,
                border: "none",
                background: colors.accentPrimary,
                color: colors.accentOnPrimary,
                boxShadow: shadow.cta,
                fontWeight: 800,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              길찾기
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCall();
              }}
              disabled={!phone}
              style={{
                flex: 1,
                height: 44,
                borderRadius: radius.button,
                border: `1px solid ${colors.borderSubtle}`,
                background: colors.bgCard,
                color: phone ? colors.textPrimary : colors.textSecondary,
                fontWeight: 800,
                fontSize: 14,
                cursor: phone ? "pointer" : "not-allowed",
              }}
            >
              지금 전화하기
            </button>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCardClick();
            }}
            style={{
              width: "100%",
              height: 40,
              borderRadius: radius.button,
              border: `1px solid ${colors.accentPrimary}`,
              background: colors.bgCard,
              color: colors.accentPrimary,
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            매장 정보
          </button>
        </div>
      </div>
      <span style={{ ...typo.caption, color: colors.textSecondary, alignSelf: "flex-start" }}>
        #{rank + 1}
      </span>
    </div>
  );
}

"use client";

import React from "react";
import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { resolveScenarioConfig } from "@/lib/scenarioEngine/resolveScenarioConfig";
import { businessStateFromCard, type BusinessState } from "@/lib/recommend/scoreParts";
import { Thumbnail } from "@/_components/common/Thumbnail";
import { Chip } from "@/_components/common/Chip";
import { colors, radius, space, typo } from "@/lib/designTokens";
import { getDefaultCardImage } from "@/lib/defaultCardImage";

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
  scenarioObject,
  onCardClick,
  onNavigate,
  onCall,
}: Props) {
  const cfg = scenarioObject ? resolveScenarioConfig(scenarioObject) : null;
  const primary =
    cfg?.primaryBadgeLabel ??
    card.recommendBadge?.primaryLabel ??
    (card.categoryLabel || "추천");

  const tags = (card.recommendBadge?.shortTags ?? []).slice(0, 3);
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
        padding: 12,
        minHeight: 132,
        borderRadius: radius.card,
        background: colors.bgCard,
        border: `1px solid ${colors.borderSubtle}`,
        boxShadow: "0 6px 20px rgba(15,23,42,0.06)",
        cursor: "pointer",
      }}
    >
      <Thumbnail src={thumb} alt="" size={84} radius={14} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ ...typo.cardTitle, fontSize: 16, color: colors.textPrimary, lineHeight: 1.25 }}>
          {card.name}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          <Chip>{primary}</Chip>
          {tags.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: colors.textSecondary,
                background: colors.bgMuted,
                padding: "3px 8px",
                borderRadius: radius.pill,
              }}
            >
              {t}
            </span>
          ))}
        </div>
        {line2 && (
          <div style={{ ...typo.caption, color: colors.textSecondary, marginTop: 8 }}>{line2}</div>
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
                color: "#fff",
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
              전화
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

"use client";

import React from "react";
import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { businessStateFromCard, type BusinessState } from "@/lib/recommend/scoreParts";
import { getDefaultCardImage } from "@/lib/defaultCardImage";
import { buildRecommendationReason, getClientTimeOfDay } from "@/lib/recommend/buildRecommendationReason";
import { colors, radius, shadow, space, typo } from "@/lib/designTokens";

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
  const reason = buildRecommendationReason(card, {
    deckSlot: rank,
    timeOfDay: getClientTimeOfDay(),
  });
  const featured = rank === 0;
  const thumb =
    (card as any).imageUrl ?? (card as any).image_url ?? getDefaultCardImage(card);
  const bs = businessStateFromCard(card);
  const dist = kmLine(card);
  const biz = bizLabel(bs);
  const metaLine = [dist, biz].filter(Boolean).join(" · ");
  const phone = String(card.phone ?? "").trim();
  const imgH = featured ? 200 : 168;
  const closed = bs === "CLOSED";
  const reasonLead = closed ? reason.headline : reason.headline.startsWith("🔥") ? reason.headline : `🔥 ${reason.headline}`;

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
      className="hama-press"
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: radius.largeCard,
        background: colors.bgCard,
        border: featured ? `2px solid ${colors.accentSoft}` : `1px solid ${colors.borderSubtle}`,
        boxShadow: featured ? shadow.elevated : shadow.card,
        cursor: "pointer",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: imgH,
          flexShrink: 0,
          background: colors.bgMuted,
        }}
      >
        <img
          src={thumb}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          loading={rank === 0 ? "eager" : "lazy"}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(15,23,42,0.12) 0%, rgba(15,23,42,0.45) 100%)",
            pointerEvents: "none",
          }}
        />
        {featured && (
          <span
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.02em",
              color: colors.accentOnPrimary,
              background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
              padding: "6px 12px",
              borderRadius: radius.pill,
              boxShadow: "0 2px 12px rgba(194,65,12,0.35)",
            }}
          >
            오늘의 1순위
          </span>
        )}
        <span
          style={{
            position: "absolute",
            bottom: 10,
            right: 12,
            fontSize: 12,
            fontWeight: 800,
            color: "rgba(255,255,255,0.92)",
            textShadow: "0 1px 4px rgba(0,0,0,0.4)",
          }}
        >
          {rank + 1}/3
        </span>
      </div>

      <div style={{ padding: featured ? 18 : space.cardPadding, display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            ...typo.cardTitle,
            fontSize: featured ? 19 : 17,
            color: colors.textPrimary,
            lineHeight: 1.25,
            fontWeight: 900,
            letterSpacing: "-0.02em",
          }}
        >
          {card.name}
        </div>

        <p
          style={{
            ...typo.cardReason,
            fontSize: 15,
            color: closed ? colors.textSecondary : colors.reasonHot,
            margin: 0,
            lineHeight: 1.35,
            fontWeight: 900,
            letterSpacing: "-0.02em",
          }}
        >
          {reasonLead}
        </p>
        <p
          style={{
            ...typo.caption,
            fontSize: 14,
            color: colors.textSecondary,
            margin: 0,
            lineHeight: 1.5,
            fontWeight: 500,
          }}
        >
          {reason.subline}
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {reason.badges.slice(0, 3).map((t) => (
            <span
              key={t}
              style={{
                ...typo.chip,
                color: colors.tagDeepText,
                background: colors.tagDeepBg,
                padding: "5px 11px",
                borderRadius: radius.pill,
                border: `1px solid ${colors.tagDeepBorder}`,
              }}
            >
              {t}
            </span>
          ))}
        </div>

        {metaLine && (
          <div style={{ ...typo.caption, color: colors.textMuted, marginTop: 2 }}>{metaLine}</div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate();
            }}
            style={{
              flex: 1,
              height: 46,
              borderRadius: radius.button,
              border: "none",
              background: `linear-gradient(135deg, ${colors.accentPrimary} 0%, ${colors.accentStrong} 100%)`,
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
              height: 46,
              borderRadius: radius.button,
              border: `1px solid ${colors.borderSubtle}`,
              background: colors.bgMuted,
              color: phone ? colors.textPrimary : colors.textSecondary,
              fontWeight: 800,
              fontSize: 14,
              cursor: phone ? "pointer" : "not-allowed",
            }}
          >
            전화하기
          </button>
        </div>
      </div>
    </div>
  );
}

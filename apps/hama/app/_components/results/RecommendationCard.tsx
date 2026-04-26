"use client";

import React, { useLayoutEffect, useRef } from "react";
import { logRecommendationPlace } from "@/lib/analytics/recommendationPlaceLog";
import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { scenarioRankKeyForRecommendationCopy } from "@/lib/scenarioEngine/scenarioRankBridge";
import { businessStateFromCard, type BusinessState } from "@/lib/recommend/scoreParts";
import { getDefaultCardImage } from "@/lib/defaultCardImage";
import {
  buildRecommendationReason,
  getClientTimeOfDay,
  type RecommendationReasonBlock,
} from "@/lib/recommend/buildRecommendationReason";
import { colors, radius, shadow, space, typo } from "@/lib/designTokens";
import { FlameIcon, SparkleIcon } from "@icons";
import { Chip } from "@ui/Chip";
import { Touchable } from "@ui/Touchable";

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

function categoryWithIcon(card: HomeCard): string {
  const c = String(card.category ?? "").toLowerCase();
  if (c === "restaurant") return "🍴 푸드";
  if (c === "cafe") return "☕ 카페";
  if (c === "salon") return "💇 미용실";
  if (c === "activity" || c === "museum") return "🎨 액티비티";
  return card.categoryLabel ?? card.category ?? "추천";
}

type Props = {
  card: HomeCard;
  rank: number;
  scenarioObject: ScenarioObject | null;
  /** 목록에서 미리 계산한 이유(덱 variation) — 없으면 카드 내부에서 생성 */
  reason?: RecommendationReasonBlock;
  showSoftFallbackCopy?: boolean;
  onCardClick: () => void;
  onNavigate: () => void;
  onCall: () => void;
};

export function RecommendationCard({
  card,
  rank,
  scenarioObject,
  reason: reasonOverride,
  showSoftFallbackCopy = false,
  onCardClick,
  onNavigate,
  onCall,
}: Props) {
  const cardEl = useRef<HTMLDivElement>(null);
  const impressOnce = useRef(false);
  useLayoutEffect(() => {
    if (impressOnce.current || !cardEl.current) return;
    const el = cardEl.current;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting && !impressOnce.current) {
          impressOnce.current = true;
          logRecommendationPlace("place_impression", card, scenarioObject, {
            rank_position: rank,
            source_page: "results",
          });
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [card.id, rank, scenarioObject]);

  const requestedScenario = scenarioRankKeyForRecommendationCopy(scenarioObject);
  const reason =
    reasonOverride ??
    buildRecommendationReason(card, {
      deckSlot: rank,
      timeOfDay: getClientTimeOfDay(),
      requestedScenario,
    });
  const featured = rank === 0;
  const thumb =
    (card as any).imageUrl ?? (card as any).image_url ?? getDefaultCardImage(card);
  const bs = businessStateFromCard(card);
  const dist = kmLine(card);
  const biz = bizLabel(bs);
  const metaLine = [dist, biz].filter(Boolean).join(" · ");
  const phone = String(card.phone ?? "").trim();
  const imgH = featured ? 228 : 132;
  const closed = bs === "CLOSED";
  const categoryBadge = categoryWithIcon(card);
  const reasonItems = [reason.badges[0], reason.badges[1], reason.badges[2]].filter(
    (v): v is string => Boolean(v && String(v).trim())
  );
  if (reasonItems.length < 3) {
    reasonItems.push(reason.subline);
  }
  if (reasonItems.length < 3) {
    reasonItems.push(metaLine || "지금 바로 이동 가능");
  }
  if (reasonItems.length < 3) {
    reasonItems.push("근처에서 빠르게 결정하기 좋음");
  }

  return (
    <Touchable>
      <div
        ref={cardEl}
        role="button"
        tabIndex={0}
        onClick={() => {
          logRecommendationPlace("place_click", card, scenarioObject, {
            rank_position: rank,
            source_page: "results",
            metadata: { selected_rank: rank },
          });
          onCardClick();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            logRecommendationPlace("place_click", card, scenarioObject, {
              rank_position: rank,
              source_page: "results",
              metadata: { selected_rank: rank },
            });
            onCardClick();
          }
        }}
        className="hama-press"
        style={{
          display: "flex",
          flexDirection: "column",
          borderRadius: radius.xl,
          background: colors.bgCard,
          border: featured ? `2px solid ${colors.accentPrimary}` : `1px solid ${colors.borderSubtle}`,
          boxShadow: featured ? shadow.elevated : "0 2px 10px rgba(17,24,39,0.05)",
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
            background: "linear-gradient(180deg, rgba(255,107,53,0.08) 0%, rgba(0,0,0,0.15) 100%)",
            pointerEvents: "none",
          }}
        />
        {featured ? (
          <span
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: "0.02em",
              color: colors.primary,
              background: "rgba(255,255,255,0.95)",
              padding: "6px 12px",
              borderRadius: radius.pill,
              boxShadow: "0 4px 14px rgba(17,24,39,0.12)",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <SparkleIcon size={12} color={colors.primary} />
              추천 1순위
            </span>
          </span>
        ) : (
          <span
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              fontSize: 11,
              fontWeight: 800,
              color: colors.textPrimary,
              background: "rgba(255,255,255,0.9)",
              padding: "4px 10px",
              borderRadius: radius.pill,
            }}
          >
            보조 추천
          </span>
        )}
        <span style={{ position: "absolute", bottom: 10, right: 12, fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.92)", textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>{rank + 1}/3</span>
      </div>

      <div style={{ padding: featured ? 18 : space.cardPadding, display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ ...typo.cardReason, fontSize: 15, color: closed ? colors.textSecondary : colors.reasonHot, margin: 0, lineHeight: 1.35, fontWeight: 900, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 6 }}>
          {!closed && <FlameIcon size={14} color={colors.reasonHot} />}
          <span>{reason.scenarioLabel}</span>
        </p>

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

        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: colors.textSecondary,
            marginTop: -2,
          }}
        >
          {categoryBadge}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {reasonItems.slice(0, 3).map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>

        {metaLine && (
          <div style={{ ...typo.caption, color: colors.textMuted, marginTop: 2 }}>{metaLine}</div>
        )}

        {featured && (
          <div style={{ marginTop: 10 }}>
            <p style={{ ...typo.caption, color: colors.textSecondary, margin: 0, lineHeight: 1.45, fontWeight: 700 }}>
              지금 시간·거리·상황 기준으로 가장 자연스러운 선택이에요
            </p>
            {showSoftFallbackCopy && (
              <p style={{ ...typo.caption, color: colors.textMuted, margin: "6px 0 0", lineHeight: 1.45, fontWeight: 600 }}>
                완벽하진 않지만 지금 조건에서 가장 무난한 선택이에요
              </p>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
          <Touchable style={{ flex: 1 }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNavigate();
              }}
              style={{
                width: "100%",
                height: 46,
                borderRadius: radius.md,
                border: `1px solid ${colors.borderSubtle}`,
                background: "#fff",
                color: colors.textPrimary,
                fontWeight: 800,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              길찾기
            </button>
          </Touchable>
          <Touchable style={{ flex: 1.35 }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCardClick();
              }}
              style={{
                width: "100%",
                height: 46,
                borderRadius: radius.md,
                border: "none",
                background: colors.textPrimary,
                color: "#fff",
                boxShadow: shadow.cta,
                fontWeight: 900,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              여기로 결정
            </button>
          </Touchable>
        </div>
        {phone ? (
          <div style={{ marginTop: 8, textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCall();
              }}
              style={{
                border: "none",
                background: "transparent",
                color: colors.accentPrimary,
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                padding: "4px 0",
              }}
            >
              전화하기
            </button>
          </div>
        ) : null}
      </div>
      </div>
    </Touchable>
  );
}

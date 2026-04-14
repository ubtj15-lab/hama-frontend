"use client";

import React, { useEffect, useState } from "react";
import type { HomeCard } from "@/lib/storeTypes";
import {
  HOME_TRUST_PICK_MAX,
  TRUST_SCENARIO_SEEDS,
  type TrustScenarioSeed,
  fetchTrustPickPlaceCards,
  pickDiverseHomeCards,
} from "@/lib/homeTrustPick";
import { getDefaultCardImage } from "@/lib/defaultCardImage";
import { colors, radius, shadow, space, typo } from "@/lib/designTokens";
import { logEvent } from "@/lib/logEvent";
import { HamaEvents } from "@/lib/analytics/events";
import { openDirections } from "@/lib/openDirections";
import { buildRecommendationReason } from "@/lib/recommend/buildRecommendationReason";
import { businessStateFromCard } from "@/lib/recommend/scoreParts";

type TrustRow =
  | { kind: "place"; card: HomeCard }
  | { kind: "scenario"; seed: TrustScenarioSeed };

type Props = {
  onPlaceOpen: (card: HomeCard) => void;
  onScenarioGo: (query: string) => void;
};

function thumbPlace(card: HomeCard): string {
  const c = card as Record<string, unknown>;
  const u = String(c.imageUrl ?? c.image_url ?? "").trim();
  if (u) return u;
  return getDefaultCardImage(card);
}

function buildRows(places: HomeCard[]): TrustRow[] {
  const picked = pickDiverseHomeCards(places, HOME_TRUST_PICK_MAX);
  /** 매장 0이면 빈 배열 → 아래에서 시나리오 단일 패널로 처리 (시드 카드 3장 반복 방지) */
  if (picked.length === 0) return [];

  const rows: TrustRow[] = picked.map((card) => ({ kind: "place", card }));
  let i = 0;
  while (rows.length < HOME_TRUST_PICK_MAX && i < TRUST_SCENARIO_SEEDS.length) {
    rows.push({ kind: "scenario", seed: TRUST_SCENARIO_SEEDS[i]! });
    i += 1;
  }
  return rows.slice(0, HOME_TRUST_PICK_MAX);
}

function splitFeatured(rows: TrustRow[]): { firstPlace: TrustRow | null; tail: TrustRow[] } {
  const idx = rows.findIndex((r) => r.kind === "place");
  if (idx === -1) return { firstPlace: null, tail: rows };
  const first = rows[idx]!;
  const tail = [...rows.slice(0, idx), ...rows.slice(idx + 1)];
  return { firstPlace: first, tail };
}

/** 목업: 거리·편의 → 📍, 그 외 추천 이유 → 🔥 */
function reasonLeadingEmoji(headline: string): string {
  if (/편해|가깝|근처|거리|이동|지금/.test(headline)) return "📍";
  return "🔥";
}

const SCENARIO_ROW_ICONS = ["🍱", "🥐", "🍽️"] as const;

function ScenarioEmptyFallback({ onScenarioGo }: { onScenarioGo: (query: string) => void }) {
  return (
    <div>
      <h3
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: colors.textPrimary,
          margin: "0 0 8px",
          letterSpacing: "-0.02em",
        }}
      >
        💡 상황만 골라도 바로 추천받을 수 있어요
      </h3>
      <p
        style={{
          fontSize: 13,
          color: colors.textSecondary,
          lineHeight: 1.5,
          margin: "0 0 14px",
        }}
      >
        지금은 이 지역 매장을 불러오지 못했어요. 위 검색창에 말을 적거나, 아래를 눌러 결과로 갈 수 있어요.
      </p>
      <div
        style={{
          borderRadius: radius.largeCard,
          border: `1px solid ${colors.borderSubtle}`,
          background: colors.bgCard,
          boxShadow: shadow.card,
          overflow: "hidden",
        }}
      >
        {TRUST_SCENARIO_SEEDS.map((seed, idx) => (
          <button
            key={seed.id}
            type="button"
            onClick={() => {
              logEvent(HamaEvents.home_recommend_row_click, {
                kind: "scenario",
                query: seed.query,
                card_rank: idx,
                page: "home",
                surface: "empty_fallback",
              });
              onScenarioGo(seed.query);
            }}
            style={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              border: "none",
              borderBottom:
                idx < TRUST_SCENARIO_SEEDS.length - 1 ? `1px solid ${colors.borderSubtle}` : "none",
              background: colors.bgCard,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: colors.accentSoft,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                flexShrink: 0,
              }}
              aria-hidden
            >
              {SCENARIO_ROW_ICONS[idx] ?? "✨"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: colors.textPrimary, lineHeight: 1.25 }}>
                {seed.title}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {seed.tags.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: colors.tagMutedText,
                      background: colors.tagMutedBg,
                      padding: "3px 8px",
                      borderRadius: radius.pill,
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <span style={{ color: colors.textMuted, fontSize: 20, flexShrink: 0 }} aria-hidden>
              ›
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function HomeTrustPickSection({ onPlaceOpen, onScenarioGo }: Props) {
  const [rows, setRows] = useState<TrustRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const raw = await fetchTrustPickPlaceCards(16);
      if (!alive) return;
      setRows(buildRows(raw));
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!rows) return;
    const placeIds = rows.filter((r) => r.kind === "place").map((r) => r.card.id);
    logEvent(HamaEvents.home_recommend_impression, {
      page: "home",
      place_ids: placeIds,
      count: placeIds.length,
      stores_empty: placeIds.length === 0,
    });
  }, [rows]);

  const { firstPlace, tail } = rows ? splitFeatured(rows) : { firstPlace: null, tail: [] };

  const renderPlaceCard = (row: Extract<TrustRow, { kind: "place" }>, idx: number, featured: boolean) => {
    const { card } = row;
    const reason = buildRecommendationReason(card);
    const bizState = businessStateFromCard(card);
    const reasonIsClosed = bizState === "CLOSED";
    const lat = typeof card.lat === "number" ? card.lat : null;
    const lng = typeof card.lng === "number" ? card.lng : null;
    const tel = String(card.phone ?? "").trim();

    const pad = featured ? 18 : 14;
    const titleSize = featured ? 18 : 16;
    /** 상단 풀폭 이미지 높이 — 첫 카드 더 크게 */
    const imageHeight = featured ? 220 : 160;
    const ctaOutline = {
      flex: "1 1 0",
      minWidth: 0,
      height: 44,
      borderRadius: radius.button,
      border: `1px solid ${colors.borderSubtle}`,
      background: colors.bgSurface,
      color: colors.accentStrong,
      fontWeight: 800,
      fontSize: 13,
      cursor: "pointer" as const,
      display: "flex" as const,
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    };

    return (
      <div
        key={`${card.id}-${featured ? "f" : "n"}`}
        role="button"
        tabIndex={0}
        onClick={() => {
          logEvent(HamaEvents.home_recommend_row_click, {
            kind: "place",
            place_id: card.id,
            card_rank: idx,
            featured,
            page: "home",
          });
          onPlaceOpen(card);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPlaceOpen(card);
          }
        }}
        style={{
          display: "flex",
          flexDirection: "column",
          padding: 0,
          borderRadius: radius.largeCard,
          background: colors.bgCard,
          border: `1px solid ${colors.borderSubtle}`,
          boxShadow: featured ? shadow.elevated : shadow.card,
          cursor: "pointer",
          textAlign: "left",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: "100%",
            height: imageHeight,
            flexShrink: 0,
            background: "#e2e8f0",
            position: "relative",
          }}
        >
          <img
            src={thumbPlace(card)}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
            loading="lazy"
          />
        </div>
        <div
          style={{
            padding: pad,
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div
              style={{
                ...typo.cardTitle,
                fontSize: titleSize,
                color: colors.textPrimary,
                lineHeight: 1.25,
                fontWeight: 800,
                flex: 1,
                minWidth: 0,
              }}
            >
              {(card.name || "추천 장소").slice(0, 40)}
              {(card.name?.length ?? 0) > 40 ? "…" : ""}
            </div>
            <span
              style={{
                fontSize: 22,
                color: colors.textMuted,
                fontWeight: 300,
                lineHeight: 1,
                flexShrink: 0,
                marginTop: 2,
              }}
              aria-hidden
            >
              ›
            </span>
          </div>
          <p
            style={{
              ...typo.cardReason,
              color: reasonIsClosed ? colors.textSecondary : colors.reasonHot,
              margin: "8px 0 0",
              lineHeight: 1.35,
              fontWeight: 800,
            }}
          >
            {reasonIsClosed ? reason.headline : `${reasonLeadingEmoji(reason.headline)} ${reason.headline}`}
          </p>
          <p
            style={{
              ...typo.caption,
              color: colors.textSecondary,
              margin: "6px 0 0",
              lineHeight: 1.5,
              fontWeight: 500,
              fontSize: 13,
            }}
          >
            {reason.subline}
          </p>
          {reason.regionTrust && !featured && (
            <p style={{ ...typo.caption, color: colors.textMuted, margin: "4px 0 0", fontSize: 12 }}>
              {reason.regionTrust}
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {reason.badges.map((t) => (
              <span
                key={t}
                style={{
                  ...typo.chip,
                  color: colors.tagMutedText,
                  background: colors.tagMutedBg,
                  padding: "5px 10px",
                  borderRadius: radius.pill,
                  border: `1px solid ${colors.accentSoft}`,
                }}
              >
                {t}
              </span>
            ))}
          </div>
          <div
            style={{ display: "flex", gap: 8, marginTop: 14 }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                logEvent(HamaEvents.home_trust_directions, { place_id: card.id, page: "home" });
                openDirections({ name: card.name, lat, lng });
              }}
              style={ctaOutline}
            >
              <span aria-hidden style={{ fontSize: 15 }}>
                📍
              </span>
              길찾기
            </button>
            <button
              type="button"
              disabled={!tel}
              onClick={() => {
                logEvent(HamaEvents.cta_call, { place_id: card.id, page: "home", surface: "trust_card" });
                window.location.href = `tel:${tel.replace(/[^0-9+]/g, "")}`;
              }}
              style={{
                ...ctaOutline,
                opacity: tel ? 1 : 0.45,
                cursor: tel ? "pointer" : "not-allowed",
              }}
            >
              <span aria-hidden style={{ fontSize: 15 }}>
                📞
              </span>
              전화하기
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderScenarioRow = (row: Extract<TrustRow, { kind: "scenario" }>, idx: number) => {
    const { seed } = row;
    return (
      <button
        key={seed.id}
        type="button"
        onClick={() => {
          logEvent(HamaEvents.home_recommend_row_click, {
            kind: "scenario",
            query: seed.query,
            card_rank: idx,
            page: "home",
          });
          onScenarioGo(seed.query);
        }}
        style={{
          display: "flex",
          gap: 12,
          padding: space.cardPadding,
          borderRadius: radius.largeCard,
          background: colors.bgCard,
          border: `1px solid ${colors.borderSubtle}`,
          boxShadow: shadow.card,
          cursor: "pointer",
          textAlign: "left",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 16,
            flexShrink: 0,
            background: `linear-gradient(145deg, ${colors.accentSoft} 0%, #fce7f3 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
          }}
          aria-hidden
        >
          ✨
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              ...typo.cardTitle,
              fontSize: 17,
              color: colors.textPrimary,
              lineHeight: 1.3,
              fontWeight: 800,
            }}
          >
            {seed.title}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {seed.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                style={{
                  ...typo.chip,
                  color: colors.accentStrong,
                  background: colors.accentSoft,
                  padding: "4px 10px",
                  borderRadius: radius.pill,
                }}
              >
                {t}
              </span>
            ))}
          </div>
          <p style={{ fontSize: 12, color: colors.textMuted, margin: "8px 0 0", lineHeight: 1.45 }}>
            한 번 탭하면 이 주제로 3곳을 골라줄게
          </p>
        </div>
        <span style={{ fontSize: 22, color: colors.textSecondary, fontWeight: 300 }} aria-hidden>
          ›
        </span>
      </button>
    );
  };

  return (
    <section style={{ marginBottom: `calc(${space.section}px + 8px)` }}>
      <p
        style={{
          fontSize: 12,
          color: colors.textMuted,
          margin: "0 0 14px",
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
      >
        오산·동탄·평택 데이터로 골라요
      </p>

        <div style={{ display: "flex", flexDirection: "column", gap: space.sectionTight }}>
        {rows !== null && rows.length === 0 && <ScenarioEmptyFallback onScenarioGo={onScenarioGo} />}

        {rows === null &&
          Array.from({ length: HOME_TRUST_PICK_MAX }).map((_, idx) => (
            <div
              key={`sk-${idx}`}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: 0,
                borderRadius: radius.largeCard,
                background: colors.bgCard,
                border: `1px solid ${colors.borderSubtle}`,
                overflow: "hidden",
                opacity: 0.65,
              }}
            >
              <div style={{ width: "100%", height: idx === 0 ? 220 : 160, background: colors.bgMuted }} />
              <div style={{ padding: 14 }}>
                <div
                  style={{
                    height: 16,
                    width: "70%",
                    background: colors.bgMuted,
                    borderRadius: 6,
                    marginBottom: 10,
                  }}
                />
                <div style={{ height: 12, width: "45%", background: colors.bgMuted, borderRadius: 6 }} />
              </div>
            </div>
          ))}

        {rows !== null && firstPlace && (
          <div>
            <h3
              style={{
                fontSize: 16,
                color: colors.textPrimary,
                margin: "0 0 12px",
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              🔥 오늘 가장 잘 맞는 곳
            </h3>
            {firstPlace.kind === "place" ? renderPlaceCard(firstPlace, 0, true) : renderScenarioRow(firstPlace, 0)}
          </div>
        )}

        {rows !== null && tail.length > 0 && (
          <div>
            <h3
              style={{
                fontSize: 16,
                color: colors.textPrimary,
                margin: "0 0 12px",
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              {firstPlace ? "👍 이런 선택도 좋아요" : "바로 골라볼게"}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: space.card }}>
              {tail.map((row, i) => {
                const globalIdx = firstPlace ? i + 1 : i;
                if (row.kind === "place") return renderPlaceCard(row, globalIdx, false);
                return renderScenarioRow(row, globalIdx);
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

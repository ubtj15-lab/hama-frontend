"use client";

import React, { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { RecommendationCard } from "@/_components/results/RecommendationCard";
import { useDeckRecommendationReasons } from "@/_hooks/useDeckRecommendationReasons";
import { colors, space } from "@/lib/designTokens";
import { logEvent } from "@/lib/logEvent";
import { mergeLogPayload, type AnalyticsContext } from "@/lib/analytics/buildLogPayload";
import { openDirections } from "@/lib/openDirections";
import { stashPlaceForSession } from "@/lib/session/placeSession";
import { RECOMMEND_DECK_SIZE } from "@/lib/recommend/recommendConstants";

/** 카드 대신 짧은 리스트만 — `NEXT_PUBLIC_DEBUG_MINIMAL_SEARCH=1` */
const MINIMAL_SEARCH_UI = process.env.NEXT_PUBLIC_DEBUG_MINIMAL_SEARCH === "1";
/** 요청한 것과 동일한 RAW 콘솔 + div-only UI — `NEXT_PUBLIC_DEBUG_SEARCH_RAW_MINIMAL=1` */
const RAW_MINIMAL_SEARCH_UI = process.env.NEXT_PUBLIC_DEBUG_SEARCH_RAW_MINIMAL === "1";

type Props = {
  /** 부모는 보통 `HomeCard[]`. 래퍼 `{ items: [] }` 등은 정규화 */
  results: HomeCard[] | unknown;
  scenarioObject: ScenarioObject | null | undefined;
  logBase: AnalyticsContext;
  onRecordView: (id: string) => void;
};

function normalizeSearchSectionResults(raw: unknown): HomeCard[] {
  if (Array.isArray(raw)) return raw as HomeCard[];
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    for (const key of ["items", "data", "results"] as const) {
      const v = o[key];
      if (Array.isArray(v)) return v as HomeCard[];
    }
  }
  return [];
}

function displayNameForPlace(place: HomeCard): string {
  const p = place as Record<string, unknown>;
  const candidates = [
    typeof place.name === "string" ? place.name.trim() : "",
    typeof p.title === "string" ? String(p.title).trim() : "",
    typeof p.place_name === "string" ? String(p.place_name).trim() : "",
    typeof p.store_name === "string" ? String(p.store_name).trim() : "",
  ];
  const hit = candidates.find(Boolean);
  return hit || "(이름 없음)";
}

export function SearchResultSection({ results: resultsProp, scenarioObject, logBase, onRecordView }: Props) {
  const router = useRouter();
  const results = useMemo(() => normalizeSearchSectionResults(resultsProp), [resultsProp]);
  const cardsForUi = useMemo(
    () =>
      results.map((c) => ({
        ...c,
        name: displayNameForPlace(c),
      })),
    [results]
  );
  const slice = cardsForUi.slice(0, RECOMMEND_DECK_SIZE);
  const deckReasons = useDeckRecommendationReasons(cardsForUi, scenarioObject ?? null);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[SearchResultSection] mounted");
    }
  }, []);

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log("[RENDER 4] results =", results);
    // eslint-disable-next-line no-console
    console.log("[RENDER 5] names =", results?.map((p) => displayNameForPlace(p)));
  }

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.log("[SEARCH UI 1] raw results =", resultsProp);
    // eslint-disable-next-line no-console
    console.log("[SEARCH UI 2] isArray =", Array.isArray(resultsProp));
  }

  if (RAW_MINIMAL_SEARCH_UI) {
    return (
      <div style={{ marginBottom: space.section }} data-testid="search-result-section">
        <h2 style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>검색 결과 테스트</h2>
        {Array.isArray(results) ? (
          results.map((place, index) => (
            <div key={place.id || `idx-${index}`} style={{ padding: "8px 0" }}>
              <div>{place.name}</div>
              <div>{`#${index + 1}`}</div>
            </div>
          ))
        ) : (
          <div>results is not array</div>
        )}
      </div>
    );
  }

  const getLatLng = (card: HomeCard) => {
    const a = card as Record<string, unknown>;
    const lat = typeof a.lat === "number" ? a.lat : undefined;
    const lng = typeof a.lng === "number" ? a.lng : undefined;
    return { lat, lng };
  };

  if (MINIMAL_SEARCH_UI) {
    return (
      <div style={{ marginBottom: space.section }} data-testid="search-result-section">
        <h2 style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>검색 결과</h2>
        {slice.map((place, index) => (
          <div
            key={place.id || `idx-${index}`}
            style={{ padding: "8px 0", borderBottom: `1px solid ${colors.borderSubtle}` }}
          >
            <div style={{ fontWeight: 700 }}>{place.name}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{`#${index + 1}`}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section style={{ marginBottom: space.section }} data-testid="search-result-section">
      <p
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: colors.textSecondary,
          margin: "0 0 6px",
          lineHeight: 1.4,
        }}
      >
        검색한 장소를 먼저 보여줄게
      </p>
      <h2
        style={{
          fontSize: 15,
          fontWeight: 900,
          color: colors.textPrimary,
          margin: "0 0 12px",
          letterSpacing: "-0.02em",
        }}
      >
        이 이름으로 찾은 결과야
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: space.card }}>
        {slice.map((card, i) => (
          <RecommendationCard
            key={card.id}
            card={card}
            rank={i}
            scenarioObject={scenarioObject ?? null}
            reason={deckReasons[i]}
            onCardClick={() => {
              logEvent(
                "place_click",
                mergeLogPayload(logBase, {
                  place_id: card.id,
                  name: card.name,
                  card_rank: i,
                  source: "place_name_search",
                })
              );
              stashPlaceForSession(card);
              onRecordView(card.id);
              router.push(`/place/${encodeURIComponent(card.id)}`);
            }}
            onNavigate={() => {
              logEvent(
                "navigate_click",
                mergeLogPayload(logBase, {
                  place_id: card.id,
                  card_rank: i,
                  source: "place_name_search",
                })
              );
              const { lat, lng } = getLatLng(card);
              openDirections({ name: card.name, lat: lat ?? null, lng: lng ?? null });
            }}
            onCall={() => {
              const tel = String(card.phone ?? "").replace(/[^0-9+]/g, "");
              logEvent(
                "call_click",
                mergeLogPayload(logBase, {
                  place_id: card.id,
                  card_rank: i,
                  source: "place_name_search",
                })
              );
              if (tel) window.location.href = `tel:${tel}`;
            }}
          />
        ))}
      </div>
    </section>
  );
}

"use client";

import React from "react";
import type { HomeCard } from "@/lib/storeTypes";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { useDeckRecommendationReasons } from "@/_hooks/useDeckRecommendationReasons";
import { RecommendationCard } from "./RecommendationCard";
import { space } from "@/lib/designTokens";
import type { LogRecommendationEventInput } from "@/lib/analytics/types";
import { logRecommendationEvent } from "@/lib/analytics/logRecommendationEvent";

type Props = {
  cards: HomeCard[];
  scenarioObject: ScenarioObject | null;
  onPlaceClick: (card: HomeCard, rank: number) => void;
  onNavigate: (card: HomeCard, rank: number) => void;
  onCall: (card: HomeCard, rank: number) => void;
  analyticsV2Click?: LogRecommendationEventInput["analytics_v2"];
  /** 메인 카드 아래 — 후보 부족·재추천 등 */
  showSoftFallbackCopy?: boolean;
};

export function RecommendationList({
  cards,
  scenarioObject,
  onPlaceClick,
  onNavigate,
  onCall,
  analyticsV2Click,
  showSoftFallbackCopy = false,
}: Props) {
  const [feedbackDone, setFeedbackDone] = React.useState<"like" | "neutral" | "dislike" | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const slice = cards.slice(0, 3);
  const deckReasons = useDeckRecommendationReasons(cards, scenarioObject);

  const submitFeedback = (value: "like" | "neutral" | "dislike") => {
    const top = slice[0];
    if (!top) return;
    setFeedbackDone(value);
    setToast("감사합니다");
    window.setTimeout(() => setToast(null), 1500);
    logRecommendationEvent({
      event_name: "place_feedback",
      entity_type: "place",
      entity_id: top.id,
      recommendation_rank: 1,
      scenario: scenarioObject?.scenario ?? null,
      source_page: "results",
      place_ids: [top.id],
      metadata: {
        feedback: value,
        message: "이 추천 도움됐나요?",
      },
      analytics_v2: {
        ...(analyticsV2Click ?? {}),
        action: "feedback",
        selected_place_id: top.id,
        feedback: value,
      } as LogRecommendationEventInput["analytics_v2"],
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space.card }}>
      {slice.map((card, i) => (
        <React.Fragment key={card.id}>
          <RecommendationCard
            card={card}
            rank={i}
            scenarioObject={scenarioObject}
            reason={deckReasons[i]}
            showSoftFallbackCopy={showSoftFallbackCopy}
            analyticsV2Click={analyticsV2Click}
            onCardClick={() => onPlaceClick(card, i)}
            onNavigate={() => onNavigate(card, i)}
            onCall={() => onCall(card, i)}
          />
          {i === 0 ? (
            <div
              style={{
                marginTop: -6,
                borderRadius: 14,
                border: "1px solid #E5E7EB",
                background: "#fff",
                padding: "10px 12px",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 800, color: "#111827", marginRight: 6 }}>
                이 추천 도움됐나요?
              </span>
              {[
                { id: "like", label: "👍 좋아요" },
                { id: "neutral", label: "😐 그냥" },
                { id: "dislike", label: "👎 별로" },
              ].map((b) => {
                const active = feedbackDone === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => submitFeedback(b.id as "like" | "neutral" | "dislike")}
                    style={{
                      border: active ? "1px solid #2563EB" : "1px solid #CBD5E1",
                      background: active ? "#EFF6FF" : "#fff",
                      color: active ? "#1D4ED8" : "#334155",
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 800,
                      padding: "6px 10px",
                      cursor: "pointer",
                    }}
                  >
                    {b.label}
                  </button>
                );
              })}
              {toast ? (
                <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800, color: "#16A34A" }}>
                  {toast}
                </span>
              ) : null}
            </div>
          ) : null}
        </React.Fragment>
      ))}
      {slice.length > 0 ? (
        <div
          style={{
            borderRadius: 999,
            background: "rgba(255,255,255,0.7)",
            border: "1px solid #E5E7EB",
            color: "#6B7280",
            fontSize: 13,
            fontWeight: 700,
            padding: "10px 14px",
          }}
        >
          ⓘ 근처 실제 매장 기준으로 추천했어요. 상황에 따라 혼잡도는 달라질 수 있어요.
        </div>
      ) : null}
    </div>
  );
}

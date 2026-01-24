"use client";

import React, { useEffect, useState } from "react";
import type { HomeCard } from "@lib/storeTypes";
import { fetchHomeCardsByTab } from "@/lib/storeRepository";

import {
  inferPreferenceFromText,
  rankStoresByPreference,
} from "@lib/recommendEngine";

// Supabase에서 실패하거나 데이터가 없을 때 쓸 비상용 카드 3장
const FALLBACK_CARDS: HomeCard[] = [
  {
    id: "cafe-1",
    name: "스타벅스 오산점",
    category: "cafe",
    categoryLabel: "카페",
    distanceKm: 0.5,
    moodText: "조용한 분위기",
    imageUrl: "/images/sample-cafe-1.jpg",
    quickQuery: "스타벅스 오산점",
  },
  {
    id: "cafe-2",
    name: "라운지 83",
    category: "cafe",
    categoryLabel: "카페",
    distanceKm: 0.8,
    moodText: "햇살 잘 들어오는 브런치",
    imageUrl: "/images/sample-cafe-2.jpg",
    quickQuery: "오산 브런치 카페",
  },
  {
    id: "kids-1",
    name: "하마키즈 플레이존",
    category: "activity",
    categoryLabel: "액티비티",
    distanceKm: 1.2,
    moodText: "아이와 가기 좋은 놀이터",
    imageUrl: "/images/sample-kids-1.jpg",
    quickQuery: "키즈카페",
  },
];


type Props = {
  query: string;
  category: string;
  hasResults: boolean;
  onQuickFilter: (category: string) => void;
  onRetryVoice: () => void;
};

type RecommendState =
  | { mode: "loading" }
  | { mode: "empty" }
  | {
      mode: "cards";
      cards: HomeCard[];
      // preference는 나중에 로그/디버깅용으로만 사용
      preferenceText?: string;
    };

const RecommendSection: React.FC<Props> = ({
  query,
  category,
  hasResults,
  onQuickFilter,
  onRetryVoice,
}) => {
  const [state, setState] = useState<RecommendState>({ mode: "loading" });

    // 🔥 Supabase + 추천엔진 + 비상용 카드
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ mode: "loading" });

      let baseStores: HomeCard[] = [];

      // 1) Supabase에서 매장 불러오기 (실패하면 로그만 찍고 넘어감)
      try {
        const stores = await fetchHomeCardsByTab("all", { count: 12 })

        if (cancelled) return;

        if (stores && stores.length > 0) {
          baseStores = stores;
        } else {
          // DB에 없으면 비상용 카드 사용
          baseStores = FALLBACK_CARDS;
        }
      } catch (e) {
        console.error("fetchStores error, use fallback cards", e);
        baseStores = FALLBACK_CARDS;
      }

      // 2) 선호도 추론 + 정렬 (에러 나면 그냥 원본 순서 사용)
      let ranked: HomeCard[] = baseStores;
      let preferenceText: string | undefined;

      try {
        const pref = inferPreferenceFromText(query || category);

        if (pref) {
          ranked = rankStoresByPreference(baseStores, pref);
          preferenceText = JSON.stringify(pref);
        }
      } catch (e) {
        console.error("recommendEngine error, use base order", e);
      }

      // 3) 상위 3개만 사용 (큰 카드 1 + 작은 카드 2)
      const top3 = ranked.slice(0, 3);

      if (!cancelled) {
        setState({
          mode: "cards",
          cards: top3,
          preferenceText,
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [query, category]);


  // ======================= 렌더링 =======================

  if (state.mode === "loading") {
    return (
      <section
        style={{
          marginTop: 16,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            borderRadius: 16,
            background: "#e5edf7",
            padding: "14px 16px",
            fontSize: 13,
            color: "#64748b",
          }}
        >
          하마가 방금 한 말을 기준으로 추천 카드를 고르는 중이에요…
        </div>
      </section>
    );
  }

  if (state.mode === "empty") {
    // ✅ 정말로 Supabase에 데이터가 없을 때만 이 분기
    return (
      <section
        style={{
          marginTop: 16,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            borderRadius: 16,
            background: "#e5edf7",
            padding: "14px 16px",
            fontSize: 13,
            color: "#64748b",
          }}
        >
          아직 추천용 매장 데이터가 많지 않아요. 아래 검색 결과에서 마음에 드는 곳을 골라보세요 😊
        </div>
      </section>
    );
  }

  // mode === "cards"
  const { cards } = state;

  return (
    <section
      style={{
        marginTop: 16,
        marginBottom: 20,
      }}
    >
      {/* 상단 타이틀 + 설명 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          하마가 고른 오늘의 카드 🦛
        </span>
      </div>

      <div
        style={{
          borderRadius: 16,
          background: "#e5edf7",
          padding: "12px 14px",
          fontSize: 12,
          color: "#64748b",
          marginBottom: 12,
        }}
      >
        방금 말한 내용을 기준으로 몇 곳을 골라봤어요.
        <br />
        아래 카드 중에서 마음에 드는 곳을 골라보세요 😊
      </div>

      {/* 큰 카드 + 작은 카드 2개 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1.2fr",
          gap: 10,
        }}
      >
        {/* 큰 카드 (0번) */}
        {cards[0] && (
          <button
            type="button"
            style={{
              borderRadius: 18,
              border: "none",
              padding: 0,
              textAlign: "left",
              background: "#ffffff",
              boxShadow: "0 10px 28px rgba(15,23,42,0.16)",
              cursor: "pointer",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "10px 12px 4px",
                fontSize: 13,
                color: "#0f172a",
                fontWeight: 700,
              }}
            >
              {cards[0].name}
            </div>
            <div
              style={{
                padding: "0 12px 6px",
                fontSize: 11,
                color: "#6b7280",
              }}
            >
              {cards[0].mood ?? cards[0].moodText}
            </div>
            <div
              style={{
                padding: "0 12px 10px",
                fontSize: 11,
                color: "#64748b",
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              <span>{cards[0].categoryLabel}</span>
              <span>· {cards[0].distanceKm.toFixed(1)} km</span>
            </div>
          </button>
        )}

        {/* 오른쪽 세로 작은 카드 2개 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {cards.slice(1, 3).map((card) => (
            <button
              key={card.id}
              type="button"
              style={{
                borderRadius: 14,
                border: "none",
                padding: "8px 10px",
                textAlign: "left",
                background: "#ffffff",
                boxShadow: "0 6px 18px rgba(15,23,42,0.10)",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 2,
                  color: "#111827",
                }}
              >
                {card.name}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                }}
              >
                {card.mood ?? card.moodText}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 퀵 필터 / 다시 말하기 버튼 */}
      <div
        style={{
          marginTop: 14,
          display: "flex",
          gap: 8,
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={() => onQuickFilter("카페")}
          style={quickButtonStyle}
        >
          카페만 보기
        </button>
        <button
          type="button"
          onClick={() => onQuickFilter("식당")}
          style={quickButtonStyle}
        >
          식당만 보기
        </button>
        <button
          type="button"
          onClick={onRetryVoice}
          style={quickButtonStyle}
        >
          다시 말하기
        </button>
      </div>

      {/* 검색 결과 0개 안내 문구 (기존 그대로) */}
      {!hasResults && (
        <p
          style={{
            marginTop: 10,
            fontSize: 11,
            color: "#ef4444",
          }}
        >
          딱 맞는 곳은 없어서, 대신 근처 비슷한 장소들을 보여드릴게요.
        </p>
      )}
    </section>
  );
};

const quickButtonStyle: React.CSSProperties = {
  flex: 1,
  borderRadius: 999,
  border: "none",
  padding: "8px 0",
  fontSize: 12,
  background: "#f9fafb",
  color: "#111827",
  boxShadow: "0 1px 4px rgba(15,23,42,0.08)",
  cursor: "pointer",
};

export default RecommendSection;

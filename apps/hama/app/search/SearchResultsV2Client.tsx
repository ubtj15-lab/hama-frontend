"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { logEvent } from "@/lib/logEvent";
import {
  colors,
  pageBackground,
  radius,
  surfaceCardStyle,
} from "@/lib/designTokens";
import { openDirections } from "@/lib/openDirections";
import {
  createMissionFromPlace,
  saveActiveMission,
  RECEIPT_VERIFY_PATH,
} from "@/lib/mission/hamaActiveMission";
import {
  buildCardsFromPool,
  fetchSearchV2Results,
  FAMILY_CATEGORY_CHIPS,
  isFamilyQuery,
  type FamilyCategoryChip,
  type SearchV2ResultCard,
  type StoreRow,
} from "@/lib/search/searchV2Results";

const PAGE_PADDING_X = 16;

const DEFAULT_NAVER_AREA = "오산";

function buildNaverPlaceSearchUrl(card: SearchV2ResultCard): string {
  const region = card.area ?? card.address ?? DEFAULT_NAVER_AREA;
  const naverQuery = `${card.name} ${region}`.trim();
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(naverQuery)}`;
}

function openNaverPlaceCheck(card: SearchV2ResultCard, query: string) {
  const url = buildNaverPlaceSearchUrl(card);
  window.open(url, "_blank", "noopener,noreferrer");
  logEvent("naver_place_check_click", {
    query: query || null,
    placeName: card.name,
    category: card.category ?? null,
    categoryLabel: card.categoryLabel ?? null,
  });
}

function openMapForPlace(card: SearchV2ResultCard) {
  if (card.lat != null && card.lng != null) {
    openDirections({ name: card.name, lat: card.lat, lng: card.lng });
    return;
  }
  const url = `https://map.kakao.com/?q=${encodeURIComponent(card.name)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: pageBackground,
  fontFamily: "Noto Sans KR, system-ui, sans-serif",
};

export default function SearchResultsV2Client() {
  const router = useRouter();
  const params = useSearchParams();
  const query = (params.get("query") ?? "").trim();
  const myLat = Number(params.get("lat"));
  const myLng = Number(params.get("lng"));
  const hasMyLocation = Number.isFinite(myLat) && Number.isFinite(myLng);

  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<SearchV2ResultCard[]>([]);
  const [storePool, setStorePool] = useState<StoreRow[]>([]);
  const [categoryChip, setCategoryChip] = useState<FamilyCategoryChip>("default");
  const [dataSource, setDataSource] = useState<"api" | "mock" | null>(null);
  const [feedbackNote, setFeedbackNote] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<SearchV2ResultCard | null>(null);

  const showFamilyChips = isFamilyQuery(query);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setSelectedResult(null);
    setCategoryChip("default");
    void (async () => {
      const { cards: next, source, pool } = await fetchSearchV2Results(query || "추천");
      if (!alive) return;
      setCards(next);
      setStorePool(pool);
      setDataSource(source);
      setLoading(false);
      logEvent("search_v2_results", {
        query: query || null,
        source,
        count: next.length,
        has_location: hasMyLocation,
      });
    })();
    return () => {
      alive = false;
    };
  }, [query, hasMyLocation]);

  const handleCategoryChipClick = (chip: FamilyCategoryChip) => {
    setCategoryChip(chip);
    setSelectedResult(null);
    const { cards: next, source } = buildCardsFromPool(storePool, query || "추천", chip);
    setCards(next);
    setDataSource(source);
    logEvent("search_v2_category_chip", {
      query: query || null,
      chip,
      source,
      count: next.length,
    });
  };

  const startMissionOnly = (card: SearchV2ResultCard) => {
    const mission = createMissionFromPlace({
      placeName: card.name,
      placeId: card.id,
      category: card.category,
    });
    saveActiveMission(mission);
    logEvent("mission_start", {
      placeName: card.name,
      placeId: card.id,
      category: card.category ?? null,
      page: "search",
      query: query || null,
      source: "mission_cta",
    });
  };

  const startMissionAndNavigate = (card: SearchV2ResultCard) => {
    startMissionOnly(card);
    openMapForPlace(card);
  };

  const handleDirections = (card: SearchV2ResultCard, e: React.MouseEvent) => {
    e.stopPropagation();
    startMissionAndNavigate(card);
  };

  const handleFeedback = (card: SearchV2ResultCard, feedback: "good" | "bad", e: React.MouseEvent) => {
    e.stopPropagation();
    logEvent("recommend_feedback", {
      placeName: card.name,
      placeId: card.id,
      feedback,
      query: query || null,
      role: card.roleLabel,
    });
    setFeedbackNote("피드백이 저장됐어요");
    window.setTimeout(() => setFeedbackNote(null), 2200);
  };

  const handleCardClick = (card: SearchV2ResultCard) => {
    logEvent("search_result_card_click", {
      query: query || null,
      placeName: card.name,
      category: card.category ?? null,
      roleLabel: card.roleLabel,
    });
    setSelectedResult(card);
  };

  if (loading) {
    return (
      <main
        style={{
          ...shellStyle,
          display: "grid",
          placeItems: "center",
          color: colors.textSecondary,
          fontWeight: 700,
        }}
      >
        추천 결과를 불러오는 중...
      </main>
    );
  }

  const displayQuery = query || "상황 추천";

  return (
    <main
      style={{
        ...shellStyle,
        paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div style={{ maxWidth: 430, margin: "0 auto", padding: `12px ${PAGE_PADDING_X}px 20px` }}>
        <header
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <button
            type="button"
            onClick={() => router.push("/")}
            aria-label="뒤로"
            style={{
              border: `1px solid ${colors.cardBorderWarm}`,
              background: "#ffffff",
              borderRadius: 12,
              padding: "8px 12px",
              boxShadow: "0 4px 10px rgba(15, 23, 42, 0.06)",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              flexShrink: 0,
              color: colors.textHeading,
            }}
          >
            ←
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 900,
                color: colors.textHeading,
                lineHeight: 1.35,
              }}
            >
              “{displayQuery}” 추천 결과
            </h1>
            <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 700, color: colors.textBody }}>
              {hasMyLocation ? "내 위치 기준" : "전체 지역 기준"}
            </p>
          </div>
        </header>

        {feedbackNote && (
          <p
            style={{
              margin: "0 0 12px",
              padding: "8px 12px",
              borderRadius: 10,
              background: colors.successSoft,
              color: "#166534",
              fontSize: 13,
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            {feedbackNote}
          </p>
        )}

        {showFamilyChips && (
          <section style={{ marginBottom: 16 }}>
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 15,
                fontWeight: 900,
                color: colors.textHeading,
              }}
            >
              아이랑 어디 갈까요?
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {FAMILY_CATEGORY_CHIPS.map(({ id, label }) => {
                const active = categoryChip === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleCategoryChipClick(id)}
                    style={{
                      border: active
                        ? `1.5px solid ${colors.accentCta}`
                        : `1px solid ${colors.cardBorderWarm}`,
                      background: active ? colors.accentSoft : "#ffffff",
                      color: active ? colors.accentStrong : colors.textBody,
                      borderRadius: radius.pill,
                      padding: "8px 14px",
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: "pointer",
                      boxShadow: active ? "0 2px 8px rgba(255, 99, 51, 0.15)" : undefined,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {categoryChip === "default" && (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: colors.textMuted, fontWeight: 600 }}>
                식당 + 카페 + 키즈카페 중심 추천 (공원·수목원 제외)
              </p>
            )}
          </section>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {cards.map((card) => (
            <article
              key={card.id}
              role="button"
              tabIndex={0}
              onClick={() => handleCardClick(card)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCardClick(card);
                }
              }}
              style={{
                ...surfaceCardStyle,
                padding: "16px 16px 14px",
                cursor: "pointer",
                outline: selectedResult?.id === card.id ? `2px solid ${colors.accentCta}` : undefined,
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  marginBottom: 8,
                  padding: "4px 10px",
                  borderRadius: radius.pill,
                  background: colors.accentSoft,
                  color: colors.accentStrong,
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {card.roleLabel}
              </div>
              <h2 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 900, color: colors.textHeading }}>
                {card.name}
              </h2>
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: colors.textBody,
                  fontWeight: 600,
                }}
              >
                {card.description}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {card.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: colors.tagDeepText,
                      background: colors.tagDeepBg,
                      padding: "4px 8px",
                      borderRadius: radius.pill,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: colors.textMuted, lineHeight: 1.45 }}>
                주의: {card.caution}
              </p>
              <p style={{ margin: "0 0 12px", fontSize: 11, color: colors.textMuted, lineHeight: 1.45 }}>
                방문 전 네이버에서 영업정보를 확인해 주세요.
              </p>
              <div style={{ display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={(e) => handleDirections(card, e)}
                  style={{
                    flex: 1,
                    border: "none",
                    borderRadius: 10,
                    padding: "10px 8px",
                    background: colors.accentCta,
                    color: "#ffffff",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  길찾기
                </button>
                <button type="button" onClick={(e) => handleFeedback(card, "good", e)} style={outlineBtn}>
                  괜찮아요
                </button>
                <button type="button" onClick={(e) => handleFeedback(card, "bad", e)} style={outlineBtn}>
                  별로예요
                </button>
              </div>
            </article>
          ))}
        </div>

        {dataSource === "mock" && (
          <p
            style={{
              marginTop: 14,
              fontSize: 11,
              color: colors.textMuted,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            상황에 맞는 예시 추천을 보여드려요. 실제 매장 데이터가 연결되면 자동으로 바뀝니다.
          </p>
        )}
      </div>

      {selectedResult && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="추천 상세"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(15, 23, 42, 0.45)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
          onClick={() => setSelectedResult(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 400,
              ...surfaceCardStyle,
              padding: 20,
              maxHeight: "min(85vh, 560px)",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: radius.pill,
                  background: colors.accentSoft,
                  color: colors.accentStrong,
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {selectedResult.roleLabel}
              </span>
              <button
                type="button"
                onClick={() => setSelectedResult(null)}
                aria-label="닫기"
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 22,
                  lineHeight: 1,
                  cursor: "pointer",
                  color: colors.textMuted,
                }}
              >
                ×
              </button>
            </div>
            <h2 style={{ margin: "12px 0 8px", fontSize: 20, fontWeight: 900, color: colors.textHeading }}>
              {selectedResult.name}
            </h2>
            {(selectedResult.categoryLabel ?? selectedResult.category) && (
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: colors.textSecondary }}>
                카테고리: {selectedResult.categoryLabel ?? selectedResult.category}
              </p>
            )}
            <p style={{ margin: "0 0 12px", fontSize: 15, lineHeight: 1.55, color: colors.textBody, fontWeight: 600 }}>
              {selectedResult.description}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {selectedResult.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: colors.tagDeepText,
                    background: colors.tagDeepBg,
                    padding: "4px 8px",
                    borderRadius: radius.pill,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: colors.textMuted, lineHeight: 1.5 }}>
              주의: {selectedResult.caution}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  startMissionAndNavigate(selectedResult);
                }}
                style={{
                  width: "100%",
                  minHeight: 44,
                  border: "none",
                  borderRadius: 12,
                  padding: "12px 14px",
                  background: colors.accentCta,
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
                  openNaverPlaceCheck(selectedResult, query);
                }}
                style={{
                  width: "100%",
                  minHeight: 44,
                  border: "1.5px solid #86efac",
                  borderRadius: 12,
                  padding: "12px 14px",
                  background: "#ffffff",
                  color: colors.textHeading,
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                네이버로 장소 확인
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  startMissionOnly(selectedResult);
                  setSelectedResult(null);
                  router.push(RECEIPT_VERIFY_PATH);
                }}
                style={{
                  width: "100%",
                  minHeight: 44,
                  border: `1px solid ${colors.cardBorderWarm}`,
                  borderRadius: 12,
                  padding: "12px 14px",
                  background: "#fff",
                  color: colors.textHeading,
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                방문 인증 미션 시작
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const outlineBtn: React.CSSProperties = {
  flex: 1,
  border: `1px solid ${colors.cardBorderWarm}`,
  borderRadius: 10,
  padding: "10px 6px",
  background: "#ffffff",
  color: colors.textBody,
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
};

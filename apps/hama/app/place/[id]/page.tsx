"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { HomeCard } from "@/lib/storeTypes";
import { readPlaceFromSession } from "@/lib/session/placeSession";
import { colors, radius, shadow, space, typo } from "@/lib/designTokens";
import { openDirections } from "@/lib/openDirections";
import { businessStateFromCard } from "@/lib/recommend/scoreParts";
import { logEvent } from "@/lib/logEvent";
import { HamaEvents } from "@/lib/analytics/events";
import { getDefaultCardImage } from "@/lib/defaultCardImage";
import { getNextSuggestions } from "@/lib/recommendation/getNextSuggestions";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { analyticsFromScenario, mergeLogPayload } from "@/lib/analytics/buildLogPayload";
import { openPlace } from "@/lib/openPlace";
import { buildRecommendationBullets, buildRecommendationReason } from "@/lib/recommend/buildRecommendationReason";
import { useSaved } from "@/_hooks/useSaved";

function bizKr(card: HomeCard): string {
  const s = businessStateFromCard(card);
  if (s === "OPEN") return "영업중";
  if (s === "BREAK") return "브레이크";
  if (s === "CLOSED") return "영업 종료";
  return "영업 정보 확인";
}

function parkingHintFromCard(card: HomeCard): string | null {
  const parts = [
    card.description ?? "",
    ...(card.tags ?? []),
    ...(card.mood ?? []),
    ...(card.menu_keywords ?? []),
  ].join(" ");
  if (!/(주차|발렛|valet|parking)/i.test(parts)) return null;
  if (/무료\s*주차|주차\s*무료/.test(parts)) return "데이터에 ‘무료 주차’ 언급이 있어요. 방문 전 한 번 더 확인하면 좋아요.";
  if (/유료\s*주차|주차\s*유료/.test(parts)) return "데이터에 ‘유료 주차’ 언급이 있어요. 요금은 매장·지도에서 확인해 주세요.";
  return "데이터에 주차 관련 언급이 있어요. 자세한 안내는 아래 링크에서 확인할 수 있어요.";
}

export default function PlaceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = decodeURIComponent(String(params.id ?? ""));
  const [card, setCard] = useState<HomeCard | null>(null);
  const { isSaved, toggleSaved } = useSaved();

  useEffect(() => {
    if (!id) return;
    setCard(readPlaceFromSession(id));
  }, [id]);

  useEffect(() => {
    if (!card) return;
    logEvent(HamaEvents.place_detail_view, { place_id: card.id, page: "place_detail" });
  }, [card]);

  if (!card) {
    return (
      <main style={{ padding: space.pageX, maxWidth: 430, margin: "0 auto" }}>
        <p style={{ color: colors.textSecondary }}>매장 정보를 불러올 수 없어요.</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          style={{
            marginTop: 16,
            padding: "12px 20px",
            borderRadius: radius.button,
            border: "none",
            background: colors.accentPrimary,
            color: colors.accentOnPrimary,
            fontWeight: 800,
            cursor: "pointer",
            boxShadow: shadow.cta,
          }}
        >
          홈으로
        </button>
      </main>
    );
  }

  const img =
    (card as any).imageUrl ?? (card as any).image_url ?? getDefaultCardImage(card);
  const tel = String(card.phone ?? "").trim();
  const reason = buildRecommendationReason(card);
  const bullets = buildRecommendationBullets(card);
  const scenarioGuess = parseScenarioIntent(
    `${card.categoryLabel ?? ""} ${card.name} 추천`
  );
  const suggests = getNextSuggestions(scenarioGuess).slice(0, 3);

  const goReserve = () => {
    const q = new URLSearchParams({
      storeId: card.id,
      name: card.name,
    });
    router.push(`/reserve?${q.toString()}`);
  };

  return (
    <main style={{ maxWidth: 430, margin: "0 auto", paddingBottom: 40, background: colors.bgDefault }}>
      <div style={{ height: 280, background: "#e2e8f0", position: "relative" }}>
        <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(180deg, rgba(15,23,42,0.45) 0%, rgba(15,23,42,0.05) 45%, rgba(15,23,42,0.55) 100%)",
            pointerEvents: "none",
          }}
        />
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            width: 42,
            height: 42,
            borderRadius: 999,
            border: "none",
            background: "rgba(15,23,42,0.45)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 18,
            backdropFilter: "blur(6px)",
          }}
        >
          ←
        </button>
      </div>

      <div style={{ padding: `0 ${space.pageX}px 24px`, marginTop: -28, position: "relative", zIndex: 2 }}>
        <div
          style={{
            borderRadius: radius.largeCard,
            background: colors.bgSurface,
            padding: space.cardPadding,
            boxShadow: shadow.elevated,
            border: `1px solid ${colors.borderSubtle}`,
          }}
        >
          <p style={{ ...typo.cardReason, color: colors.accentStrong, margin: 0 }}>{reason.headline}</p>
          <p style={{ ...typo.caption, color: colors.textSecondary, margin: "6px 0 0", lineHeight: 1.5 }}>
            {reason.subline}
          </p>
          {reason.regionTrust && (
            <p style={{ ...typo.caption, color: colors.textMuted, margin: "6px 0 0", fontSize: 12 }}>
              {reason.regionTrust}
            </p>
          )}
        </div>

        <h1 style={{ ...typo.cardTitle, fontSize: 22, margin: "18px 0 0", lineHeight: 1.25 }}>{card.name}</h1>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {reason.badges.map((t) => (
            <span
              key={t}
              style={{
                ...typo.chip,
                color: colors.tagMutedText,
                background: colors.tagMutedBg,
                padding: "6px 11px",
                borderRadius: radius.chip,
              }}
            >
              {t}
            </span>
          ))}
        </div>
        <p style={{ ...typo.body, color: colors.textSecondary, marginTop: 12 }}
        >
          {typeof card.distanceKm === "number" ? `${card.distanceKm.toFixed(1)}km · ` : ""}
          {bizKr(card)}
        </p>
        {card.address && (
          <p style={{ ...typo.caption, color: colors.textSecondary, marginTop: 6 }}>
            {card.address}
          </p>
        )}

        <div style={{ display: "flex", gap: space.buttonGap, marginTop: 18 }}>
          <button
            type="button"
            onClick={() => {
              logEvent(
                HamaEvents.cta_directions,
                mergeLogPayload(analyticsFromScenario(null), { place_id: card.id, page: "place_detail" })
              );
              const lat = typeof card.lat === "number" ? card.lat : null;
              const lng = typeof card.lng === "number" ? card.lng : null;
              openDirections({ name: card.name, lat, lng });
            }}
            style={{
              flex: 1,
              height: 50,
              borderRadius: radius.button,
              border: "none",
              background: colors.accentPrimary,
              color: colors.accentOnPrimary,
              fontWeight: 800,
              fontSize: 15,
              cursor: "pointer",
              boxShadow: shadow.cta,
            }}
          >
            길찾기
          </button>
          <button
            type="button"
            disabled={!tel}
            onClick={() => {
              logEvent(
                HamaEvents.cta_call,
                mergeLogPayload(analyticsFromScenario(null), { place_id: card.id, page: "place_detail" })
              );
              window.location.href = `tel:${tel.replace(/[^0-9+]/g, "")}`;
            }}
            style={{
              flex: 1,
              height: 50,
              borderRadius: radius.button,
              border: `1px solid ${colors.borderSubtle}`,
              background: colors.bgSurface,
              fontWeight: 800,
              fontSize: 15,
              cursor: tel ? "pointer" : "not-allowed",
              opacity: tel ? 1 : 0.45,
            }}
          >
            지금 전화하기
          </button>
        </div>

        <div style={{ display: "flex", gap: space.buttonGap, marginTop: 10 }}>
          <button
            type="button"
            onClick={async () => {
              const next = await toggleSaved(card.id);
              logEvent(HamaEvents.cta_save_toggle, {
                place_id: card.id,
                saved: next,
                page: "place_detail",
              });
            }}
            style={{
              flex: 1,
              height: 46,
              borderRadius: radius.button,
              border: `1px solid ${colors.accentPrimary}`,
              background: isSaved(card.id) ? colors.accentSoft : colors.bgSurface,
              color: colors.accentStrong,
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {isSaved(card.id) ? "저장됨" : "저장해두기"}
          </button>
          <button
            type="button"
            onClick={() => {
              logEvent(HamaEvents.home_trust_reserve, { place_id: card.id, page: "place_detail" });
              goReserve();
            }}
            style={{
              flex: 1,
              height: 46,
              borderRadius: radius.button,
              border: `1px solid ${colors.borderSubtle}`,
              background: colors.bgMuted,
              color: colors.textPrimary,
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            예약하기
          </button>
        </div>

        <div style={{ display: "flex", gap: space.buttonGap, marginTop: 10 }}>
          <button
            type="button"
            onClick={() => {
              logEvent(
                HamaEvents.external_place_open,
                mergeLogPayload(analyticsFromScenario(null), {
                  place_id: card.id,
                  provider: "naver",
                  page: "place_detail",
                })
              );
              openPlace(card, "naver");
            }}
            style={{
              flex: 1,
              height: 44,
              borderRadius: radius.button,
              border: `1px solid ${colors.borderSubtle}`,
              background: colors.bgSurface,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              color: colors.textSecondary,
            }}
          >
            네이버에서 보기
          </button>
          <button
            type="button"
            onClick={() => {
              logEvent(
                HamaEvents.external_place_open,
                mergeLogPayload(analyticsFromScenario(null), {
                  place_id: card.id,
                  provider: "kakao",
                  page: "place_detail",
                })
              );
              openPlace(card, "kakao");
            }}
            style={{
              flex: 1,
              height: 44,
              borderRadius: radius.button,
              border: `1px solid ${colors.borderSubtle}`,
              background: colors.bgSurface,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              color: colors.textSecondary,
            }}
          >
            카카오맵에서 보기
          </button>
        </div>

        <h2 style={{ ...typo.sectionTitle, fontSize: 17, marginTop: 28 }}>이런 이유로 추천했어요</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {bullets.map((b) => (
            <div
              key={b}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                padding: "12px 14px",
                borderRadius: radius.card,
                background: colors.bgSurface,
                border: `1px solid ${colors.borderSubtle}`,
                boxShadow: shadow.soft,
              }}
            >
              <span aria-hidden style={{ fontSize: 16, lineHeight: 1.2 }}>
                ✓
              </span>
              <p style={{ ...typo.body, margin: 0, color: colors.textPrimary, lineHeight: 1.5 }}>{b}</p>
            </div>
          ))}
        </div>

        <h2 style={{ ...typo.sectionTitle, fontSize: 17, marginTop: 28 }}>매장 정보</h2>
        {card.description ? (
          <p style={{ ...typo.body, color: colors.textPrimary, marginTop: 10, lineHeight: 1.55 }}>{card.description}</p>
        ) : (
          <p style={{ ...typo.caption, color: colors.textSecondary, marginTop: 10, lineHeight: 1.55 }}>
            메뉴와 최신 사진은 아래 링크에서 더 확인할 수 있어요. 자세한 리뷰와 사진은 외부 페이지에서도 볼 수 있어요.
          </p>
        )}

        {Array.isArray(card.menu_keywords) && card.menu_keywords.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <p style={{ ...typo.caption, fontWeight: 800, color: colors.textPrimary, margin: "0 0 8px" }}>메뉴·키워드</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {card.menu_keywords.slice(0, 16).map((kw) => (
                <span
                  key={kw}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: colors.textSecondary,
                    background: colors.bgMuted,
                    padding: "5px 10px",
                    borderRadius: radius.pill,
                  }}
                >
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {((card.tags?.length ?? 0) > 0 || (card.mood?.length ?? 0) > 0) && (
          <div style={{ marginTop: 14 }}>
            <p style={{ ...typo.caption, fontWeight: 800, color: colors.textPrimary, margin: "0 0 8px" }}>분위기·태그</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[...(card.mood ?? []), ...(card.tags ?? [])]
                .filter(Boolean)
                .filter((t, i, a) => a.indexOf(t) === i)
                .slice(0, 20)
                .map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: colors.textSecondary,
                      background: colors.bgMuted,
                      padding: "5px 10px",
                      borderRadius: radius.pill,
                    }}
                  >
                    {t}
                  </span>
                ))}
            </div>
          </div>
        )}

        {tel && (
          <p style={{ ...typo.caption, color: colors.textSecondary, marginTop: 12 }}>{tel}</p>
        )}

        <p style={{ ...typo.caption, color: colors.textSecondary, marginTop: 14, lineHeight: 1.5 }}>
          {parkingHintFromCard(card) ??
            "주차 가능 여부는 매장마다 달라요. 네이버·카카오 플레이스에서 ‘주차’ 정보를 꼭 확인해 주세요."}
        </p>

        <h2 style={{ ...typo.sectionTitle, fontSize: 17, marginTop: 28 }}>이어서 가기 좋아요</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {suggests.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => router.push(`/results?q=${encodeURIComponent(s.query)}`)}
              style={{
                textAlign: "left",
                padding: "12px 14px",
                borderRadius: radius.card,
                border: `1px solid ${colors.borderSubtle}`,
                background: colors.bgSurface,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: shadow.soft,
              }}
            >
              {s.icon} {s.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

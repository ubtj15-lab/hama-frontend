"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { HomeCard } from "@/lib/storeTypes";
import { readPlaceFromSession } from "@/lib/session/placeSession";
import { colors, radius, space, typo } from "@/lib/designTokens";
import { Chip } from "@/_components/common/Chip";
import { openDirections } from "@/lib/openDirections";
import { businessStateFromCard } from "@/lib/recommend/scoreParts";
import { logEvent } from "@/lib/logEvent";
import { getDefaultCardImage } from "@/lib/defaultCardImage";
import { getNextSuggestions } from "@/lib/recommendation/getNextSuggestions";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { analyticsFromScenario, mergeLogPayload } from "@/lib/analytics/buildLogPayload";
import { openPlace } from "@/lib/openPlace";

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
  if (/무료\s*주차|주차\s*무료/.test(parts)) return "데이터에 ‘무료 주차’ 언급이 있어. 방문 전 한 번 더 확인하면 좋아.";
  if (/유료\s*주차|주차\s*유료/.test(parts)) return "데이터에 ‘유료 주차’ 언급이 있어. 요금은 매장·지도에서 확인해줘.";
  return "데이터에 주차 관련 언급이 있어. 자세한 안내는 아래 네이버·카카오에서 보면 돼.";
}

export default function PlaceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = decodeURIComponent(String(params.id ?? ""));
  const [card, setCard] = useState<HomeCard | null>(null);

  useEffect(() => {
    if (!id) return;
    setCard(readPlaceFromSession(id));
  }, [id]);

  if (!card) {
    return (
      <main style={{ padding: space.pageX, maxWidth: 430, margin: "0 auto" }}>
        <p style={{ color: colors.textSecondary }}>매장 정보를 불러올 수 없어.</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          style={{
            marginTop: 16,
            padding: "12px 20px",
            borderRadius: radius.button,
            border: "none",
            background: colors.accentPrimary,
            color: "#fff",
            fontWeight: 800,
            cursor: "pointer",
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
  const tags = (card.recommendBadge?.shortTags ?? []).slice(0, 4);
  const scenarioGuess = parseScenarioIntent(
    `${card.categoryLabel ?? ""} ${card.name} 추천`
  );
  const suggests = getNextSuggestions(scenarioGuess);

  return (
    <main style={{ maxWidth: 430, margin: "0 auto", paddingBottom: 32, background: colors.bgDefault }}>
      <div style={{ height: 260, background: "#e2e8f0", position: "relative" }}>
        <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            width: 40,
            height: 40,
            borderRadius: 999,
            border: "none",
            background: "rgba(15,23,42,0.55)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 18,
          }}
        >
          ←
        </button>
      </div>
      <div style={{ padding: `20px ${space.pageX}px` }}>
        <h1 style={{ ...typo.cardTitle, fontSize: 22, margin: 0 }}>{card.name}</h1>
        <div style={{ marginTop: 10 }}>
          <Chip>{card.recommendBadge?.primaryLabel ?? card.categoryLabel ?? "추천"}</Chip>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          {tags.map((t) => (
            <span
              key={t}
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: colors.textSecondary,
                background: colors.bgMuted,
                padding: "4px 10px",
                borderRadius: radius.pill,
              }}
            >
              {t}
            </span>
          ))}
        </div>
        <p style={{ ...typo.body, color: colors.textSecondary, marginTop: 14 }}>
          {typeof card.distanceKm === "number" ? `${card.distanceKm.toFixed(1)}km · ` : ""}
          {bizKr(card)}
        </p>
        {card.address && (
          <p style={{ ...typo.caption, color: colors.textSecondary }}>{card.address}</p>
        )}
        {tel && <p style={{ ...typo.caption, color: colors.textSecondary }}>{tel}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            type="button"
            onClick={() => {
              logEvent(
                "navigate_click",
                mergeLogPayload(analyticsFromScenario(null), { place_id: card.id, page: "place_detail" })
              );
              const lat = typeof card.lat === "number" ? card.lat : null;
              const lng = typeof card.lng === "number" ? card.lng : null;
              openDirections({ name: card.name, lat, lng });
            }}
            style={{
              flex: 1,
              height: 48,
              borderRadius: radius.button,
              border: "none",
              background: colors.accentPrimary,
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            길찾기
          </button>
          <button
            type="button"
            disabled={!tel}
            onClick={() => {
              logEvent(
                "call_click",
                mergeLogPayload(analyticsFromScenario(null), { place_id: card.id, page: "place_detail" })
              );
              window.location.href = `tel:${tel.replace(/[^0-9+]/g, "")}`;
            }}
            style={{
              flex: 1,
              height: 48,
              borderRadius: radius.button,
              border: `1px solid ${colors.borderSubtle}`,
              background: colors.bgCard,
              fontWeight: 800,
              cursor: tel ? "pointer" : "not-allowed",
            }}
          >
            전화하기
          </button>
        </div>

        <h2 style={{ ...typo.sectionTitle, fontSize: 17, marginTop: 28 }}>매장 정보</h2>
        {card.description ? (
          <p style={{ ...typo.body, color: colors.textPrimary, marginTop: 10, lineHeight: 1.55 }}>{card.description}</p>
        ) : (
          <p style={{ ...typo.caption, color: colors.textSecondary, marginTop: 10, lineHeight: 1.5 }}>
            등록된 소개 문구가 없어. 아래 링크에서 메뉴·사진·리뷰를 확인해줘.
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

        <p style={{ ...typo.caption, color: colors.textSecondary, marginTop: 14, lineHeight: 1.5 }}>
          {parkingHintFromCard(card) ??
            "주차 가능 여부는 매장마다 달라. 네이버·카카오 플레이스에서 ‘주차’ 정보를 꼭 확인해줘."}
        </p>

        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button
            type="button"
            onClick={() => {
              logEvent(
                "external_place_open",
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
              height: 46,
              borderRadius: radius.button,
              border: `1px solid ${colors.borderSubtle}`,
              background: colors.bgCard,
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            네이버에서 보기
          </button>
          <button
            type="button"
            onClick={() => {
              logEvent(
                "external_place_open",
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
              height: 46,
              borderRadius: radius.button,
              border: `1px solid ${colors.borderSubtle}`,
              background: colors.bgCard,
              fontWeight: 800,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            카카오맵에서 보기
          </button>
        </div>

        <h2 style={{ ...typo.sectionTitle, fontSize: 17, marginTop: 32 }}>이어서 가기 좋아요</h2>
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
                background: colors.bgCard,
                fontWeight: 700,
                cursor: "pointer",
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

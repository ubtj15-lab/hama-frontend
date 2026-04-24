"use client";

export const dynamic = "force-dynamic";

import React, { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { colors } from "@/lib/designTokens";
import { ChickIcon, FamilyIcon, FerrisWheelIcon, HeartIcon, RiceBowlIcon, SparkleIcon } from "@icons";

type Place = {
  id: number;
  name: string;
  category: string;
  area: string;
  rating: number;
  reviewCount: number;
  distanceMeters: number;
  image: string;
  phone?: string;
  headlineReason: string;
  sublineReason: string;
  tags: string[];
};

const PLACES: Place[] = [
  {
    id: 1,
    name: "윤담",
    category: "한식",
    area: "동탄역 인근",
    rating: 4.7,
    reviewCount: 328,
    distanceMeters: 600,
    image: "/images/bluemoon-cafe.png",
    phone: "031-123-4567",
    headlineReason: "지금 시간대 대기 거의 없음",
    sublineReason: "아이랑 들어가도 테이블 간격이 넓어서 편해",
    tags: ["주차 가능", "조용한 좌석", "근거리"],
  },
  {
    id: 2,
    name: "공차 오산역점",
    category: "카페",
    area: "오산역 근처",
    rating: 4.4,
    reviewCount: 82,
    distanceMeters: 1200,
    image: "/images/solhyang-hair.png",
    phone: "031-555-1200",
    headlineReason: "바로 앉을 수 있는 좌석 여유",
    sublineReason: "가볍게 들렀다가 다음 동선으로 넘어가기 좋아",
    tags: ["빠른 입장", "디저트", "이동 편함"],
  },
  {
    id: 3,
    name: "북락산 공원",
    category: "공원",
    area: "오산 시내",
    rating: 4.6,
    reviewCount: 54,
    distanceMeters: 2100,
    image: "/images/dorandoran-food.png",
    headlineReason: "지금 가면 산책하기 딱 좋은 시간대",
    sublineReason: "복잡한 도심 피해서 짧게 리프레시하기 좋아",
    tags: ["산책", "주차 가능", "조용함"],
  },
];

type ContextType = "family" | "date" | "solo" | "course";

export default function RecommendPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = PLACES[0];
  const secondaryPlaces = PLACES.slice(1, 3);
  const q = (searchParams.get("q") || "").toLowerCase();
  const contextType: ContextType = useMemo(() => {
    if (/아이|가족|부모/.test(q)) return "family";
    if (/데이트|커플|연인/.test(q)) return "date";
    if (/혼밥|혼자|1인|솔로/.test(q)) return "solo";
    if (/코스|일정|동선/.test(q)) return "course";
    return "family";
  }, [q]);

  const contextChip = {
    family: { icon: <FamilyIcon size={16} color={colors.primaryDark} />, label: "아이랑" },
    date: { icon: <HeartIcon size={16} color={colors.primaryDark} />, label: "데이트" },
    solo: { icon: <RiceBowlIcon size={16} color={colors.primaryDark} />, label: "혼밥" },
    course: { icon: <FerrisWheelIcon size={16} color={colors.primaryDark} />, label: "코스" },
  }[contextType];

  const headlineWord = contextType === "date" || contextType === "solo" ? "딱 좋아" : "끝";

  const reasonByContext: Record<ContextType, string[]> = {
    family: ["지금 가면 대기 거의 없음", "아이랑 가도 조용하게 식사 가능", "주차 바로 가능"],
    date: ["지금 가면 너무 붐비지 않음", "둘이 대화하기 조용한 분위기", "식사 후 바로 이동 동선 좋음"],
    solo: ["지금 바로 앉을 수 있는 좌석 여유", "혼자 먹기 부담 없는 분위기", "주문부터 식사까지 빠르게 가능"],
    course: ["지금 시작하면 동선이 가장 깔끔함", "다음 장소까지 이동 시간이 짧음", "주차와 출발 동선이 편함"],
  };

  const reasons = reasonByContext[contextType];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: colors.bgCream,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          padding: "16px 16px 32px",
          boxSizing: "border-box",
          fontFamily: "Noto Sans KR, system-ui, sans-serif",
          color: colors.neutral[900],
        }}
      >
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer", color: colors.neutral[900] }}
          >
            ←
          </button>
          <strong style={{ fontSize: 17, fontWeight: 900 }}>하마의 추천</strong>
          <button
            type="button"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.share) {
                void navigator.share({
                  title: "하마의 추천",
                  text: `${selected.name} 어때?`,
                  url: window.location.href,
                });
              }
            }}
            style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: colors.neutral[900] }}
          >
            ⤴
          </button>
        </header>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            borderRadius: 999,
            padding: "8px 12px",
            background: colors.primaryLight,
            border: `1px solid ${colors.borderSubtle}`,
            color: colors.neutral[700],
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 14,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {contextChip.icon}
            {contextChip.label}
          </span>
          · 🚗 차로 10분 거리
        </div>

        <h1 style={{ margin: "0 0 16px", fontSize: 30, lineHeight: 1.2, letterSpacing: "-0.03em" }}>
          오늘은 여기 가면 <span style={{ color: colors.primary, fontWeight: 900 }}>{headlineWord}</span>
        </h1>

        <section
          style={{
            borderRadius: 24,
            background: "#fff",
            border: `1px solid ${colors.borderSubtle}`,
            boxShadow: "0 4px 20px rgba(255,107,53,0.08)",
            overflow: "hidden",
            paddingBottom: 14,
          }}
        >
          <div style={{ position: "relative", height: 176 }}>
            <img src={selected.image} alt={selected.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <span
              style={{
                position: "absolute",
                left: 12,
                top: 12,
                background: colors.primary,
                color: "#fff",
                fontSize: 12,
                fontWeight: 900,
                borderRadius: 999,
                padding: "6px 11px",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <SparkleIcon size={12} color="#fff" />
                추천 1순위
              </span>
            </span>
            <span
              style={{
                position: "absolute",
                right: 12,
                bottom: 12,
                background: "rgba(17,24,39,0.8)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
                borderRadius: 999,
                padding: "5px 10px",
              }}
            >
              📍 {selected.distanceMeters}m
            </span>
          </div>

          <div style={{ padding: "14px 14px 0", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.2, letterSpacing: "-0.03em" }}>{selected.name}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.neutral[700] }}>
              ⭐ {selected.rating.toFixed(1)} ({selected.reviewCount}) · {selected.category} · {selected.area}
            </div>

            <div
              style={{
                marginTop: 2,
                borderRadius: 16,
                border: `1px solid ${colors.borderSubtle}`,
                background: colors.primaryLight,
                padding: "11px 12px",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>추천 이유</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {reasons.map((reason) => (
                  <div key={reason} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        minWidth: 18,
                        borderRadius: 999,
                        background: colors.primary,
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 900,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      ✓
                    </span>
                    <span style={{ fontSize: 13, color: colors.neutral[700], fontWeight: 700 }}>{reason}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              <span style={{ fontSize: 12, color: colors.neutral[700], background: colors.neutral[100], borderRadius: 999, padding: "6px 10px" }}>가까운 거리</span>
              <span style={{ fontSize: 12, color: colors.primaryDark, background: colors.primaryLight, borderRadius: 999, padding: "6px 10px" }}>지금 이동 편함</span>
              <span style={{ fontSize: 12, color: colors.neutral[700], background: colors.neutral[100], borderRadius: 999, padding: "6px 10px" }}>빠른 결정</span>
            </div>

            <p style={{ margin: "10px 0 0", fontSize: 13, fontWeight: 700, color: colors.neutral[700], lineHeight: 1.45 }}>
              지금 시간·거리·상황 기준으로 가장 자연스러운 선택이에요
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => window.open(`https://map.kakao.com/?q=${encodeURIComponent(selected.name)}`, "_blank")}
                style={{
                  flex: 1,
                  height: 46,
                  borderRadius: 16,
                  border: `1px solid ${colors.neutral[900]}`,
                  background: "#fff",
                  color: colors.neutral[900],
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                길찾기
              </button>
              <button
                type="button"
                onClick={() => router.push("/course/progress")}
                style={{
                  flex: 1.7,
                  height: 46,
                  borderRadius: 16,
                  border: "none",
                  background: colors.neutral[900],
                  boxShadow: "0 8px 20px rgba(17,24,39,0.2)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                여기로 결정
              </button>
            </div>
            <div style={{ height: 2 }} />
          </div>
        </section>

        <section style={{ marginTop: 18 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: "-0.03em" }}>이런 곳도 괜찮아</h2>
          <p style={{ margin: "6px 0 12px", color: colors.neutral[700], fontSize: 14, fontWeight: 700 }}>다른 선택지 2곳</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {secondaryPlaces.map((place) => (
              <article
                key={place.id}
                style={{
                  borderRadius: 20,
                  border: `1px solid ${colors.borderSubtle}`,
                  background: "#fff",
                  padding: 10,
                  display: "flex",
                  gap: 10,
                }}
              >
                <img
                  src={place.image}
                  alt={place.name}
                  style={{ width: 88, height: 88, borderRadius: 14, objectFit: "cover", flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 5 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: colors.primaryDark,
                        background: colors.primaryLight,
                        borderRadius: 999,
                        padding: "4px 8px",
                      }}
                    >
                      {place.category}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: colors.neutral[700],
                        background: colors.neutral[100],
                        borderRadius: 999,
                        padding: "4px 8px",
                      }}
                    >
                      📍 {place.distanceMeters >= 1000 ? `${(place.distanceMeters / 1000).toFixed(1)}km` : `${place.distanceMeters}m`}
                    </span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 2 }}>{place.name}</div>
                  <div style={{ fontSize: 12, color: colors.neutral[700], fontWeight: 700, marginBottom: 4 }}>
                    ⭐ {place.rating.toFixed(1)} ({place.reviewCount})
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: colors.neutral[900], lineHeight: 1.35 }}>{place.headlineReason}</div>
                  <div style={{ fontSize: 12, color: colors.neutral[700], fontWeight: 700, lineHeight: 1.35, marginTop: 2 }}>
                    {place.sublineReason}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                    {place.tags.map((tag) => (
                      <span
                        key={`${place.id}-${tag}`}
                        style={{
                          fontSize: 11,
                          color: colors.neutral[700],
                          background: colors.neutral[100],
                          borderRadius: 999,
                          padding: "4px 8px",
                          fontWeight: 700,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => window.open(`https://map.kakao.com/?q=${encodeURIComponent(place.name)}`, "_blank")}
                      style={{
                        flex: 1,
                        height: 36,
                        borderRadius: 12,
                        border: `1px solid ${colors.neutral[900]}`,
                        background: "#fff",
                        color: colors.neutral[900],
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      길찾기
                    </button>
                    {place.phone && (
                      <button
                        type="button"
                        onClick={() => {
                          const tel = place.phone?.replace(/[^0-9+]/g, "");
                          if (tel) window.location.href = `tel:${tel}`;
                        }}
                        style={{
                          flex: 1,
                          height: 36,
                          borderRadius: 12,
                          border: "none",
                          background: colors.neutral[900],
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        전화하기
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <button
            type="button"
            onClick={() => router.refresh()}
            style={{
              width: "100%",
              height: 46,
              marginTop: 12,
              borderRadius: 16,
              border: `1.5px dashed ${colors.primary}`,
              background: colors.primaryLight,
              color: colors.primaryDark,
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              마음에 안 들어? 다시 골라줄게
              <ChickIcon size={14} color={colors.primaryDark} />
            </span>
          </button>
        </section>
      </div>
    </main>
  );
}

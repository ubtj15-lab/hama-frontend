"use client";

import React, { useState } from "react";
import { colors, radius, shadow } from "@/lib/designTokens";
import type { HomeResultsNavParams } from "@/lib/homeResultsNavParams";
import { HOME_RESULTS_TAB_TARGETS, logHamaTabClickTrace, resolveHomeResultsUrl } from "@/lib/hamaTabClickTrace";
import { Touchable } from "@ui/Touchable";

const CATEGORY_SPRITE_SRC = "/home/home-category-icons-grid.png";

/** 코스 카드 — 배경 없는 SVG 3종 (A안) */
const COURSE_ICON_SRCS = [
  "/home/course-icon-restaurant.svg",
  "/home/course-icon-cafe.svg",
  "/home/course-icon-camera.svg",
] as const;

const SPRITE_COLS = 4;
const SPRITE_ROWS = 2;

export type QuickCategoryItem = {
  label: string;
  subtitle: string;
  query: string;
  bg: string;
  /** 0..7 — `home-category-icons-grid.png` (4×2, 행: 푸드~문화 / 뷰티~키즈·가족) */
  spriteIndex: number;
  /** /results? 에 intent·category·mode 명시 (퀵 그리드 전용) */
  nav?: HomeResultsNavParams;
};

/** 홈 1차 카테고리 (스프라이트 순서와 동일) — 배경은 목업 파스텔에 맞춤 */
export const QUICK_CATEGORY_CANDIDATES: QuickCategoryItem[] = [
  {
    label: "푸드",
    subtitle: "식당·맛집",
    query: HOME_RESULTS_TAB_TARGETS.restaurant.q,
    spriteIndex: 0,
    bg: "#FFF5EB",
    nav: {
      intent: HOME_RESULTS_TAB_TARGETS.restaurant.intent,
      category: HOME_RESULTS_TAB_TARGETS.restaurant.category,
    },
  },
  {
    label: "카페",
    subtitle: "커피·디저트·베이커리",
    query: HOME_RESULTS_TAB_TARGETS.cafe.q,
    spriteIndex: 1,
    bg: "#FFE4CC",
    nav: { intent: HOME_RESULTS_TAB_TARGETS.cafe.intent, category: HOME_RESULTS_TAB_TARGETS.cafe.category },
  },
  {
    label: "액티비티",
    subtitle: "체험·놀이·전시",
    query: HOME_RESULTS_TAB_TARGETS.activity.q,
    spriteIndex: 2,
    bg: "#E6F7ED",
    nav: {
      intent: HOME_RESULTS_TAB_TARGETS.activity.intent,
      category: HOME_RESULTS_TAB_TARGETS.activity.category,
    },
  },
  {
    label: "문화",
    subtitle: "전시·공연·영화·책",
    query: HOME_RESULTS_TAB_TARGETS.culture.q,
    spriteIndex: 3,
    bg: "#EDE7F6",
    nav: {
      intent: HOME_RESULTS_TAB_TARGETS.culture.intent,
      category: HOME_RESULTS_TAB_TARGETS.culture.category,
    },
  },
  {
    label: "뷰티",
    subtitle: "헤어·네일·관리",
    query: HOME_RESULTS_TAB_TARGETS.beauty.q,
    spriteIndex: 4,
    bg: "#FCE7EF",
    nav: {
      intent: HOME_RESULTS_TAB_TARGETS.beauty.intent,
      category: HOME_RESULTS_TAB_TARGETS.beauty.category,
    },
  },
  {
    label: "운동",
    subtitle: "헬스·필라테스·수영",
    query: HOME_RESULTS_TAB_TARGETS.fitness.q,
    spriteIndex: 5,
    bg: "#E0F0FA",
    nav: {
      intent: HOME_RESULTS_TAB_TARGETS.fitness.intent,
      category: HOME_RESULTS_TAB_TARGETS.fitness.category,
    },
  },
  {
    label: "생활",
    subtitle: "병원·약국·세탁·편의",
    query: HOME_RESULTS_TAB_TARGETS.life.q,
    spriteIndex: 6,
    bg: "#E9F5EA",
    nav: { intent: HOME_RESULTS_TAB_TARGETS.life.intent, category: HOME_RESULTS_TAB_TARGETS.life.category },
  },
  {
    label: "키즈/가족",
    subtitle: "아이와 함께·주말 나들이",
    query: "가족 나들이 아이랑 추천해줘",
    spriteIndex: 7,
    bg: "#FFF8DC",
    nav: { intent: "family_outing", category: "activity" },
  },
];

const HOME_COURSE = {
  label: "코스 추천",
  subtitle: "식당+카페+산책+체험",
  query: "코스 추천해줘 식당 카페 산책 체험",
  bg: "#F3ECD4",
  nav: { intent: "course_general", category: "mixed", mode: "course" } satisfies HomeResultsNavParams,
} as const;

/** 카테고리 타일 — 스프라이트 PNG는 48px 그리드, 표시 셀(클립) 크기 */
const ICON_SPRITE_CELL = 54;

/** 둥근 네모 없음 — 클립 영역 배경을 카드와 동일하게 두고 multiply로 PNG 흰 테두리 제거 */

function CoursePin() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden style={{ display: "block", flexShrink: 0 }}>
      <path
        d="M6 13C6 13 1 8.5 1 5C1 2.8 2.8 1 5 1C7.2 1 9 2.8 9 5C9 8.5 6 13 6 13Z"
        fill="#EA580C"
        stroke="#C2410C"
        strokeWidth="0.6"
      />
      <circle cx="5" cy="5" r="1.4" fill="#FFF7ED" />
    </svg>
  );
}

const COURSE_ICON_BOX = 58;
const COURSE_ICON_GAP = 10;

/** 투명 SVG 3개 + 점선 + 핀 — 아이콘 행 / 핀 행 분리로 같은 열 폭·수직선 맞춤 */
function CourseIconsRow() {
  const slotW = COURSE_ICON_BOX;
  const gapW = COURSE_ICON_GAP;

  const iconCell = (src: (typeof COURSE_ICON_SRCS)[number]) => (
    <div
      key={src}
      style={{
        width: slotW,
        height: slotW,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 정적 로컬 SVG */}
      <img
        src={src}
        alt=""
        width={54}
        height={54}
        decoding="async"
        style={{ display: "block", width: 54, height: 54, objectFit: "contain" }}
      />
    </div>
  );

  const dashCell = (i: number) => (
    <div
      key={`dash-${i}`}
      aria-hidden
      style={{
        width: gapW,
        height: slotW,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", borderTop: "2px dashed rgba(90, 78, 58, 0.42)" }} />
    </div>
  );

  const pinCell = (i: number) => (
    <div
      key={`pin-${i}`}
      style={{
        width: slotW,
        flexShrink: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
      }}
    >
      <CoursePin />
    </div>
  );

  const spacerCell = (i: number) => (
    <div key={`sp-${i}`} aria-hidden style={{ width: gapW, flexShrink: 0 }} />
  );

  return (
    <div
      aria-hidden
      style={{
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
      }}
    >
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start" }}>
        {iconCell(COURSE_ICON_SRCS[0])}
        {dashCell(0)}
        {iconCell(COURSE_ICON_SRCS[1])}
        {dashCell(1)}
        {iconCell(COURSE_ICON_SRCS[2])}
      </div>
      <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", justifyContent: "flex-start" }}>
        {pinCell(0)}
        {spacerCell(0)}
        {pinCell(1)}
        {spacerCell(1)}
        {pinCell(2)}
      </div>
    </div>
  );
}

function CategorySpriteOnly({ spriteIndex, cardBg }: { spriteIndex: number; cardBg: string }) {
  const col = spriteIndex % SPRITE_COLS;
  const row = Math.floor(spriteIndex / SPRITE_COLS);
  const w = ICON_SPRITE_CELL * SPRITE_COLS;
  const h = ICON_SPRITE_CELL * SPRITE_ROWS;
  return (
    <div
      aria-hidden
      style={{
        width: ICON_SPRITE_CELL,
        height: ICON_SPRITE_CELL,
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
        background: cardBg,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 스프라이트 클리핑용 정적 에셋 */}
      <img
        src={CATEGORY_SPRITE_SRC}
        alt=""
        width={w}
        height={h}
        style={{
          position: "absolute",
          left: -col * ICON_SPRITE_CELL,
          top: -row * ICON_SPRITE_CELL,
          width: w,
          height: h,
          objectFit: "fill",
          display: "block",
          pointerEvents: "none",
          mixBlendMode: "multiply",
        }}
      />
    </div>
  );
}

type Props = { onPick: (query: string, nav?: HomeResultsNavParams) => void };

export function QuickScenarioGrid({ onPick }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div style={{ marginBottom: 12 }}>
      <p
        style={{
          margin: "0 0 6px",
          fontSize: 12,
          fontWeight: 800,
          color: colors.textSecondary,
          textAlign: "center",
          letterSpacing: "-0.02em",
        }}
      >
        ✨ 카테고리에서 바로 시작해도 좋아요
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}
      >
        {QUICK_CATEGORY_CANDIDATES.map((it) => {
          const on = selected === it.label;
          return (
            <Touchable key={it.label}>
              <button
                type="button"
                aria-label={`${it.label}, ${it.subtitle}`}
                onClick={() => {
                  setSelected(it.label);
                  const nav = it.nav;
                  const nextUrl = resolveHomeResultsUrl(it.query, nav);
                  logHamaTabClickTrace({
                    source: "QuickScenarioGrid",
                    key: it.label,
                    label: it.label,
                    href: null,
                    nav: nav ?? null,
                    nextUrl,
                  });
                  onPick(it.query, nav);
                }}
                className="hama-press"
                style={{
                  minHeight: 82,
                  width: "100%",
                  borderRadius: radius.card,
                  border: on ? `2px solid ${colors.accentPrimary}` : `1px solid ${colors.borderSubtle}`,
                  background: it.bg,
                  color: colors.textPrimary,
                  cursor: "pointer",
                  boxShadow: on ? shadow.card : "none",
                  boxSizing: "border-box",
                  transition: "border-color 150ms ease",
                  textAlign: "left",
                  padding: "8px 10px 8px 8px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  <CategorySpriteOnly spriteIndex={it.spriteIndex} cardBg={it.bg} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0, justifyContent: "center" }}>
                    <strong style={{ fontSize: 15, letterSpacing: "-0.03em" }}>{it.label}</strong>
                    <span style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 700, lineHeight: 1.25 }}>{it.subtitle}</span>
                  </div>
                </div>
              </button>
            </Touchable>
          );
        })}
      </div>
      <div style={{ marginTop: 8 }}>
        <Touchable>
          <button
            type="button"
            aria-label={`${HOME_COURSE.label}, ${HOME_COURSE.subtitle}`}
            onClick={() => {
              setSelected(HOME_COURSE.label);
              const nextUrl = resolveHomeResultsUrl(HOME_COURSE.query, HOME_COURSE.nav);
              logHamaTabClickTrace({
                source: "QuickScenarioGrid",
                key: "course",
                label: HOME_COURSE.label,
                href: null,
                nav: { ...HOME_COURSE.nav },
                nextUrl,
              });
              onPick(HOME_COURSE.query, HOME_COURSE.nav);
            }}
            className="hama-press"
            style={{
              minHeight: 94,
              width: "100%",
              borderRadius: radius.card,
              border:
                selected === HOME_COURSE.label
                  ? `2px solid ${colors.accentPrimary}`
                  : `1px solid ${colors.borderSubtle}`,
              background: HOME_COURSE.bg,
              color: colors.textPrimary,
              cursor: "pointer",
              boxShadow: selected === HOME_COURSE.label ? shadow.card : "none",
              boxSizing: "border-box",
              textAlign: "left",
              padding: "6px 12px 6px 6px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 18,
              }}
            >
              <CourseIconsRow />
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  flex: 1,
                  minWidth: 0,
                  textAlign: "left",
                  marginLeft: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 16, letterSpacing: "-0.03em" }}>{HOME_COURSE.label}</strong>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 900,
                      letterSpacing: "0.01em",
                      color: "#C41E3A",
                      background: "rgba(254, 226, 226, 0.95)",
                      border: "1px solid rgba(220, 38, 38, 0.22)",
                      borderRadius: 999,
                      padding: "3px 8px",
                    }}
                  >
                    인기
                  </span>
                </div>
                <span style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 700, lineHeight: 1.25 }}>{HOME_COURSE.subtitle}</span>
              </div>
            </div>
          </button>
        </Touchable>
      </div>
    </div>
  );
}

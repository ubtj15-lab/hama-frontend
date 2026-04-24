import React from "react";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { CoffeeIcon, HeartIcon, RiceBowlIcon } from "@icons";

export type NextSuggestion = {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** 결과 페이지로 전달할 자연어 쿼리 */
  query: string;
};

export type GetNextSuggestionsOptions = {
  /** 코스 생성 실패 후 장소 추천으로 떨어진 경우 — 코스 재시도 버튼 대신 추천형 제안 */
  courseFallback?: boolean;
};

/**
 * 탭 대신 "다음 행동 제안" — 카테고리 탐색이 아닌 흐름형 카피.
 */
export function getNextSuggestions(
  scenarioObject: ScenarioObject | null,
  options?: GetNextSuggestionsOptions
): NextSuggestion[] {
  const it = scenarioObject?.intentType;
  const cat = scenarioObject?.intentCategory;

  if (options?.courseFallback) {
    return [
      { id: "cf1", label: "카페 가기", icon: React.createElement(CoffeeIcon, { size: 14 }), query: "카페 추천" },
      { id: "cf2", label: "점심 정하기", icon: React.createElement(RiceBowlIcon, { size: 14 }), query: "점심 뭐 먹지" },
      { id: "cf3", label: "조용한 곳 보기", icon: "🌙", query: "조용한 데 추천" },
      { id: "cf4", label: "가까운 곳 보기", icon: "📍", query: "가까운 맛집 추천" },
    ];
  }

  if (it === "course_generation") {
    return [
      { id: "n1", label: "조용한 흐름으로 다시", icon: "🌙", query: "조용한 데이트 코스 짜줘" },
      { id: "n2", label: "실내 위주로 이어가기", icon: "🏠", query: "실내 데이트 코스 짜줘" },
      { id: "n3", label: "활동 많은 코스로", icon: "⚡", query: "활동적인 데이트 코스 짜줘" },
    ];
  }

  if (it === "search_strict") {
    if (cat === "FOOD") {
      return [
        { id: "n1", label: "카페 가기", icon: React.createElement(CoffeeIcon, { size: 14 }), query: "카페 가기 좋은 데 추천" },
        { id: "n2", label: "디저트", icon: "🍰", query: "디저트 맛집 추천" },
        { id: "n3", label: "놀거리", icon: "🎯", query: "놀거리 추천" },
      ];
    }
    if (cat === "CAFE") {
      return [
        { id: "n1", label: "디저트 더 보기", icon: "🧁", query: "디저트 카페 추천" },
        { id: "n2", label: "식사 이어가기", icon: React.createElement(RiceBowlIcon, { size: 14 }), query: "점심 뭐 먹지" },
        { id: "n3", label: "놀거리", icon: "🎯", query: "놀거리 추천" },
      ];
    }
    if (cat === "BEAUTY") {
      return [
        { id: "n1", label: "카페에서 쉬기", icon: React.createElement(CoffeeIcon, { size: 14 }), query: "카페 가기 좋은 데 추천" },
        { id: "n2", label: "식사", icon: "🍽️", query: "점심 뭐 먹지" },
        { id: "n3", label: "네일", icon: "💅", query: "네일샵 추천" },
      ];
    }
    if (cat === "ACTIVITY") {
      return [
        { id: "n1", label: "카페", icon: React.createElement(CoffeeIcon, { size: 14 }), query: "카페 추천" },
        { id: "n2", label: "식사", icon: "🍽️", query: "저녁 뭐 먹지" },
        { id: "n3", label: "실내 휴식", icon: "🛋️", query: "실내에서 쉴 만한 곳" },
      ];
    }
  }

  // scenario_recommendation / generic
  return [
    { id: "n1", label: "점심 정하기", icon: React.createElement(RiceBowlIcon, { size: 14 }), query: "점심 뭐 먹지" },
    { id: "n2", label: "카페 가기", icon: React.createElement(CoffeeIcon, { size: 14 }), query: "카페 추천" },
    { id: "n3", label: "데이트 코스", icon: React.createElement(HeartIcon, { size: 14 }), query: "데이트 코스 짜줘" },
  ];
}

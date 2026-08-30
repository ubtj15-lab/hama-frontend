import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { RECOMMEND_DECK_SIZE } from "@/lib/recommend/recommendConstants";
import type { HomeCard } from "@/lib/storeTypes";
import type { RecommendationReasonBlock } from "@/lib/recommend/buildRecommendationReason";
import {
  conversationalReasonFromBlock,
  essentialFacts,
  formatDistanceFact,
  hasVerifiedPlacePhoto,
  oneLineReasonFromBlock,
  resultsContextLine,
  dedupeDisplayChips,
} from "../resultsPresentation";

function card(partial: Partial<HomeCard> & { id: string; name: string }): HomeCard {
  return { category: "restaurant", ...partial };
}

const reason = (over: Partial<RecommendationReasonBlock> = {}): RecommendationReasonBlock => ({
  scenarioLabel: "아이랑",
  headline: "아이들과 가볍게 나가기 좋아요",
  subline: "지금 거리도 부담스럽지 않아요",
  badges: ["아이랑 가기 좋아요"],
  ...over,
});

const resultsDir = path.resolve(__dirname, "..");

describe("Results V2 presentation helpers", () => {
  it("keeps deck size at 3", () => {
    expect(RECOMMEND_DECK_SIZE).toBe(3);
  });

  it("builds conversational reason from existing fields only", () => {
    const text = conversationalReasonFromBlock(reason());
    expect(text).toContain("아이들과 가볍게 나가기 좋아요");
    expect(text).toContain("지금 거리도 부담스럽지 않아요");
    expect(text).not.toMatch(/가성비 선택|지난번처럼|취향에 맞춰/);
  });

  it("does not invent distance or alternative roles", () => {
    expect(formatDistanceFact(card({ id: "a", name: "A" }))).toBeNull();
    expect(formatDistanceFact(card({ id: "b", name: "B", distanceKm: 5.32 }))).toBe("5.3km");
    expect(essentialFacts(card({ id: "c", name: "C", distanceKm: 1, with_kids: true }))).toEqual([
      "1.0km",
      "식당",
      "아이랑",
    ]);
    expect(essentialFacts(card({ id: "d", name: "D" }))).not.toContain("더 가까운 선택");
    expect(hasVerifiedPlacePhoto(card({ id: "e", name: "E", imageUrl: "/x.jpg" }))).toBe(false);
  });

  it("uses a fixed clock for context line", () => {
    expect(resultsContextLine(new Date(2026, 7, 30, 14, 0, 0))).toBe("일요일 오후 · 오산");
  });

  it("shortens existing headline for alternatives", () => {
    expect(oneLineReasonFromBlock(reason({ headline: "짧게" }))).toBe("짧게");
  });

  it("dedupes exact visible chip labels only", () => {
    expect(dedupeDisplayChips(["아이 동반", "아이 메뉴", "아이 동반"])).toEqual(["아이 동반", "아이 메뉴"]);
    expect(dedupeDisplayChips(["아이 동반", "아이 메뉴"])).toEqual(["아이 동반", "아이 메뉴"]);
    expect(dedupeDisplayChips([" 아이 동반 ", "아이 동반"])).toEqual(["아이 동반"]);
    expect(dedupeDisplayChips(["데이트", "분위기"])).toEqual(["데이트", "분위기"]);
  });
});

describe("Results V2 card/list copy", () => {
  it("makes TOP1 primary and TOP2/3 lighter without rank badges or fake photo claims", () => {
    const cardSrc = fs.readFileSync(path.join(resultsDir, "RecommendationCard.tsx"), "utf8");
    const listSrc = fs.readFileSync(path.join(resultsDir, "RecommendationList.tsx"), "utf8");
    const headerSrc = fs.readFileSync(path.join(resultsDir, "ResultsHeader.tsx"), "utf8");
    const pageSrc = fs.readFileSync(path.resolve(resultsDir, "../../results/page.tsx"), "utf8");
    expect(cardSrc).toContain("PRIMARY_PICK_LABEL");
    expect(cardSrc).toContain("DECISION_BUTTON_COPY");
    expect(cardSrc).toContain("길찾기");
    expect(cardSrc).toContain("방문 후 인증/피드백");
    expect(cardSrc).toContain("IMAGE_REFERENCE_LABEL");
    expect(cardSrc).not.toContain("추천 1순위");
    expect(cardSrc).not.toContain("실제 장소 사진");
    expect(cardSrc).not.toContain("실제 매장 참고 이미지");
    expect(cardSrc).not.toMatch(/취향을 분석|OO님에게|지난 행동을 분석/);
    expect(listSrc).toContain("ALTERNATIVE_SECTION_LABEL");
    expect(listSrc).toContain("REFRESH_BUTTON_COPY");
    expect(listSrc).toContain("onRejectRecommendation");
    expect(pageSrc).toContain("ContextualRejectReasonBar");
    expect(listSrc).toContain("slice(0, 3)");
    expect(headerSrc).toContain("RESULT_HEADER_COPY");
    expect(headerSrc).not.toMatch(/검색 결과/);
    expect(fs.readFileSync(path.join(resultsDir, "resultsPresentation.ts"), "utf8")).toContain(
      "잘 맞는 곳을 골라봤어요"
    );
    expect(cardSrc).toContain("hama-top1-hero");
    expect(cardSrc).toContain("176px");
    expect(pageSrc).toContain("RESULTS_CONTENT_MAX_WIDTH");
  });
});

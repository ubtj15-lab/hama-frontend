/**
 * 시나리오별 추천 문구 계약 검증 — `npm run test:reason` (apps/hama)
 */
import assert from "node:assert/strict";
import { buildRecommendationReason } from "./buildRecommendationReason";
import type { HomeCard } from "../storeTypes";

function card(p: Partial<HomeCard>): HomeCard {
  return {
    id: "test-place",
    name: "테스트 장소",
    category: "cafe",
    ...p,
  } as HomeCard;
}

function main() {
  // 데이트 코스 — 카드 voice·태그가 달라도 date 전용 headline
  const dateReq = card({
    recommendationVoice: "solo",
    tags: ["아이동반", "혼밥가능"],
    description: "가족과 오기 좋은 분위기",
  });
  const r1 = buildRecommendationReason(dateReq, { requestedScenario: "date", deckSlot: 0 });
  assert.match(
    r1.headline,
    /데이트|둘이|연인|분위기|대화|식사 후|조용|코스로|마무리|가볍게 시작|편하게 머물|분위기 있는/
  );
  assert.doesNotMatch(r1.headline, /아이랑|혼자 가기|혼밥하기/);

  for (let slot = 0; slot < 3; slot++) {
    const rx = buildRecommendationReason(dateReq, { requestedScenario: "date", deckSlot: slot });
    assert.match(
      rx.headline,
      /데이트|둘이|연인|분위기|대화|식사 후|조용|코스로|마무리|가볍게 시작|편하게 머물|분위기 있는/
    );
    assert.doesNotMatch(rx.headline, /아이랑|혼자 가기|혼밥하기/);
  }

  // 아이랑 식당 — family
  const familyReq = card({
    recommendationVoice: "date",
    with_kids: true,
    tags: ["키즈", "유아의자"],
    description: "가족 단위로 방문하기 좋은 식당",
  });
  const r2 = buildRecommendationReason(familyReq, { requestedScenario: "family", deckSlot: 0 });
  assert.match(r2.headline, /아이|가족|부담|편하게|모임|외출/);
  assert.doesNotMatch(r2.headline, /데이트로|둘이|연인|혼자|혼밥/);

  // 혼자 — solo
  const soloReq = card({
    recommendationVoice: "family",
    with_kids: true,
    tags: ["가족", "키즈"],
    description: "가족 모임",
  });
  const r3 = buildRecommendationReason(soloReq, { requestedScenario: "solo", deckSlot: 0 });
  assert.match(r3.headline, /혼자|혼밥|잠깐|가성비|부담|간단|빠르게|가볍게|커피|디저트|짧게|카페/);
  assert.doesNotMatch(r3.headline, /데이트로|아이랑|가족 외식|연인/);

  // drink-only + date — 식사형 금지
  const drinkCafe = card({
    category: "cafe",
    name: "로스팅 카페",
    tags: ["커피", "디저트"],
    servingType: "drink",
  });
  const r4 = buildRecommendationReason(drinkCafe, { requestedScenario: "date", deckSlot: 0 });
  const bundle = `${r4.headline} ${r4.subline}`;
  assert.doesNotMatch(bundle, /식사하기 좋아요|혼밥하기 좋아요/);

  // 덱 variation — 같은 시나리오에서 headline 중복 최소화
  const uh = new Set<string>();
  const us = new Set<string>();
  const a = buildRecommendationReason(dateReq, {
    requestedScenario: "date",
    deckSlot: 0,
    usedHeadlines: uh,
    usedSublines: us,
  });
  const b = buildRecommendationReason(dateReq, {
    requestedScenario: "date",
    deckSlot: 1,
    usedHeadlines: uh,
    usedSublines: us,
  });
  assert.notEqual(a.headline, b.headline);

  // 배지: 요청 시나리오와 상충하는 태그는 메인에 안 붙음
  const dateBadges = buildRecommendationReason(dateReq, { requestedScenario: "date", deckSlot: 0 }).badges;
  assert.ok(!dateBadges.includes("혼밥가능"));
  assert.ok(!dateBadges.includes("아이동반"));

  const soloClash = card({
    category: "restaurant",
    tags: ["아이동반", "데이트", "혼밥"],
    description: "혼밥 가능",
  });
  const soloBadges = buildRecommendationReason(soloClash, { requestedScenario: "solo", deckSlot: 0 }).badges;
  assert.ok(!soloBadges.includes("아이동반"));
  assert.ok(!soloBadges.includes("데이트"));
  assert.ok(soloBadges.includes("혼밥가능") || soloBadges.includes("가성비"));

  const famBadges = buildRecommendationReason(familyReq, { requestedScenario: "family", deckSlot: 0 }).badges;
  assert.ok(!famBadges.includes("혼밥가능"));
  assert.ok(!famBadges.includes("데이트"));

  // 시나리오 미지정 — 태그(혼밥)만으로는 solo 톤 headline 이 나오면 안 됨
  const ambiguous = card({
    recommendationVoice: undefined,
    tags: ["혼밥", "1인"],
    category: "restaurant",
  });
  const amb = buildRecommendationReason(ambiguous, { deckSlot: 0 });
  assert.doesNotMatch(amb.headline, /혼자 가기 편해요|혼밥하기/);

  // drink-only + solo — 식사형 headline/subline 금지
  const soloDrinkCafe = card({
    category: "cafe",
    name: "커피전문",
    servingType: "drink",
    tags: ["커피"],
  });
  const rs = buildRecommendationReason(soloDrinkCafe, { requestedScenario: "solo", deckSlot: 0 });
  const soloBundle = `${rs.headline} ${rs.subline}`;
  assert.doesNotMatch(soloBundle, /식사하기 좋아요|혼밥하기 좋아요|한 끼/);

  // eslint-disable-next-line no-console
  console.log("buildRecommendationReason scenario tests: ok");
}

main();

import { describe, it, expect } from "vitest";
import { buildTopRecommendations, type BuildRecommendationsContext } from "../scoring";
import { DEFAULT_USER_PROFILE } from "@/lib/onboardingProfile";
import type { HomeCard } from "@/lib/storeTypes";

function baseCard(partial: Partial<HomeCard> & Pick<HomeCard, "id" | "name" | "category">): HomeCard {
  return {
    lat: 37.1498,
    lng: 127.0772,
    area: null,
    address: null,
    image_url: null,
    mood: [],
    tags: [],
    description: null,
    updated_at: null,
    with_kids: null,
    for_work: null,
    reservation_required: null,
    vegetarian_available: null,
    halal_available: null,
    price_level: null,
    ...partial,
  };
}

describe("persona venue filters (키즈·보드)", () => {
  const ctxBase = { userLat: 37.1498 as number, userLng: 127.0772 as number };

  it("혼자·자녀 없음 → 보드게임 카페 후보 제외", () => {
    const board = baseCard({
      id: "board-1",
      name: "보드게임카페 유닛",
      category: "activity",
      tags: [],
    });
    const other = baseCard({
      id: "other-1",
      name: "실외 산책 코스",
      category: "activity",
      tags: [],
    });
    const ctx: BuildRecommendationsContext = {
      intent: "solo",
      ...ctxBase,
      userProfile: {
        ...DEFAULT_USER_PROFILE,
        companions: ["혼자"],
        young_child: "없음",
        onboarding_completed_at: "t",
      },
    };
    const out = buildTopRecommendations([board, other], ctx);
    expect(out.some((r) => r.card.id === "board-1")).toBe(false);
    expect(out.some((r) => r.card.id === "other-1")).toBe(true);
  });

  it("친구·자녀 없음 → 보드게임 카페 후보 허용", () => {
    const board = baseCard({
      id: "board-1",
      name: "보드게임카페 유닛",
      category: "activity",
    });
    const other = baseCard({
      id: "other-1",
      name: "실외 산책 코스",
      category: "activity",
    });
    const ctx: BuildRecommendationsContext = {
      intent: "meeting",
      ...ctxBase,
      userProfile: {
        ...DEFAULT_USER_PROFILE,
        companions: ["친구"],
        young_child: "없음",
        onboarding_completed_at: "t",
      },
    };
    const out = buildTopRecommendations([board, other], ctx);
    expect(out.some((r) => r.card.id === "board-1")).toBe(true);
  });

  it("자녀 없음 + with_kids·키즈룸 명 → 키즈 후보 제외", () => {
    const kidVenue = baseCard({
      id: "kid-1",
      name: "실내 놀이 모음",
      category: "activity",
      with_kids: true,
      description: "키즈룸 대여",
    });
    const plain = baseCard({
      id: "plain-1",
      name: "일반 체험 공방",
      category: "activity",
      with_kids: false,
    });
    const ctx: BuildRecommendationsContext = {
      intent: "none",
      ...ctxBase,
      userProfile: {
        ...DEFAULT_USER_PROFILE,
        companions: ["혼자"],
        young_child: "없음",
        onboarding_completed_at: "t",
      },
    };
    const out = buildTopRecommendations([kidVenue, plain], ctx);
    expect(out.some((r) => r.card.id === "kid-1")).toBe(false);
    expect(out.some((r) => r.card.id === "plain-1")).toBe(true);
  });
});

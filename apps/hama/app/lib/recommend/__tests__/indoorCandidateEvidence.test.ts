import { describe, expect, it } from "vitest";
import { storeCategoryMatchesIntentCategory } from "@/lib/scenarioEngine/intentClassification";
import { indoorEvidenceFor, keepForIndoorRequest } from "@/lib/recommend/indoorCandidateEvidence";
import type { HomeCard } from "@/lib/storeTypes";

function card(partial: Partial<HomeCard> & Pick<HomeCard, "name">): HomeCard {
  return { id: partial.name, category: "activity", ...partial };
}

describe("indoor and activity candidate evidence", () => {
  it("keeps restaurants out of an activity request before scoring", () => {
    const restaurant = card({ name: "쭈돼집 동탄본점", category: "restaurant", address: "경기 화성시 동탄오산로 86" });
    expect(storeCategoryMatchesIntentCategory(restaurant, "ACTIVITY")).toBe(false);
  });

  it("treats park roads and water play as outdoor, and floors or kids cafes as indoor", () => {
    expect(
      indoorEvidenceFor(card({ name: "청계중앙공원 물놀이장", address: "경기 화성시 동탄대로시범길 153" }))
    ).toBe("outdoor");
    expect(
      indoorEvidenceFor(card({ name: "동탄센트럴파크", address: "경기 화성시 동탄공원로2길 22" }))
    ).toBe("unknown");
    expect(
      indoorEvidenceFor(card({ name: "히어로플레이파크 동탄역점", address: "경기도 화성시 동탄광역환승로 73 아이비파크 지하1층" }))
    ).toBe("estimated");
    expect(
      indoorEvidenceFor(card({ name: "프릴리 키즈카페", address: "경기도 화성시 동탄신리천로 268" }))
    ).toBe("indoor");
    expect(
      indoorEvidenceFor(card({ name: "물노리베이비", address: "경기도 화성시 동탄대로 446 3117호" }))
    ).toBe("unknown");
  });

  it("does not fill an indoor request with outdoor or unknown places", () => {
    const kept = keepForIndoorRequest([
      card({ name: "동탄센트럴파크", address: "경기 화성시 동탄공원로2길 22" }),
      card({ name: "물노리베이비", address: "경기도 화성시 동탄대로 446 3117호" }),
      card({ name: "나만의 키즈카페", address: "경기도 화성시 동탄문화센터로 61 2층" }),
    ]);
    expect(kept.map((item) => item.name)).toEqual(["나만의 키즈카페"]);
  });

  it("keeps the play list when a separate food group drops non-restaurants", () => {
    const play = ["놀이1", "놀이2"];
    const food = [
      card({ name: "식당", category: "restaurant" }),
      card({ name: "공원", category: "activity" }),
    ].filter((item) => storeCategoryMatchesIntentCategory(item, "FOOD"));
    expect(play).toEqual(["놀이1", "놀이2"]);
    expect(food.map((item) => item.name)).toEqual(["식당"]);
  });
});

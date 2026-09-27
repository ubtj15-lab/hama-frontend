import { describe, expect, it } from "vitest";
import {
  intentCategoryToCategoryClicked,
  isFamilyDiningAliasQuery,
  isGenericFoodResultsQuery,
  isSituationResultsQuery,
  resolveSearchQueryForHomeCards,
} from "../resultsQueryRouting";

const base = {
  explicitCategory: null as string | null,
  isSoloSituationQuery: false,
  hasNamedFoodPreset: false,
};

describe("intent category click labels", () => {
  it("maps known categories and leaves unknown values unchanged", () => {
    expect(intentCategoryToCategoryClicked(null)).toBeNull();
    expect(intentCategoryToCategoryClicked(undefined)).toBeNull();
    expect(intentCategoryToCategoryClicked("")).toBeNull();
    expect(intentCategoryToCategoryClicked("FOOD")).toBe("푸드");
    expect(intentCategoryToCategoryClicked("CAFE")).toBe("카페");
    expect(intentCategoryToCategoryClicked("BEAUTY")).toBe("미용실");
    expect(intentCategoryToCategoryClicked("FITNESS")).toBe("운동");
    expect(intentCategoryToCategoryClicked("LIFE")).toBe("생활");
    expect(intentCategoryToCategoryClicked("ACTIVITY")).toBe("액티비티");
    expect(intentCategoryToCategoryClicked("CUSTOM")).toBe("CUSTOM");
  });
});

describe("results home-card search query", () => {
  it("keeps the current turn for an ordinary query", () => {
    expect(resolveSearchQueryForHomeCards({ ...base, qRaw: "조용한 식당" })).toBe("조용한 식당");
    expect(resolveSearchQueryForHomeCards({ ...base, qRaw: "   " })).toBe("   ");
    expect(resolveSearchQueryForHomeCards({ ...base, qRaw: "" })).toBeNull();
  });

  it("keeps solo and named-food queries literal", () => {
    expect(
      resolveSearchQueryForHomeCards({ ...base, qRaw: "  혼밥  ", isSoloSituationQuery: true })
    ).toBe("혼밥");
    expect(
      resolveSearchQueryForHomeCards({ ...base, qRaw: "파스타", hasNamedFoodPreset: true })
    ).toBe("파스타");
  });

  it("keeps museum, library, and situation presets unchanged", () => {
    expect(resolveSearchQueryForHomeCards({ ...base, qRaw: "박물관" })).toBe("박물관");
    expect(resolveSearchQueryForHomeCards({ ...base, qRaw: "도서관" })).toBe("도서관");
    expect(resolveSearchQueryForHomeCards({ ...base, qRaw: "데이트" })).toBe("데이트");
    expect(resolveSearchQueryForHomeCards({ ...base, qRaw: "아이랑 갈만한 곳" })).toBe("아이랑 갈만한 곳");
    expect(isSituationResultsQuery("데이트")).toBe(true);
    expect(isSituationResultsQuery("조용한 카페")).toBe(false);
  });

  it("expands non-preset aliases and family dining into the existing ranking input", () => {
    expect(resolveSearchQueryForHomeCards({ ...base, qRaw: "조용한 카페" })).toBe("카페 조용한 감성");
    expect(resolveSearchQueryForHomeCards({ ...base, qRaw: "가족 외식" })).toBe("식당");
    expect(resolveSearchQueryForHomeCards({ ...base, qRaw: "가족이랑  밥" })).toBe("식당");
    expect(resolveSearchQueryForHomeCards({ ...base, qRaw: "푸드" })).toBe("식당");
    expect(resolveSearchQueryForHomeCards({ ...base, qRaw: "맛집" })).toBe("맛집");
  });

  it("returns the raw culture query before food alias rules", () => {
    expect(
      resolveSearchQueryForHomeCards({ ...base, qRaw: "가족 외식", explicitCategory: "Culture" })
    ).toBe("가족 외식");
  });

  it("classifies family and generic food queries the same way both screens did", () => {
    expect(isFamilyDiningAliasQuery("가족외식", "가족외식")).toBe(true);
    expect(isFamilyDiningAliasQuery("파스타", "파스타")).toBe(false);
    expect(isGenericFoodResultsQuery("푸드")).toBe(true);
    expect(isGenericFoodResultsQuery("식당")).toBe(true);
    expect(isGenericFoodResultsQuery("맛집")).toBe(true);
    expect(isGenericFoodResultsQuery("파스타")).toBe(false);
  });
});

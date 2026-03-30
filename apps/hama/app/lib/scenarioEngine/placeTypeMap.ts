import type { HomeCard } from "@/lib/storeTypes";
import type { PlaceType } from "./types";

const SUB_HINTS: { sub: RegExp; type: PlaceType }[] = [
  { sub: /room_escape|방탈출|escap/i, type: "ACTIVITY" },
  { sub: /bowling|볼링/i, type: "ACTIVITY" },
  { sub: /boardgame|보드게임/i, type: "ACTIVITY" },
  { sub: /vr|vr게임/i, type: "ACTIVITY" },
  { sub: /workshop|워크샵|클래스|체험|만들기/i, type: "CULTURE" },
  { sub: /baking|베이킹|빵/i, type: "CULTURE" },
  { sub: /movie|영화관|cgv|메가박스/i, type: "CULTURE" },
  { sub: /gallery|미술관|전시|exhibition/i, type: "CULTURE" },
  { sub: /bookstore|서점/i, type: "CULTURE" },
  { sub: /night_view|야경|전망/i, type: "WALK" },
  { sub: /park|공원|산책/i, type: "WALK" },
];

/**
 * DB category / 보조 필드를 PlaceType으로
 */
export function mapPlaceToPlaceType(place: HomeCard): PlaceType {
  const c: any = place as any;
  const main = String(c.category ?? c.category_main ?? "").toLowerCase();
  const sub = String(c.category_sub ?? c.categorySub ?? "").toLowerCase();
  const hay = `${main} ${sub} ${place.name ?? ""}`;

  for (const { sub: re, type } of SUB_HINTS) {
    if (re.test(hay)) return type;
  }

  switch (main) {
    case "restaurant":
    case "food":
      return "FOOD";
    case "cafe":
    case "coffee":
      return "CAFE";
    case "activity":
      return "ACTIVITY";
    case "culture":
    case "museum":
      return "CULTURE";
    case "salon":
      return "CULTURE";
    default:
      if (/카페|커피|디저트/.test(hay)) return "CAFE";
      if (/식당|맛집|음식|밥|고기/.test(hay)) return "FOOD";
      if (/공원|산책|한강/.test(hay)) return "WALK";
      return "FOOD";
  }
}

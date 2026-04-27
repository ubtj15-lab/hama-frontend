/**
 * 디버그용 `recommendPlaces` 샘플 — apps/hama 에서:
 *   npm run test:recommend-places
 */
import { recommendPlaces } from "./recommend";
import type { ScorePlace } from "@/utils/calculateScore";

const testContext = {
  who: "family" as const,
  category: "food",
  isGroup: true,
  time: "dinner" as const,
};

const places: ScorePlace[] = [
  {
    name: "가족·단체 OK 식당",
    category: "food",
    familyFriendly: true,
    groupAvailable: true,
    distance: 0.4,
  },
  {
    name: "혼밥 위주",
    category: "food",
    familyFriendly: false,
    soloFriendly: true,
    groupAvailable: false,
    distance: 0.2,
  },
  {
    name: "다른 카테고리",
    category: "cafe",
    familyFriendly: true,
    groupAvailable: true,
    distance: 0.3,
  },
];

const result = recommendPlaces(places, testContext);
console.log("최종 추천:", result);

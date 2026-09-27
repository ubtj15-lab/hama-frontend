import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** apps/hama */
export const HAMA_ROOT = path.resolve(here, "../..");
export const CACHE_DIR = path.join(HAMA_ROOT, ".simulator-cache");
export const OUTPUT_DIR = path.join(HAMA_ROOT, ".simulator-output");
export const CATALOG_CACHE_PATH = path.join(CACHE_DIR, "stores.json");

export const OSAN_CITY_HALL = { lat: 37.1498, lng: 127.0772, name: "오산시청" as const };
export const DONGTAN_STATION = { lat: 37.2009, lng: 127.0957, name: "동탄역" as const };

export const RECOMMEND_POOL_SINGLE_TAB = 120;
export const RECOMMEND_POOL_PER_CATEGORY_MIXED = 55;
export const KEYWORD_OVERLAP_CAP = 200;
export const NAMED_FOOD_PRESET_POOL = 420;
export const DEFAULT_DECK_SIZE = 3;
export const DEFAULT_CONCURRENCY = 4;

/** Ranking-v2 protected queries — Diversity / Discovery must not degrade these. */
export const PROTECTED_QUERIES: readonly string[] = [
  "냉면 땡겨",
  "물냉면 맛집",
  "더운데 냉면 먹을 곳",
  "소금빵 맛집",
  "분식 먹고 싶다",
  "김밥이랑 라면",
  "간단히 분식",
  "아이 입맛 분식",
  "오늘 고깃집 가자",
  "비 오니까 칼국수",
  "회사 근처 돈가스",
  "회식할 고깃집",
  "달달한 거 먹고 싶어",
  "브런치 카페 추천",
  "키즈카페 있는 곳",
];

/** Discovery v1 target queries — only those present in the scenario set are used. */
export const DISCOVERY_TARGET_QUERIES: readonly string[] = [
  "심심한데 뭐하지",
  "오늘 뭐하지",
  "어디 갈까",
  "아이랑 갈 곳",
  "아이랑 뭐하지",
  "날씨 좋은데 야외 나들이",
  "산책하다 들를 곳",
  "조용히 책 읽을 곳",
  "조용히 시간 보낼 곳",
  "데이트하기 좋은 곳",
  "가족끼리 나들이",
];

export type SimMode = "quick" | "standard" | "full";

export const MODE_TARGET_COUNTS: Record<SimMode, number> = {
  quick: 200,
  standard: 2000,
  full: 10000,
};

/** Overall score pillar weights (simulator-only; not production ranking weights). */
export const METRIC_WEIGHTS = {
  categoryMatch: 0.2,
  intentMatch: 0.2,
  distanceMatch: 0.1,
  diversity: 0.1,
  nonZero: 0.15,
  hardConstraintOk: 0.15,
  top1Quality: 0.1,
} as const;

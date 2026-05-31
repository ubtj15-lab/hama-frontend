import type { SearchV2ResultCard, StoreRow } from "./searchV2Results";
import {
  getCategoryLabel,
  getCautionByCategory,
  getReasonByCategory,
  getTagsByCategory,
} from "./searchV2CategoryCopy";

export function normalizeCategory(category?: string | null): string {
  return String(category ?? "").toLowerCase();
}

export function isFoodCategory(category?: string | null): boolean {
  const c = normalizeCategory(category);
  return (
    c.includes("fd6") ||
    c.includes("food") ||
    c.includes("restaurant") ||
    c.includes("식당") ||
    c.includes("음식") ||
    c.includes("한식") ||
    c.includes("분식") ||
    c.includes("맛집")
  );
}

export function isCafeCategory(category?: string | null): boolean {
  const c = normalizeCategory(category);
  return (
    c.includes("ce7") ||
    c.includes("cafe") ||
    c.includes("카페") ||
    c.includes("커피") ||
    c.includes("베이커리") ||
    c.includes("디저트")
  );
}

export function isKidsOrActivityCategory(category?: string | null): boolean {
  const c = normalizeCategory(category);
  return (
    c.includes("at4") ||
    c.includes("activity") ||
    c.includes("kids") ||
    c.includes("family") ||
    c.includes("kidscafe") ||
    c.includes("키즈") ||
    c.includes("가족") ||
    c.includes("체험") ||
    c.includes("실내") ||
    c.includes("library") ||
    c.includes("museum")
  );
}

export function isOutdoorCategory(category?: string | null, name?: string | null): boolean {
  const hay = `${normalizeCategory(category)} ${String(name ?? "").toLowerCase()}`;
  return (
    hay.includes("park") ||
    hay.includes("outdoor") ||
    hay.includes("공원") ||
    hay.includes("수목원") ||
    hay.includes("산책") ||
    hay.includes("arboretum") ||
    hay.includes("야외")
  );
}

export function isExcludedForFamilyDefault(category?: string | null): boolean {
  const c = normalizeCategory(category);
  return (
    c.includes("beauty") ||
    c.includes("salon") ||
    c.includes("hair") ||
    c.includes("nail") ||
    c.includes("bk9") ||
    c.includes("미용") ||
    c.includes("네일") ||
    c.includes("병원") ||
    c.includes("약국") ||
    c.includes("인테리어") ||
    c.includes("타일") ||
    c.includes("공사") ||
    c.includes("hospital") ||
    c.includes("pharmacy")
  );
}

function roleKeyFromLabel(label: string): SearchV2ResultCard["roleKey"] {
  if (label === "가장 무난한 선택") return "safe";
  if (label === "분위기 좋은 선택") return "mood";
  return "nearby";
}

function pickLatLng(row: StoreRow): { lat: number | null; lng: number | null } {
  const lat = row.lat ?? row.latitude ?? null;
  const lng = row.lng ?? row.longitude ?? null;
  return {
    lat: typeof lat === "number" && Number.isFinite(lat) ? lat : null,
    lng: typeof lng === "number" && Number.isFinite(lng) ? lng : null,
  };
}

/** family 기본 fallback — 항상 식당/카페/키즈·액티비티 3슬롯 */
export const familyDefaultFallbackResults: SearchV2ResultCard[] = [
  {
    id: "family-food-1",
    roleKey: "safe",
    role: "가장 무난한 선택",
    roleLabel: "가장 무난한 선택",
    name: "아이랑 가기 좋은 가족 식당",
    category: "FD6",
    categoryLabel: "식당",
    description: "아이와 함께 편하게 식사하기 좋은 곳이에요.",
    tags: ["#아이동반", "#가족외식", "#무난한선택"],
    caution: "방문 전 영업정보와 대기 여부를 확인해 주세요.",
  },
  {
    id: "family-cafe-1",
    roleKey: "mood",
    role: "분위기 좋은 선택",
    roleLabel: "분위기 좋은 선택",
    name: "아이랑 들르기 좋은 카페",
    category: "CE7",
    categoryLabel: "카페",
    description: "가족 나들이 후 가볍게 쉬어가기 좋은 카페예요.",
    tags: ["#아이랑", "#카페", "#분위기좋음"],
    caution: "주말에는 혼잡할 수 있어요.",
  },
  {
    id: "family-activity-1",
    roleKey: "nearby",
    role: "가까운 대안",
    roleLabel: "가까운 대안",
    name: "근처 키즈카페 또는 실내체험",
    category: "AT4",
    categoryLabel: "키즈/가족",
    description: "아이와 함께 가볍게 놀거나 체험하기 좋은 실내 대안이에요.",
    tags: ["#아이동반", "#실내활동", "#체험"],
    caution: "운영시간과 예약 필요 여부를 확인해 주세요.",
  },
];

function rowKey(row: StoreRow): string {
  return String(row.id ?? row.name ?? "").trim();
}

function classifyRowCategory(row: StoreRow): string {
  const cat = row.category ? String(row.category) : "";
  if (cat) return cat;
  const name = String(row.name ?? "").toLowerCase();
  if (/카페|커피|베이커리/.test(name)) return "cafe";
  if (/식당|맛집|음식|한식|분식/.test(name)) return "restaurant";
  if (/키즈|체험|놀이|activity/.test(name)) return "activity";
  return "activity";
}

/** DB/API row → category에 맞는 reason/tags/caution/roleLabel 적용 */
export function enrichResultByCategory(
  row: StoreRow,
  roleLabel: string,
  query: string
): SearchV2ResultCard {
  const category = classifyRowCategory(row);
  const hints = { name: row.name, description: row.description, tags: row.tags };
  const { lat, lng } = pickLatLng(row);

  return {
    id: String(row.id ?? row.name ?? `row-${category}`),
    roleKey: roleKeyFromLabel(roleLabel),
    role: roleLabel,
    roleLabel,
    name: String(row.name ?? "").trim(),
    category,
    categoryLabel: getCategoryLabel(category, hints),
    description: getReasonByCategory(category, query, hints),
    tags: getTagsByCategory(category, query, hints),
    caution: getCautionByCategory(category, hints),
    lat,
    lng,
    area: row.area ?? null,
    address: row.address ?? null,
  };
}

function isEligibleForFamilyDefault(row: StoreRow): boolean {
  if (!row?.name || !String(row.name).trim()) return false;
  const category = classifyRowCategory(row);
  if (isExcludedForFamilyDefault(category)) return false;
  if (isOutdoorCategory(category, row.name)) return false;
  return isFoodCategory(category) || isCafeCategory(category) || isKidsOrActivityCategory(category);
}

function findFirstMatching(
  pool: StoreRow[],
  used: Set<string>,
  matcher: (category: string) => boolean
): StoreRow | undefined {
  for (const row of pool) {
    const key = rowKey(row);
    if (!key || used.has(key)) continue;
    const category = classifyRowCategory(row);
    if (matcher(category)) {
      used.add(key);
      return row;
    }
  }
  return undefined;
}

/**
 * family 기본 추천 3장 — 무조건 식당 → 카페 → 키즈/액티비티.
 * slice(0,3) 사용 금지. 슬롯별 find + fallback.
 */
export function buildFamilyDefaultResults(pool: StoreRow[], query: string): SearchV2ResultCard[] {
  const eligible = pool.filter(isEligibleForFamilyDefault);
  const used = new Set<string>();

  const foodRow = findFirstMatching(eligible, used, isFoodCategory);
  const cafeRow = findFirstMatching(eligible, used, isCafeCategory);
  const activityRow = findFirstMatching(eligible, used, isKidsOrActivityCategory);

  const roleLabels = ["가장 무난한 선택", "분위기 좋은 선택", "가까운 대안"] as const;
  const fallbacks = familyDefaultFallbackResults;

  return [
    foodRow ? enrichResultByCategory(foodRow, roleLabels[0], query) : { ...fallbacks[0]! },
    cafeRow ? enrichResultByCategory(cafeRow, roleLabels[1], query) : { ...fallbacks[1]! },
    activityRow ? enrichResultByCategory(activityRow, roleLabels[2], query) : { ...fallbacks[2]! },
  ];
}

export function familyResultsUseApi(cards: SearchV2ResultCard[]): boolean {
  return cards.some((c) => !c.id.startsWith("family-"));
}

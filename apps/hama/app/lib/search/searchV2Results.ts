import { normalizeSearchV2ResultCard, normalizeSearchV2ResultCards } from "./searchV2CategoryCopy";
import {
  buildFamilyDefaultResults,
  enrichResultByCategory,
  familyDefaultFallbackResults,
  familyResultsUseApi,
  isCafeCategory,
  isExcludedForFamilyDefault,
  isFoodCategory,
  isKidsOrActivityCategory,
  isOutdoorCategory,
} from "./searchV2FamilyResults";

export type SearchV2RoleKey = "safe" | "mood" | "nearby";

export type SearchQueryIntent = "family" | "date" | "solo" | "quiet" | "parking" | "default";

export type FamilyCategoryChip =
  | "default"
  | "restaurant"
  | "cafe"
  | "indoor"
  | "outdoor"
  | "kidscafe";

export type StoreCategoryBucket =
  | "restaurant"
  | "cafe"
  | "kids_indoor"
  | "kidscafe"
  | "outdoor"
  | "other";

export type SearchV2ResultCard = {
  id: string;
  roleKey: SearchV2RoleKey;
  role: string;
  roleLabel: string;
  name: string;
  description: string;
  tags: string[];
  caution: string;
  category?: string;
  categoryLabel?: string;
  area?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
};

export type SearchV2FetchResult = {
  cards: SearchV2ResultCard[];
  source: "api" | "mock";
  pool: StoreRow[];
  intent: SearchQueryIntent;
};

export type StoreRow = {
  id?: string | number;
  name?: string;
  category?: string;
  lat?: number | null;
  lng?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  tags?: string[] | null;
  description?: string | null;
  area?: string | null;
  address?: string | null;
};

type FallbackTemplate = Omit<SearchV2ResultCard, "roleLabel"> & { role: string };

export {
  buildFamilyDefaultResults,
  enrichResultByCategory,
  familyDefaultFallbackResults,
  isCafeCategory,
  isExcludedForFamilyDefault,
  isFoodCategory,
  isKidsOrActivityCategory,
  isOutdoorCategory,
  normalizeCategory,
} from "./searchV2FamilyResults";

export {
  getCategoryLabel,
  getCautionByCategory,
  getReasonByCategory,
  getRoleLabelByCategory,
  getTagsByCategory,
  normalizeSearchV2ResultCard,
  normalizeSearchV2ResultCards,
} from "./searchV2CategoryCopy";

const EXCLUDED_CATEGORY_RE =
  /beauty|salon|hair|nail|interior|construction|tile|bk9|repair|hospital|pharmacy|laundry|convenience|미용|네일|헤어|인테리어|타일|공사|성형|피부|병원|약국|세탁|편의점|수리|생활/i;

/** family_default(추천) 모드에서 제외 — 야외/공원 칩에서만 허용 */
const FAMILY_DEFAULT_EXCLUDED_RE =
  /공원|수목원|야외|산책|문화|박물관|전시|park|arboretum|outdoor|exhibition|museum|culture|숲|둘레길|정원/i;

const FAMILY_DEFAULT_BLOCKED_NAME_RE =
  /양산제2소공원|물향기수목원|소공원|도시공원|근린공원|수목원/i;

const FAMILY_ALLOWED_CATEGORY_RE =
  /restaurant|cafe|activity|culture|kids|family|food|ce7|fd6|at4|식당|카페|키즈|가족|체험|문화|활동|놀이|박물관|도서관|음식|맛집|베이커리|커피/i;

const ROLE_ORDER: SearchV2RoleKey[] = ["safe", "mood", "nearby"];

export function detectSearchQueryIntent(query: string): SearchQueryIntent {
  const q = query.trim().toLowerCase();
  if (/아이랑|아이|가족|키즈|kids|family|유아|어린이/.test(q)) return "family";
  if (/데이트|date|커플|연인/.test(q)) return "date";
  if (/혼자|솔로|solo|나홀로/.test(q)) return "solo";
  if (/조용|한적|quiet|조용한/.test(q)) return "quiet";
  if (/주차|parking|발렛/.test(q)) return "parking";
  return "default";
}

export function isFamilyQuery(query: string): boolean {
  return detectSearchQueryIntent(query) === "family";
}

function toCard(t: FallbackTemplate): SearchV2ResultCard {
  return { ...t, roleLabel: t.role };
}

const FAMILY_FALLBACK: SearchV2ResultCard[] = familyDefaultFallbackResults;

const FAMILY_CHIP_FALLBACK: Record<Exclude<FamilyCategoryChip, "default">, SearchV2ResultCard[]> = {
  restaurant: [
    toCard({
      id: "fallback-family-r1",
      roleKey: "safe",
      role: "가장 무난한 선택",
      name: "아이랑 가기 좋은 가족 식당",
      description: "아이와 함께 편하게 식사하기 좋은 곳이에요.",
      tags: ["#아이동반", "#가족외식", "#무난한선택"],
      caution: "방문 전 영업정보와 대기 여부를 확인해 주세요.",
      category: "식당",
    }),
    toCard({
      id: "fallback-family-r2",
      roleKey: "mood",
      role: "분위기 좋은 선택",
      name: "아이 메뉴가 있는 식당",
      description: "아이도 함께 즐길 수 있는 메뉴가 준비된 식당이에요.",
      tags: ["#아이동반", "#식당", "#가족외식"],
      caution: "인기 시간대에는 대기가 있을 수 있어요.",
      category: "식당",
    }),
    toCard({
      id: "fallback-family-r3",
      roleKey: "nearby",
      role: "가까운 대안",
      name: "근처 가족 외식 식당",
      description: "이동 부담 없이 들르기 좋은 식당 대안이에요.",
      tags: ["#가까운곳", "#식당", "#아이동반"],
      caution: "정확한 거리는 길찾기에서 확인해 주세요.",
      category: "식당",
    }),
  ],
  cafe: [
    toCard({
      id: "fallback-family-c1",
      roleKey: "safe",
      role: "가장 무난한 선택",
      name: "아이랑 들르기 좋은 카페",
      description: "가족 나들이 후 가볍게 쉬어가기 좋은 카페예요.",
      tags: ["#아이랑", "#카페", "#무난한선택"],
      caution: "주말에는 혼잡할 수 있어요.",
      category: "카페",
    }),
    toCard({
      id: "fallback-family-c2",
      roleKey: "mood",
      role: "분위기 좋은 선택",
      name: "디저트 맛있는 카페",
      description: "아이와 함께 디저트 즐기기 좋은 분위기예요.",
      tags: ["#카페", "#디저트", "#분위기좋음"],
      caution: "좌석 상황은 매장마다 달라요.",
      category: "카페",
    }),
    toCard({
      id: "fallback-family-c3",
      roleKey: "nearby",
      role: "가까운 대안",
      name: "근처 브런치 카페",
      description: "가볍게 들르기 좋은 카페 대안이에요.",
      tags: ["#가까운곳", "#카페", "#아이랑"],
      caution: "영업시간을 미리 확인해 주세요.",
      category: "카페",
    }),
  ],
  indoor: [
    toCard({
      id: "fallback-family-i1",
      roleKey: "safe",
      role: "가장 무난한 선택",
      name: "근처 실내 체험 장소",
      description: "날씨와 상관없이 아이와 잠깐 들르기 좋아요.",
      tags: ["#실내활동", "#아이동반", "#무난한선택"],
      caution: "운영시간과 휴무일을 확인해 주세요.",
      category: "키즈/가족",
    }),
    toCard({
      id: "fallback-family-i2",
      roleKey: "mood",
      role: "분위기 좋은 선택",
      name: "아이 체험 프로그램 공간",
      description: "짧은 체험으로 아이와 함께 보내기 좋아요.",
      tags: ["#체험", "#실내", "#아이랑"],
      caution: "사전 예약이 필요할 수 있어요.",
      category: "키즈/가족",
    }),
    toCard({
      id: "fallback-family-i3",
      roleKey: "nearby",
      role: "가까운 대안",
      name: "근처 실내 놀거리",
      description: "이동 부담 없는 실내 대안이에요.",
      tags: ["#실내활동", "#대안", "#가까운곳"],
      caution: "혼잡 시간대를 피하면 더 편해요.",
      category: "키즈/가족",
    }),
  ],
  outdoor: [
    toCard({
      id: "fallback-family-o1",
      roleKey: "safe",
      role: "가장 무난한 선택",
      name: "아이랑 산책하기 좋은 공원",
      description: "가볍게 걸으며 쉬어가기 좋은 야외 공간이에요.",
      tags: ["#공원", "#야외", "#산책"],
      caution: "날씨와 바람을 확인해 주세요.",
      category: "공원",
    }),
    toCard({
      id: "fallback-family-o2",
      roleKey: "mood",
      role: "분위기 좋은 선택",
      name: "가족 나들이 공원",
      description: "넓은 공간에서 아이와 함께 시간 보내기 좋아요.",
      tags: ["#야외", "#가족", "#나들이"],
      caution: "주말에는 사람이 많을 수 있어요.",
      category: "공원",
    }),
    toCard({
      id: "fallback-family-o3",
      roleKey: "nearby",
      role: "가까운 대안",
      name: "근처 산책로",
      description: "짧게 걸으며 쉬어가기 좋은 야외 대안이에요.",
      tags: ["#가까운곳", "#산책", "#야외"],
      caution: "일몰 전 방문을 추천해요.",
      category: "공원",
    }),
  ],
  kidscafe: [
    toCard({
      id: "fallback-family-k1",
      roleKey: "safe",
      role: "가장 무난한 선택",
      name: "아이랑 가기 좋은 키즈카페",
      description: "아이가 놀기 좋고 부모도 잠깐 쉴 수 있는 공간이에요.",
      tags: ["#키즈카페", "#아이동반", "#무난한선택"],
      caution: "혼잡 시간대와 이용 시간을 확인해 주세요.",
      category: "키즈카페",
    }),
    toCard({
      id: "fallback-family-k2",
      roleKey: "mood",
      role: "분위기 좋은 선택",
      name: "실내 놀이 키즈카페",
      description: "날씨 걱정 없이 아이와 보내기 좋아요.",
      tags: ["#키즈카페", "#실내", "#놀이"],
      caution: "양말 등 준비물을 확인해 주세요.",
      category: "키즈카페",
    }),
    toCard({
      id: "fallback-family-k3",
      roleKey: "nearby",
      role: "가까운 대안",
      name: "근처 키즈 놀이 카페",
      description: "가까운 거리의 키즈카페 대안이에요.",
      tags: ["#키즈카페", "#가까운곳", "#대안"],
      caution: "예약·입장 제한을 확인해 주세요.",
      category: "키즈카페",
    }),
  ],
};

const DATE_FALLBACK: SearchV2ResultCard[] = [
  toCard({
    id: "fallback-date-safe",
    roleKey: "safe",
    role: "가장 무난한 선택",
    name: "데이트하기 좋은 식당",
    description: "부담 없이 대화하기 좋은 분위기의 식당이에요.",
    tags: ["#데이트", "#식당", "#무난한선택"],
    caution: "방문 전 영업정보와 예약 가능 여부를 확인해 주세요.",
    category: "식당",
  }),
  toCard({
    id: "fallback-date-mood",
    roleKey: "mood",
    role: "분위기 좋은 선택",
    name: "분위기 좋은 카페",
    description: "데이트 후 들르기 좋은 감성 카페예요.",
    tags: ["#데이트", "#카페", "#분위기좋음"],
    caution: "저녁 시간대에는 혼잡할 수 있어요.",
    category: "카페",
  }),
  toCard({
    id: "fallback-date-nearby",
    roleKey: "nearby",
    role: "가까운 대안",
    name: "근처 산책·문화 스팟",
    description: "식사 전후에 가볍게 들를 수 있는 대안이에요.",
    tags: ["#가까운곳", "#산책", "#대안"],
    caution: "운영 시간은 방문 전 확인해 주세요.",
    category: "문화",
  }),
];

const SOLO_FB: SearchV2ResultCard[] = [
  toCard({
    id: "fallback-solo-safe",
    roleKey: "safe",
    role: "가장 무난한 선택",
    name: "혼자 가기 좋은 카페",
    description: "혼자 앉아도 부담 없는 좌석과 분위기예요.",
    tags: ["#혼자", "#카페", "#무난한선택"],
    caution: "콘센트·와이파이는 매장마다 다를 수 있어요.",
    category: "카페",
  }),
  toCard({
    id: "fallback-solo-mood",
    roleKey: "mood",
    role: "분위기 좋은 선택",
    name: "혼자 식사하기 좋은 식당",
    description: "혼밥하기 편한 메뉴와 좌석이 있는 곳이에요.",
    tags: ["#혼자", "#식당", "#분위기좋음"],
    caution: "피크 시간대 대기가 있을 수 있어요.",
    category: "식당",
  }),
  toCard({
    id: "fallback-solo-nearby",
    roleKey: "nearby",
    role: "가까운 대안",
    name: "근처 조용한 공간",
    description: "잠깐 쉬어가기 좋은 가까운 대안이에요.",
    tags: ["#가까운곳", "#혼자", "#대안"],
    caution: "정확한 거리는 길찾기에서 확인해 주세요.",
    category: "카페",
  }),
];

const QUIET_FB: SearchV2ResultCard[] = [
  toCard({
    id: "fallback-quiet-safe",
    roleKey: "safe",
    role: "가장 무난한 선택",
    name: "조용히 쉬기 좋은 카페",
    description: "대화·독서하기 좋은 한적한 분위기예요.",
    tags: ["#조용한곳", "#카페", "#무난한선택"],
    caution: "주말 오후에는 조금 붐빌 수 있어요.",
    category: "카페",
  }),
  toCard({
    id: "fallback-quiet-mood",
    roleKey: "mood",
    role: "분위기 좋은 선택",
    name: "조용한 식사 공간",
    description: "소음이 적어 편하게 식사하기 좋아요.",
    tags: ["#조용한곳", "#식당", "#분위기좋음"],
    caution: "예약 가능 여부를 확인해 주세요.",
    category: "식당",
  }),
  toCard({
    id: "fallback-quiet-nearby",
    roleKey: "nearby",
    role: "가까운 대안",
    name: "근처 도서관·전시 공간",
    description: "실내에서 조용히 시간 보내기 좋은 대안이에요.",
    tags: ["#실내", "#조용한곳", "#대안"],
    caution: "휴관일을 미리 확인해 주세요.",
    category: "문화",
  }),
];

const PARKING_FB: SearchV2ResultCard[] = [
  toCard({
    id: "fallback-parking-safe",
    roleKey: "safe",
    role: "가장 무난한 선택",
    name: "주차 편한 식당",
    description: "방문객 주차가 비교적 수월한 식당이에요.",
    tags: ["#주차편함", "#식당", "#무난한선택"],
    caution: "주차 요금·자리는 매장마다 달라요.",
    category: "식당",
  }),
  toCard({
    id: "fallback-parking-mood",
    roleKey: "mood",
    role: "분위기 좋은 선택",
    name: "주차 편한 카페",
    description: "근교 나들이 때 들르기 좋은 카페예요.",
    tags: ["#주차편함", "#카페", "#분위기좋음"],
    caution: "주말에는 주차가 어려울 수 있어요.",
    category: "카페",
  }),
  toCard({
    id: "fallback-parking-nearby",
    roleKey: "nearby",
    role: "가까운 대안",
    name: "근처 주차 가능한 장소",
    description: "차량 이동 시 부담 적은 가까운 대안이에요.",
    tags: ["#주차편함", "#가까운곳", "#대안"],
    caution: "정확한 주차 안내는 방문 전 확인해 주세요.",
    category: "식당",
  }),
];

const DEFAULT_FB: SearchV2ResultCard[] = [
  toCard({
    id: "fallback-default-safe",
    roleKey: "safe",
    role: "가장 무난한 선택",
    name: "무난한 추천 장소",
    description: "상황에 맞게 가볍게 들르기 좋은 곳이에요.",
    tags: ["#추천", "#무난한선택", "#하마추천"],
    caution: "방문 전 영업정보를 확인해 주세요.",
    category: "식당",
  }),
  toCard({
    id: "fallback-default-mood",
    roleKey: "mood",
    role: "분위기 좋은 선택",
    name: "분위기 좋은 추천 장소",
    description: "기분 전환하기 좋은 분위기의 장소예요.",
    tags: ["#분위기좋음", "#추천", "#하마추천"],
    caution: "혼잡 시간대를 피하면 더 편해요.",
    category: "카페",
  }),
  toCard({
    id: "fallback-default-nearby",
    roleKey: "nearby",
    role: "가까운 대안",
    name: "근처 대안 장소",
    description: "현재 위치 기준으로 가볍게 들르기 좋은 대안이에요.",
    tags: ["#가까운곳", "#대안", "#하마추천"],
    caution: "정확한 거리는 길찾기에서 확인해 주세요.",
    category: "식당",
  }),
];

export function buildFallbackSearchV2Results(
  query: string,
  chip: FamilyCategoryChip = "default"
): SearchV2ResultCard[] {
  const intent = detectSearchQueryIntent(query);
  if (intent === "family") {
    if (chip !== "default") return FAMILY_CHIP_FALLBACK[chip];
    return FAMILY_FALLBACK;
  }
  switch (intent) {
    case "date":
      return DATE_FALLBACK;
    case "solo":
      return SOLO_FB;
    case "quiet":
      return QUIET_FB;
    case "parking":
      return PARKING_FB;
    default:
      return DEFAULT_FB;
  }
}

function storeHaystack(row: StoreRow): string {
  const parts = [row.category, row.name, row.description, ...(Array.isArray(row.tags) ? row.tags : [])];
  return parts.map((p) => String(p ?? "").toLowerCase()).join(" ");
}

export function classifyStoreBucket(row: StoreRow): StoreCategoryBucket {
  const hay = storeHaystack(row);
  if (/키즈카페|키즈 카페|kidscafe|kids cafe|키즈 놀이/.test(hay)) return "kidscafe";
  if (/공원|수목원|park|arboretum|야외|산책|숲|둘레길|정원|outdoor/.test(hay)) return "outdoor";
  if (/restaurant|food|fd6|식당|음식|맛집|한식|분식|레스토랑|일식|중식|양식/.test(hay)) return "restaurant";
  if (/cafe|ce7|카페|커피|베이커리|디저트|브런치/.test(hay)) return "cafe";
  if (/kids|키즈|가족|체험|activity|at4|놀이|실내|문화|박물관|도서관|키자|미니어처|miniature|전시/.test(hay))
    return "kids_indoor";
  return "other";
}

function isMiniatureVillage(row: StoreRow): boolean {
  return /미니어처|miniature/i.test(storeHaystack(row));
}

/** family_default(추천) 기본 결과에서 제외할 장소 */
export function isFamilyDefaultExcluded(row: StoreRow): boolean {
  const hay = storeHaystack(row);
  if (EXCLUDED_CATEGORY_RE.test(hay)) return true;
  if (FAMILY_DEFAULT_BLOCKED_NAME_RE.test(hay)) return true;
  const bucket = classifyStoreBucket(row);
  if (bucket === "outdoor") return true;
  if (bucket === "kidscafe" || bucket === "kids_indoor" || isMiniatureVillage(row)) return false;
  if (FAMILY_DEFAULT_EXCLUDED_RE.test(hay)) return true;
  return false;
}

/** family_default 점수 — 높을수록 우선 */
export function scoreStoreForFamilyDefault(row: StoreRow): number {
  if (isFamilyDefaultExcluded(row)) return -999;
  const hay = storeHaystack(row);
  const bucket = classifyStoreBucket(row);
  let score = 0;
  if (bucket === "restaurant" || /restaurant|food|fd6|식당|음식|맛집/.test(hay)) score += 100;
  if (bucket === "cafe" || /cafe|ce7|카페|커피/.test(hay)) score += 90;
  if (bucket === "kidscafe" || /키즈카페|kidscafe/.test(hay)) score += 85;
  if (bucket === "kids_indoor" || /kids|family|indoor|activity|at4|체험|키즈|가족/.test(hay)) score += 80;
  if (isMiniatureVillage(row)) score = Math.min(score, 65);
  if (bucket === "outdoor" || /공원|수목원|park|outdoor|야외|산책/.test(hay)) score -= 50;
  if (/문화|박물관|exhibition|전시|museum|culture/.test(hay)) score -= 30;
  return score;
}

function filterFamilyDefaultPool(pool: StoreRow[]): StoreRow[] {
  return pool.filter((row) => {
    if (!row?.name || !String(row.name).trim()) return false;
    return !isFamilyDefaultExcluded(row);
  });
}

function sortByFamilyDefaultScore(pool: StoreRow[]): StoreRow[] {
  return [...pool].sort((a, b) => scoreStoreForFamilyDefault(b) - scoreStoreForFamilyDefault(a));
}

function isIndoorExperienceRow(row: StoreRow): boolean {
  if (isExcludedCategoryForQuery(row, "family")) return false;
  const bucket = classifyStoreBucket(row);
  if (bucket === "kidscafe" || bucket === "kids_indoor") return true;
  const hay = storeHaystack(row);
  if (bucket === "outdoor" || FAMILY_DEFAULT_BLOCKED_NAME_RE.test(hay)) return false;
  return /문화|박물관|전시|체험|실내|activity|at4|도서관|미니어처|miniature/.test(hay);
}

function isOutdoorRow(row: StoreRow): boolean {
  const bucket = classifyStoreBucket(row);
  if (bucket === "outdoor") return true;
  return /공원|수목원|산책|park|arboretum|야외/.test(storeHaystack(row));
}

export function isExcludedCategoryForQuery(row: StoreRow, intent: SearchQueryIntent): boolean {
  const hay = storeHaystack(row);
  if (EXCLUDED_CATEGORY_RE.test(hay)) return true;
  if (intent !== "family") return false;
  if (FAMILY_ALLOWED_CATEGORY_RE.test(hay)) return false;
  const cat = String(row.category ?? "").trim().toLowerCase();
  if (!cat) return EXCLUDED_CATEGORY_RE.test(String(row.name ?? ""));
  return true;
}

export function filterStoresForQuery(stores: StoreRow[], query: string): StoreRow[] {
  const intent = detectSearchQueryIntent(query);
  return stores.filter((row) => {
    if (!row?.name || !String(row.name).trim()) return false;
    return !isExcludedCategoryForQuery(row, intent);
  });
}

function pickLatLng(row: StoreRow): { lat: number | null; lng: number | null } {
  const lat = row.lat ?? row.latitude ?? null;
  const lng = row.lng ?? row.longitude ?? null;
  return {
    lat: typeof lat === "number" && Number.isFinite(lat) ? lat : null,
    lng: typeof lng === "number" && Number.isFinite(lng) ? lng : null,
  };
}

function storeToCard(row: StoreRow, roleLabel: string, query: string): SearchV2ResultCard {
  return enrichResultByCategory(row, roleLabel, query);
}

function finalizeCards(cards: SearchV2ResultCard[], query: string): SearchV2ResultCard[] {
  return normalizeSearchV2ResultCards(cards, query);
}

function buildFamilyChipCards(
  pool: StoreRow[],
  chip: Exclude<FamilyCategoryChip, "default">,
  query: string
): SearchV2ResultCard[] {
  const templates = FAMILY_CHIP_FALLBACK[chip];
  let matched: StoreRow[];
  switch (chip) {
    case "restaurant":
      matched = pool.filter((r) => !isExcludedForFamilyDefault(classifyRowCategorySafe(r)) && isFoodCategory(classifyRowCategorySafe(r)));
      break;
    case "cafe":
      matched = pool.filter((r) => !isExcludedForFamilyDefault(classifyRowCategorySafe(r)) && isCafeCategory(classifyRowCategorySafe(r)));
      break;
    case "kidscafe":
      matched = pool.filter((r) => {
        const c = classifyRowCategorySafe(r);
        return !isExcludedForFamilyDefault(c) && /키즈카페|kidscafe|kids cafe/.test(`${c} ${r.name ?? ""}`.toLowerCase());
      });
      break;
    case "indoor":
      matched = pool.filter(isIndoorExperienceRow);
      break;
    case "outdoor":
      matched = pool.filter((r) => !isExcludedForFamilyDefault(classifyRowCategorySafe(r)) && isOutdoorRow(r));
      break;
    default:
      matched = [];
  }
  return ROLE_ORDER.map((_, idx) => {
    const template = templates[idx]!;
    const row = matched[idx];
    return row?.name
      ? enrichResultByCategory(row, template.roleLabel, query)
      : normalizeSearchV2ResultCard(template, query);
  });
}

function classifyRowCategorySafe(row: StoreRow): string {
  return row.category ? String(row.category) : "";
}

export function buildCardsFromPool(
  pool: StoreRow[],
  query: string,
  chip: FamilyCategoryChip = "default"
): { cards: SearchV2ResultCard[]; source: "api" | "mock" } {
  const intent = detectSearchQueryIntent(query);
  const filtered = filterStoresForQuery(pool, query);

  if (intent === "family") {
    if (chip === "default") {
      const cards = buildFamilyDefaultResults(pool, query);
      return { cards, source: familyResultsUseApi(cards) ? ("api" as const) : ("mock" as const) };
    }
    let chipMatched: StoreRow[];
    switch (chip) {
      case "restaurant":
        chipMatched = pool.filter(
          (r) => !isExcludedForFamilyDefault(classifyRowCategorySafe(r)) && isFoodCategory(classifyRowCategorySafe(r))
        );
        break;
      case "cafe":
        chipMatched = pool.filter(
          (r) => !isExcludedForFamilyDefault(classifyRowCategorySafe(r)) && isCafeCategory(classifyRowCategorySafe(r))
        );
        break;
      case "kidscafe":
        chipMatched = pool.filter((r) => {
          const c = classifyRowCategorySafe(r);
          return !isExcludedForFamilyDefault(c) && /키즈카페|kidscafe|kids cafe/.test(`${c} ${r.name ?? ""}`.toLowerCase());
        });
        break;
      case "indoor":
        chipMatched = pool.filter(isIndoorExperienceRow);
        break;
      case "outdoor":
        chipMatched = pool.filter((r) => !isExcludedForFamilyDefault(classifyRowCategorySafe(r)) && isOutdoorRow(r));
        break;
      default:
        chipMatched = [];
    }
    if (chipMatched.length >= 1) return { cards: buildFamilyChipCards(chipMatched, chip, query), source: "api" as const };
    return { cards: finalizeCards(FAMILY_CHIP_FALLBACK[chip], query), source: "mock" as const };
  }

  const fallback = buildFallbackSearchV2Results(query);
  if (filtered.length >= 1) {
    const roleLabels = ["가장 무난한 선택", "분위기 좋은 선택", "가까운 대안"];
    return {
      cards: ROLE_ORDER.map((_, idx) => {
        const template = fallback[idx]!;
        const row = filtered[idx];
        return row?.name
          ? storeToCard(row, roleLabels[idx] ?? template.roleLabel, query)
          : normalizeSearchV2ResultCard(template, query);
      }),
      source: "api" as const,
    };
  }
  return { cards: finalizeCards(fallback, query), source: "mock" as const };
}

async function fetchJsonItems(url: string): Promise<StoreRow[]> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: StoreRow[] };
    return Array.isArray(json?.items) ? json.items : [];
  } catch {
    return [];
  }
}

function dedupeStores(stores: StoreRow[]): StoreRow[] {
  const seen = new Set<string>();
  const out: StoreRow[] = [];
  for (const row of stores) {
    const key = String(row.id ?? row.name ?? "").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function fetchStorePool(query: string): Promise<StoreRow[]> {
  const intent = detectSearchQueryIntent(query);
  const q = query.trim();

  if (intent === "family") {
    const [restaurants, cafes, activities] = await Promise.all([
      fetchJsonItems("/api/home-recommend?tab=restaurant&count=15"),
      fetchJsonItems("/api/home-recommend?tab=cafe&count=15"),
      fetchJsonItems("/api/home-recommend?tab=activity&count=15"),
    ]);
    const tagged: StoreRow[] = [
      ...restaurants.map((r) => ({ ...r, category: r.category || "restaurant" })),
      ...cafes.map((r) => ({ ...r, category: r.category || "cafe" })),
      ...activities.map((r) => ({ ...r, category: r.category || "activity" })),
    ];
    return dedupeStores(tagged);
  }

  const tab =
    intent === "date" || intent === "solo" ? "cafe" : intent === "parking" ? "restaurant" : "all";
  const items = await fetchJsonItems(`/api/home-recommend?tab=${encodeURIComponent(tab)}&count=20`);
  const filtered = filterStoresForQuery(items, q);
  if (filtered.length >= 1) return dedupeStores(filtered);

  if (q) {
    try {
      const res = await fetch(`/api/places/search?query=${encodeURIComponent(q)}`, { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as {
          items?: { id?: string; name?: string; x?: number; y?: number; category_name?: string }[];
        };
        const mapped: StoreRow[] = (Array.isArray(json?.items) ? json.items : []).map((it) => ({
          id: it.id,
          name: it.name,
          lat: typeof it.y === "number" ? it.y : null,
          lng: typeof it.x === "number" ? it.x : null,
          category: it.category_name ?? "place",
        }));
        const filtered = filterStoresForQuery(mapped, q);
        if (filtered.length >= 1) return dedupeStores(filtered);
      }
    } catch {
      /* ignore */
    }
  }

  return [];
}

export async function fetchSearchV2Results(
  query: string,
  chip: FamilyCategoryChip = "default"
): Promise<SearchV2FetchResult> {
  const q = query.trim();
  const intent = detectSearchQueryIntent(q);
  const pool = q ? await fetchStorePool(q) : [];
  const { cards, source } = buildCardsFromPool(pool, q || "추천", chip);
  return { cards, source, pool, intent };
}

export const FAMILY_CATEGORY_CHIPS: { id: FamilyCategoryChip; label: string }[] = [
  { id: "default", label: "추천" },
  { id: "restaurant", label: "식당" },
  { id: "cafe", label: "카페" },
  { id: "kidscafe", label: "키즈카페" },
  { id: "indoor", label: "실내놀거리" },
  { id: "outdoor", label: "야외/공원" },
];

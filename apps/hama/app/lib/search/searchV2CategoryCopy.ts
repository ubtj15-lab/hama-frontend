import type { SearchV2ResultCard, StoreRow } from "./searchV2Results";

export type SearchCategoryKind = "restaurant" | "cafe" | "kidscafe" | "activity" | "outdoor" | "other";

function isFamilyQuery(query: string): boolean {
  return /아이|가족|키즈|kids|family|유아|어린이/.test(query.trim().toLowerCase());
}

function categoryHaystack(
  category?: string | null,
  hints?: Pick<StoreRow, "name" | "description" | "tags">
): string {
  const parts = [category, hints?.name, hints?.description, ...(Array.isArray(hints?.tags) ? hints.tags : [])];
  return parts.map((p) => String(p ?? "").toLowerCase()).join(" ");
}

export function resolveSearchCategoryKind(
  category?: string | null,
  hints?: Pick<StoreRow, "name" | "description" | "tags">
): SearchCategoryKind {
  const raw = String(category ?? "").trim().toLowerCase();
  if (raw === "activity" || raw === "at4") return "activity";
  if (raw === "fd6" || raw === "restaurant" || raw === "food") return "restaurant";
  if (raw === "ce7" || raw === "cafe") return "cafe";
  if (raw === "kids" || raw === "family" || raw === "kidscafe") return "kidscafe";
  if (raw === "park" || raw === "outdoor") return "outdoor";

  const hay = categoryHaystack(category, hints);
  if (/키즈카페|kidscafe|kids cafe|키즈 놀이/.test(hay)) return "kidscafe";
  if (/공원|수목원|park|outdoor|arboretum|야외|산책|숲|둘레길|정원/.test(hay)) return "outdoor";
  if (/restaurant|food|fd6|식당|음식|맛집|한식|분식|레스토랑/.test(hay)) return "restaurant";
  if (/cafe|ce7|카페|커피|베이커리|디저트|브런치/.test(hay)) return "cafe";
  if (/^kids$|^family$|키즈\/가족|키즈|가족/.test(hay) && !/activity|체험|at4/.test(hay)) return "kidscafe";
  if (/activity|at4|체험|실내활동|실내|놀이|문화|박물관|전시|미니어처|miniature/.test(hay)) return "activity";
  return "other";
}

export function getCategoryLabel(category?: string | null, hints?: Pick<StoreRow, "name" | "description" | "tags">): string {
  const kind = resolveSearchCategoryKind(category, hints);
  switch (kind) {
    case "restaurant":
      return "식당";
    case "cafe":
      return "카페";
    case "kidscafe":
      return "키즈/가족";
    case "activity":
      return "액티비티";
    case "outdoor":
      return "야외/공원";
    default: {
      const raw = String(category ?? "").trim();
      if (!raw) return "추천";
      if (/^fd6$/i.test(raw)) return "식당";
      if (/^ce7$/i.test(raw)) return "카페";
      if (/^at4$/i.test(raw)) return "액티비티";
      return raw;
    }
  }
}

export function getReasonByCategory(
  category?: string | null,
  query = "",
  hints?: Pick<StoreRow, "name" | "description" | "tags">
): string {
  const kind = resolveSearchCategoryKind(category, hints);
  const family = isFamilyQuery(query);

  switch (kind) {
    case "restaurant":
      return family
        ? "아이와 함께 편하게 식사하기 좋은 곳이에요."
        : "편하게 식사하기 좋은 곳이에요.";
    case "cafe":
      return family
        ? "가족 나들이 후 가볍게 쉬어가기 좋은 카페예요."
        : "가볍게 쉬어가기 좋은 카페예요.";
    case "kidscafe":
      return "아이와 함께 놀기 좋은 키즈 공간이에요.";
    case "activity":
      return "아이와 함께 가볍게 놀거나 체험하기 좋은 곳이에요.";
    case "outdoor":
      return "아이와 함께 산책하거나 잠깐 들르기 좋은 야외 장소예요.";
    default:
      return family
        ? "아이와 함께 들르기 좋은 곳이에요."
        : "상황에 맞게 가볍게 들르기 좋은 곳이에요.";
  }
}

export function getTagsByCategory(
  category?: string | null,
  _query = "",
  hints?: Pick<StoreRow, "name" | "description" | "tags">
): string[] {
  const kind = resolveSearchCategoryKind(category, hints);
  switch (kind) {
    case "restaurant":
      return ["#아이동반", "#가족외식", "#무난한선택"];
    case "cafe":
      return ["#아이랑", "#카페", "#분위기좋음"];
    case "kidscafe":
      return ["#키즈카페", "#아이동반", "#실내활동"];
    case "activity":
      return ["#아이동반", "#실내활동", "#체험"];
    case "outdoor":
      return ["#야외", "#산책", "#아이동반"];
    default:
      return ["#추천", "#하마추천"];
  }
}

export function getCautionByCategory(
  category?: string | null,
  hints?: Pick<StoreRow, "name" | "description" | "tags">
): string {
  const kind = resolveSearchCategoryKind(category, hints);
  switch (kind) {
    case "restaurant":
      return "방문 전 영업정보와 대기 여부를 확인해 주세요.";
    case "cafe":
      return "주말에는 혼잡할 수 있어요.";
    case "kidscafe":
      return "이용요금과 운영시간은 방문 전 확인해 주세요.";
    case "activity":
      return "운영시간과 예약 필요 여부를 확인해 주세요.";
    case "outdoor":
      return "날씨와 주차 가능 여부를 확인해 주세요.";
    default:
      return "방문 전 영업정보를 확인해 주세요.";
  }
}

export function getRoleLabelByCategory(
  category?: string | null,
  hints?: Pick<StoreRow, "name" | "description" | "tags">
): string {
  const kind = resolveSearchCategoryKind(category, hints);
  switch (kind) {
    case "restaurant":
      return "가장 무난한 선택";
    case "cafe":
      return "분위기 좋은 선택";
    case "kidscafe":
    case "activity":
      return "아이랑 놀기 좋은 선택";
    case "outdoor":
      return "야외 대안";
    default:
      return "추천";
  }
}

function roleKeyFromLabel(label: string): SearchV2ResultCard["roleKey"] {
  if (label === "가장 무난한 선택") return "safe";
  if (label === "분위기 좋은 선택") return "mood";
  if (label === "야외 대안" || label === "아이랑 놀기 좋은 선택" || label === "가까운 대안") return "nearby";
  return "safe";
}

/** API/DB 결과·fallback 카드의 category와 설명·태그·주의문구를 일치시킴 */
export function normalizeSearchV2ResultCard(
  card: SearchV2ResultCard,
  query: string,
  row?: StoreRow
): SearchV2ResultCard {
  const hints: Pick<StoreRow, "name" | "description" | "tags"> = row ?? {
    name: card.name,
    description: card.description,
    tags: card.tags,
  };
  const rawCategory = row?.category ?? card.category;
  const categoryLabel = getCategoryLabel(rawCategory, hints);
  const roleLabel = getRoleLabelByCategory(rawCategory, hints);
  const kind = resolveSearchCategoryKind(rawCategory, hints);

  // mock fallback(이름이 템플릿 문구)은 기존 description 유지, DB 실제 장소는 category 기준 copy
  const isMockPlaceholder = /^fallback-/.test(card.id);
  const useCategoryCopy = !isMockPlaceholder || kind !== "other";

  return {
    ...card,
    category: rawCategory ? String(rawCategory) : card.category,
    categoryLabel,
    roleLabel,
    role: roleLabel,
    roleKey: roleKeyFromLabel(roleLabel),
    description: useCategoryCopy ? getReasonByCategory(rawCategory, query, hints) : card.description,
    tags: useCategoryCopy ? getTagsByCategory(rawCategory, query, hints) : card.tags,
    caution: useCategoryCopy ? getCautionByCategory(rawCategory, hints) : card.caution,
  };
}

export function normalizeSearchV2ResultCards(
  cards: SearchV2ResultCard[],
  query: string,
  rowById?: Map<string, StoreRow>
): SearchV2ResultCard[] {
  return cards.map((card) => normalizeSearchV2ResultCard(card, query, rowById?.get(card.id)));
}

import type { HomeCard } from "@/lib/storeTypes";

export type KidVenueFieldParts = {
  name?: string | null;
  category?: string | null;
  tags?: readonly string[] | null;
  mood?: readonly string[] | null;
  description?: string | null;
};

/**
 * 이름·카테고리·태그·설명·무드에 드러난 키즈 전용 브랜딩 (가중치·부스트용, 비교적 보수적).
 */
export function isKidFocusedVenueFields(parts: KidVenueFieldParts): boolean {
  const cat = String(parts.category ?? "").toLowerCase();
  if (cat.includes("키즈카페")) return true;
  const name = String(parts.name ?? "").toLowerCase();
  if (name.includes("키즈")) return true;
  const tags = (parts.tags ?? []).map((t) => String(t).toLowerCase());
  if (tags.some((t) => t.includes("키즈카페"))) return true;
  const moodBlob = (parts.mood ?? []).join(" ").toLowerCase();
  const desc = String(parts.description ?? "").toLowerCase();
  if (/키즈카페|키즈룸|키즈존/.test(moodBlob) || /키즈카페|키즈룸|키즈존/.test(desc)) return true;
  return false;
}

export function isKidFocusedVenue(card: HomeCard): boolean {
  return isKidFocusedVenueFields({
    name: card.name,
    category: card.category,
    tags: card.tags,
    mood: card.mood,
    description: card.description,
  });
}

export type KidVenueExcludeParts = KidVenueFieldParts & {
  with_kids?: boolean | null;
};

/**
 * 설문 영유아 자녀 "없음"일 때 후보에서 제외할 키즈 성격 매장.
 * - 기존 키즈 브랜딩 휴리스틱
 * - 또는 with_kids이면서 명백한 키즈·놀이 시설 키워드(일반 가족식당 과필터 방지)
 */
export function isKidVenueExcludedWhenNoYoungChildFromParts(parts: KidVenueExcludeParts): boolean {
  if (
    isKidFocusedVenueFields({
      name: parts.name,
      category: parts.category,
      tags: parts.tags,
      mood: parts.mood,
      description: parts.description,
    })
  ) {
    return true;
  }
  if (parts.with_kids !== true) return false;
  const blob = [
    parts.name,
    parts.category,
    ...(parts.tags ?? []),
    ...(parts.mood ?? []),
    parts.description ?? "",
  ]
    .join(" ")
    .toLowerCase();
  if (
    /키즈카페|키즈룸|키즈존|키즈놀이|키즈\s*카페|키즈\s*놀이|놀이카페|실내놀이터|실내\s*놀이|indoor\s*play/.test(
      blob
    )
  ) {
    return true;
  }
  return false;
}

export function isKidVenueExcludedWhenNoYoungChild(card: HomeCard): boolean {
  const c = card as { with_kids?: boolean | null };
  return isKidVenueExcludedWhenNoYoungChildFromParts({
    name: card.name,
    category: card.category,
    tags: card.tags,
    mood: card.mood,
    description: card.description,
    with_kids: c.with_kids ?? null,
  });
}

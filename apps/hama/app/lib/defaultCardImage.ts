// app/lib/defaultCardImage.ts
import type { HomeCard } from "@/lib/storeTypes";

/**
 * ✅ public/images/category 아래 파일명 기준 매핑
 *
 * - restaurant.jpg              (기본/분류 못한 식당)
 * - restaurant-korean.jpg
 * - restaurant-chinese.jpg
 * - restaurant-japanese.jpg
 * - restaurant-western.jpg
 * - cafe.jpg
 * - activity.jpg
 * - museum.jpg
 * - salon.jpg
 * - park.png
 */

export const DEFAULT_CARD_IMAGES = {
  restaurant: "/images/category/restaurant.jpg",
  restaurant_korean: "/images/category/restaurant-korean.jpg",
  restaurant_chinese: "/images/category/restaurant-chinese.jpg",
  restaurant_japanese: "/images/category/restaurant-japanese.jpg",
  restaurant_western: "/images/category/restaurant-western.jpg",

  cafe: "/images/category/cafe.jpg",
  activity: "/images/category/activity.jpg",
  museum: "/images/category/museum.jpg",
  salon: "/images/category/salon.jpg",
  park: "/images/category/park.png",
} as const;

function normalizeText(v?: string | null) {
  return (v ?? "").trim().toLowerCase();
}

function hasAny(str: string, keywords: string[]) {
  return keywords.some((k) => str.includes(k));
}

/** 레스토랑 세부분류 추정 */
export function inferRestaurantSubtype(
  card: Partial<HomeCard>
): keyof typeof DEFAULT_CARD_IMAGES {
  const anyCard = card as any;

  const name = normalizeText(anyCard?.name);
  const categoryLabel = normalizeText(anyCard?.categoryLabel);
  const moodText = normalizeText(anyCard?.moodText);
  const mood = Array.isArray(anyCard?.mood) ? (anyCard.mood as string[]).join(" ") : "";
  const tags = Array.isArray(anyCard?.tags) ? (anyCard.tags as string[]).join(" ") : "";

  const blob = `${name} ${categoryLabel} ${moodText} ${normalizeText(mood)} ${normalizeText(tags)}`;

  if (
    hasAny(blob, ["한식", "국밥", "백반", "김치", "삼겹", "갈비", "찌개", "비빔", "냉면", "분식", "족발", "보쌈"])
  ) {
    return "restaurant_korean";
  }
  if (hasAny(blob, ["중식", "짜장", "짬뽕", "탕수", "마라", "훠궈", "딤섬", "양꼬치"])) {
    return "restaurant_chinese";
  }
  if (hasAny(blob, ["일식", "초밥", "스시", "라멘", "돈까스", "우동", "사시미", "이자카야", "규카츠"])) {
    return "restaurant_japanese";
  }
  if (hasAny(blob, ["양식", "파스타", "스테이크", "피자", "브런치", "그릴", "바베큐", "버거", "샌드위치"])) {
    return "restaurant_western";
  }

  // 기본 식당 이미지
  return "restaurant";
}

/** 카드에 이미지가 없으면 기본 이미지 반환 */
export function getDefaultCardImage(card: Partial<HomeCard>): string {
  const anyCard = card as any;

  const existing =
    (anyCard.imageUrl as string | undefined) ||
    (anyCard.image_url as string | undefined) ||
    (anyCard.image as string | undefined) ||
    (anyCard.imageURL as string | undefined);

  if (existing && typeof existing === "string" && existing.trim().length > 0) return existing;

  const category = normalizeText(anyCard.category as string);

  if (category === "cafe") return DEFAULT_CARD_IMAGES.cafe;
  if (category === "salon") return DEFAULT_CARD_IMAGES.salon;

  if (category === "activity") {
    const blob = `${normalizeText(anyCard.name)} ${normalizeText(anyCard.categoryLabel)} ${
      Array.isArray(anyCard.tags) ? normalizeText(anyCard.tags.join(" ")) : ""
    } ${normalizeText(anyCard.moodText)}`;

    if (hasAny(blob, ["박물관", "전시", "미술관", "갤러리", "museum"])) return DEFAULT_CARD_IMAGES.museum;
    if (hasAny(blob, ["공원", "산책", "park"])) return DEFAULT_CARD_IMAGES.park;

    return DEFAULT_CARD_IMAGES.activity;
  }

  // restaurant or unknown
  const sub = inferRestaurantSubtype(card);
  return DEFAULT_CARD_IMAGES[sub];
}

/** 카드 객체에 imageUrl / image_url 둘 다 확정 주입 */
export function applyDefaultImage<T extends Partial<HomeCard>>(card: T): T {
  const img = getDefaultCardImage(card);
  const anyCard = card as any;

  if (!anyCard.imageUrl) anyCard.imageUrl = img;
  if (!anyCard.image_url) anyCard.image_url = img;

  return card;
}

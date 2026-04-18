import type { HomeCard } from "@/lib/storeTypes";
import type { CourseStop } from "@/lib/scenarioEngine/types";

/**
 * 코스에 넣을 때 추천 카드와 동일 데이터를 세션에 보존(결과 화면 고정 렌더용).
 */
export function snapshotHomeCardForCourse(p: HomeCard): HomeCard {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    categoryLabel: p.categoryLabel,
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    phone: p.phone ?? null,
    address: p.address ?? null,
    area: p.area ?? null,
    image_url: p.image_url ?? (p as { imageUrl?: string }).imageUrl ?? null,
    imageUrl: (p as { imageUrl?: string }).imageUrl ?? p.image_url ?? null,
    mood: p.mood,
    tags: p.tags,
    description: p.description ?? null,
    menu_keywords: p.menu_keywords,
    distanceKm: p.distanceKm,
    with_kids: p.with_kids,
    for_work: p.for_work,
    reservation_required: p.reservation_required,
    price_level: p.price_level,
    kakao_place_url: p.kakao_place_url,
    naver_place_id: p.naver_place_id,
    placeUrl: p.placeUrl,
  };
}

function categoryFromPlaceType(placeType: CourseStop["placeType"]): string {
  switch (placeType) {
    case "CAFE":
      return "cafe";
    case "ACTIVITY":
    case "CULTURE":
    case "WALK":
      return "activity";
    default:
      return "restaurant";
  }
}

/** 스냅샷 없는 구버전 세션용 폴백 */
export function homeCardFromCourseStop(stop: CourseStop): HomeCard {
  const cat = stop.dbCategory ?? categoryFromPlaceType(stop.placeType);
  return {
    id: stop.placeId,
    name: stop.placeName,
    category: cat,
    categoryLabel: stop.categoryLabel ?? undefined,
    lat: stop.lat ?? null,
    lng: stop.lng ?? null,
    mood: stop.mood,
    tags: stop.tags,
  };
}

/** 코스 스톱 배열 → 결과 카드(스냅샷 우선) */
export function homeCardsFromCourseStops(stops: CourseStop[]): HomeCard[] {
  return stops.map((s) => s.cardSnapshot ?? homeCardFromCourseStop(s));
}

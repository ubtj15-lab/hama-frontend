// app/lib/placeLinks.ts
import type { HomeCard } from "@/lib/storeTypes";

function cleanName(name: string) {
  return String(name ?? "").trim();
}

// ✅ 네이버 모바일 place (id 있을 때 제일 깔끔)
export function buildNaverPlaceUrl(card: HomeCard): string | null {
  const anyCard = card as any;
  const id = String(anyCard?.naver_place_id ?? "").trim();
  if (!id) return null;
  return `https://m.place.naver.com/place/${id}`;
}

// ✅ 네이버 검색 fallback
export function buildNaverSearchUrl(card: HomeCard, action?: "예약" | "평점" | "메뉴"): string {
  const name = cleanName((card as any)?.name);
  const suffix =
    action === "예약" ? " 예약" : action === "평점" ? " 리뷰" : action === "메뉴" ? " 메뉴" : "";
  const q = `${name}${suffix}`.trim();
  return `https://m.search.naver.com/search.naver?query=${encodeURIComponent(q)}`;
}

// ✅ 카카오 place url (DB에 있는 경우)
export function buildKakaoPlaceUrl(card: HomeCard): string | null {
  const anyCard = card as any;
  const url = String(anyCard?.kakao_place_url ?? "").trim();
  if (!url) return null;
  return url;
}

// ✅ 길안내 (카카오맵 / 네이버지도)
// - 모바일에서는 앱 딥링크 우선, PC에서는 웹으로 fallback
export function buildKakaoDirectionsUrl(card: HomeCard): string | null {
  const anyCard = card as any;
  const name = cleanName(anyCard?.name);
  const lat = typeof anyCard?.lat === "number" ? anyCard.lat : null;
  const lng = typeof anyCard?.lng === "number" ? anyCard.lng : null;
  if (!name) return null;

  // 좌표가 없으면 길안내 URL 생성 불가(검색으로는 가능하지만 UX 애매해서 null)
  if (lat == null || lng == null) return null;

  // 카카오맵 웹 길찾기(PC에서도 OK)
  return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;
}

export function buildNaverDirectionsUrl(card: HomeCard): string | null {
  const anyCard = card as any;
  const name = cleanName(anyCard?.name);
  const lat = typeof anyCard?.lat === "number" ? anyCard.lat : null;
  const lng = typeof anyCard?.lng === "number" ? anyCard.lng : null;
  if (!name) return null;
  if (lat == null || lng == null) return null;

  // 네이버 지도 웹 길찾기(PC에서도 OK)
  // (네이버는 파라미터 포맷이 자주 변동되는데, 이 형태는 웹에서 비교적 잘 동작)
  return `https://map.naver.com/v5/directions/-/${lng},${lat},${encodeURIComponent(name)}`;
}

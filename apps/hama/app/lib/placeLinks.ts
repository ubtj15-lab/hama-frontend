// app/lib/placeLinks.ts
import type { HomeCard } from "@/lib/storeTypes";
import { resolveKakaoPlaceLink, resolveNaverPlaceLink } from "@/lib/placeExternalUrl";

function cleanName(name: string) {
  return String(name ?? "").trim();
}

// 확인된 네이버 장소 페이지만 반환한다. 검색 주소는 포함하지 않는다.
export function buildNaverPlaceUrl(card: HomeCard): string | null {
  const link = resolveNaverPlaceLink(card);
  return link?.mode === "direct" ? link.url : null;
}

// 네이버 검색. 결과 목록이지 확인된 매장 페이지가 아니다.
export function buildNaverSearchUrl(card: HomeCard, action?: "예약" | "평점" | "메뉴"): string | null {
  const name = cleanName((card as any)?.name);
  const address = cleanName((card as any)?.address);
  const suffix =
    action === "예약" ? " 예약" : action === "평점" ? " 리뷰" : action === "메뉴" ? " 메뉴" : "";
  const q = `${[name, address].filter(Boolean).join(" ")}${suffix}`.trim();
  if (!q) return null;
  const link = resolveNaverPlaceLink({ name: q });
  return link?.mode === "search" ? link.url : null;
}

// 카카오 공식 도메인만 반환한다. 네이버 주소가 들어 있으면 null이다.
export function buildKakaoPlaceUrl(card: HomeCard): string | null {
  const link = resolveKakaoPlaceLink(card);
  return link?.mode === "direct" ? link.url : null;
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

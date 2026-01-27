// app/lib/placeLinks.ts
import type { HomeCard } from "@/lib/storeTypes";

function safeText(v: any): string {
  return String(v ?? "").trim();
}

function isNaverUrl(url: string) {
  return url.includes("naver.me") || url.includes("m.place.naver.com");
}

export function buildNaverUrl(card: HomeCard): string {
  const anyCard = card as any;

  const placeUrl = safeText(anyCard.placeUrl);
  if (placeUrl && isNaverUrl(placeUrl)) return placeUrl;

  const naverPlaceId = safeText(anyCard.naver_place_id);
  if (naverPlaceId) return `https://m.place.naver.com/place/${encodeURIComponent(naverPlaceId)}`;

  const name = safeText(anyCard.name);
  const q = encodeURIComponent(name ? `${name} 네이버플레이스` : "네이버플레이스");
  return `https://m.search.naver.com/search.naver?query=${q}`;
}

export function buildKakaoUrl(card: HomeCard): string {
  const anyCard = card as any;

  const kakaoPlaceUrl = safeText(anyCard.kakao_place_url);
  if (kakaoPlaceUrl) return kakaoPlaceUrl;

  const name = safeText(anyCard.name);
  const q = encodeURIComponent(name || "카카오맵");
  return `https://map.kakao.com/?q=${q}`;
}

export function openExternal(url: string) {
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {}
}

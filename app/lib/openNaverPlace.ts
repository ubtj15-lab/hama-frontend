"use client";

type Params = {
  name: string;
  naverPlaceId?: string | null;
  naverPlaceUrl?: string | null;
};

function safeTrim(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeNaverShortUrl(url: string): string {
  // naver.me 단축은 그대로 열어도 됨. (리다이렉트 처리)
  // 혹시 공백/개행 제거 정도만.
  return url.trim();
}

function normalizePlaceUrl(url: string): string {
  // 이미 m.place.naver.com/place/... 또는 place.naver.com/... 형태면 그대로
  return url.trim();
}

export function openNaverPlace(params: Params) {
  const name = safeTrim(params.name);
  const naverPlaceId = safeTrim(params.naverPlaceId);
  const naverPlaceUrl = safeTrim(params.naverPlaceUrl);

  // 1) ✅ DB에 naver_place_url 있으면 무조건 그걸로 연다 (가장 정확)
  if (naverPlaceUrl) {
    const url =
      naverPlaceUrl.includes("naver.me")
        ? normalizeNaverShortUrl(naverPlaceUrl)
        : normalizePlaceUrl(naverPlaceUrl);

    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  // 2) ✅ 없으면 naver_place_id로 상세 페이지
  // 주의: 이 ID가 "플레이스 ID"여야 함. 임의 숫자면 404 뜸.
  if (naverPlaceId) {
    const url = `https://m.place.naver.com/place/${encodeURIComponent(naverPlaceId)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  // 3) ✅ 둘 다 없으면 검색으로 fallback
  const q = encodeURIComponent(name || "");
  const fallback = `https://m.search.naver.com/search.naver?query=${q}`;
  window.open(fallback, "_blank", "noopener,noreferrer");
}

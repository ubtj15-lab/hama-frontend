export function openNaverPlace(params: { name: string; naverPlaceId?: string | null }) {
  const name = (params.name ?? "").trim();
  const naverPlaceId = (params.naverPlaceId ?? "").trim();

  // 1순위: 네이버 플레이스 상세(오른쪽 스샷)
  if (naverPlaceId) {
    const url = `https://m.place.naver.com/place/${encodeURIComponent(naverPlaceId)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  // 2순위: 없으면 검색(왼쪽 스샷)
  const fallback = `https://m.search.naver.com/search.naver?query=${encodeURIComponent(name)}`;
  window.open(fallback, "_blank", "noopener,noreferrer");
}

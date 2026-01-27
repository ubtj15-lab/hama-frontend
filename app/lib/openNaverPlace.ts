// app/lib/openNaverPlace.ts

export function openNaverPlace(params: {
  name: string;
  naverPlaceUrl?: string | null;
  naverPlaceId?: string | null;
}) {
  const name = (params.name ?? "").trim();
  const naverPlaceUrl = (params.naverPlaceUrl ?? "").trim();
  const naverPlaceId = (params.naverPlaceId ?? "").trim();

  // 1️⃣ 네이버 place 단축 URL (naver.me) — 최우선
  if (naverPlaceUrl) {
    window.open(naverPlaceUrl, "_blank", "noopener,noreferrer");
    return;
  }

  // 2️⃣ placeId (있으면 시도, 안 열릴 수도 있음)
  if (naverPlaceId) {
    const url = `https://m.place.naver.com/place/${encodeURIComponent(
      naverPlaceId
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  // 3️⃣ 최후 fallback: 네이버 검색
  if (name) {
    const q = encodeURIComponent(name);
    const fallback = `https://m.search.naver.com/search.naver?query=${q}`;
    window.open(fallback, "_blank", "noopener,noreferrer");
  }
}

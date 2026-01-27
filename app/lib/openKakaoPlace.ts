export function openKakaoPlace(params: {
  name: string;
  kakaoPlaceUrl?: string | null;
}) {
  const name = (params.name ?? "").trim();
  const kakaoPlaceUrl = (params.kakaoPlaceUrl ?? "").trim();

  // 1순위: 카카오 장소 URL
  if (kakaoPlaceUrl) {
    window.open(kakaoPlaceUrl, "_blank", "noopener,noreferrer");
    return;
  }

  // 2순위: 카카오맵 검색
  const fallback = `https://map.kakao.com/?q=${encodeURIComponent(name)}`;
  window.open(fallback, "_blank", "noopener,noreferrer");
}

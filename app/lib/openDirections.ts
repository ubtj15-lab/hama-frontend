type OpenDirectionsArgs = {
  name: string;
  lat: number | null;
  lng: number | null;
};

export function openDirections({ name, lat, lng }: OpenDirectionsArgs) {
  const safeName = (name || "").trim();

  const isMobile =
    typeof window !== "undefined" && window.matchMedia?.("(max-width: 768px)")?.matches;

  const open = (url: string) => {
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // ignore
    }
  };

  // ✅ 좌표 있으면: 지도 앱/웹을 "길찾기"로
  if (typeof lat === "number" && typeof lng === "number") {
    if (isMobile) {
      // 모바일: 카카오맵 앱 딥링크 시도 (실패해도 웹이 열리도록 web fallback 같이 제공)
      // iOS/Android 공통으로 동작하는 스킴 위주
      const kakaoApp = `kakaomap://route?sp=&ep=${lat},${lng}&by=CAR`;
      const kakaoWeb = `https://map.kakao.com/link/to/${encodeURIComponent(safeName || "목적지")},${lat},${lng}`;
      // 대부분 모바일은 스킴이 막히는 경우가 있으니 web도 같이 열리게
      open(kakaoApp);
      setTimeout(() => open(kakaoWeb), 250);
      return;
    }

    // PC: 카카오맵 웹
    const kakaoWeb = `https://map.kakao.com/link/to/${encodeURIComponent(safeName || "목적지")},${lat},${lng}`;
    open(kakaoWeb);
    return;
  }

  // ✅ 좌표 없으면: 네이버/카카오 검색으로 보냄 (최소한 행동 가능)
  const q = encodeURIComponent(safeName);
  if (isMobile) {
    open(`https://m.search.naver.com/search.naver?query=${q}`);
  } else {
    open(`https://search.naver.com/search.naver?query=${q}`);
  }
}

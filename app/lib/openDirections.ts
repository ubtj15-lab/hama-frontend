"use client";

export function openDirections(opts: { name: string; lat?: number | null; lng?: number | null }) {
  const name = (opts.name ?? "").trim();
  const lat = typeof opts.lat === "number" ? opts.lat : null;
  const lng = typeof opts.lng === "number" ? opts.lng : null;

  if (typeof window === "undefined") return;

  const ua = navigator.userAgent || "";
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);

  // 좌표 있으면: 앱 딥링크 우선
  if (isMobile && lat != null && lng != null) {
    // 카카오맵 앱 딥링크 (to)
    const kakao = `kakaomap://route?ep=${lat},${lng}&by=CAR`;
    // 실패 대비: 웹 fallback
    const fallback = `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;

    // 딥링크 시도
    window.location.href = kakao;

    // 앱이 없으면 웹으로 보내기
    setTimeout(() => {
      try {
        window.location.href = fallback;
      } catch {}
    }, 700);
    return;
  }

  // 모바일인데 좌표가 없거나, PC면 웹으로
  if (lat != null && lng != null) {
    window.open(
      `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`,
      "_blank",
      "noopener,noreferrer"
    );
  } else {
    window.open(
      `https://map.kakao.com/?q=${encodeURIComponent(name)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }
}

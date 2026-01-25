"use client";

import React from "react";

type Props = {
  name: string;
  lat?: number | null;
  lng?: number | null;

  // 나중에 확장용(지금은 미사용)
  phone?: string | null;
  placeId?: string | number | null;

  className?: string;
};

function isMobileUA() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function openKakaoMap(lat: number, lng: number, name: string) {
  const isMobile = isMobileUA();

  // 모바일: 앱 딥링크(카카오맵 설치 시 바로 열림)
  // PC/미설치: 웹 링크로 fallback
  const webUrl = `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`;
  const appUrl = `kakaomap://look?p=${lat},${lng}`;

  if (!isMobile) {
    window.open(webUrl, "_blank", "noopener,noreferrer");
    return;
  }

  // 모바일에서는 딥링크 시도 후, 설치 안 된 경우를 대비해 웹으로 fallback
  // (브라우저마다 동작 차이가 있어 700~1200ms 정도가 무난)
  window.location.href = appUrl;

  setTimeout(() => {
    // 딥링크가 성공하면 앱으로 전환되며 이 코드가 의미 없거나 실행되지 않는 경우가 많음
    // 실패했을 때만 웹으로 넘어가게 하는 목적
    window.location.href = webUrl;
  }, 900);
}

export default function CardActionButtons({
  name,
  lat,
  lng,
  className,
}: Props) {
  const hasGeo = typeof lat === "number" && typeof lng === "number";

  const onClickNavigate = () => {
    if (!hasGeo) return;
    openKakaoMap(lat!, lng!, name);
  };

  return (
    <div className={className}>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={onClickNavigate}
          disabled={!hasGeo}
          aria-disabled={!hasGeo}
          style={{
            flex: 1,
            height: 44,
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.12)",
            background: hasGeo ? "white" : "rgba(0,0,0,0.04)",
            fontWeight: 600,
            cursor: hasGeo ? "pointer" : "not-allowed",
          }}
        >
          길안내
        </button>

        {/* 다음 단계에서 전화/예약 버튼이 여기로 들어감 */}
      </div>

      {!hasGeo && (
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
          위치 정보 준비 중
        </div>
      )}
    </div>
  );
}

// utils/loadKakaoSdk.ts

export default function loadKakaoSdk(callback: () => void) {
  if (typeof window === "undefined") return;

  // 이미 kakao.maps가 로드된 경우
  if (window.kakao && window.kakao.maps) {
    try {
      window.kakao.maps.load(callback);
    } catch (e) {
      console.error("[KAKAO] maps.load 호출 중 에러", e);
    }
    return;
  }

  const appKey = process.env.NEXT_PUBLIC_KAKAO_APP_KEY;
  if (!appKey) {
    console.error(
      "[KAKAO] NEXT_PUBLIC_KAKAO_APP_KEY 가 설정되어 있지 않습니다 (.env.local 확인 필요)"
    );
    return;
  }

  // 이미 스크립트 태그가 있는 경우
  const existingScript = document.getElementById("kakao-sdk") as
    | HTMLScriptElement
    | null;

  if (existingScript) {
    // 이미 로드가 끝난 경우
    if (window.kakao && window.kakao.maps) {
      try {
        window.kakao.maps.load(callback);
      } catch (e) {
        console.error("[KAKAO] 기존 스크립트에서 maps.load 에러", e);
      }
    } else {
      // 아직 로드 중인 경우 → onload에 콜백 연결
      existingScript.onload = () => {
        if (window.kakao && window.kakao.maps) {
          window.kakao.maps.load(callback);
        } else {
          console.error("[KAKAO] onload 이후에도 kakao.maps 가 없음");
        }
      };
    }
    return;
  }

  // 새 스크립트 추가
  const script = document.createElement("script");
  script.id = "kakao-sdk";
  script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
  script.async = true;

  script.onload = () => {
    if (window.kakao && window.kakao.maps) {
      try {
        window.kakao.maps.load(callback);
      } catch (e) {
        console.error("[KAKAO] 새 스크립트에서 maps.load 에러", e);
      }
    } else {
      console.error("[KAKAO] SDK 로드 후에도 kakao.maps 없음");
    }
  };

  script.onerror = () => {
    console.error("[KAKAO] Kakao SDK 스크립트 로드 실패");
  };

  document.head.appendChild(script);
}

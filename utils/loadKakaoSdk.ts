// utils/loadKakaoSdk.ts

export default function loadKakaoSdk(callback: () => void) {
  if (typeof window === "undefined") return;

  if (window.kakao && window.kakao.maps) {
    try {
      window.kakao.maps.load(callback);
    } catch (e) {
      console.error("[KAKAO] maps.load 호출 중 에러", e);
    }
    return;
  }

  // ✅ 여기 한 줄만 네 자바스크립트 키로 바꿔줘
  const appKey =
  process.env.NEXT_PUBLIC_KAKAO_APP_KEY ||
  "0a7d727707ad45e650718af282076602";

if (!appKey || appKey === "0a7d727707ad45e650718af282076602") {
  console.error("[KAKAO] JavaScript 키가 설정되어 있지 않습니다.");
  return;
}


  const existingScript = document.getElementById("kakao-sdk") as
    | HTMLScriptElement
    | null;

  if (existingScript) {
    if (window.kakao && window.kakao.maps) {
      try {
        window.kakao.maps.load(callback);
      } catch (e) {
        console.error("[KAKAO] 기존 스크립트 maps.load 에러", e);
      }
    } else {
      existingScript.onload = () => {
        if (window.kakao && window.kakao.maps) {
          window.kakao.maps.load(callback);
        } else {
          console.error("[KAKAO] onload 이후에도 kakao.maps 없음");
        }
      };
    }
    return;
  }

  const script = document.createElement("script");
  script.id = "kakao-sdk";
  script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
  script.async = true;

  script.onload = () => {
    if (window.kakao && window.kakao.maps) {
      try {
        window.kakao.maps.load(callback);
      } catch (e) {
        console.error("[KAKAO] 새 스크립트 maps.load 에러", e);
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

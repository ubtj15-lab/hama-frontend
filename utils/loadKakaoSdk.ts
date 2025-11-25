// utils/loadKakaoSdk.ts

export default function loadKakaoSdk(callback: () => void) {
  if (typeof window === "undefined") return;

  // 이미 kakao.maps가 로드돼 있으면 바로 실행
  if (window.kakao && window.kakao.maps) {
    window.kakao.maps.load(callback);
    return;
  }

  // 이미 script 태그만 있는 경우 → onload 에 callback 연결
  const existingScript = document.getElementById("kakao-sdk") as
    | HTMLScriptElement
    | null;

  if (existingScript) {
    existingScript.onload = () => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(callback);
      }
    };
    return;
  }

  // 🔑 여기! 네가 원래 쓰던 env 이름으로 맞춤
  const appKey = process.env.NEXT_PUBLIC_KAKAO_APP_KEY;
  if (!appKey) {
    console.error(
      "[KAKAO] NEXT_PUBLIC_KAKAO_APP_KEY 가 설정되어 있지 않습니다 (.env.local 확인)"
    );
    return;
  }

  const script = document.createElement("script");
  script.id = "kakao-sdk";
  script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
  script.async = true;

  script.onload = () => {
    if (window.kakao && window.kakao.maps) {
      window.kakao.maps.load(callback);
    } else {
      console.error("[KAKAO] SDK 로드는 되었지만 kakao.maps 가 없습니다.");
    }
  };

  script.onerror = () => {
    console.error("[KAKAO] SDK 스크립트 로드 실패");
  };

  document.head.appendChild(script);
}

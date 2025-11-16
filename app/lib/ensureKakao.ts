// app/lib/ensureKakao.ts
export default function ensureKakao(onReady: () => void) {
  if (typeof window === "undefined") return;
  const w = window as any;

  const run = () => {
    try {
      // kakao maps 객체가 이미 준비되어 있으면 load() 혹은 바로 onReady 호출
      if (w.kakao?.maps) {
        if (typeof w.kakao.maps.load === "function") {
          w.kakao.maps.load(onReady);
        } else {
          onReady();
        }
      } else {
        // 방어: 혹시라도 아직 없으면 다음 틱에 재시도
        setTimeout(() => {
          if (w.kakao?.maps) {
            if (typeof w.kakao.maps.load === "function") {
              w.kakao.maps.load(onReady);
            } else {
              onReady();
            }
          }
        }, 0);
      }
    } catch (e) {
      console.error("[Kakao] run() error:", e);
    }
  };

  // 이미 로드돼 있으면 바로 실행
  if (w.kakao?.maps) {
    run();
    return;
  }

  const appkey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  if (!appkey) {
    console.error("[Kakao] JS key missing: set NEXT_PUBLIC_KAKAO_JS_KEY in .env.local");
    return;
  }

  const id = "kakao-sdk";
  const existing = document.getElementById(id) as HTMLScriptElement | null;

  if (existing) {
    // 스크립트 태그는 있는데 아직 kakao가 없을 수 있음 -> load 이벤트에 연결
    if (existing.getAttribute("data-loaded") === "1") {
      run();
    } else {
      existing.addEventListener("load", () => {
        existing.setAttribute("data-loaded", "1");
        run();
      });
    }
    return;
  }

  // 새로 로드
  const s = document.createElement("script");
  s.id = id;
  s.async = true;
  s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appkey}&autoload=false`;
  s.addEventListener("load", () => {
    s.setAttribute("data-loaded", "1");
    run();
  });
  s.addEventListener("error", () => {
    console.error("[Kakao] SDK load failed");
  });
  document.head.appendChild(s);
}

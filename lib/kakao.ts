// lib/kakao.ts
export const loadKakao = (): Promise<typeof window.kakao> =>
  new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("SSR"));
    const w = window as any;

    // 이미 로드돼 있으면 바로 반환
    if (w.kakao?.maps) return resolve(w.kakao);

    const onReady = () => {
      if (!w.kakao) return reject(new Error("kakao not found"));
      w.kakao.maps.load(() => resolve(w.kakao));
    };

    const existing = document.getElementById("kakao-sdk") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", onReady, { once: true });
      existing.addEventListener("error", () => reject(new Error("SDK load error")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "kakao-sdk";
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_APP_KEY}&autoload=false&libraries=services,clusterer`;
    script.addEventListener("load", onReady, { once: true });
    script.addEventListener("error", () => reject(new Error("SDK load error")), { once: true });
    document.head.appendChild(script);
  });

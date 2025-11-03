// /app/lib/kakao.ts
export async function loadKakao(appKey: string) {
  if (typeof window === "undefined") return; // SSR 가드
  const w = window as any;
  if (w.kakao?.maps) return; // 이미 로드됨

  await new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;
    s.async = true;
    s.onload = () => {
      try {
        w.kakao.maps.load(() => resolve());
      } catch (e) {
        reject(e);
      }
    };
    s.onerror = () => reject(new Error("Kakao SDK load failed"));
    document.head.appendChild(s);
  });
}

// app/lib/services.ts
export type KakaoPlace = {
  place_name: string;
  x: string; // lng
  y: string; // lat
  road_address_name?: string;
  address_name?: string;
};

export async function searchPlace(query: string): Promise<KakaoPlace[]> {
  const key = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;

  if (!key) {
    console.error("[KAKAO] REST key missing (env)");
    return [];
  }

  const url =
    "https://dapi.kakao.com/v2/local/search/keyword.json?query=" +
    encodeURIComponent(query) +
    "&size=3";

  const res = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${key}`, // ★ 정확한 헤더 형식
    },
  });

  if (!res.ok) {
    // 어떤 에러인지 바로 보자
    const text = await res.text().catch(() => "");
    console.warn("[KAKAO] search fail", res.status, text);
    return [];
  }

  const json = await res.json().catch(() => null);
  if (!json || !Array.isArray(json.documents)) return [];
  return json.documents as KakaoPlace[];
}

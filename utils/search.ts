// /api/local/search → Kakao Local 프록시 응답 사용
type KakaoPlace = {
  x: string; // lng
  y: string; // lat
  place_name: string;
  address_name?: string;
};

export async function findDestByKeyword(keyword: string) {
  const r = await fetch(`/api/local/search?query=${encodeURIComponent(keyword)}`, {
    cache: "no-store",
  });
  const data = await r.json();

  const d: KakaoPlace | undefined = data?.documents?.[0];
  if (!d) return null;

  return {
    name: d.place_name,
    x: Number(d.x),
    y: Number(d.y),
  };
}

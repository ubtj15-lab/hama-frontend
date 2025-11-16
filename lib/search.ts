// app/lib/search.ts
export async function searchPlace(query: string) {
  const REST_API_KEY = process.env.KAKAO_REST_API_KEY;
  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;
  
  const res = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${REST_API_KEY}`,
    },
  });

  if (!res.ok) {
    console.error("검색 실패:", res.status, await res.text());
    return [];
  }

  const data = await res.json();
  return data.documents || [];
}

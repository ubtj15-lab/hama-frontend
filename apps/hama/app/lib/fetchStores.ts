// app/lib/fetchStores.ts
import type { HomeCard } from "@/lib/storeTypes";
import { toHomeCard } from "@/lib/storeRepository";


// ✅ API 응답은 형태가 바뀔 수 있으니 느슨하게 받는다
type ApiStoreLoose = {
  id?: any;
  name?: any;
  category?: any;
  area?: any;
  address?: any;

  lat?: any;
  lng?: any;

  phone?: any;
  image_url?: any;

  kakao_place_url?: any;
  naver_place_id?: any;

  mood?: any;
  tags?: any;

  with_kids?: any;
  for_work?: any;
  reservation_required?: any;

  price_level?: any;
  updated_at?: any;

  // 더미에서 쓰던 값들이 남아있어도 무시 가능
  distance_hint?: any;
  is_active?: any;
};

type ApiResponse = {
  items?: ApiStoreLoose[];
};

function normalizeStoreRow(x: ApiStoreLoose) {
  return {
    id: String(x?.id ?? ""),
    name: x?.name != null ? String(x.name) : null,
    category: x?.category != null ? String(x.category) : null,
    area: x?.area != null ? String(x.area) : null,
    address: x?.address != null ? String(x.address) : null,

    lat: typeof x?.lat === "number" ? x.lat : null,
    lng: typeof x?.lng === "number" ? x.lng : null,

    phone: x?.phone != null ? String(x.phone) : null,
    image_url: x?.image_url != null ? String(x.image_url) : null,

    kakao_place_url: x?.kakao_place_url != null ? String(x.kakao_place_url) : null,
    naver_place_id: x?.naver_place_id != null ? String(x.naver_place_id) : null,

    mood: Array.isArray(x?.mood) ? x.mood.map(String) : [],
    tags: Array.isArray(x?.tags) ? x.tags.map(String) : [],

    with_kids: typeof x?.with_kids === "boolean" ? x.with_kids : null,
    for_work: typeof x?.for_work === "boolean" ? x.for_work : null,
    reservation_required:
      typeof x?.reservation_required === "boolean" ? x.reservation_required : null,

    price_level: x?.price_level != null ? String(x.price_level) : null,
    updated_at: x?.updated_at != null ? String(x.updated_at) : null,
  };
}

export async function fetchStores(): Promise<HomeCard[]> {
  const res = await fetch("/api/stores", { cache: "no-store" });
  if (!res.ok) return [];

  const json = (await res.json()) as ApiResponse;
  const items = Array.isArray(json?.items) ? json.items : [];

  // ✅ 누락 필드 채워서 안전하게 변환
  const normalized = items
    .map(normalizeStoreRow)
    .filter((r) => r.id && r.name); // id/name 없는 더미는 제외

  return normalized.map((r) => toHomeCard(r as any));

}

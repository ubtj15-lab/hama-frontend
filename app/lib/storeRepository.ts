import { createClient } from "@supabase/supabase-js";
import type { HomeCard, HomeTabKey } from "@/lib/storeTypes";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

type FetchOptions = {
  count?: number;
};

const SELECT_FIELDS = `
  id,
  name,
  category,
  area,
  address,
  lat,
  lng,
  phone,
  image_url,
  kakao_place_url,
  naver_place_id,
  mood,
  tags,
  with_kids,
  for_work,
  price_level,
  reservation_required,
  updated_at
`;

function normalizeCard(row: any): HomeCard {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),

    category: row.category ?? null,
    area: row.area ?? null,
    address: row.address ?? null,

    lat: typeof row.lat === "number" ? row.lat : row.lat == null ? null : Number(row.lat),
    lng: typeof row.lng === "number" ? row.lng : row.lng == null ? null : Number(row.lng),

    phone: row.phone ?? null,

    image_url: row.image_url ?? null,
    kakao_place_url: row.kakao_place_url ?? null,

    // ✅ 여기 중요
    naver_place_id: row.naver_place_id ?? null,

    mood: Array.isArray(row.mood) ? row.mood : row.mood == null ? null : [],
    tags: Array.isArray(row.tags) ? row.tags : row.tags == null ? null : [],

    with_kids: typeof row.with_kids === "boolean" ? row.with_kids : null,
    for_work: typeof row.for_work === "boolean" ? row.for_work : null,
    price_level: row.price_level ?? null,
    reservation_required: typeof row.reservation_required === "boolean" ? row.reservation_required : null,
  };
}

export async function fetchHomeCardsByTab(
  homeTab: HomeTabKey,
  options: FetchOptions = {}
): Promise<HomeCard[]> {
  const count = options.count ?? (homeTab === "all" ? 12 : 5);

  let q = supabase.from("stores").select(SELECT_FIELDS);

  if (homeTab !== "all") {
    q = q.eq("category", homeTab);
  }

  // 오베 단계에서는 단순 최신 업데이트 순으로 가져오자
  q = q.order("updated_at", { ascending: false }).limit(count);

  const { data, error } = await q;

  if (error) {
    console.error("[fetchHomeCardsByTab] error:", error);
    return [];
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map(normalizeCard);
}

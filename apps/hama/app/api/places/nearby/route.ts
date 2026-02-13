import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type HomeTabKey = "all" | "restaurant" | "cafe" | "salon" | "activity";

type StoreUpsert = {
  id?: string; // supabase가 기본키 자동이면 없어도 됨
  name: string | null;
  category: string | null;
  area: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  image_url: string | null;
  kakao_place_url: string | null;
  naver_place_id: string | null;
  mood: string[] | null;
  tags: string[] | null;
  with_kids: boolean | null;
  for_work: boolean | null;
  reservation_required: boolean | null;
  price_level: string | null;
  curated_score: number | null;
  updated_at: string | null;

  source: string | null;
  place_key: string | null;
};

function categoryToKakaoGroup(tab: HomeTabKey): string | null {
  if (tab === "cafe") return "CE7";
  if (tab === "restaurant") return "FD6";
  return null; // 미용/액티비티는 일단 제외(원하면 확장)
}

function safeNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickAreaFromAddress(addr: string | null): string | null {
  if (!addr) return null;
  // "경기 화성시 ..." 같은 주소면 시/구 정도만 area로
  const parts = addr.split(" ").filter(Boolean);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] ?? null;
}

function makeSupabaseAdmin(): ReturnType<typeof createClient> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function fetchDbNearbyPool(params: {
  lat: number;
  lng: number;
  tab: HomeTabKey;
  radiusKm: number;
  limit: number;
}) {
  const supabase = makeSupabaseAdmin();
  if (!supabase) return [];
  const { lat, lng, tab, radiusKm, limit } = params;

  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;

  let q = supabase
    .from("stores")
    .select(
      `
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
      curated_score,
      updated_at,
      source,
      place_key
    `
    )
    .gte("lat", minLat)
    .lte("lat", maxLat)
    .gte("lng", minLng)
    .lte("lng", maxLng)
    .limit(limit);

  if (tab !== "all") q = q.eq("category", tab);

  // 운영자 점수/최신 우선은 유지(후보풀은 넉넉히 받고, 클라에서 랜덤픽)
  q = q
    .order("curated_score", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false, nullsFirst: false });

  const { data, error } = await q;
  if (error) {
    console.error("[dbNearbyPool]", error);
    return [];
  }
  return (data ?? []) as any[];
}

async function fetchKakaoNearby(params: {
  lat: number;
  lng: number;
  tab: HomeTabKey;
  radiusKm: number;
  size: number;
}) {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) return [];

  const group = categoryToKakaoGroup(params.tab);
  if (!group) return [];

  const radiusMeters = Math.min(Math.max(Math.floor(params.radiusKm * 1000), 100), 20000); // Kakao max 20km
  const url = new URL("https://dapi.kakao.com/v2/local/search/category.json");
  url.searchParams.set("category_group_code", group);
  url.searchParams.set("x", String(params.lng)); // Kakao: x=lng
  url.searchParams.set("y", String(params.lat)); // Kakao: y=lat
  url.searchParams.set("radius", String(radiusMeters));
  url.searchParams.set("size", String(Math.min(params.size, 15))); // Kakao size max 15
  url.searchParams.set("sort", "distance");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `KakaoAK ${apiKey}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error("[kakaoNearby] fail", res.status, t);
    return [];
  }

  const json = await res.json();
  const docs = Array.isArray(json?.documents) ? json.documents : [];
  return docs as any[];
}

function kakaoDocToUpsert(doc: any, tab: HomeTabKey): StoreUpsert {
  const name = (doc?.place_name ?? null) as string | null;
  const address = (doc?.road_address_name ?? doc?.address_name ?? null) as string | null;
  const phone = (doc?.phone ?? null) as string | null;

  const lat = safeNum(doc?.y); // Kakao y=lat
  const lng = safeNum(doc?.x); // Kakao x=lng

  const kakaoUrl = (doc?.place_url ?? null) as string | null;
  const placeKey = doc?.id ? String(doc.id) : null;

  return {
    name,
    category: tab === "all" ? null : tab,
    area: pickAreaFromAddress(address),
    address,
    lat,
    lng,
    phone,
    image_url: null,
    kakao_place_url: kakaoUrl,
    naver_place_id: null,
    mood: [],
    tags: [],
    with_kids: null,
    for_work: null,
    reservation_required: null,
    price_level: null,
    curated_score: 0,
    updated_at: new Date().toISOString(),

    source: "kakao",
    place_key: placeKey,
  };
}

function rowToHomeCard(row: any) {
  // HomeSwipeDeck가 쓰는 필드만 맞춰주면 됨
  return {
    id: row.id,
    name: row.name ?? "",
    category: row.category ?? null,
    categoryLabel:
      row.category === "restaurant"
        ? "식당"
        : row.category === "cafe"
        ? "카페"
        : row.category === "salon"
        ? "미용"
        : row.category === "activity"
        ? "액티비티"
        : "장소",
    area: row.area ?? null,
    address: row.address ?? null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    phone: row.phone ?? null,
    image_url: row.image_url ?? null,
    imageUrl: row.image_url ?? null,
    kakao_place_url: row.kakao_place_url ?? null,
    naver_place_id: row.naver_place_id ?? null,
    mood: Array.isArray(row.mood) ? row.mood : [],
    moodText: Array.isArray(row.mood) ? row.mood.slice(0, 2).join(" · ") : "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    curated_score: typeof row.curated_score === "number" ? row.curated_score : 0,
    updated_at: row.updated_at ?? null,
    source: row.source ?? null,
    place_key: row.place_key ?? null,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    const tab = (searchParams.get("tab") ?? "all") as HomeTabKey;

    const radiusKm = Number(searchParams.get("radiusKm") ?? "4");
    const limit = Number(searchParams.get("limit") ?? "40"); // ✅ 후보 풀 사이즈

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ ok: false, error: "invalid lat/lng" }, { status: 400 });
    }

    const safeTab: HomeTabKey[] = ["all", "restaurant", "cafe", "salon", "activity"];
    if (!safeTab.includes(tab)) {
      return NextResponse.json({ ok: false, error: "invalid tab" }, { status: 400 });
    }

    // 1) DB 근처 후보 풀
    const dbRows = await fetchDbNearbyPool({
      lat,
      lng,
      tab,
      radiusKm,
      limit,
    });

    // 2) 부족하면 카카오로 보충(식당/카페만)
    const need = Math.max(0, limit - dbRows.length);
    let merged = dbRows;

    if (need > 0) {
      // Kakao는 한 번에 최대 15라 여러 번 호출해야 할 수 있음
      const supabase = makeSupabaseAdmin();
      const apiKey = process.env.KAKAO_REST_API_KEY;
      if (!supabase || !apiKey) {
        // env 없으면 DB 결과만 반환
      } else {
      let fetched: any[] = [];
      let remain = need;

      while (remain > 0) {
        const batchSize = Math.min(remain, 15);
        const docs = await fetchKakaoNearby({ lat, lng, tab, radiusKm, size: batchSize });
        if (!docs.length) break;
        fetched = fetched.concat(docs);
        remain -= docs.length;

        // Kakao 응답이 적게 오면 더 돌려봐도 의미 없음
        if (docs.length < batchSize) break;
      }

      if (fetched.length > 0) {
        const upserts = fetched
          .map((d) => kakaoDocToUpsert(d, tab))
          .filter((x) => x.place_key && x.name && x.lat != null && x.lng != null);

        if (upserts.length > 0) {
          // ✅ place_key unique 기준 upsert (Supabase 타입 미생성 시 any 단언)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: upsertErr } = await supabase.from("stores").upsert(upserts as any, { onConflict: "place_key" });

          if (upsertErr) console.error("[kakao upsert]", upsertErr);
        }

        // upsert 후 다시 DB에서 최신 풀 재조회(합쳐진 결과를 안정적으로 받기)
        merged = await fetchDbNearbyPool({ lat, lng, tab, radiusKm, limit });
      }
      }
    }

    const cards = merged.map(rowToHomeCard);
    return NextResponse.json({ ok: true, cards });
  } catch (e: any) {
    console.error("[/api/places/nearby]", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
  }
}

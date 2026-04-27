import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseKey =
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as
    | string
    | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

type Capability = {
  solo_friendly: boolean | null;
  group_seating: boolean | null;
  private_room: boolean | null;
  alcohol_available: boolean | null;
  fast_food: boolean | null;
  formal_atmosphere: boolean | null;
  quick_service: boolean | null;
  vegan_available: boolean | null;
  halal_available: boolean | null;
  with_kids: boolean | null;
  max_group_size?: number | null;
};

function inferFromLegacy(row: any): Capability {
  const mood = Array.isArray(row?.mood) ? row.mood.map((x: any) => String(x).toLowerCase()) : [];
  const tags = Array.isArray(row?.tags) ? row.tags.map((x: any) => String(x).toLowerCase()) : [];
  const blob = [row?.category ?? "", ...(row?.mood ?? []), ...(row?.tags ?? []), row?.name ?? ""].join(" ").toLowerCase();
  const withKids =
    tags.some((t: string) => t.includes("아이동반") || t.includes("키즈") || t.includes("가족")) ||
    mood.some((m: string) => m.includes("가족")) ||
    /키즈|아이|가족/.test(blob);
  const groupSeating = withKids || /단체|모임|회식|패밀리|한정식|정찬/.test(blob);
  const privateRoom = /룸|별실|프라이빗|코스룸|단독룸/.test(blob) || mood.some((m: string) => m.includes("데이트"));
  const alcohol = /이자카야|호프|술집|와인|바|칵테일|맥주|소주/.test(blob);
  const fastFood = /패스트푸드|맥도날드|버거킹|kfc|롯데리아|분식|김밥|토스트/.test(blob);
  const formal = /정찬|한정식|코스|격식|예약필수|파인다이닝/.test(blob) || tags.some((t: string) => t.includes("예약필수"));
  const quick = fastFood || /빠른|분식|김밥|회전/.test(blob);
  const solo = quick || /혼밥|1인|카운터|혼자/.test(blob) || row?.for_work === true;
  const vegan = /비건|채식|vegan|vegetarian/.test(blob);
  const halal = /할랄|halal/.test(blob);

  return {
    solo_friendly: solo,
    group_seating: groupSeating,
    private_room: privateRoom,
    alcohol_available: alcohol,
    fast_food: fastFood,
    formal_atmosphere: formal,
    quick_service: quick,
    vegan_available: vegan,
    halal_available: halal,
    with_kids: withKids,
    max_group_size: [4, 8, 12, 20].includes(Number(row?.max_group_size)) ? Number(row.max_group_size) : 4,
  };
}

function actualCapability(row: any): Capability {
  return {
    solo_friendly: row?.solo_friendly ?? null,
    group_seating: row?.group_seating ?? null,
    private_room: row?.private_room ?? null,
    alcohol_available: row?.alcohol_available ?? null,
    fast_food: row?.fast_food ?? null,
    formal_atmosphere: row?.formal_atmosphere ?? null,
    quick_service: row?.quick_service ?? null,
    vegan_available: row?.vegan_available ?? null,
    halal_available: row?.halal_available ?? null,
    with_kids: row?.with_kids ?? null,
    max_group_size: row?.max_group_size ?? null,
  };
}

function mismatch(inferred: Capability, actual: Capability): string[] {
  const keys: Array<keyof Capability> = [
    "solo_friendly",
    "group_seating",
    "private_room",
    "alcohol_available",
    "fast_food",
    "formal_atmosphere",
    "quick_service",
    "vegan_available",
    "halal_available",
    "with_kids",
  ];
  return keys
    .filter((k) => actual[k] !== null && inferred[k] !== actual[k])
    .map((k) => String(k));
}

const OSAN_CITY_HALL = { lat: 37.1498, lng: 127.0772 };
const DONGTAN_STATION = { lat: 37.2009, lng: 127.0957 };
const RADIUS_KM = 5;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function scoreStore(row: any): number {
  let score = 0;
  const tags = Array.isArray(row?.tags) ? row.tags.length : 0;
  const mood = Array.isArray(row?.mood) ? row.mood.length : 0;
  score += row?.image_url ? 5 : 0;
  score += Math.min(tags, 5);
  score += Math.min(mood, 3);
  score += row?.updated_at ? 2 : 0;
  return score;
}

function categoryOk(c: unknown) {
  const x = String(c ?? "").toLowerCase();
  return x === "restaurant" || x === "cafe" || x === "salon" || x === "beauty";
}

function pickDescription(row: any): string | null {
  const candidates = [
    row?.description,
    row?.store_description,
    row?.summary,
    row?.intro,
    row?.content,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const limitRaw = Number(req.nextUrl.searchParams.get("limit") || "40");
  const limit = Math.max(30, Math.min(50, Number.isFinite(limitRaw) ? limitRaw : 40));

  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .not("name", "is", null)
    .neq("name", "")
    .limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = Array.isArray(data) ? data : [];
  const scoped = rows
    .filter((r: any) => categoryOk(r.category))
    .map((r: any) => {
      if (typeof r.lat !== "number" || typeof r.lng !== "number") return { row: r, near: false, dist: Infinity };
      const d1 = haversineKm(OSAN_CITY_HALL, { lat: r.lat, lng: r.lng });
      const d2 = haversineKm(DONGTAN_STATION, { lat: r.lat, lng: r.lng });
      const d = Math.min(d1, d2);
      return { row: r, near: d <= RADIUS_KM, dist: d };
    })
    .filter((x) => x.near)
    .sort((a, b) => (scoreStore(b.row) - scoreStore(a.row)) || (a.dist - b.dist))
    .slice(0, limit)
    .map((x) => x.row);

  const mapped = scoped
    .map((r: any) => {
      const inferred = inferFromLegacy(r);
      const actual = actualCapability(r);
      return {
        id: r.id,
        name: r.name,
        category: r.category,
        area: r.area,
        address: r.address,
        image_url: r.image_url ?? null,
        mood: Array.isArray(r.mood) ? r.mood : [],
        tags: Array.isArray(r.tags) ? r.tags : [],
        description: pickDescription(r),
        inferred,
        actual,
        mismatch: mismatch(inferred, actual),
        ai_confidence: r.ai_confidence ?? null,
        verified_by_human: Boolean(r.verified_by_human),
        final_capability: r.final_capability ?? null,
      };
    });

  return NextResponse.json({
    totalStores: rows.length,
    mismatchStores: mapped.filter((x) => x.mismatch.length > 0).length,
    stores: mapped,
  });
}

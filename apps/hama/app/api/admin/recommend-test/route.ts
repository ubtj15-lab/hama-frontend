import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildTopRecommendations, type BuildRecommendationsContext } from "@/lib/recommend/scoring";
import type { HomeCard } from "@/lib/storeTypes";
import type { IntentionType } from "@/lib/intention";
import type { UserProfile } from "@/lib/onboardingProfile";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseKey =
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as
    | string
    | undefined;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

type ReqBody = {
  companions?: "가족" | "혼자" | "친구" | "연인" | "동료";
  dietary?: "채식" | "할랄" | "없음";
  interests?: Array<"액티비티" | "만화카페/보드게임카페" | "영화/공연" | "전시/박물관">;
  gender?: "남성" | "여성" | "선택 안 함";
  category?: "food" | "cafe" | "beauty" | "activity" | "course";
  time?: "점심" | "저녁" | "오후";
  locationPreset?: "osan_city_hall" | "dongtan_station" | "my_location";
  userLat?: number | null;
  userLng?: number | null;
};

const OSAN_CITY_HALL = { lat: 37.1498, lng: 127.0772 };
const DONGTAN_STATION = { lat: 37.2009, lng: 127.0957 };

function categoryMatches(category: ReqBody["category"], cardCategory: string | null | undefined): boolean {
  const c = String(cardCategory ?? "").toLowerCase();
  if (!category) return true;
  if (category === "food") return c === "restaurant";
  if (category === "cafe") return c === "cafe";
  if (category === "beauty") return c === "salon" || c === "beauty";
  if (category === "activity") return c === "activity" || c === "museum";
  if (category === "course") return true;
  return true;
}

function mapCompanionToIntent(v: ReqBody["companions"]): IntentionType {
  if (v === "가족") return "family";
  if (v === "혼자") return "solo";
  if (v === "연인") return "date";
  if (v === "친구" || v === "동료") return "meeting";
  return "none";
}

function mapCompanionToProfile(v: ReqBody["companions"]): UserProfile["companions"] {
  if (!v) return [];
  if (v === "연인") return ["둘이서"];
  if (v === "동료") return ["친구"];
  return [v];
}

function resolveLatLng(input: ReqBody): { lat: number; lng: number } | null {
  if (input.locationPreset === "osan_city_hall") return OSAN_CITY_HALL;
  if (input.locationPreset === "dongtan_station") return DONGTAN_STATION;
  if (input.locationPreset === "my_location") {
    if (typeof input.userLat === "number" && typeof input.userLng === "number") {
      return { lat: input.userLat, lng: input.userLng };
    }
    return null;
  }
  if (typeof input.userLat === "number" && typeof input.userLng === "number") {
    return { lat: input.userLat, lng: input.userLng };
  }
  return OSAN_CITY_HALL;
}

function mapStoreToHomeCard(row: any): HomeCard {
  const card: HomeCard = {
    id: String(row.id),
    name: String(row.name ?? "이름없음"),
    category: row.category ?? null,
    area: row.area ?? null,
    address: row.address ?? null,
    lat: typeof row.lat === "number" ? row.lat : null,
    lng: typeof row.lng === "number" ? row.lng : null,
    image_url: row.image_url ?? null,
    mood: Array.isArray(row.mood) ? row.mood : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    description: typeof row.description === "string" ? row.description : null,
    with_kids: row.with_kids ?? null,
    for_work: row.for_work ?? null,
    reservation_required: row.reservation_required ?? null,
    vegetarian_available: row.vegetarian_available ?? null,
    halal_available: row.halal_available ?? null,
    price_level: row.price_level ?? null,
    updated_at: row.updated_at ?? null,
    distanceKm: typeof row.distance_km === "number" ? row.distance_km : undefined,
    recommendationScoreBreakdown: undefined,
  };
  const c = card as any;
  c.solo_friendly = row.solo_friendly ?? null;
  c.group_seating = row.group_seating ?? null;
  c.private_room = row.private_room ?? null;
  c.alcohol_available = row.alcohol_available ?? null;
  c.fast_food = row.fast_food ?? null;
  c.formal_atmosphere = row.formal_atmosphere ?? null;
  c.quick_service = row.quick_service ?? null;
  c.vegan_available = row.vegan_available ?? row.vegetarian_available ?? null;
  c.max_group_size = row.max_group_size ?? null;
  return card;
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  let input: ReqBody;
  try {
    input = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .not("name", "is", null)
    .neq("name", "")
    .limit(1200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = Array.isArray(data) ? data : [];
  const cards = rows.map(mapStoreToHomeCard).filter((c) => categoryMatches(input.category, c.category));
  if (!cards.length) {
    return NextResponse.json({ error: "No candidate stores for selected category", stores: [] }, { status: 200 });
  }

  const point = resolveLatLng(input);
  const profile: UserProfile = {
    companions: mapCompanionToProfile(input.companions),
    gender: input.gender ?? "선택 안 함",
    dietary_restrictions: input.dietary && input.dietary !== "없음" ? [input.dietary] : ["없음"],
    interests: (input.interests ?? []) as UserProfile["interests"],
    onboarding_completed_at: new Date().toISOString(),
  };

  const ctx: BuildRecommendationsContext = {
    intent: mapCompanionToIntent(input.companions),
    userLat: point?.lat ?? null,
    userLng: point?.lng ?? null,
    userProfile: profile,
  };

  const ranked = buildTopRecommendations(cards, ctx).slice(0, 3);
  const stores = ranked.map((item, idx) => {
    const c = item.card as any;
    const capability = {
      with_kids: c.with_kids ?? null,
      solo_friendly: c.solo_friendly ?? null,
      group_seating: c.group_seating ?? null,
      private_room: c.private_room ?? null,
      alcohol_available: c.alcohol_available ?? null,
      quick_service: c.quick_service ?? null,
      formal_atmosphere: c.formal_atmosphere ?? null,
      vegan_available: c.vegan_available ?? c.vegetarian_available ?? null,
      halal_available: c.halal_available ?? null,
      for_work: c.for_work ?? null,
    };
    return {
      rank: idx + 1,
      id: item.card.id,
      name: item.card.name,
      category: item.card.category,
      image_url: c.image_url ?? c.imageUrl ?? null,
      mood: Array.isArray(c.mood) ? c.mood : [],
      tags: Array.isArray(c.tags) ? c.tags : [],
      reason: item.reasonText,
      score: Number(item.breakdown.finalScore.toFixed(2)),
      breakdown: item.breakdown,
      capability,
    };
  });

  return NextResponse.json({
    input,
    totalCandidates: cards.length,
    stores,
  });
}

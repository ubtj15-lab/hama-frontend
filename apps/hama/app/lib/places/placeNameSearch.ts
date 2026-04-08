/**
 * 매장명 검색 — `stores`(추천·홈과 동일 데이터원) 우선, `places` 보조 병합.
 * 한쪽 테이블만 쓰면 실제 상호가 다른 테이블에 있을 때 빈 결과 → 추천 폴밄만 보이는 문제가 난다.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoreRow } from "@/lib/storeTypes";

export const STORES_TABLE = "stores";
export const PLACES_TABLE = "places";

/** 같은 id면 stores 행이 우선(컬럼이 더 많음) */
export function mergeStoreRows(storesRows: StoreRow[], placesRows: StoreRow[]): StoreRow[] {
  const m = new Map<string, StoreRow>();
  for (const r of placesRows) {
    if (r.id) m.set(r.id, r);
  }
  for (const r of storesRows) {
    if (r.id) m.set(r.id, r);
  }
  return [...m.values()];
}

/**
 * places에 실제 존재하는 컬럼만 조회.
 * category 등 스키마에 없으면 PostgREST 400 → 검색 전체 실패하므로 필수 최소만 사용.
 * (category가 있으면 DB에서 별도 뷰/마이그레이으로 추가 후 여기에만 붙이면 됨)
 */
export const PLACE_NAME_SELECT = `
  id,
  name,
  lat,
  lng,
  area,
  address
`
  .replace(/\s+/g, " ")
  .trim();

function sanitizeToken(s: string): string {
  return s.replace(/[%_]/g, "").trim().slice(0, 40);
}

export function mapPlaceRowToStoreRow(row: Record<string, unknown>): StoreRow {
  const latRaw = row.lat;
  const lngRaw = row.lng;
  const lat =
    typeof latRaw === "number" && Number.isFinite(latRaw)
      ? latRaw
      : latRaw != null && String(latRaw).length
        ? Number(latRaw)
        : null;
  const lng =
    typeof lngRaw === "number" && Number.isFinite(lngRaw)
      ? lngRaw
      : lngRaw != null && String(lngRaw).length
        ? Number(lngRaw)
        : null;

  return {
    id: String(row.id ?? ""),
    name: row.name != null ? String(row.name) : null,
    category: row.category != null ? String(row.category) : null,
    area: row.area != null ? String(row.area) : null,
    address: row.address != null ? String(row.address) : null,
    lat: lat != null && Number.isFinite(lat) ? lat : null,
    lng: lng != null && Number.isFinite(lng) ? lng : null,
    phone: null,
    image_url: null,
    kakao_place_url: null,
    naver_place_id: null,
    mood: null,
    tags: null,
    with_kids: null,
    for_work: null,
    reservation_required: null,
    price_level: null,
    updated_at: null,
  };
}

/** home-recommend와 동일하게 `*` — 스키마 차이에 덜 취약 */
function baseStoresQuery(supabase: SupabaseClient) {
  return supabase.from(STORES_TABLE).select("*").not("name", "is", null).neq("name", "");
}

function mapStoresStarRowToStoreRow(raw: Record<string, unknown>): StoreRow {
  const latRaw = raw.lat;
  const lngRaw = raw.lng;
  const latNum =
    typeof latRaw === "number" && Number.isFinite(latRaw)
      ? latRaw
      : latRaw != null && String(latRaw).length
        ? Number(latRaw)
        : null;
  const lngNum =
    typeof lngRaw === "number" && Number.isFinite(lngRaw)
      ? lngRaw
      : lngRaw != null && String(lngRaw).length
        ? Number(lngRaw)
        : null;

  const mood = raw.mood;
  const tags = raw.tags;

  return {
    id: String(raw.id ?? ""),
    name: raw.name != null ? String(raw.name) : null,
    category: raw.category != null ? String(raw.category) : null,
    area: raw.area != null ? String(raw.area) : null,
    address: raw.address != null ? String(raw.address) : null,
    lat: latNum != null && Number.isFinite(latNum) ? latNum : null,
    lng: lngNum != null && Number.isFinite(lngNum) ? lngNum : null,
    phone: raw.phone != null ? String(raw.phone) : null,
    image_url: raw.image_url != null ? String(raw.image_url) : null,
    kakao_place_url: raw.kakao_place_url != null ? String(raw.kakao_place_url) : null,
    naver_place_id: raw.naver_place_id != null ? String(raw.naver_place_id) : null,
    mood: Array.isArray(mood) ? (mood as string[]) : null,
    tags: Array.isArray(tags) ? (tags as string[]) : null,
    description: raw.description != null ? String(raw.description) : null,
    menu_keywords: Array.isArray(raw.menu_keywords) ? (raw.menu_keywords as string[]) : null,
    food_sub_category: raw.food_sub_category != null ? String(raw.food_sub_category) : null,
    with_kids: typeof raw.with_kids === "boolean" ? raw.with_kids : null,
    for_work: typeof raw.for_work === "boolean" ? raw.for_work : null,
    reservation_required: typeof raw.reservation_required === "boolean" ? raw.reservation_required : null,
    price_level: raw.price_level != null ? String(raw.price_level) : null,
    updated_at: raw.updated_at != null ? String(raw.updated_at) : null,
  };
}

export async function fetchStoresByNamePatterns(
  supabase: SupabaseClient,
  patterns: string[]
): Promise<{ rows: StoreRow[]; hadError: boolean }> {
  const byId = new Map<string, StoreRow>();
  let hadError = false;
  const tasks = patterns.map((p) => baseStoresQuery(supabase).ilike("name", `%${p}%`).limit(80));
  const results = await Promise.all(tasks);
  for (const { data, error } of results) {
    if (error) {
      hadError = true;
      console.error("[placeNameSearch] stores ilike", error);
      continue;
    }
    for (const raw of data ?? []) {
      const row = mapStoresStarRowToStoreRow(raw as unknown as Record<string, unknown>);
      if (row.id && !byId.has(row.id)) byId.set(row.id, row);
    }
  }
  return { rows: [...byId.values()], hadError };
}

export async function fetchStoresByNamePrefix(supabase: SupabaseClient, sub: string): Promise<StoreRow[]> {
  const { data, error } = await baseStoresQuery(supabase).ilike("name", `%${sub}%`).limit(50);
  if (error) {
    console.error("[placeNameSearch] stores prefix", error);
    return [];
  }
  return (data ?? []).map((r) => mapStoresStarRowToStoreRow(r as unknown as Record<string, unknown>));
}

export async function fetchStoresByCompactHalves(supabase: SupabaseClient, safe: string): Promise<StoreRow[]> {
  const compact = safe.replace(/\s+/g, "").trim();
  const qc = normCompactName(compact);
  if (qc.length < 4) return [];
  const mid = Math.ceil(compact.length / 2);
  const p1 = sanitizeToken(compact.slice(0, mid));
  const p2 = sanitizeToken(compact.slice(mid));
  if (p1.length < 2 || p2.length < 2) return [];

  const sel = () => baseStoresQuery(supabase);
  const [r1, r2] = await Promise.all([
    sel().ilike("name", `%${p1}%`).limit(120),
    sel().ilike("name", `%${p2}%`).limit(120),
  ]);
  if (r1.error || r2.error) {
    if (r1.error) console.error("[placeNameSearch] stores halves/1", r1.error);
    if (r2.error) console.error("[placeNameSearch] stores halves/2", r2.error);
    return [];
  }
  const rows1 = (r1.data ?? []).map((r) => mapStoresStarRowToStoreRow(r as unknown as Record<string, unknown>));
  const rows2 = (r2.data ?? []).map((r) => mapStoresStarRowToStoreRow(r as unknown as Record<string, unknown>));
  const ids2 = new Set(rows2.map((r) => r.id).filter(Boolean));
  const intersect = rows1.filter((r) => r.id && ids2.has(r.id));
  return intersect.filter((r) => normCompactName(String(r.name ?? "")).includes(qc));
}

function basePlacesQuery(supabase: SupabaseClient) {
  return supabase.from(PLACES_TABLE).select(PLACE_NAME_SELECT).not("name", "is", null).neq("name", "");
}

export async function fetchPlacesByNamePatterns(
  supabase: SupabaseClient,
  patterns: string[]
): Promise<{ rows: StoreRow[]; hadError: boolean }> {
  const byId = new Map<string, StoreRow>();
  let hadError = false;
  const tasks = patterns.map((p) => basePlacesQuery(supabase).ilike("name", `%${p}%`).limit(80));
  const results = await Promise.all(tasks);
  for (const { data, error } of results) {
    if (error) {
      hadError = true;
      console.error("[placeNameSearch] places ilike", error);
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.log("[place-search] error:", (error as { message?: string }).message ?? error);
      }
      continue;
    }
    for (const raw of data ?? []) {
      const row = mapPlaceRowToStoreRow(raw as unknown as Record<string, unknown>);
      if (row.id && !byId.has(row.id)) byId.set(row.id, row);
    }
  }
  return { rows: [...byId.values()], hadError };
}

export async function fetchPlacesByNamePrefix(supabase: SupabaseClient, sub: string): Promise<StoreRow[]> {
  const { data, error } = await basePlacesQuery(supabase).ilike("name", `%${sub}%`).limit(50);
  if (error) {
    console.error("[placeNameSearch] prefix", error);
    return [];
  }
  return (data ?? []).map((r) => mapPlaceRowToStoreRow(r as unknown as Record<string, unknown>));
}

function normCompactName(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

export async function fetchPlacesByCompactHalves(supabase: SupabaseClient, safe: string): Promise<StoreRow[]> {
  const compact = safe.replace(/\s+/g, "").trim();
  const qc = normCompactName(compact);
  if (qc.length < 4) return [];
  const mid = Math.ceil(compact.length / 2);
  const p1 = sanitizeToken(compact.slice(0, mid));
  const p2 = sanitizeToken(compact.slice(mid));
  if (p1.length < 2 || p2.length < 2) return [];

  const sel = () => basePlacesQuery(supabase);
  const [r1, r2] = await Promise.all([
    sel().ilike("name", `%${p1}%`).limit(120),
    sel().ilike("name", `%${p2}%`).limit(120),
  ]);
  if (r1.error || r2.error) {
    if (r1.error) console.error("[placeNameSearch] halves/1", r1.error);
    if (r2.error) console.error("[placeNameSearch] halves/2", r2.error);
    return [];
  }
  const rows1 = (r1.data ?? []).map((r) => mapPlaceRowToStoreRow(r as unknown as Record<string, unknown>));
  const rows2 = (r2.data ?? []).map((r) => mapPlaceRowToStoreRow(r as unknown as Record<string, unknown>));
  const ids2 = new Set(rows2.map((r) => r.id).filter(Boolean));
  const intersect = rows1.filter((r) => r.id && ids2.has(r.id));
  return intersect.filter((r) => normCompactName(String(r.name ?? "")).includes(qc));
}

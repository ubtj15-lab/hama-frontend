export type StoreSuppressionScope =
  | "all"
  | "food"
  | "kids_family"
  | "cafe"
  | "culture"
  | "search";

export type StoreSuppressionRule = {
  id: string;
  store_id: string | null;
  store_name: string | null;
  scope: StoreSuppressionScope | string;
  reason: string | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
};

type ScopeInput = {
  query?: string | null;
  explicitCategory?: string | null;
  explicitIntent?: string | null;
};

type SuppressionOptions<T> = {
  scope: StoreSuppressionScope;
  getStoreId?: (item: T) => string;
  getStoreName?: (item: T) => string;
};

const FOOD_QUERY_TOKENS = ["푸드", "식당", "맛집", "밥", "점심", "저녁", "외식"];
const KIDS_FAMILY_TOKENS = ["아이", "아이랑", "가족", "키즈", "family", "kids"];
const CAFE_TOKENS = ["카페", "커피", "디저트", "베이커리"];
const CULTURE_TOKENS = ["문화", "박물관", "도서관", "미술관", "전시"];

function normalizeText(v: string | null | undefined): string {
  return String(v ?? "").trim().toLowerCase();
}

export function inferStoreSuppressionScope(input: ScopeInput): StoreSuppressionScope {
  const q = normalizeText(input.query);
  const explicitCategory = normalizeText(input.explicitCategory);
  const explicitIntent = normalizeText(input.explicitIntent);

  if (
    FOOD_QUERY_TOKENS.some((w) => q.includes(w)) ||
    explicitCategory === "restaurant" ||
    explicitIntent === "food_general"
  ) {
    return "food";
  }

  if (KIDS_FAMILY_TOKENS.some((w) => q.includes(w))) {
    return "kids_family";
  }

  if (CAFE_TOKENS.some((w) => q.includes(w)) || explicitCategory === "cafe") {
    return "cafe";
  }

  if (CULTURE_TOKENS.some((w) => q.includes(w)) || explicitCategory === "culture") {
    return "culture";
  }

  return "search";
}

export type StoreSuppressionLoad =
  | { status: "ok"; rules: StoreSuppressionRule[] }
  | { status: "failed" };

export const SUPPRESSION_UNAVAILABLE_MESSAGE =
  "가게 확인에 실패해서 추천을 보여드리지 않았어요. 잠시 후 다시 시도해 주세요.";

export const SUPPRESSION_UNAVAILABLE_ERROR = "suppression_unavailable";

type SuppressionQueryResult = {
  data: unknown;
  error: { message: string } | null;
};

export function readStoreSuppressionLoad(result: SuppressionQueryResult): StoreSuppressionLoad {
  if (result.error || !Array.isArray(result.data)) return { status: "failed" };
  return { status: "ok", rules: result.data as StoreSuppressionRule[] };
}

export type PlaceSuppressionRef = { id: string; name: string };

export const SUPPRESSION_FILTER_LIMIT = 400;

export function keptPlaceIds(places: PlaceSuppressionRef[], rules: StoreSuppressionRule[]): string[] {
  const applied = applyStoreSuppression(places, rules, {
    scope: "search",
    getStoreId: (place) => place.id,
    getStoreName: (place) => place.name,
  });
  return applied.next.map((place) => place.id);
}

export function readKeptPlaceIds(requested: PlaceSuppressionRef[], body: unknown): string[] | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (record.status !== "ok" || !Array.isArray(record.keptIds)) return null;
  const allowed = new Set(requested.map((place) => place.id));
  const kept: string[] = [];
  for (const id of record.keptIds) {
    if (typeof id !== "string" || !allowed.has(id) || kept.includes(id)) continue;
    kept.push(id);
  }
  return kept;
}

export async function filterPlacesOnServer(
  scope: StoreSuppressionScope,
  places: PlaceSuppressionRef[]
): Promise<{ status: "ok"; keptIds: string[] } | { status: "failed" }> {
  if (places.length > SUPPRESSION_FILTER_LIMIT) return { status: "failed" };
  try {
    const response = await fetch("/api/stores/suppression-filter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        scope,
        places: places.map((place) => ({ id: place.id, name: place.name })),
      }),
    });
    const body = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) return { status: "failed" };
    const keptIds = readKeptPlaceIds(places, body);
    if (!keptIds) return { status: "failed" };
    return { status: "ok", keptIds };
  } catch {
    return { status: "failed" };
  }
}

export function applyStoreSuppression<T>(
  cards: T[],
  rules: StoreSuppressionRule[],
  options: SuppressionOptions<T>
): { next: T[]; suppressedNames: string[] } {
  if (!Array.isArray(cards) || cards.length === 0 || !Array.isArray(rules) || rules.length === 0) {
    return { next: cards, suppressedNames: [] };
  }

  const getStoreId =
    options.getStoreId ??
    ((item: T) => {
      const x = item as Record<string, unknown>;
      const id = x.store_id ?? x.place_id ?? x.id;
      return String(id ?? "");
    });
  const getStoreName =
    options.getStoreName ??
    ((item: T) => {
      const x = item as Record<string, unknown>;
      return String(x.name ?? "");
    });

  const idSet = new Set(
    rules
      .map((r) => String(r.store_id ?? "").trim())
      .filter(Boolean)
      .map((v) => v.toLowerCase())
  );
  const nameSet = new Set(
    rules
      .filter((r) => !r.store_id)
      .map((r) => String(r.store_name ?? "").trim())
      .filter(Boolean)
      .map((v) => v.toLowerCase())
  );

  const suppressedNames: string[] = [];
  const filtered = cards.filter((card) => {
    const id = getStoreId(card).trim().toLowerCase();
    const name = getStoreName(card).trim();
    const nameLower = name.toLowerCase();
    const matched = (!!id && idSet.has(id)) || (!!nameLower && nameSet.has(nameLower));
    if (matched) suppressedNames.push(name || id || "unknown");
    return !matched;
  });

  if (filtered.length === 0 && cards.length > 0) {
    return { next: [], suppressedNames };
  }

  return { next: filtered, suppressedNames };
}

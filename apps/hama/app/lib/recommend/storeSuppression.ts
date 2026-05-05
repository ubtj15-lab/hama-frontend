import { createClient } from "@supabase/supabase-js";

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

export async function fetchActiveStoreSuppressionRules(
  scope: StoreSuppressionScope
): Promise<StoreSuppressionRule[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return [];

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("store_suppression_rules")
      .select("id, store_id, store_name, scope, reason, starts_at, ends_at, is_active, metadata")
      .eq("is_active", true)
      .lte("starts_at", nowIso)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .or(`scope.eq.all,scope.eq.${scope}`);

    if (error) {
      console.warn("[store suppression] rules fetch failed", { scope, message: error.message });
      return [];
    }
    return Array.isArray(data) ? (data as StoreSuppressionRule[]) : [];
  } catch (e) {
    console.warn("[store suppression] rules fetch exception", { scope, error: e });
    return [];
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
    console.warn("[store suppression] suppressed all results, fallback to original", {
      scope: options.scope,
      originalCount: cards.length,
      ruleCount: rules.length,
    });
    return { next: cards, suppressedNames };
  }

  return { next: filtered, suppressedNames };
}

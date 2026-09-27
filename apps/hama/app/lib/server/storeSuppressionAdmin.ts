import { getSupabaseAdmin } from "./supabaseAdmin";
import {
  keptPlaceIds,
  readStoreSuppressionLoad,
  SUPPRESSION_FILTER_LIMIT,
  type PlaceSuppressionRef,
  type StoreSuppressionLoad,
  type StoreSuppressionScope,
} from "../recommend/storeSuppression";

const SCOPES = new Set<StoreSuppressionScope>([
  "all",
  "food",
  "kids_family",
  "cafe",
  "culture",
  "search",
]);

export function normalizeSuppressionScope(value: unknown): StoreSuppressionScope {
  return typeof value === "string" && SCOPES.has(value as StoreSuppressionScope)
    ? (value as StoreSuppressionScope)
    : "search";
}

export function parsePlaceRefs(value: unknown): PlaceSuppressionRef[] | null {
  if (!Array.isArray(value) || value.length > SUPPRESSION_FILTER_LIMIT) return null;
  const places: PlaceSuppressionRef[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.name !== "string") return null;
    const id = record.id.trim();
    const name = record.name.trim();
    if (!id || id.length > 80 || name.length > 200) return null;
    places.push({ id, name });
  }
  return places;
}

type RuleQuery = () => Promise<{ data: unknown; error: { message: string } | null }>;

async function queryActiveRules(
  scope: StoreSuppressionScope,
  anyScope = false
): Promise<{ data: unknown; error: { message: string } | null }> {
  const admin = getSupabaseAdmin();
  if (!admin) return { data: null, error: { message: "admin_unavailable" } };
  const nowIso = new Date().toISOString();
  let request = admin
    .from("store_suppression_rules")
    .select("store_id, store_name")
    .eq("is_active", true)
    .lte("starts_at", nowIso)
    .or(`ends_at.is.null,ends_at.gt.${nowIso}`);
  if (!anyScope) {
    request = request.or(`scope.eq.all,scope.eq.${scope}`);
  }
  return request;
}

export async function loadActiveStoreSuppressionRules(
  scope: StoreSuppressionScope,
  query: RuleQuery = () => queryActiveRules(scope)
): Promise<StoreSuppressionLoad> {
  try {
    const result = await query();
    const load = readStoreSuppressionLoad(result);
    if (load.status === "failed") {
      console.warn("[store suppression] rules fetch failed", { scope });
    }
    return load;
  } catch {
    console.warn("[store suppression] rules fetch exception", { scope });
    return { status: "failed" };
  }
}

export async function filterPlacesWithAnyActiveSuppressionRule(
  places: PlaceSuppressionRef[]
): Promise<{ status: "ok"; keptIds: string[] } | { status: "failed" }> {
  return filterPlacesWithSuppressionRules("search", places, () => queryActiveRules("search", true));
}

export async function filterPlacesWithSuppressionRules(
  scope: StoreSuppressionScope,
  places: PlaceSuppressionRef[],
  query?: RuleQuery
): Promise<{ status: "ok"; keptIds: string[] } | { status: "failed" }> {
  const load = await loadActiveStoreSuppressionRules(scope, query);
  if (load.status !== "ok") return { status: "failed" };
  return { status: "ok", keptIds: keptPlaceIds(places, load.rules) };
}

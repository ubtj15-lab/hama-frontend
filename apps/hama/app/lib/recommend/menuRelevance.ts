import type { HomeCard } from "@/lib/storeTypes";
import { SEARCH_SYNONYM_GROUPS } from "@/lib/searchSynonyms";
import {
  MENU_RANK_BOOST_EXACT,
  MENU_RANK_BOOST_SEMANTIC,
  MENU_RANK_BOOST_SYNONYM,
} from "./recommendConstants";

export type MenuMatchTier = "exact" | "synonym" | "semantic" | "none";

export type MenuRelevanceMatch = {
  tier: MenuMatchTier;
  exactScore: number;
  synonymScore: number;
  semanticScore: number;
  /** 채널별 합산 raw (정규화 전) */
  raw: number;
  hasExactHit: boolean;
  hasSynonymHit: boolean;
  hasSemanticHit: boolean;
  /** strict filter용: exact 또는 strong synonym */
  hasStrongHit: boolean;
};

function compact(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function spaced(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function termHitsHay(hayCompact: string, haySpaced: string, term: string): boolean {
  const t = String(term ?? "").trim().toLowerCase();
  if (t.length < 2) return false;
  if (haySpaced.includes(t)) return true;
  const tc = compact(t);
  return tc.length >= 2 && hayCompact.includes(tc);
}

const SCORE_EXACT_NAME = 45;
const SCORE_EXACT_MENU_KW = 40;
const SCORE_EXACT_SEARCH_KW = 36;
const SCORE_SYN_NAME = 36;
const SCORE_SYN_MENU_KW = 32;
const SCORE_SYN_SEARCH_KW = 28;
const SCORE_SEMANTIC = 16;

/**
 * Ranking-only related terms. Not used by strict filter.
 * Keep this list tight so semantic bonus does not become another mixed pool.
 */
export const MENU_SEMANTIC_RELATIONS: Record<string, readonly string[]> = {
  해장: ["국밥", "순대국", "순댓국", "뼈해장국", "콩나물국밥", "해장국"],
  국밥: ["해장국", "순댓국"],
};

function storeFields(card: HomeCard): {
  name: string;
  menuKw: string;
  searchKw: string;
  tags: string;
  desc: string;
} {
  const c = card as HomeCard & {
    menu_keywords?: string[];
    search_keywords?: string[];
    tags?: string[];
    description?: string | null;
  };
  return {
    name: String(c.name ?? ""),
    menuKw: Array.isArray(c.menu_keywords) ? c.menu_keywords.join(" ") : "",
    searchKw: Array.isArray(c.search_keywords) ? c.search_keywords.join(" ") : "",
    tags: Array.isArray(c.tags) ? c.tags.join(" ") : "",
    desc: typeof c.description === "string" ? c.description : "",
  };
}

function packedFields(fields: ReturnType<typeof storeFields>) {
  return {
    nameC: compact(fields.name),
    nameS: spaced(fields.name),
    menuC: compact(fields.menuKw),
    menuS: spaced(fields.menuKw),
    searchC: compact(fields.searchKw),
    searchS: spaced(fields.searchKw),
    tagsC: compact(fields.tags),
    tagsS: spaced(fields.tags),
    descC: compact(fields.desc),
    descS: spaced(fields.desc),
  };
}

/**
 * Canonical group terms for a menu intent token.
 * Own dictionary key wins (소금빵 → bakery siblings, not the whole 디저트 group).
 */
export function strongTermsForMenu(menu: string): string[] {
  const raw = String(menu ?? "").trim();
  if (!raw) return [];
  const key = compact(raw);
  const out = new Set<string>();
  out.add(raw);

  const direct = SEARCH_SYNONYM_GROUPS[key] ?? SEARCH_SYNONYM_GROUPS[raw];
  if (direct) {
    for (const t of direct) out.add(String(t).trim());
    return [...out].filter((t) => compact(t).length >= 2);
  }

  for (const [gKey, terms] of Object.entries(SEARCH_SYNONYM_GROUPS)) {
    if (compact(gKey) === key || terms.some((t) => compact(t) === key)) {
      out.add(gKey);
      for (const t of terms) out.add(String(t).trim());
    }
  }

  return [...out].filter((t) => compact(t).length >= 2);
}

/** Terms from the raw query that exist in the shared synonym dictionary. */
export function mentionedMenuTermsInQuery(query: string): string[] {
  const raw = String(query ?? "").trim();
  if (!raw) return [];
  const compactQ = compact(raw);
  const spacedQ = spaced(raw);
  const out: string[] = [];
  const seen = new Set<string>();
  const consider = (term: string) => {
    const t = String(term ?? "").trim();
    if (compact(t).length < 2) return;
    if (!termHitsHay(compactQ, spacedQ, t)) return;
    const k = compact(t);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };
  for (const [gKey, terms] of Object.entries(SEARCH_SYNONYM_GROUPS)) {
    consider(gKey);
    for (const t of terms) consider(t);
  }
  return out;
}

/**
 * Prefer query-mentioned leaf terms (소금빵, 갈비) over canonical parent menuIntent (디저트, 고기).
 */
export function resolveMenuIntentsForMatch(
  menuIntent: string[] | undefined | null,
  query?: string | null
): string[] {
  const mentioned = query ? mentionedMenuTermsInQuery(query) : [];
  if (mentioned.length) return mentioned;
  return (menuIntent ?? []).map((m) => String(m).trim()).filter(Boolean);
}

export function semanticTermsForMenu(menu: string): string[] {
  const raw = String(menu ?? "").trim();
  if (!raw) return [];
  const key = compact(raw);
  const out = new Set<string>();
  const direct = MENU_SEMANTIC_RELATIONS[key] ?? MENU_SEMANTIC_RELATIONS[raw];
  if (direct) {
    for (const t of direct) out.add(String(t).trim());
  }
  for (const [gKey, terms] of Object.entries(MENU_SEMANTIC_RELATIONS)) {
    if (compact(gKey) === key) {
      for (const t of terms) out.add(String(t).trim());
    }
  }
  const strong = new Set(strongTermsForMenu(raw).map(compact));
  return [...out].filter((t) => compact(t).length >= 2 && !strong.has(compact(t)));
}

function bestChannelScore(
  packed: ReturnType<typeof packedFields>,
  terms: readonly string[],
  scores: { name: number; menu: number; search: number; allowDescExact?: boolean; desc?: number }
): number {
  let best = 0;
  for (const term of terms) {
    if (termHitsHay(packed.nameC, packed.nameS, term)) best = Math.max(best, scores.name);
    if (termHitsHay(packed.menuC, packed.menuS, term)) best = Math.max(best, scores.menu);
    if (termHitsHay(packed.searchC, packed.searchS, term)) best = Math.max(best, scores.search);
    if (scores.allowDescExact && scores.desc && termHitsHay(packed.descC, packed.descS, term)) {
      best = Math.max(best, scores.desc);
    }
    if (termHitsHay(packed.tagsC, packed.tagsS, term)) {
      best = Math.max(best, Math.min(scores.menu, 35));
    }
  }
  return best;
}

export const MENU_RAW_CAP_PER_INTENT = SCORE_EXACT_NAME;

/**
 * Match store text against query menu intents using the shared synonym dictionary.
 */
export function matchMenuRelevance(
  card: HomeCard,
  menuIntents: string[] | undefined | null
): MenuRelevanceMatch {
  const menus = (menuIntents ?? []).map((m) => String(m).trim()).filter(Boolean);
  if (!menus.length) {
    return {
      tier: "none",
      exactScore: 0,
      synonymScore: 0,
      semanticScore: 0,
      raw: 0,
      hasExactHit: false,
      hasSynonymHit: false,
      hasSemanticHit: false,
      hasStrongHit: false,
    };
  }

  const packed = packedFields(storeFields(card));
  let exactScore = 0;
  let synonymScore = 0;
  let semanticScore = 0;

  for (const menu of menus) {
    const strong = strongTermsForMenu(menu);
    const exactTerms = [menu, ...strong.filter((t) => compact(t) === compact(menu))];
    const synonymTerms = strong.filter((t) => compact(t) !== compact(menu));
    const semanticTerms = semanticTermsForMenu(menu);

    exactScore = Math.max(
      exactScore,
      bestChannelScore(packed, exactTerms, {
        name: SCORE_EXACT_NAME,
        menu: SCORE_EXACT_MENU_KW,
        search: SCORE_EXACT_SEARCH_KW,
        allowDescExact: compact(menu).length >= 3,
        desc: 20,
      })
    );
    synonymScore = Math.max(
      synonymScore,
      bestChannelScore(packed, synonymTerms, {
        name: SCORE_SYN_NAME,
        menu: SCORE_SYN_MENU_KW,
        search: SCORE_SYN_SEARCH_KW,
      })
    );
    semanticScore = Math.max(
      semanticScore,
      bestChannelScore(packed, semanticTerms, {
        name: SCORE_SEMANTIC,
        menu: SCORE_SEMANTIC,
        search: SCORE_SEMANTIC,
      })
    );
  }

  const hasExactHit = exactScore > 0;
  const hasSynonymHit = synonymScore > 0;
  const hasSemanticHit = semanticScore > 0;
  const raw = exactScore + synonymScore + semanticScore;
  const tier: MenuMatchTier = hasExactHit
    ? "exact"
    : hasSynonymHit
      ? "synonym"
      : hasSemanticHit
        ? "semantic"
        : "none";

  return {
    tier,
    exactScore,
    synonymScore,
    semanticScore,
    raw,
    hasExactHit,
    hasSynonymHit,
    hasSemanticHit,
    hasStrongHit: hasExactHit || hasSynonymHit,
  };
}

export function menuRankBoostForTier(tier: MenuMatchTier): number {
  if (tier === "exact") return MENU_RANK_BOOST_EXACT;
  if (tier === "synonym") return MENU_RANK_BOOST_SYNONYM;
  if (tier === "semantic") return MENU_RANK_BOOST_SEMANTIC;
  return 0;
}

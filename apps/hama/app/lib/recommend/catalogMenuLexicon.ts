import type { HomeCard } from "@/lib/storeTypes";
import { SEARCH_SYNONYM_GROUPS } from "@/lib/searchSynonyms";

export type MenuTermKind = "FOOD_MENU" | "GENERIC_FOOD" | "NON_MENU" | "AMBIGUOUS";

export type CatalogMenuEntry = {
  normalizedTerm: string;
  originalTerms: string[];
  storeCount: number;
  restaurantCount: number;
  storeIds: string[];
  exampleStoreNames: string[];
  categories: string[];
  sourceFields: string[];
  menuKeywordStoreCount: number;
  searchKeywordStoreCount: number;
  nameStoreCount: number;
  confidence: number;
  specificity: number;
  kind: MenuTermKind;
};

export type CatalogMenuMatch = {
  term: string;
  normalizedTerm: string;
  confidence: number;
  storeCount: number;
  sourceFields: string[];
  matchType: "substring" | "token_prefix" | "token_exact";
  kind: MenuTermKind;
};

export type CatalogMenuResolution = {
  staticMenuIntent: string[];
  catalogMenuMatches: CatalogMenuMatch[];
  catalogMenuPrimary: string | null;
  catalogMenuSecondary: string[];
  resolvedMenuIntent: string[];
  collision: string | null;
};

export type CatalogMenuLexicon = {
  signature: string;
  catalogCount: number;
  entries: CatalogMenuEntry[];
};

const GENERIC_FOOD_TERMS = new Set(
  [
    "고기",
    "분식",
    "디저트",
    "중식",
    "한식",
    "일식",
    "양식",
    "브런치",
    "해장",
    "국물",
    "식사",
    "밥",
    "음식",
    "메뉴",
    "요리",
    ...Object.keys(SEARCH_SYNONYM_GROUPS),
  ].map((t) => compact(t))
);

/** Context / place / mood — not a dish. Built from existing catalog noise + scenario language, not Challenge menus. */
const CONTEXT_STOPWORDS = new Set(
  [
    "맛집",
    "추천",
    "근처",
    "분위기",
    "주차",
    "데이트",
    "가족",
    "아이",
    "애들",
    "친구",
    "혼자",
    "혼밥",
    "회식",
    "모임",
    "외식",
    "가족외식",
    "가족식사",
    "친구모임",
    "오산",
    "동탄",
    "세교",
    "오산점",
    "동탄점",
    "오산맛집",
    "동탄맛집",
    "restaurant",
    "cafe",
    "카페",
    "커피",
    "식당",
    "레스토랑",
    "기본",
    "카카오",
    "네이버",
    "보통",
    "식사",
    "아이동반",
    "예약필수",
    "가성비",
    "업무",
    "활기찬",
    "캐주얼한",
    "편안한",
    "서민적인",
    "푸짐한",
    "프리미엄",
    "관리",
    "액티비티",
    "미용",
    "뷰티",
    "오늘",
    "시간",
    "날씨",
    "나들이",
    "놀거리",
    "갈곳",
    "조용한",
    "조용히",
    "아늑한",
    "아늑",
    "단체",
    "포장",
    "배달",
    "웨이팅",
    "예약",
    "테라스",
    "야외",
    "실내",
    "키즈",
    "키즈룸",
    "아이동반",
    "인기",
    "핫플",
    "오픈",
    "혼술",
    "술집",
    "포차",
    "모둠",
    "괜찮은",
    "좋은",
    "점심",
    "저녁",
    "아침",
    "점심식사",
    "저녁식사",
    "점심저녁",
    "단체모임",
    "캐주얼",
    "다이닝",
    "코스요리",
    "한식집",
    "중식집",
    "일식집",
    "맛있는",
    "생각",
    "먹고",
    "싶어",
    "어디",
    "곳",
    "데",
    "집",
    "점",
    "차",
    "탕",
    "국",
    "면",
    "밥",
    "룸",
    "홀",
    "관",
    "동",
    "리",
    "시",
    "구",
    "로",
    "길",
  ].map((t) => compact(t))
);

const SHORT_BLOCK = new Set(["차", "탕", "집", "곳", "데", "밥", "점", "국", "면", "룸", "홀"]);

function compact(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .replace(/\s+/g, "");
}

function categoryKey(card: HomeCard): string {
  return String(card.category ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function isRestaurant(card: HomeCard): boolean {
  const c = categoryKey(card);
  return c === "restaurant" || c === "fd6" || c.includes("food");
}

function isContextLike(norm: string): boolean {
  if (CONTEXT_STOPWORDS.has(norm) || SHORT_BLOCK.has(norm)) return true;
  if (/점심|저녁|아침|브런치타임/.test(norm) && !GENERIC_FOOD_TERMS.has(norm)) return true;
  if (/모임|다이닝|동선|분위기|쇼핑|드라이브|부모님|어린이|기념일|코스/.test(norm)) return true;
  if (/동탄|오산|세교|공원|호수|테라스/.test(norm)) return true;
  if (/[한함운]$/.test(norm) && norm.length >= 3) return true;
  if (/적인$|스러움$|스러운$/.test(norm)) return true;
  if (norm.endsWith("적") && norm.length >= 4) return true;
  if (/무한|리필|뷔페|안주|건강식|이자카야|친화|광장|간편|야식|정식/.test(norm)) return true;
  if (norm.endsWith("집") && norm.length >= 3) return true;
  if (norm.endsWith("식당") || norm.endsWith("푸드") || norm.endsWith("참")) return true;
  if (/레이크|꼬모|타임테라스|활기|로컬|가성비|맛집/.test(norm)) return true;
  if (norm.length >= 7) return true;
  return false;
}

function classifyKind(norm: string, menuCount: number, restShare: number): MenuTermKind {
  if (CONTEXT_STOPWORDS.has(norm) || SHORT_BLOCK.has(norm) || isContextLike(norm)) return "NON_MENU";
  if (GENERIC_FOOD_TERMS.has(norm)) return "GENERIC_FOOD";
  if (menuCount > 0) return "FOOD_MENU";
  if (restShare >= 0.8 && norm.length >= 2 && norm.length <= 6) return "FOOD_MENU";
  if (restShare < 0.5) return "AMBIGUOUS";
  return "AMBIGUOUS";
}

function confidenceOf(e: {
  normalizedTerm: string;
  menuKeywordStoreCount: number;
  searchKeywordStoreCount: number;
  restaurantCount: number;
  storeCount: number;
  kind: MenuTermKind;
  nameStoreCount: number;
}): number {
  let c = 0;
  if (e.menuKeywordStoreCount > 0) c += 0.42;
  c += Math.min(e.menuKeywordStoreCount, 12) * 0.03;
  c += Math.min(e.restaurantCount, 15) * 0.02;
  if (e.searchKeywordStoreCount > 0 && e.menuKeywordStoreCount === 0) c += 0.18;
  if (e.nameStoreCount > 0) c += 0.08;
  if (e.kind === "FOOD_MENU") c += 0.12;
  if (e.kind === "GENERIC_FOOD") c += 0.04;
  if (e.normalizedTerm.length >= 3) c += 0.06;
  if (e.normalizedTerm.length >= 4) c += 0.04;
  return Math.max(0, Math.min(1, c));
}

function specificityOf(norm: string, kind: MenuTermKind, menuCount: number): number {
  let s = norm.length;
  if (menuCount > 0) s += 2;
  if (kind === "GENERIC_FOOD") s -= 3;
  if (kind === "FOOD_MENU") s += 1;
  return s;
}

type Acc = {
  original: Set<string>;
  storeIds: Set<string>;
  names: Map<string, string>;
  categories: Set<string>;
  sources: Set<string>;
  menuStores: Set<string>;
  searchStores: Set<string>;
  nameStores: Set<string>;
  restStores: Set<string>;
};

function ensureAcc(map: Map<string, Acc>, norm: string): Acc {
  let a = map.get(norm);
  if (!a) {
    a = {
      original: new Set(),
      storeIds: new Set(),
      names: new Map(),
      categories: new Set(),
      sources: new Set(),
      menuStores: new Set(),
      searchStores: new Set(),
      nameStores: new Set(),
      restStores: new Set(),
    };
    map.set(norm, a);
  }
  return a;
}

function addTerm(
  map: Map<string, Acc>,
  raw: string,
  card: HomeCard,
  field: "menu_keywords" | "search_keywords" | "name"
): void {
  const original = String(raw ?? "").trim();
  const norm = compact(original);
  if (norm.length < 2) return;
  if (SHORT_BLOCK.has(norm)) return;
  const acc = ensureAcc(map, norm);
  acc.original.add(original);
  acc.storeIds.add(card.id);
  acc.names.set(card.id, card.name);
  acc.categories.add(categoryKey(card) || "unknown");
  acc.sources.add(field);
  if (field === "menu_keywords") acc.menuStores.add(card.id);
  if (field === "search_keywords") acc.searchStores.add(card.id);
  if (field === "name") acc.nameStores.add(card.id);
  if (isRestaurant(card)) acc.restStores.add(card.id);
}

const NAME_FOOD_CHUNK = /([가-힣]{2,8})(?:구이|볶음|전골|무침|조림|찜|탕|국밥|집)/g;

function nameFoodChunks(name: string): string[] {
  const out: string[] = [];
  const n = String(name ?? "");
  NAME_FOOD_CHUNK.lastIndex = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(NAME_FOOD_CHUNK.source, "g");
  while ((m = re.exec(n))) {
    const chunk = m[1];
    if (chunk && compact(chunk).length >= 2) out.push(chunk);
  }
  return out;
}

function lexiconSignature(cards: HomeCard[]): string {
  const first = cards[0]?.id ?? "";
  const last = cards[cards.length - 1]?.id ?? "";
  return `${cards.length}:${first}:${last}`;
}

let cached: CatalogMenuLexicon | null = null;

export function setCatalogMenuLexicon(lex: CatalogMenuLexicon | null): void {
  cached = lex;
}

export function getCatalogMenuLexicon(): CatalogMenuLexicon | null {
  return cached;
}

export function buildCatalogMenuLexicon(cards: HomeCard[]): CatalogMenuLexicon {
  const map = new Map<string, Acc>();
  const sortedCards = [...cards].sort((a, b) => a.id.localeCompare(b.id));

  for (const card of sortedCards) {
    for (const t of card.menu_keywords ?? []) addTerm(map, t, card, "menu_keywords");
    if (isRestaurant(card)) {
      for (const t of card.search_keywords ?? []) addTerm(map, t, card, "search_keywords");
      for (const t of nameFoodChunks(card.name)) addTerm(map, t, card, "name");
    }
  }

  const entries: CatalogMenuEntry[] = [];
  const norms = [...map.keys()].sort((a, b) => a.localeCompare(b, "ko"));
  for (const norm of norms) {
    const acc = map.get(norm)!;
    const storeCount = acc.storeIds.size;
    const restaurantCount = acc.restStores.size;
    const restShare = storeCount ? restaurantCount / storeCount : 0;
    const menuCount = acc.menuStores.size;
    const kind = classifyKind(norm, menuCount, restShare);
    const storeIds = [...acc.storeIds].sort((a, b) => a.localeCompare(b));
    const exampleStoreNames = storeIds.slice(0, 5).map((id) => acc.names.get(id) ?? id);
    const partial = {
      normalizedTerm: norm,
      menuKeywordStoreCount: menuCount,
      searchKeywordStoreCount: acc.searchStores.size,
      restaurantCount,
      storeCount,
      kind,
      nameStoreCount: acc.nameStores.size,
    };
    entries.push({
      normalizedTerm: norm,
      originalTerms: [...acc.original].sort((a, b) => a.localeCompare(b, "ko")),
      storeCount,
      restaurantCount,
      storeIds: storeIds.slice(0, 40),
      exampleStoreNames,
      categories: [...acc.categories].sort(),
      sourceFields: [...acc.sources].sort(),
      menuKeywordStoreCount: menuCount,
      searchKeywordStoreCount: acc.searchStores.size,
      nameStoreCount: acc.nameStores.size,
      confidence: confidenceOf(partial),
      specificity: specificityOf(norm, kind, menuCount),
      kind,
    });
  }

  entries.sort((a, b) => {
    if (b.specificity !== a.specificity) return b.specificity - a.specificity;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.normalizedTerm.localeCompare(b.normalizedTerm, "ko");
  });

  return {
    signature: lexiconSignature(cards),
    catalogCount: cards.length,
    entries,
  };
}

export function ensureCatalogMenuLexicon(cards: HomeCard[]): CatalogMenuLexicon {
  const sig = lexiconSignature(cards);
  if (cached && cached.signature === sig) return cached;
  cached = buildCatalogMenuLexicon(cards);
  return cached;
}

function usableForMatch(e: CatalogMenuEntry): boolean {
  if (e.kind !== "FOOD_MENU") return false;
  if (e.normalizedTerm.length < 2) return false;
  if (e.normalizedTerm.length === 2) {
    if (e.menuKeywordStoreCount >= 1) return true;
    if (e.searchKeywordStoreCount >= 1 && e.restaurantCount >= 1) return true;
    return e.restaurantCount >= 3 || e.confidence >= 0.35;
  }
  return e.confidence >= 0.22 || e.menuKeywordStoreCount >= 1 || e.restaurantCount >= 2;
}

function tokenizeQuery(q: string): string[] {
  const stripped = String(q ?? "")
    .toLowerCase()
    .replace(/[은는이가을를의에서로와과도만께랑이랑요죠]\s*/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
  return stripped
    .split(/\s+/)
    .map((t) => compact(t))
    .filter((t) => t.length >= 2 && !SHORT_BLOCK.has(t) && !CONTEXT_STOPWORDS.has(t));
}

const PREFIX_REST_OK = /^(샤브|구이|볶음|전골|무침|조림|찜|탕|국밥|국수|면|밥|회|까스|가스|커리|찌개|조림)$/;
const PREFIX_BLOCK_TOKS = new Set(["매운", "뜨거운", "따뜻한", "달달한", "간단한", "조용한", "한식", "중식", "일식", "양식"]);

export function matchCatalogMenusInQuery(
  rawQuery: string,
  lexicon: CatalogMenuLexicon | null | undefined
): CatalogMenuMatch[] {
  if (!lexicon?.entries.length) return [];
  const raw = String(rawQuery ?? "").trim();
  if (!raw) return [];
  const compactQ = compact(raw);
  if (compactQ.length < 2) return [];
  const tokens = tokenizeQuery(raw);
  const usable = lexicon.entries.filter(usableForMatch);
  const hits: CatalogMenuMatch[] = [];

  for (const e of usable) {
    const term = e.normalizedTerm;
    let matchType: CatalogMenuMatch["matchType"] | null = null;
    if (compactQ.includes(term)) {
      matchType = "substring";
    } else {
      for (const tok of tokens) {
        if (tok === term) {
          matchType = "token_exact";
          break;
        }
        if (PREFIX_BLOCK_TOKS.has(tok)) continue;
        if (term.startsWith(tok) && tok.length >= 2) {
          const rest = term.slice(tok.length);
          if (rest.length >= 2 && PREFIX_REST_OK.test(rest)) {
            matchType = "token_prefix";
            break;
          }
        }
      }
    }
    if (!matchType) continue;
    hits.push({
      term: e.originalTerms[0] ?? e.normalizedTerm,
      normalizedTerm: e.normalizedTerm,
      confidence: e.confidence,
      storeCount: e.storeCount,
      sourceFields: e.sourceFields,
      matchType,
      kind: e.kind,
    });
  }

  hits.sort((a, b) => {
    const prefixRank = (m: CatalogMenuMatch) => (m.matchType === "token_prefix" ? 1 : 0);
    if (prefixRank(a) !== prefixRank(b)) return prefixRank(a) - prefixRank(b);
    if (b.normalizedTerm.length !== a.normalizedTerm.length) return b.normalizedTerm.length - a.normalizedTerm.length;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.normalizedTerm.localeCompare(b.normalizedTerm, "ko");
  });

  const kept: CatalogMenuMatch[] = [];
  for (const h of hits) {
    const absorbed = kept.some((k) => {
      if (k.normalizedTerm === h.normalizedTerm) return true;
      if (!k.normalizedTerm.includes(h.normalizedTerm) && !h.normalizedTerm.includes(k.normalizedTerm)) return false;
      if (h.normalizedTerm.includes(k.normalizedTerm) && h.normalizedTerm.length > k.normalizedTerm.length) {
        return k.matchType === "token_prefix" || compactQ.includes(h.normalizedTerm);
      }
      return k.normalizedTerm.includes(h.normalizedTerm) && k.normalizedTerm.length > h.normalizedTerm.length;
    });
    if (absorbed) continue;
    kept.push(h);
  }
  return kept;
}

export function resolveCatalogMenus(opts: {
  staticMenuIntent: string[];
  catalogMatches: CatalogMenuMatch[];
  excludedMenus?: string[];
}): CatalogMenuResolution {
  const staticMenuIntent = [...new Set((opts.staticMenuIntent ?? []).map((m) => String(m).trim()).filter(Boolean))];
  const excluded = new Set((opts.excludedMenus ?? []).map(compact));
  const catalogMenuMatches = opts.catalogMatches.filter((m) => !excluded.has(m.normalizedTerm));

  const staticCompact = new Set(staticMenuIntent.map(compact));
  const collision =
    staticMenuIntent.length && catalogMenuMatches.some((m) => !staticCompact.has(m.normalizedTerm))
      ? "static_and_dynamic"
      : catalogMenuMatches.length > 1
        ? "multiple_dynamic"
        : null;

  let catalogMenuPrimary: string | null = null;
  const catalogMenuSecondary: string[] = [];
  if (!staticMenuIntent.length) {
    catalogMenuPrimary = catalogMenuMatches[0]?.term ?? null;
    for (const m of catalogMenuMatches.slice(1)) catalogMenuSecondary.push(m.term);
  } else {
    for (const m of catalogMenuMatches) {
      if (staticCompact.has(m.normalizedTerm)) continue;
      const coveredByStatic = staticMenuIntent.some((s) => {
        const sc = compact(s);
        return sc === m.normalizedTerm || sc.includes(m.normalizedTerm) || m.normalizedTerm.includes(sc);
      });
      if (coveredByStatic) continue;
      catalogMenuSecondary.push(m.term);
    }
  }

  const resolved = [...staticMenuIntent];
  if (catalogMenuPrimary && !resolved.some((r) => compact(r) === compact(catalogMenuPrimary!))) {
    resolved.unshift(catalogMenuPrimary);
  }
  for (const s of catalogMenuSecondary) {
    if (!resolved.some((r) => compact(r) === compact(s))) resolved.push(s);
  }

  return {
    staticMenuIntent,
    catalogMenuMatches,
    catalogMenuPrimary,
    catalogMenuSecondary,
    resolvedMenuIntent: resolved,
    collision,
  };
}

export function selectCatalogMenuHoldout(
  lexicon: CatalogMenuLexicon,
  excludedNormalized: Set<string>,
  n = 20
): CatalogMenuEntry[] {
  const menuFirst = lexicon.entries
    .filter((e) => e.kind === "FOOD_MENU")
    .filter((e) => e.menuKeywordStoreCount >= 1)
    .filter((e) => e.normalizedTerm.length >= 2)
    .filter((e) => !excludedNormalized.has(e.normalizedTerm))
    .filter((e) => ![...excludedNormalized].some((x) => x.length >= 2 && (e.normalizedTerm.includes(x) || x.includes(e.normalizedTerm))))
    .filter(usableForMatch);

  menuFirst.sort((a, b) => {
    const sa = a.menuKeywordStoreCount * 4 + a.restaurantCount + a.normalizedTerm.length;
    const sb = b.menuKeywordStoreCount * 4 + b.restaurantCount + b.normalizedTerm.length;
    if (sb !== sa) return sb - sa;
    return a.normalizedTerm.localeCompare(b.normalizedTerm, "ko");
  });

  if (menuFirst.length >= n) return menuFirst.slice(0, n);

  const seen = new Set(menuFirst.map((e) => e.normalizedTerm));
  const extra = lexicon.entries
    .filter((e) => e.kind === "FOOD_MENU")
    .filter((e) => e.menuKeywordStoreCount === 0)
    .filter((e) => e.normalizedTerm.length >= 2 && e.normalizedTerm.length <= 4)
    .filter((e) => !e.normalizedTerm.endsWith("집"))
    .filter((e) => !excludedNormalized.has(e.normalizedTerm))
    .filter((e) => ![...excludedNormalized].some((x) => x.length >= 2 && (e.normalizedTerm.includes(x) || x.includes(e.normalizedTerm))))
    .filter((e) => !seen.has(e.normalizedTerm))
    .filter(usableForMatch)
    .sort((a, b) => {
      const sa = a.restaurantCount + a.normalizedTerm.length;
      const sb = b.restaurantCount + b.normalizedTerm.length;
      if (sb !== sa) return sb - sa;
      return a.normalizedTerm.localeCompare(b.normalizedTerm, "ko");
    });
  return [...menuFirst, ...extra].slice(0, n);
}

export function catalogMenuDebugFields(resolution: CatalogMenuResolution | undefined | null): Record<string, unknown> {
  if (!resolution) {
    return {
      staticMenuIntent: [],
      catalogMenuMatches: [],
      catalogMenuPrimary: null,
      catalogMenuSecondary: [],
      resolvedMenuIntent: [],
    };
  }
  return {
    staticMenuIntent: resolution.staticMenuIntent,
    catalogMenuMatches: resolution.catalogMenuMatches,
    catalogMenuPrimary: resolution.catalogMenuPrimary,
    catalogMenuSecondary: resolution.catalogMenuSecondary,
    resolvedMenuIntent: resolution.resolvedMenuIntent,
    menuCollision: resolution.collision,
  };
}

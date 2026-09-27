import { expandSearchQuery } from "@/lib/searchSynonyms";
import { normIntentQuery } from "./intentQueryNormalize";
import type {
  IntentCategory,
  ParsedRecommendationQuery,
  QueryUnderstandingCategory,
} from "./types";
import { applyNegationToParsedQuery, parseQueryNegation } from "./negationUnderstanding";
import { applyVenuePolarityToParsedQuery } from "./venuePolarity";

function compact(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function containsPhrase(spaced: string, packed: string, phrase: string): boolean {
  const p = String(phrase ?? "")
    .toLowerCase()
    .trim();
  if (p.length < 2) return false;
  if (spaced.includes(p)) return true;
  const pc = compact(p);
  return pc.length >= 2 && packed.includes(pc);
}

export type PhraseSignal = {
  phrases: readonly string[];
  category?: QueryUnderstandingCategory;
  categoryWeight?: number;
  menu?: string;
  purpose?: string;
  companion?: string;
  context?: string;
  constraint?: string;
  venue?: string;
};

/**
 * 확장 가능한 구문 사전. 긴 구문이 먼저 매칭되도록 understandQuery에서 정렬한다.
 * exact equality가 아니라 includes/compact contains.
 */
export const QUERY_PHRASE_SIGNALS: readonly PhraseSignal[] = [
  // kids cafe — coffee cafe 보다 우선
  {
    phrases: ["키즈카페", "키즈 카페", "놀이카페", "키즈룸", "애들 놀 수 있는 카페", "애들이 놀 수 있는 카페", "아이가 놀 수 있는 카페"],
    category: "activity",
    categoryWeight: 8,
    purpose: "kids_cafe",
    companion: "child",
    menu: "키즈카페",
    venue: "kids_cafe",
  },
  // dessert / bakery / brunch (cafe-leaning)
  {
    phrases: ["달달한 거", "달달한거", "단 거", "단거", "디저트", "케이크", "케익", "마카롱", "베이커리", "빵집", "소금빵", "갓 구운 빵"],
    category: "cafe",
    categoryWeight: 6,
    menu: "디저트",
    purpose: "dessert",
  },
  {
    phrases: ["브런치 카페", "브런치카페", "브런치"],
    category: "cafe",
    categoryWeight: 5,
    menu: "브런치",
    purpose: "brunch",
  },
  // meat
  {
    phrases: [
      "고깃집",
      "고기집",
      "고기 먹자",
      "고기 먹고",
      "고기 구워",
      "삼겹살",
      "목살",
      "소고기",
      "돼지고기",
      "갈비집",
      "우대갈비",
      "숯불구이",
      "갈비",
      "고기",
    ],
    category: "restaurant",
    categoryWeight: 7,
    menu: "고기",
    purpose: "meat",
  },
  {
    phrases: ["분식", "떡볶이", "김밥"],
    category: "restaurant",
    categoryWeight: 6,
    menu: "분식",
  },
  {
    phrases: ["치킨집", "치킨", "치맥"],
    category: "restaurant",
    categoryWeight: 6,
    menu: "치킨",
  },
  {
    phrases: ["이탈리안", "이탈리아", "파스타집"],
    category: "restaurant",
    categoryWeight: 6,
    menu: "파스타",
  },
  {
    phrases: ["칼국수", "손칼국수"],
    category: "restaurant",
    categoryWeight: 7,
    menu: "칼국수",
  },
  {
    phrases: ["돈까스집", "돈가스집", "돈까스", "돈가스", "경양식 돈가스", "수제 돈까스"],
    category: "restaurant",
    categoryWeight: 7,
    menu: "돈까스",
  },
  {
    phrases: ["해장할", "해장국", "해장", "숙취", "속 풀리는", "속풀리는", "몸 녹일", "몸 녹"],
    category: "restaurant",
    categoryWeight: 6,
    menu: "해장",
    context: "hangover",
    purpose: "hangover",
  },
  {
    phrases: ["국물", "뜨끈한"],
    category: "restaurant",
    categoryWeight: 4,
    context: "brothy",
    purpose: "brothy",
  },
  {
    phrases: ["회식할", "회식 장소", "팀 회식", "회식"],
    category: "restaurant",
    categoryWeight: 6,
    purpose: "group_dinner",
    companion: "group",
  },
  {
    phrases: ["외식할", "외식"],
    category: "restaurant",
    categoryWeight: 5,
    purpose: "dining",
  },
  {
    phrases: ["매운 거", "매운거", "알싸한", "매운"],
    category: "restaurant",
    categoryWeight: 4,
    purpose: "spicy",
    context: "spicy",
  },
  // culture / activity
  {
    phrases: ["전시 볼", "전시회", "미술관", "박물관", "과학관", "도서관", "실내 관람", "관람할", "전시"],
    category: "culture",
    categoryWeight: 7,
    purpose: "culture",
  },
  {
    phrases: ["실내 놀이", "실내놀이터", "키즈 실내"],
    category: "activity",
    categoryWeight: 6,
    purpose: "indoor_play",
    companion: "child",
  },
  {
    phrases: ["실내에서 놀", "실내에서놀", "실내 놀거리", "실내놀거리"],
    purpose: "play",
    context: "indoor",
    constraint: "indoor",
  },
  // parking is a constraint, not LIFE
  {
    phrases: ["주차 되는", "주차되는", "주차 편한", "주차편한", "주차 가능", "주차가능", "주차"],
    constraint: "parking",
  },
  // weather / indoor
  {
    phrases: ["비 오", "비오", "장마", "우산"],
    context: "rain",
    constraint: "indoor",
  },
  {
    phrases: ["실내"],
    constraint: "indoor",
    context: "indoor",
  },
];

const CATEGORY_TO_ROUTE: Record<QueryUnderstandingCategory, IntentCategory> = {
  restaurant: "FOOD",
  cafe: "CAFE",
  activity: "ACTIVITY",
  culture: "ACTIVITY",
  beauty: "BEAUTY",
  life: "LIFE",
};

const EXPLICIT_CAFE = /카페|커피|디저트|베이커리|빵집/;
const EXPLICIT_RESTAURANT = /식당|레스토랑|맛집|밥집|고깃집|고기집|외식|회식/;
const EXPLICIT_KIDS_CAFE = /키즈\s*카페|키즈카페|놀이카페|키즈룸/;
const WEAK_DISCOVERY =
  /심심|뭐하지|어디\s*가지|갈\s*곳|갈만한\s*곳|데이트할\s*곳|데이트하기\s*좋은\s*곳$/;

export function understandQuery(rawQuery: string): ParsedRecommendationQuery {
  const raw = String(rawQuery ?? "").trim();
  const negation = parseQueryNegation(raw);
  const signalSource = negation.isNegationQuery ? negation.positiveRemainder || raw : raw;
  const normalizedQuery = normIntentQuery(raw);
  const packed = compact(normIntentQuery(signalSource));
  const spaced = normIntentQuery(signalSource);
  const out: ParsedRecommendationQuery = {
    rawQuery: raw,
    normalizedQuery,
    menuIntents: [],
    purposeIntents: [],
    venueIntents: [],
    companionIntents: [],
    contextIntents: [],
    hardConstraints: [],
    expandedKeywords: expandSearchQuery(signalSource),
    secondaryCategories: [],
    route: "MIXED",
    strongVertical: false,
    negation,
  };

  const categoryScores = new Map<QueryUnderstandingCategory, number>();
  const signals = [...QUERY_PHRASE_SIGNALS].sort((a, b) => {
    const la = Math.max(...a.phrases.map((p) => p.length), 0);
    const lb = Math.max(...b.phrases.map((p) => p.length), 0);
    return lb - la;
  });

  for (const rule of signals) {
    const hit = rule.phrases.some((p) => containsPhrase(spaced, packed, p));
    if (!hit) continue;
    if (rule.menu) out.menuIntents = [...new Set([...(out.menuIntents ?? []), rule.menu])];
    if (rule.purpose) out.purposeIntents = [...new Set([...(out.purposeIntents ?? []), rule.purpose])];
    if (rule.venue) out.venueIntents = [...new Set([...(out.venueIntents ?? []), rule.venue])];
    if (rule.companion) out.companionIntents = [...new Set([...(out.companionIntents ?? []), rule.companion])];
    if (rule.context) out.contextIntents = [...new Set([...(out.contextIntents ?? []), rule.context])];
    if (rule.constraint === "parking") {
      out.parkingPreferred = true;
      out.hardConstraints = [...new Set([...(out.hardConstraints ?? []), "parking"])];
    }
    if (rule.constraint === "indoor") {
      out.hardConstraints = [...new Set([...(out.hardConstraints ?? []), "indoor"])];
    }
    if (rule.category) {
      const w = rule.categoryWeight ?? 1;
      categoryScores.set(rule.category, (categoryScores.get(rule.category) ?? 0) + w);
    }
  }

  const childCue =
    (out.companionIntents ?? []).includes("child") ||
    /(아이|애들|애 |키즈|유아|초등|영유아)/.test(spaced);
  const indoorCue =
    (out.hardConstraints ?? []).includes("indoor") || (out.contextIntents ?? []).includes("indoor");
  const playCue = (out.purposeIntents ?? []).some((p) => p === "play" || p === "indoor_play");
  if (childCue && indoorCue && playCue) {
    out.purposeIntents = [...new Set([...(out.purposeIntents ?? []), "indoor_play"])];
    out.companionIntents = [...new Set([...(out.companionIntents ?? []), "child"])];
  }

  if (EXPLICIT_KIDS_CAFE.test(spaced) && !negation.excludedVenues.includes("kids_cafe")) {
    categoryScores.set("activity", (categoryScores.get("activity") ?? 0) + 10);
    out.companionIntents = [...new Set([...(out.companionIntents ?? []), "child"])];
    out.purposeIntents = [...new Set([...(out.purposeIntents ?? []), "kids_cafe"])];
    out.venueIntents = [...new Set([...(out.venueIntents ?? []), "kids_cafe"])];
  }

  const ranked = [...categoryScores.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (top && top[1] > 0) {
    out.primaryCategory = top[0];
    out.categoryConfidence = Math.min(0.98, 0.45 + top[1] * 0.06);
    out.secondaryCategories = ranked.slice(1).filter(([, s]) => s >= 3).map(([c]) => c);
  }

  // 카페가 명시되면 FOOD 서브키워드(브런치)보다 cafe 우선
  if (EXPLICIT_CAFE.test(spaced) && !EXPLICIT_KIDS_CAFE.test(spaced) && !negation.excludedCategories.includes("cafe")) {
    if ((out.primaryCategory === "restaurant" && (out.purposeIntents ?? []).some((p) => p === "brunch" || p === "dessert"))
      || (out.menuIntents ?? []).includes("브런치")
      || (out.menuIntents ?? []).includes("디저트")) {
      out.secondaryCategories = [
        ...new Set<QueryUnderstandingCategory>([...(out.secondaryCategories ?? []), "restaurant"]),
      ];
      out.primaryCategory = "cafe";
      out.categoryConfidence = Math.max(out.categoryConfidence ?? 0, 0.72);
    } else if (!out.primaryCategory) {
      out.primaryCategory = "cafe";
      out.categoryConfidence = 0.7;
    }
  }

  if (EXPLICIT_RESTAURANT.test(spaced) && out.primaryCategory === "cafe" && (out.purposeIntents ?? []).includes("group_dinner") && !negation.excludedCategories.includes("restaurant")) {
    out.secondaryCategories = [
      ...new Set<QueryUnderstandingCategory>([...(out.secondaryCategories ?? []), "cafe"]),
    ];
    out.primaryCategory = "restaurant";
  }

  const dessertLean = (out.purposeIntents ?? []).some((p) => p === "dessert" || p === "brunch");
  if (dessertLean && out.primaryCategory === "cafe") {
    out.secondaryCategories = [
      ...new Set<QueryUnderstandingCategory>([...(out.secondaryCategories ?? []), "restaurant"]),
    ];
  }

  const strongMenu = (out.menuIntents ?? []).some((m) =>
    ["고기", "칼국수", "돈까스", "해장", "키즈카페", "디저트", "브런치", "분식", "치킨", "파스타"].includes(m)
  );
  const strongPurpose = (out.purposeIntents ?? []).some((p) =>
    ["meat", "hangover", "group_dinner", "culture", "kids_cafe", "dessert", "brunch", "dining", "spicy", "brothy"].includes(p)
  );

  const parkingOnly =
    out.parkingPreferred === true &&
    !out.primaryCategory &&
    !strongMenu &&
    !EXPLICIT_CAFE.test(normalizedQuery) &&
    !EXPLICIT_RESTAURANT.test(normalizedQuery);

  const weak = WEAK_DISCOVERY.test(spaced) && !strongMenu && !strongPurpose && !EXPLICIT_KIDS_CAFE.test(spaced);

  out.strongVertical = Boolean(
    !parkingOnly &&
      !weak &&
      out.primaryCategory &&
      (strongMenu || strongPurpose || EXPLICIT_KIDS_CAFE.test(spaced) || (out.categoryConfidence ?? 0) >= 0.7)
  );

  if (out.strongVertical && out.primaryCategory) {
    out.route = CATEGORY_TO_ROUTE[out.primaryCategory];
  } else {
    out.route = "MIXED";
  }

  return applyVenuePolarityToParsedQuery(applyNegationToParsedQuery(out, negation));
}

export function queryUnderstandingToIntentCategories(parsed: ParsedRecommendationQuery): IntentCategory[] {
  const cats: IntentCategory[] = [];
  if (parsed.route && parsed.route !== "MIXED") cats.push(parsed.route);
  for (const sec of parsed.secondaryCategories ?? []) {
    const r = CATEGORY_TO_ROUTE[sec];
    if (r && !cats.includes(r)) cats.push(r);
  }
  return cats;
}

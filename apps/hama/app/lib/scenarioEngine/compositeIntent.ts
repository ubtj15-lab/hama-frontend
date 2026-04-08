import type { ScenarioObject, ScenarioType } from "./types";
import type { RecommendScenarioKey } from "@/lib/recommend/scenarioWeights";

function normQ(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

const FOOD_PREF_RULES: { id: string; patterns: RegExp[] }[] = [
  {
    id: "not_spicy",
    patterns: [/맵지\s*않|안\s*맵|맵기\s*싫|안\s*매운|순한\s*맛/],
  },
  {
    id: "spicy_brothy",
    patterns: [/얼큰한?/, /칼칼한?/],
  },
  {
    id: "light_clean",
    patterns: [/담백한?/, /깔끔한?/],
  },
  {
    id: "light",
    patterns: [/가벼운?/, /부담\s*없는?/, /부담없는/, /가볍게/],
  },
  {
    id: "hearty",
    patterns: [/든든한?/],
  },
  {
    id: "brothy",
    patterns: [/국물\s*있는?/, /국물있는/],
  },
  {
    id: "hangover",
    patterns: [/해장/],
  },
  {
    id: "kid_friendly_menu",
    patterns: [/아이가?\s*먹기\s*편한?/, /아이도?\s*먹기\s*편한?/, /아이\s*먹기\s*편한?/, /키즈\s*메뉴/],
  },
  {
    id: "parent_friendly_menu",
    patterns: [/부모님이?\s*좋아할\s*만한?/, /부모님\s*좋아하는?/, /어른들이?\s*좋아하는?/],
  },
];

const VIBE_RULES: { id: string; patterns: RegExp[] }[] = [
  {
    id: "atmospheric",
    patterns: [/분위기\s*있는?/, /분위기\s*좋은?/, /감성\s*맛집/],
  },
  {
    id: "calm",
    patterns: [/조용한?/, /한적한?/, /잔잔한?/],
  },
  {
    id: "conversation_friendly",
    patterns: [/대화하기\s*좋은?/, /수다\s*떨기\s*좋은?/],
  },
  {
    id: "emotional",
    patterns: [/감성적인?/, /감성\s+/],
  },
];

/** hard: 반드시 지켜야 하는 제약 토큰 */
export function detectHardConstraints(
  rawQuery: string,
  base: Pick<
    ScenarioObject,
    | "intentCategory"
    | "foodSubCategory"
    | "weatherHint"
    | "indoorPreferred"
    | "menuIntent"
  >
): string[] {
  const q = normQ(rawQuery);
  const h: string[] = [];

  if (/실내만/.test(q) || /인도어만/.test(q)) h.push("indoor");
  if (/비\s*오는\s*날/.test(q) || /비오는\s*날/.test(q) || /장마/.test(q)) {
    if (/(실내|인도어)/.test(q)) h.push("indoor");
  }
  if (/카페\s*만/.test(q) || /^카페\s/.test(q.trim()) && /만\b/.test(q)) h.push("category_cafe");
  if (/미용실\s*만/.test(q)) h.push("category_salon");

  if (/(중국집|중식\s*집)/.test(q) && base.intentCategory === "FOOD") h.push("sub_chinese");
  if (/일식\s*집/.test(q) && base.intentCategory === "FOOD") h.push("sub_japanese");
  if (/한식\s*집/.test(q) && base.intentCategory === "FOOD") h.push("sub_korean");
  if (/(양식\s*집|파스타\s*집)/.test(q) && base.intentCategory === "FOOD") h.push("sub_western");

  if (base.foodSubCategory && base.intentCategory === "FOOD" && !h.some((x) => x.startsWith("sub_"))) {
    if (/(국밥집)/.test(q)) h.push("sub_korean");
  }

  return uniq(h);
}

/** soft: 있으면 가점 */
export function detectSoftConstraints(
  rawQuery: string,
  base: Pick<ScenarioObject, "weatherHint" | "intentCategory" | "mealRequired">
): string[] {
  const q = normQ(rawQuery);
  const s: string[] = [];

  if (
    base.weatherHint === "rain" &&
    (/(먹을|식사|밥|맛집|국물|라면)/.test(q) || base.intentCategory === "FOOD")
  ) {
    s.push("rainy_day_food");
  }
  if (/가볍게|가벼운|부담\s*없는?/.test(q)) s.push("light");
  if (/(조용한|한적|잔잔)/.test(q)) s.push("calm_env");

  return uniq(s);
}

export function detectFoodPreference(rawQuery: string): string[] {
  const q = normQ(rawQuery);
  const out: string[] = [];
  for (const { id, patterns } of FOOD_PREF_RULES) {
    if (patterns.some((re) => re.test(q))) out.push(id);
  }
  return uniq(out);
}

export function detectVibePreference(rawQuery: string): string[] {
  const q = normQ(rawQuery);
  const out: string[] = [];
  for (const { id, patterns } of VIBE_RULES) {
    if (patterns.some((re) => re.test(q))) out.push(id);
  }
  return uniq(out);
}

function inferPrefsFromScenario(obj: ScenarioObject): { food: string[]; vibe: string[] } {
  const food: string[] = [];
  const vibe: string[] = [];
  const sc = obj.scenario;
  if (sc === "family_kids" || sc === "parent_child_outing") {
    food.push("kid_friendly_menu");
  }
  if (sc === "parents") {
    food.push("parent_friendly_menu");
    vibe.push("calm");
  }
  if (sc === "date") {
    vibe.push("atmospheric");
  }
  if (sc === "solo" && /가볍게|가벼운/.test(normQ(obj.rawQuery))) {
    food.push("light");
  }
  return { food: uniq(food), vibe: uniq(vibe) };
}

/**
 * mood/scenario와 겹치지 않게 soft만 보강(같은 의미 토큰은 한쪽에 둠)
 */
function mergeFoodPrefs(base: string[], inferred: string[]): string[] {
  return uniq([...base, ...inferred]);
}

function mergeVibes(base: string[], inferred: string[]): string[] {
  const merged = uniq([...base, ...inferred]);
  if (merged.includes("atmospheric") && merged.includes("emotional")) {
    return merged.filter((x) => x !== "emotional");
  }
  return merged;
}

/**
 * ScenarioObject에 복합 조건 필드를 채웁니다. parseScenarioIntent 마지막에 호출.
 */
export function augmentScenarioWithComposite(obj: ScenarioObject): ScenarioObject {
  const raw = obj.rawQuery ?? "";
  const inferred = inferPrefsFromScenario(obj);

  let foodPreference = mergeFoodPrefs(detectFoodPreference(raw), inferred.food);
  let vibePreference = mergeVibes(detectVibePreference(raw), inferred.vibe);

  const hardConstraints = detectHardConstraints(raw, {
    intentCategory: obj.intentCategory,
    foodSubCategory: obj.foodSubCategory,
    weatherHint: obj.weatherHint,
    indoorPreferred: obj.indoorPreferred,
    menuIntent: obj.menuIntent,
  });

  let softConstraints = detectSoftConstraints(raw, {
    weatherHint: obj.weatherHint,
    intentCategory: obj.intentCategory,
    mealRequired: obj.mealRequired,
  });

  if (vibePreference.includes("calm") && !softConstraints.includes("calm_env")) {
    softConstraints = uniq([...softConstraints, "calm_env"]);
  }

  if (obj.scenario === "family_kids" && /먹기\s*좋은/.test(normQ(raw))) {
    foodPreference = mergeFoodPrefs(foodPreference, ["kid_friendly_menu", "light"]);
  }
  if (obj.scenario === "parents" && (obj.menuIntent?.includes("국밥") || /국밥/.test(normQ(raw)))) {
    foodPreference = mergeFoodPrefs(foodPreference, ["parent_friendly_menu"]);
  }

  return {
    ...obj,
    foodPreference: foodPreference.length ? foodPreference : undefined,
    vibePreference: vibePreference.length ? vibePreference : undefined,
    hardConstraints: hardConstraints.length ? hardConstraints : undefined,
    softConstraints: softConstraints.length ? softConstraints : undefined,
  };
}

const PREF_DISPLAY: Record<string, string> = {
  not_spicy: "맵지 않음",
  spicy_brothy: "얼큰·칼칼",
  light_clean: "담백·깔끔",
  light: "부담 적음",
  hearty: "든든함",
  brothy: "국물",
  hangover: "해장",
  kid_friendly_menu: "아이도 먹기 편함",
  parent_friendly_menu: "부모님과 가기 좋음",
};

const VIBE_DISPLAY: Record<string, string> = {
  atmospheric: "분위기 좋음",
  calm: "조용한 편",
  conversation_friendly: "대화하기 좋음",
  emotional: "감성",
};

const TIME_DISPLAY: Record<string, string> = {
  morning: "아침 추천",
  lunch: "점심 추천",
  afternoon: "오후 추천",
  dinner: "저녁 추천",
  night: "밤·야식 추천",
};

const SCENARIO_PILL: Partial<Record<ScenarioType, string>> = {
  family_kids: "가족·아이 동반",
  parent_child_outing: "육아 나들이",
  parents: "부모님과",
  date: "데이트 추천",
  solo: "혼밥·혼술",
  friends: "친구 모임",
  group: "단체",
};

function rankKeyFromScenarioType(s: ScenarioType): RecommendScenarioKey | null {
  switch (s) {
    case "date":
      return "date";
    case "family_kids":
    case "parent_child_outing":
    case "family":
      return "family";
    case "solo":
      return "solo";
    case "friends":
    case "group":
      return "group";
    case "parents":
      return "family";
    default:
      return null;
  }
}

/**
 * 추천 카드 shortTags에 붙일 복합 의도 라벨(한국어, 중복 제거).
 */
export function buildCompositeTagsForCard(parsed: ScenarioObject): string[] {
  const tags: string[] = [];

  const rk = rankKeyFromScenarioType(parsed.scenario);
  if (rk && SCENARIO_PILL[parsed.scenario]) tags.push(SCENARIO_PILL[parsed.scenario]!);

  if (parsed.timeOfDay && TIME_DISPLAY[parsed.timeOfDay]) tags.push(TIME_DISPLAY[parsed.timeOfDay]);

  for (const id of parsed.foodPreference ?? []) {
    const l = PREF_DISPLAY[id];
    if (l && !tags.includes(l)) tags.push(l);
  }
  for (const id of parsed.vibePreference ?? []) {
    const l = VIBE_DISPLAY[id];
    if (l && !tags.includes(l)) tags.push(l);
  }

  if (parsed.indoorPreferred || (parsed.hardConstraints ?? []).includes("indoor")) {
    if (!tags.some((t) => /실내/.test(t))) tags.push("실내");
  }
  if (parsed.weatherHint === "rain") {
    if (!tags.some((t) => /비/.test(t))) tags.push("비 오는 날");
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const k = t.replace(/\s+/g, "").toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out.slice(0, 6);
}

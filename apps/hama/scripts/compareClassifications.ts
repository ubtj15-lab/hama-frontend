import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

type Store = {
  id: string;
  name: string;
  category: string | null;
  area: string | null;
  address: string | null;
  mood: string[] | null;
  tags: string[] | null;
  for_work: boolean | null;
  price_level: number | string | null;
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
  ai_confidence: number | null;
};

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
};

const CAP_KEYS: Array<keyof Capability> = [
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

function has(v: unknown): boolean {
  return !(v === null || v === undefined);
}

function boolOrNull(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  return Boolean(v);
}

function inferFromLegacy(store: Store): Capability {
  const mood = (store.mood ?? []).map((x) => String(x).toLowerCase());
  const tags = (store.tags ?? []).map((x) => String(x).toLowerCase());
  const blob = [store.category ?? "", ...(store.mood ?? []), ...(store.tags ?? []), store.name].join(" ").toLowerCase();
  const price = Number(store.price_level ?? 0);

  const withKids =
    tags.some((t) => t.includes("아이동반") || t.includes("키즈") || t.includes("가족")) ||
    mood.some((m) => m.includes("가족")) ||
    /키즈|아이|가족/.test(blob);

  const groupSeating = withKids || /단체|모임|회식|패밀리|한정식|정찬/.test(blob);
  const privateRoom = /룸|별실|프라이빗|코스룸|단독룸/.test(blob) || mood.some((m) => m.includes("데이트"));
  const alcohol = /이자카야|호프|술집|와인|바|칵테일|맥주|소주/.test(blob);
  const fastFood = /패스트푸드|맥도날드|버거킹|kfc|롯데리아|분식|김밥|토스트/.test(blob);
  const formal = /정찬|한정식|코스|격식|예약필수|파인다이닝/.test(blob) || tags.some((t) => t.includes("예약필수"));
  const quick = fastFood || /빠른|분식|김밥|회전/.test(blob);
  const solo = quick || /혼밥|1인|카운터|혼자/.test(blob) || Boolean(store.for_work);
  const vegan = /비건|채식|vegan|vegetarian/.test(blob);
  const halal = /할랄|halal/.test(blob);

  // price rule: higher price leans formal
  const formalWithPrice = formal || price >= 4;

  return {
    solo_friendly: solo,
    group_seating: groupSeating,
    private_room: privateRoom,
    alcohol_available: alcohol,
    fast_food: fastFood,
    formal_atmosphere: formalWithPrice,
    quick_service: quick,
    vegan_available: vegan,
    halal_available: halal,
    with_kids: withKids,
  };
}

function actualCapability(store: Store): Capability {
  return {
    solo_friendly: boolOrNull(store.solo_friendly),
    group_seating: boolOrNull(store.group_seating),
    private_room: boolOrNull(store.private_room),
    alcohol_available: boolOrNull(store.alcohol_available),
    fast_food: boolOrNull(store.fast_food),
    formal_atmosphere: boolOrNull(store.formal_atmosphere),
    quick_service: boolOrNull(store.quick_service),
    vegan_available: boolOrNull(store.vegan_available),
    halal_available: boolOrNull(store.halal_available),
    with_kids: boolOrNull(store.with_kids),
  };
}

function mismatchKeys(a: Capability, b: Capability): Array<keyof Capability> {
  return CAP_KEYS.filter((k) => has(b[k]) && a[k] !== b[k]);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("stores")
    .select(
      "id,name,category,area,address,mood,tags,for_work,price_level,solo_friendly,group_seating,private_room,alcohol_available,fast_food,formal_atmosphere,quick_service,vegan_available,halal_available,with_kids,ai_confidence"
    )
    .not("name", "is", null)
    .neq("name", "")
    .limit(2000);
  if (error) throw new Error(error.message);
  const stores = (data ?? []) as Store[];

  let totalCompared = 0;
  let totalMatched = 0;
  const mismatches: Array<{
    id: string;
    name: string;
    category: string | null;
    area: string | null;
    mood: string[];
    tags: string[];
    inferred: Capability;
    actual: Capability;
    mismatch: string[];
    ai_confidence: number | null;
  }> = [];

  for (const s of stores) {
    const inferred = inferFromLegacy(s);
    const actual = actualCapability(s);
    const mm = mismatchKeys(inferred, actual);

    const comparableKeys = CAP_KEYS.filter((k) => has(actual[k]));
    if (comparableKeys.length === 0) continue;
    totalCompared += comparableKeys.length;
    totalMatched += comparableKeys.filter((k) => inferred[k] === actual[k]).length;

    if (mm.length > 0) {
      mismatches.push({
        id: s.id,
        name: s.name,
        category: s.category,
        area: s.area,
        mood: s.mood ?? [],
        tags: s.tags ?? [],
        inferred,
        actual,
        mismatch: mm.map(String),
        ai_confidence: s.ai_confidence ?? null,
      });
    }
  }

  const agreePct = totalCompared > 0 ? (totalMatched / totalCompared) * 100 : 0;

  const mismatchByCategory = mismatches.reduce<Record<string, number>>((acc, m) => {
    const k = (m.category ?? "unknown").toLowerCase();
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  const priority100 = mismatches
    .filter((m) => /오산|동탄/.test(`${m.area ?? ""} ${m.category ?? ""} ${m.name}`))
    .sort((a, b) => (b.mismatch.length - a.mismatch.length) || ((a.ai_confidence ?? 0) - (b.ai_confidence ?? 0)))
    .slice(0, 100);

  console.log("=== 분류 비교 요약 ===");
  console.log(`- 매장 수: ${stores.length}`);
  console.log(`- 비교 가능한 capability 셀: ${totalCompared}`);
  console.log(`- 일치 셀: ${totalMatched}`);
  console.log(`- 일치율: ${agreePct.toFixed(1)}%`);
  console.log(`- 불일치 매장 수: ${mismatches.length}`);
  console.log("\n=== 불일치 카테고리 분포 ===");
  console.table(
    Object.entries(mismatchByCategory)
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count }))
  );

  console.log("\n=== 우선 검증 필요 매장 (최대 100) ===");
  console.table(
    priority100.map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      area: m.area,
      mismatch: m.mismatch.join(", "),
      ai_confidence: m.ai_confidence,
    }))
  );

  console.log("\n=== 불일치 샘플 상세 (최대 50) ===");
  console.table(
    mismatches.slice(0, 50).map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      mood: m.mood.join("|"),
      tags: m.tags.join("|"),
      mismatch: m.mismatch.join(", "),
    }))
  );
}

void main().catch((e) => {
  console.error("[compare:classifications] fatal:", e?.message ?? e);
  process.exit(1);
});

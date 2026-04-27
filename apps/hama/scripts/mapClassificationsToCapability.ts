import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

type Store = {
  id: string;
  name: string | null;
  category: string | null;
  mood: string[] | null;
  tags: string[] | null;
  for_work: boolean | null;
  price_level: number | string | null;
  with_kids: boolean | null;
};

type Patch = {
  solo_friendly: boolean;
  group_seating: boolean;
  private_room: boolean;
  alcohol_available: boolean;
  fast_food: boolean;
  formal_atmosphere: boolean;
  quick_service: boolean;
  vegan_available: boolean;
  halal_available: boolean;
  with_kids: boolean;
  max_group_size: number;
  ai_classified: boolean;
  ai_confidence: number;
  ai_classified_at: string;
  verified_by_human: boolean;
};

function parsePriceLevel(v: number | string | null): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function inferPatch(s: Store): Patch {
  const mood = (s.mood ?? []).map((x) => String(x).toLowerCase());
  const tags = (s.tags ?? []).map((x) => String(x).toLowerCase());
  const blob = [s.name ?? "", s.category ?? "", ...(s.mood ?? []), ...(s.tags ?? [])]
    .join(" ")
    .toLowerCase();
  const price = parsePriceLevel(s.price_level);

  const category = String(s.category ?? "").toLowerCase();
  const hasKidsTag = tags.some((t) => t.includes("아이동반") || t.includes("키즈") || t.includes("유아"));
  const hasFamilyMood = mood.some((m) => m.includes("가족"));
  const hasKidsKeyword = /키즈|아이|유아|어린이/.test(blob);
  const kidFriendlyCategory = /restaurant|cafe|activity|museum/.test(category);
  // with_kids 과대 추정을 막기 위해 "명시 태그" 또는 "가족 mood + 키즈 키워드 + 적합 카테고리"일 때만 활성화
  const withKids = hasKidsTag || (kidFriendlyCategory && hasFamilyMood && hasKidsKeyword);

  const formalFromMeta =
    mood.some((m) => m.includes("데이트")) ||
    tags.some((t) => t.includes("예약필수")) ||
    /한정식|정찬|코스|파인다이닝|격식/.test(blob) ||
    price >= 4;

  const fastFood = /패스트푸드|맥도날드|kfc|버거킹|롯데리아|분식|김밥|도시락|토스트/.test(blob) || price === 0;
  const quickService = fastFood || /빠른|회전|분식|김밥/.test(blob);
  const groupSeating =
    /단체|모임|회식|한정식|정찬|룸|별실|연회|프라이빗룸/.test(blob) ||
    tags.some((t) => t.includes("단체") || t.includes("모임") || t.includes("회식") || t.includes("예약")) ||
    (withKids && /restaurant|activity/.test(category));
  const privateRoom = /룸|별실|프라이빗|코스룸|단독룸/.test(blob) || formalFromMeta;
  const alcohol =
    /술집|이자카야|호프|바|칵테일|와인|맥주|소주|포차|pub|주점|막걸리|고깃집|곱창|횟집|해장국/.test(blob) ||
    tags.some((t) => t.includes("주류") || t.includes("술") || t.includes("와인") || t.includes("포차") || t.includes("회식")) ||
    mood.some((m) => m.includes("회식") || m.includes("모임"));
  const soloFriendly = Boolean(s.for_work) || quickService || /혼밥|1인|혼자|카운터/.test(blob);
  const vegan = /비건|채식|vegan|vegetarian/.test(blob);
  const halal = /할랄|halal/.test(blob);

  const maxGroupSize = groupSeating ? (privateRoom || formalFromMeta ? 12 : 8) : 4;

  return {
    solo_friendly: soloFriendly,
    group_seating: groupSeating,
    private_room: privateRoom,
    alcohol_available: alcohol,
    fast_food: fastFood,
    formal_atmosphere: formalFromMeta,
    quick_service: quickService,
    vegan_available: vegan,
    halal_available: halal,
    with_kids: withKids,
    max_group_size: maxGroupSize,
    ai_classified: true,
    ai_confidence: 0.7,
    ai_classified_at: new Date().toISOString(),
    verified_by_human: false,
  };
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const envFile = path.resolve(here, "../.env.local");
  dotenv.config({ path: envFile });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error(`Missing Supabase env (url/key): ${envFile}`);

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await supabase
    .from("stores")
    .select("id,name,category,mood,tags,for_work,price_level,with_kids")
    .not("name", "is", null)
    .neq("name", "")
    .limit(2000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Store[];
  if (!rows.length) {
    console.log("No stores found.");
    return;
  }

  console.log(`매핑 대상 매장: ${rows.length}`);
  let ok = 0;
  let fail = 0;
  const failures: Array<{ id: string; name: string; error: string }> = [];

  for (const s of rows) {
    const patch = inferPatch(s);
    const { error: upErr } = await supabase.from("stores").update(patch).eq("id", s.id);
    if (upErr) {
      fail += 1;
      failures.push({ id: s.id, name: s.name ?? "", error: upErr.message });
    } else {
      ok += 1;
    }
  }

  console.log("=== mapping summary ===");
  console.log(`success: ${ok}`);
  console.log(`failed: ${fail}`);
  if (failures.length) {
    console.log("failures (first 20):");
    console.table(failures.slice(0, 20));
  }
}

void main().catch((e) => {
  console.error("[map:classifications-to-capability] fatal:", e?.message ?? e);
  process.exit(1);
});

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { buildTopRecommendations, type BuildRecommendationsContext } from "../app/lib/recommend/scoring";
import {
  isKidFocusedVenueFields,
  isKidVenueExcludedWhenNoYoungChildFromParts,
} from "../app/lib/recommend/kidVenueSignals";
import { isBoardGameVenueFields } from "../app/lib/recommend/boardVenueSignals";
import type { HomeCard } from "../app/lib/storeTypes";
import type { IntentionType } from "../app/lib/intention";
import type { UserProfile } from "../app/lib/onboardingProfile";

type ScenarioInput = {
  companions: "가족" | "혼자" | "친구" | "연인" | "동료";
  dietary: "채식" | "할랄" | "없음";
  /** 미지정 시 '없음' (구 시나리오 회귀) */
  young_child?: "있음" | "없음";
  interests: UserProfile["interests"];
  gender: UserProfile["gender"];
  category: "food" | "cafe" | "beauty" | "activity" | "course";
  time: "점심" | "저녁" | "오후";
  locationName: "오산시청" | "동탄역";
  lat: number;
  lng: number;
};

type Scenario = {
  id: number;
  name: string;
  input: ScenarioInput;
  checks: Array<{
    label: string;
    pass: (top: any[]) => boolean;
  }>;
};

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const OSAN = { lat: 37.1498, lng: 127.0772 };
const DONGTAN = { lat: 37.2009, lng: 127.0957 };

const SCENARIOS: Scenario[] = [
  {
    id: 1,
    name: "가족 + 저녁 + food (오산)",
    input: {
      companions: "가족",
      dietary: "없음",
      young_child: "있음",
      interests: [],
      gender: "선택 안 함",
      category: "food",
      time: "저녁",
      locationName: "오산시청",
      ...OSAN,
    },
    checks: [
      { label: "top1 kids/group 친화", pass: (top) => top[0]?.capability.with_kids === true || top[0]?.capability.group_seating === true },
    ],
  },
  {
    id: 2,
    name: "혼자 + 점심 + food (동탄)",
    input: { companions: "혼자", dietary: "없음", interests: [], gender: "선택 안 함", category: "food", time: "점심", locationName: "동탄역", ...DONGTAN },
    checks: [{ label: "top3 중 solo 친화 존재", pass: (top) => top.some((x) => x.capability.solo_friendly === true) }],
  },
  {
    id: 3,
    name: "회식 + 저녁 + food (오산)",
    input: { companions: "동료", dietary: "없음", interests: [], gender: "선택 안 함", category: "food", time: "저녁", locationName: "오산시청", ...OSAN },
    checks: [
      { label: "top1 패스트푸드 회피", pass: (top) => top[0]?.capability.fast_food !== true },
      { label: "top3 중 술/단체 조건", pass: (top) => top.some((x) => x.capability.alcohol_available === true || x.capability.group_seating === true) },
    ],
  },
  {
    id: 4,
    name: "데이트 + 저녁 + food (동탄)",
    input: { companions: "연인", dietary: "없음", interests: [], gender: "선택 안 함", category: "food", time: "저녁", locationName: "동탄역", ...DONGTAN },
    checks: [{ label: "top3 중 격식/룸 조건", pass: (top) => top.some((x) => x.capability.formal_atmosphere === true || x.capability.private_room === true) }],
  },
  {
    id: 5,
    name: "친구 + 점심 + food (오산)",
    input: { companions: "친구", dietary: "없음", interests: [], gender: "선택 안 함", category: "food", time: "점심", locationName: "오산시청", ...OSAN },
    checks: [{ label: "top1 극단치 회피(점수>40)", pass: (top) => Number(top[0]?.score ?? 0) > 40 }],
  },
  {
    id: 6,
    name: "가족 + 채식 + 저녁 + food (동탄)",
    input: {
      companions: "가족",
      dietary: "채식",
      young_child: "있음",
      interests: [],
      gender: "선택 안 함",
      category: "food",
      time: "저녁",
      locationName: "동탄역",
      ...DONGTAN,
    },
    checks: [
      { label: "top3 존재", pass: (top) => top.length >= 1 },
      {
        label: "top3 채식 신호 포함",
        pass: (top) =>
          top.length > 0 &&
          top.every((x) => x.capability.vegan_available === true || /비건|채식|vegan|vegetarian/i.test(x.blob)),
      },
    ],
  },
  {
    id: 7,
    name: "혼자 + 카페에서 일하기 + cafe (동탄)",
    input: { companions: "혼자", dietary: "없음", interests: [], gender: "선택 안 함", category: "cafe", time: "오후", locationName: "동탄역", ...DONGTAN },
    checks: [{ label: "top3 work/solo 신호", pass: (top) => top.some((x) => x.capability.for_work === true || x.capability.solo_friendly === true) }],
  },
  {
    id: 8,
    name: "가족 + 액티비티 + activity (오산)",
    input: {
      companions: "가족",
      dietary: "없음",
      young_child: "있음",
      interests: ["액티비티"],
      gender: "선택 안 함",
      category: "activity",
      time: "오후",
      locationName: "오산시청",
      ...OSAN,
    },
    checks: [{ label: "top3 중 kids 신호 1개 이상", pass: (top) => top.some((x) => x.capability.with_kids === true || /키즈|가족|체험/.test(x.blob)) }],
  },
  {
    id: 9,
    name: "데이트 + 코스 + course (동탄)",
    input: { companions: "연인", dietary: "없음", interests: [], gender: "선택 안 함", category: "course", time: "저녁", locationName: "동탄역", ...DONGTAN },
    checks: [{ label: "top1 reason 존재", pass: (top) => typeof top[0]?.reason === "string" && top[0].reason.length > 0 }],
  },
  {
    id: 10,
    name: "가족 + 미용실 + beauty (오산)",
    input: { companions: "가족", dietary: "없음", interests: [], gender: "선택 안 함", category: "beauty", time: "오후", locationName: "오산시청", ...OSAN },
    checks: [{ label: "top1 카테고리 미용", pass: (top) => ["salon", "beauty"].includes(String(top[0]?.category ?? "").toLowerCase()) }],
  },
  {
    id: 11,
    name: "혼자 + 액티비티 + 영유아 자녀 X (오산) → 키즈·보드카페 제외",
    input: {
      companions: "혼자",
      dietary: "없음",
      young_child: "없음",
      interests: ["액티비티"],
      gender: "선택 안 함",
      category: "activity",
      time: "오후",
      locationName: "오산시청",
      ...OSAN,
    },
    checks: [
      {
        label: "top3 모두 영유아 없음 필터(키즈) + 보드카페 아님",
        pass: (top) =>
          top.length > 0 &&
          top.every((x) => {
            const kid = !isKidVenueExcludedWhenNoYoungChildFromParts({
              name: x.name,
              category: x.category,
              tags: x.tags,
              mood: x.mood,
              description: x.description,
              with_kids: x.capability.with_kids,
            });
            const board = !isBoardGameVenueFields({ name: x.name, category: x.category, tags: x.tags });
            return kid && board;
          }),
      },
    ],
  },
  {
    id: 12,
    name: "친구 + 액티비티 + 영유아 자녀 X (오산) → 키즈 제외·보드 OK",
    input: {
      companions: "친구",
      dietary: "없음",
      young_child: "없음",
      interests: ["액티비티"],
      gender: "선택 안 함",
      category: "activity",
      time: "오후",
      locationName: "오산시청",
      ...OSAN,
    },
    checks: [
      {
        label: "top3 모두 영유아 없음 키즈 필터 통과",
        pass: (top) =>
          top.length > 0 &&
          top.every((x) =>
            !isKidVenueExcludedWhenNoYoungChildFromParts({
              name: x.name,
              category: x.category,
              tags: x.tags,
              mood: x.mood,
              description: x.description,
              with_kids: x.capability.with_kids,
            })
          ),
      },
    ],
  },
  {
    id: 13,
    name: "가족 + 액티비티 + 영유아 자녀 O (오산) → 자녀 친화 신호 OK",
    input: {
      companions: "가족",
      dietary: "없음",
      young_child: "있음",
      interests: ["액티비티"],
      gender: "선택 안 함",
      category: "activity",
      time: "오후",
      locationName: "오산시청",
      ...OSAN,
    },
    checks: [
      {
        label: "top3 중 with_kids 또는 키즈/체험 신호",
        pass: (top) =>
          top.some(
            (x) =>
              x.capability.with_kids === true ||
              isKidFocusedVenueFields({ name: x.name, category: x.category, tags: x.tags }) ||
              /키즈|가족|체험|어린이/.test(x.blob)
          ),
      },
    ],
  },
  {
    id: 14,
    name: "가족 + 액티비티 + 영유아 자녀 X (오산) → 키즈 전용 매장 제외",
    input: {
      companions: "가족",
      dietary: "없음",
      young_child: "없음",
      interests: ["액티비티"],
      gender: "선택 안 함",
      category: "activity",
      time: "오후",
      locationName: "오산시청",
      ...OSAN,
    },
    checks: [
      {
        label: "top3 모두 영유아 없음 키즈 필터 통과",
        pass: (top) =>
          top.length > 0 &&
          top.every((x) =>
            !isKidVenueExcludedWhenNoYoungChildFromParts({
              name: x.name,
              category: x.category,
              tags: x.tags,
              mood: x.mood,
              description: x.description,
              with_kids: x.capability.with_kids,
            })
          ),
      },
    ],
  },
];

function mapCompanionToIntent(v: ScenarioInput["companions"]): IntentionType {
  if (v === "가족") return "family";
  if (v === "혼자") return "solo";
  if (v === "연인") return "date";
  if (v === "친구" || v === "동료") return "meeting";
  return "none";
}

function mapCompanionProfile(v: ScenarioInput["companions"]): UserProfile["companions"] {
  if (v === "연인") return ["둘이서"];
  if (v === "동료") return ["친구"];
  return [v];
}

function categoryMatches(category: ScenarioInput["category"], c: string | null | undefined): boolean {
  const x = String(c ?? "").toLowerCase();
  if (category === "food") return x === "restaurant";
  if (category === "cafe") return x === "cafe";
  if (category === "beauty") return x === "salon" || x === "beauty";
  if (category === "activity") return x === "activity" || x === "museum";
  return true;
}

function toCard(row: any): HomeCard {
  const card: HomeCard = {
    id: String(row.id),
    name: String(row.name ?? "이름없음"),
    category: row.category ?? null,
    area: row.area ?? null,
    address: row.address ?? null,
    lat: typeof row.lat === "number" ? row.lat : null,
    lng: typeof row.lng === "number" ? row.lng : null,
    image_url: row.image_url ?? null,
    mood: Array.isArray(row.mood) ? row.mood : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    description: typeof row.description === "string" ? row.description : null,
    with_kids: row.with_kids ?? null,
    for_work: row.for_work ?? null,
    reservation_required: row.reservation_required ?? null,
    vegetarian_available: row.vegetarian_available ?? null,
    halal_available: row.halal_available ?? null,
    price_level: row.price_level ?? null,
    updated_at: row.updated_at ?? null,
  };
  const c = card as any;
  c.solo_friendly = row.solo_friendly ?? null;
  c.group_seating = row.group_seating ?? null;
  c.private_room = row.private_room ?? null;
  c.alcohol_available = row.alcohol_available ?? null;
  c.fast_food = row.fast_food ?? null;
  c.formal_atmosphere = row.formal_atmosphere ?? null;
  c.quick_service = row.quick_service ?? null;
  c.vegan_available = row.vegan_available ?? row.vegetarian_available ?? null;
  c.max_group_size = row.max_group_size ?? null;
  return card;
}

async function loadCards(): Promise<HomeCard[]> {
  const { data, error } = await supabase.from("stores").select("*").not("name", "is", null).neq("name", "").limit(1200);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toCard);
}

function blobOf(card: HomeCard): string {
  return [card.name, card.category, card.address, ...(card.tags ?? []), ...(card.mood ?? []), card.description ?? ""]
    .join(" ")
    .toLowerCase();
}

async function main() {
  const cards = await loadCards();
  const results: any[] = [];
  const suspiciousStores = new Set<string>();

  for (const scenario of SCENARIOS) {
    const filtered = cards.filter((c) => categoryMatches(scenario.input.category, c.category));
    const profile: UserProfile = {
      companions: mapCompanionProfile(scenario.input.companions),
      gender: scenario.input.gender,
      dietary_restrictions: scenario.input.dietary === "없음" ? ["없음"] : [scenario.input.dietary],
      young_child: scenario.input.young_child === "있음" ? "있음" : "없음",
      interests: scenario.input.interests,
      onboarding_completed_at: new Date().toISOString(),
    };
    const ctx: BuildRecommendationsContext = {
      intent: mapCompanionToIntent(scenario.input.companions),
      userLat: scenario.input.lat,
      userLng: scenario.input.lng,
      userProfile: profile,
    };
    const ranked = buildTopRecommendations(filtered, ctx).slice(0, 3);
    const top = ranked.map((r) => {
      const c = r.card as any;
      return {
        id: r.card.id,
        name: r.card.name,
        category: r.card.category,
        tags: Array.isArray(r.card.tags) ? r.card.tags : [],
        mood: Array.isArray(r.card.mood) ? r.card.mood : [],
        description: typeof r.card.description === "string" ? r.card.description : null,
        score: Number(r.breakdown.finalScore.toFixed(2)),
        reason: r.reasonText,
        blob: blobOf(r.card),
        capability: {
          with_kids: c.with_kids ?? null,
          group_seating: c.group_seating ?? null,
          solo_friendly: c.solo_friendly ?? null,
          private_room: c.private_room ?? null,
          alcohol_available: c.alcohol_available ?? null,
          formal_atmosphere: c.formal_atmosphere ?? null,
          fast_food: c.fast_food ?? null,
          vegan_available: c.vegan_available ?? c.vegetarian_available ?? null,
          for_work: c.for_work ?? null,
        },
      };
    });
    const checkResults = scenario.checks.map((ch) => ({ label: ch.label, pass: ch.pass(top) }));
    const pass = checkResults.every((x) => x.pass);
    const suspicious = !pass || (top[0] && top[1] && top[0].score - top[1].score < 1.5);
    if (suspicious && top[0]?.name) suspiciousStores.add(top[0].name);

    results.push({
      id: scenario.id,
      name: scenario.name,
      pass,
      checks: checkResults,
      top1: top[0] ?? null,
      top23: top.slice(1, 3),
      suspicious,
    });

    if (scenario.id === 6) {
      const vegCandidates = filtered.filter((c) => {
        const x = c as any;
        const blob = blobOf(c);
        return x.vegan_available === true || x.vegetarian_available === true || /비건|채식|vegan|vegetarian/i.test(blob);
      }).length;
      const top1 = top[0];
      const top1Vegan =
        top1 != null
          ? top1.capability.vegan_available === true || /비건|채식|vegan|vegetarian/i.test(top1.blob)
          : false;
      console.log("=== Scenario #6 Dietary Diagnostics ===");
      console.log(`filtered food candidates: ${filtered.length}`);
      console.log(`veg-signaled candidates: ${vegCandidates}`);
      console.log(`dietary filter intended: strict (채식)`);
      console.log(`top1: ${top1 ? `${top1.name} (${top1.score})` : "-"}`);
      console.log(`top1 vegan signal: ${top1Vegan ? "YES" : "NO"}`);
      console.log(`scenario #6 pass: ${pass ? "PASS" : "FAIL"}`);
    }
  }

  const passCount = results.filter((r) => r.pass).length;
  const passRate = Math.round((passCount / SCENARIOS.length) * 1000) / 10;
  const recommendation =
    passRate >= 80
      ? "PASS 80%+ → 다음 주 배포 OK"
      : passRate >= 50
        ? "PASS 50~80% → 매장 데이터 추가 검증"
        : "PASS 50% 미만 → 추천 엔진 수정 검토";

  const report = {
    generatedAt: new Date().toISOString(),
    totalScenarios: SCENARIOS.length,
    passCount,
    passRate,
    recommendation,
    suspiciousStores: Array.from(suspiciousStores),
    failedScenarios: results.filter((r) => !r.pass).map((r) => ({ id: r.id, name: r.name, checks: r.checks })),
    scenarios: results,
  };

  const outDir = path.resolve(here, "../reports");
  fs.mkdirSync(outDir, { recursive: true });
  const fileName = `recommend-scenarios-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const outPath = path.join(outDir, fileName);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log("=== recommend-scenarios summary ===");
  console.log(`pass: ${passCount}/${SCENARIOS.length} (${passRate}%)`);
  console.log(`recommendation: ${recommendation}`);
  console.log(`suspicious stores: ${Array.from(suspiciousStores).join(" | ") || "-"}`);
  console.log(`saved: ${outPath}`);
  for (const r of results) {
    const top = r.top1 ? `${r.top1.name} (${r.top1.score})` : "-";
    console.log(`[${r.pass ? "PASS" : "FAIL"}] #${r.id} ${r.name} | top1=${top}`);
  }
}

void main().catch((e) => {
  console.error("[test:recommend-scenarios] fatal:", e?.message ?? e);
  process.exit(1);
});

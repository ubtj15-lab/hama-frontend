/**
 * 설문(companions/gender/dietary/young_child/interests) 반영 점검 스크립트.
 *
 * 실행:
 *   npm run test:survey-reflection
 */
import fs from "node:fs";
import path from "node:path";
import "dotenv/config";
import { buildTopRecommendations, type BuildRecommendationsContext, type ScoredRecommendItem } from "./scoring";
import type { HomeCard } from "@/lib/storeTypes";
import type { UserProfile } from "@/lib/onboardingProfile";
import {
  HYBRID_WEIGHT_BEHAVIOR,
  HYBRID_WEIGHT_CONVENIENCE,
  HYBRID_WEIGHT_DISTANCE,
  HYBRID_WEIGHT_PERSONAL,
  HYBRID_WEIGHT_RATING,
  HYBRID_WEIGHT_SCENARIO,
} from "./recommendConstants";
import { createClient } from "@supabase/supabase-js";

type SurveyUser = {
  label: string;
  profile: UserProfile;
};

type RequestedContext = {
  category: string;
  isGroup: boolean;
  time: string;
  weather: string;
};

type CapabilityField = {
  key: string;
  label: string;
};

function toList(v: string[]): string {
  return `[${v.map((x) => `'${x}'`).join(", ")}]`;
}

function printUserProfile(profile: UserProfile) {
  console.log("유저 설문 데이터:");
  console.log(`- companions: ${toList(profile.companions)}`);
  console.log(`- gender: '${profile.gender}'`);
  console.log(`- dietary: ${toList(profile.dietary_restrictions)}`);
  console.log(`- young_child: '${profile.young_child}'`);
  console.log(`- interests: ${toList(profile.interests)}`);
}

function printRequestedContext(ctx: RequestedContext) {
  console.log("\n요청 컨텍스트:");
  console.log(`- category: '${ctx.category}'`);
  console.log(`- isGroup: ${ctx.isGroup}`);
  console.log(`- time: '${ctx.time}'`);
  console.log(`- weather: '${ctx.weather}'`);
}

function neutralProfile(): UserProfile {
  return {
    companions: [],
    gender: "선택 안 함",
    dietary_restrictions: ["없음"],
    young_child: "없음",
    interests: [],
    onboarding_completed_at: "debug",
  };
}

function mkCtx(profile: UserProfile | null, requested: RequestedContext): BuildRecommendationsContext {
  const intentCategory = requested.category === "activity" ? "ACTIVITY" : "FOOD";
  const scenario = requested.category === "activity" ? "friends" : "generic";
  const rawQuery =
    requested.category === "activity" ? "혼자 액티비티 체험" : "저녁 식사";

  return {
    intent: requested.category === "activity" ? "none" : "solo",
    userLat: 37.266,
    userLng: 127.028,
    userProfile: profile,
    scenarioObject: {
      intentType: "search_strict",
      scenario,
      intentCategory: intentCategory as any,
      intentStrict: true,
      timeOfDay: requested.time as any,
      weatherCondition: requested.weather === "sunny" ? "clear" : "unknown",
      rawQuery,
      confidence: 0.9,
    },
    searchQuery: rawQuery,
  };
}

function sampleCandidates(): HomeCard[] {
  return [
    {
      id: "p1",
      name: "오산가족비건식당",
      category: "restaurant",
      lat: 37.267,
      lng: 127.028,
      with_kids: true,
      vegetarian_available: true,
      tags: ["가족", "비건", "좌석 넓음", "체험 후 식사"],
      mood: ["조용함"],
      description: "아이 동반 편함, 비건 메뉴 제공",
      distanceKm: 0.7,
    },
    {
      id: "p2",
      name: "혼밥속도국밥",
      category: "restaurant",
      lat: 37.264,
      lng: 127.026,
      tags: ["혼밥", "회전 빠름", "국밥"],
      mood: ["빠른 식사"],
      description: "혼자 식사 빠르게 가능",
      distanceKm: 0.5,
    },
    {
      id: "p3",
      name: "만화보드카페 플레잇",
      category: "cafe",
      lat: 37.2668,
      lng: 127.0302,
      tags: ["만화", "보드게임", "커피"],
      mood: ["오래 머물기"],
      description: "보드게임, 만화카페",
      distanceKm: 0.8,
    },
    {
      id: "p4",
      name: "동탄할랄그릴",
      category: "restaurant",
      lat: 37.2651,
      lng: 127.031,
      halal_available: true,
      tags: ["할랄", "그릴", "친구 모임"],
      mood: ["활기참"],
      description: "할랄 인증 메뉴",
      distanceKm: 1.1,
    },
    {
      id: "p5",
      name: "시네마거리식당",
      category: "restaurant",
      lat: 37.269,
      lng: 127.029,
      tags: ["영화", "공연장 근처", "저녁"],
      mood: ["데이트"],
      description: "공연장/영화관 인근",
      distanceKm: 1.4,
    },
    {
      id: "p6",
      name: "키즈박물관식당",
      category: "museum",
      lat: 37.262,
      lng: 127.027,
      with_kids: true,
      tags: ["박물관", "체험", "가족"],
      mood: ["실내"],
      description: "박물관 연계 코스",
      distanceKm: 2.3,
    },
    {
      id: "p7",
      name: "여성전용브런치",
      category: "restaurant",
      lat: 37.261,
      lng: 127.025,
      vegetarian_available: false,
      tags: ["브런치", "여성전용"],
      mood: ["차분함"],
      description: "여성 전용 라운지",
      distanceKm: 2.6,
    },
    {
      id: "p8",
      name: "친구회식고깃집",
      category: "restaurant",
      lat: 37.268,
      lng: 127.024,
      reservation_required: true,
      tags: ["단체", "회식", "고기"],
      mood: ["북적임"],
      description: "친구 모임, 단체 회식",
      distanceKm: 2.0,
    },
  ];
}

async function loadCandidatesFromSupabase(limit = 800): Promise<HomeCard[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    throw new Error("missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const supabase = createClient(supabaseUrl, supabaseAnon);
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .not("name", "is", null)
    .neq("name", "")
    .limit(limit);

  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : [];
  return rows.map((r: any) => ({
    id: String(r.id),
    name: String(r.name ?? "이름없음"),
    category: (r.category ?? null) as string | null,
    lat: typeof r.lat === "number" ? r.lat : null,
    lng: typeof r.lng === "number" ? r.lng : null,
    tags: Array.isArray(r.tags) ? r.tags : [],
    mood: Array.isArray(r.mood) ? r.mood : [],
    description: typeof r.description === "string" ? r.description : null,
    with_kids: r.with_kids ?? null,
    solo_friendly: r.solo_friendly ?? null,
    group_seating: r.group_seating ?? null,
    private_room: r.private_room ?? null,
    alcohol_available: r.alcohol_available ?? null,
    fast_food: r.fast_food ?? null,
    formal_atmosphere: r.formal_atmosphere ?? null,
    quick_service: r.quick_service ?? null,
    vegan_available: r.vegan_available ?? null,
    max_group_size: r.max_group_size ?? null,
    vegetarian_available: r.vegetarian_available ?? null,
    halal_available: r.halal_available ?? null,
    reservation_required: r.reservation_required ?? null,
    for_work: r.for_work ?? null,
  }));
}

function hasData(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "boolean") return true;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

function capabilityValue(card: HomeCard, key: string): unknown {
  const c = card as any;
  if (key === "kids_friendly") return c.with_kids;
  if (key === "vegan_available") return c.vegan_available ?? c.vegetarian_available;
  if (key === "halal_available") return c.halal_available;
  // requested fields are checked by exact key when present in DB row
  return c[key];
}

function capabilityAudit(candidates: HomeCard[]) {
  const fields: CapabilityField[] = [
    { key: "solo_friendly", label: "solo_friendly (혼자 친화)" },
    { key: "group_seating", label: "group_seating (단체석)" },
    { key: "private_room", label: "private_room (룸)" },
    { key: "alcohol_available", label: "alcohol_available (술)" },
    { key: "fast_food", label: "fast_food (패스트푸드)" },
    { key: "formal_atmosphere", label: "formal_atmosphere (격식)" },
    { key: "quick_service", label: "quick_service (빠른 서비스)" },
    { key: "vegan_available", label: "vegan_available (채식)" },
    { key: "halal_available", label: "halal_available (할랄)" },
    { key: "kids_friendly", label: "kids_friendly (아이 친화)" },
  ];

  const total = candidates.length;
  console.log("\n=== 매장 capability 점검 ===");
  const rows = fields.map((f) => {
    const filled = candidates.filter((card) => hasData(capabilityValue(card, f.key))).length;
    const ratio = total > 0 ? (filled / total) * 100 : 0;
    const warn = ratio < 50 ? "⚠ 매장 데이터 부족" : "";
    return {
      field: f.label,
      total_stores: total,
      with_data: filled,
      coverage_percent: `${ratio.toFixed(1)}%`,
      warning: warn,
    };
  });
  console.table(rows);
  return rows;
}

function scoreOne(card: HomeCard, ctx: BuildRecommendationsContext): ScoredRecommendItem | null {
  const r = buildTopRecommendations([card], ctx);
  return r[0] ?? null;
}

function personalizationDelta(card: HomeCard, requested: RequestedContext, profile: UserProfile): {
  companions: number;
  dietary: number;
  interests: number;
  gender: number;
} {
  const neutral = scoreOne(card, mkCtx(neutralProfile(), requested));
  const neutralPersonal = neutral?.breakdown.personalizationScore ?? 0;

  const withComp = scoreOne(
    card,
    mkCtx(
      { ...neutralProfile(), companions: profile.companions, onboarding_completed_at: "debug" },
      requested
    )
  );
  const withDiet = scoreOne(
    card,
    mkCtx(
      { ...neutralProfile(), dietary_restrictions: profile.dietary_restrictions, onboarding_completed_at: "debug" },
      requested
    )
  );
  const withInterest = scoreOne(
    card,
    mkCtx(
      { ...neutralProfile(), interests: profile.interests, onboarding_completed_at: "debug" },
      requested
    )
  );
  const withGender = scoreOne(
    card,
    mkCtx({ ...neutralProfile(), gender: profile.gender, onboarding_completed_at: "debug" }, requested)
  );

  return {
    companions: (withComp?.breakdown.personalizationScore ?? 0) - neutralPersonal,
    dietary: (withDiet?.breakdown.personalizationScore ?? 0) - neutralPersonal,
    interests: (withInterest?.breakdown.personalizationScore ?? 0) - neutralPersonal,
    gender: (withGender?.breakdown.personalizationScore ?? 0) - neutralPersonal,
  };
}

function printWeights() {
  console.log("\n=== 가중치 점검 ===");
  console.log(`- companions: 개인화 점수 내부 가산(상황별 +10~+16) -> 최종 ${HYBRID_WEIGHT_PERSONAL * 100}%`);
  console.log(`- dietary: 개인화 점수 + strict 필터(채식/할랄 미충족 시 제외) -> 최종 ${HYBRID_WEIGHT_PERSONAL * 100}% + 필터`);
  console.log(`- interests: 개인화 점수 내부 가산(+10~+30) -> 최종 ${HYBRID_WEIGHT_PERSONAL * 100}%`);
  console.log(`- gender: 개인화 점수 내부 가산(+25/+30 패턴 기반) -> 최종 ${HYBRID_WEIGHT_PERSONAL * 100}%`);
  console.log(`- distance: 하이브리드 ${HYBRID_WEIGHT_DISTANCE * 100}% (참고: debug util 규칙 20점)`);
  console.log(`- timeContext: debug util 규칙 8점 (메인 하이브리드 엔진의 독립 항목 아님)`);
  console.log(`- capability: debug util 규칙 20점 (메인 하이브리드 엔진의 독립 항목 아님)`);
  console.log(`- rating: ${HYBRID_WEIGHT_RATING * 100}%`);
  console.log(`- scenario: ${HYBRID_WEIGHT_SCENARIO * 100}%`);
  console.log(`- convenience: ${HYBRID_WEIGHT_CONVENIENCE * 100}%`);
  console.log(`- behavior: ${HYBRID_WEIGHT_BEHAVIOR * 100}%`);
}

function detectMissingUsage() {
  const scoringPath = path.resolve(process.cwd(), "app/lib/recommend/scoring.ts");
  const src = fs.readFileSync(scoringPath, "utf8");
  const usage = {
    companions: /profile\.companions/.test(src),
    gender: /profile\.gender/.test(src),
    dietary: /dietary_restrictions|violatesDietaryProfile/.test(src),
    interests: /profile\.interests/.test(src),
    young_child: /young_child/.test(src),
  };

  const missing = Object.entries(usage)
    .filter(([, used]) => !used)
    .map(([k]) => k);
  console.log("\n=== 누락 항목 점검 ===");
  if (missing.length === 0) {
    console.log("누락 없음: companions/gender/dietary/young_child/interests 모두 코드 사용 흔적 확인");
  } else {
    for (const m of missing) {
      console.log(`- ${m}: 현재 추천에 반영 X`);
    }
  }
}

function printComparison(
  label: string,
  requested: RequestedContext,
  profile: UserProfile,
  candidates: HomeCard[]
): { withSurvey: string[]; withoutSurvey: string[] } {
  const withSurvey = buildTopRecommendations(candidates, mkCtx(profile, requested));
  const withoutSurvey = buildTopRecommendations(candidates, mkCtx(neutralProfile(), requested));
  const withNames = withSurvey.slice(0, 3).map((x) => x.card.name);
  const withoutNames = withoutSurvey.slice(0, 3).map((x) => x.card.name);

  console.log(`\n=== ${label} : 설문 적용 vs 미적용 비교 ===`);
  console.log(`- with survey   : ${withNames.join(" | ")}`);
  console.log(`- without survey: ${withoutNames.join(" | ")}`);
  console.log(`- diff: ${JSON.stringify(withNames) !== JSON.stringify(withoutNames) ? "OK (차이 있음)" : "NO_DIFF (설문 반영 의심)"}`);

  return { withSurvey: withNames, withoutSurvey: withoutNames };
}

async function main() {
  const requested: RequestedContext = {
    category: "food",
    isGroup: true,
    time: "dinner",
    weather: "sunny",
  };

  const users: SurveyUser[] = [
    {
      label: "사용자 A",
      profile: {
        companions: ["가족"],
        gender: "여성",
        dietary_restrictions: ["채식"],
        young_child: "있음",
        interests: ["전시/박물관", "액티비티"],
        onboarding_completed_at: "debug",
      },
    },
    {
      label: "사용자 B",
      profile: {
        companions: ["혼자"],
        gender: "선택 안 함",
        dietary_restrictions: ["없음"],
        young_child: "없음",
        interests: ["만화카페/보드게임카페"],
        onboarding_completed_at: "debug",
      },
    },
    {
      label: "사용자 C",
      profile: {
        companions: ["친구"],
        gender: "남성",
        dietary_restrictions: ["할랄"],
        young_child: "없음",
        interests: ["영화/공연"],
        onboarding_completed_at: "debug",
      },
    },
  ];

  let candidates = sampleCandidates();
  let candidateSource = "sample";
  try {
    const live = await loadCandidatesFromSupabase(800);
    if (live.length > 0) {
      candidates = live;
      candidateSource = "supabase";
    }
  } catch (e: any) {
    console.log(`[capability-audit] supabase load failed, using sample candidates: ${e?.message ?? String(e)}`);
  }

  console.log(`\n[dataset] candidate source: ${candidateSource}, count=${candidates.length}`);
  const capabilityRows = capabilityAudit(candidates);
  const userA = users[0]!;
  const scoredA = buildTopRecommendations(candidates, mkCtx(userA.profile, requested));

  console.log("=== 추천 디버그 ===");
  printUserProfile(userA.profile);
  printRequestedContext(requested);
  console.log(`\n후보 매장 ${candidates.length}개`);
  console.log("\n각 매장 점수 분해:");

  const rows = candidates.map((card) => {
    const scored = scoreOne(card, mkCtx(userA.profile, requested));
    const delta = personalizationDelta(card, requested, userA.profile);
    if (!scored) {
      return {
        name: card.name,
        total: "FILTERED",
        companions_score: delta.companions,
        dietary_score: delta.dietary,
        interests_score: delta.interests,
        gender_score: delta.gender,
        category_match: card.category === "restaurant" ? 20 : 0,
        distance: 0,
        time_ctx: 0,
        capability: 0,
        penalty: -999,
      };
    }
    return {
      name: card.name,
      total: Math.round(scored.breakdown.finalScore),
      companions_score: Math.round(delta.companions),
      dietary_score: Math.round(delta.dietary),
      interests_score: Math.round(delta.interests),
      gender_score: Math.round(delta.gender),
      category_match: card.category === "restaurant" ? 20 : 0,
      distance: Math.round(scored.breakdown.distanceScore),
      time_ctx: 0,
      capability: 0,
      penalty: 0,
    };
  });
  console.table(rows);

  const comparisons = users.map((u) =>
    printComparison(u.label, requested, u.profile, candidates)
  );

  const bBaseProfile: UserProfile = {
    companions: ["혼자"],
    gender: "선택 안 함",
    dietary_restrictions: ["없음"],
    young_child: "없음",
    interests: ["만화카페/보드게임카페"],
    onboarding_completed_at: "debug",
  };
  const bScenarios = [
    {
      label: "B-1: 혼자 + 일반 + 만화카페 (activity)",
      requested: { ...requested, category: "activity" },
      profile: bBaseProfile,
    },
    {
      label: "B-2: 혼자 + 채식 + 만화카페 (food)",
      requested,
      profile: { ...bBaseProfile, dietary_restrictions: ["채식"] as UserProfile["dietary_restrictions"] },
    },
    {
      label: "B-3: 가족 + 일반 + 만화카페 (food)",
      requested,
      profile: { ...bBaseProfile, companions: ["가족"] as UserProfile["companions"] },
    },
  ];
  const bScenarioResults = bScenarios.map((s) =>
    printComparison(s.label, s.requested, s.profile, candidates)
  );

  console.log("\n=== 사용자별 추천 결과 차이 점검 (같은 컨텍스트: food/dinner/sunny) ===");
  const top3ByUser = comparisons.map((c) => JSON.stringify(c.withSurvey));
  const uniqueCount = new Set(top3ByUser).size;
  console.log(`- 사용자별 top3 unique count: ${uniqueCount}/${users.length}`);
  console.log(`- 판정: ${uniqueCount === users.length ? "OK (사용자별 결과 다름)" : "NO_DIFF (설문 반영 약함/없음)"}`);

  detectMissingUsage();
  printWeights();

  const bAllDiff = bScenarioResults.every(
    (r) => JSON.stringify(r.withSurvey) !== JSON.stringify(r.withoutSurvey)
  );
  const bAllNoDiff = bScenarioResults.every(
    (r) => JSON.stringify(r.withSurvey) === JSON.stringify(r.withoutSurvey)
  );
  const lowCoverageCount = capabilityRows.filter((r) => Number.parseFloat(String(r.coverage_percent)) < 50).length;

  console.log("\n=== B 무차이 원인 진단 ===");
  if (bAllDiff) {
    console.log("A. 페르소나 자체 영향 약함 (정상) — B-1/2/3은 차이 확인됨");
  } else if (bAllNoDiff) {
    console.log(
      lowCoverageCount > 0
        ? "B. 매장 데이터 부족 (수정 필요) — capability 커버리지 낮고 B-1/2/3 모두 무차이"
        : "C. 가중치 더 올려야 (옵션 B 시도) — 데이터는 있으나 B-1/2/3 모두 무차이"
    );
  } else {
    console.log(
      lowCoverageCount > 0
        ? "B/C 혼합: 일부는 페르소나 반영, 일부는 매장 데이터 부족 영향. capability 보강 후 재검증 필요"
        : "C. 일부 시나리오만 반응 — 가중치/시나리오 분리 점검 권장"
    );
  }

  console.log("\n=== 최종 요약 ===");
  const allDiff = comparisons.every((c) => JSON.stringify(c.withSurvey) !== JSON.stringify(c.withoutSurvey));
  console.log(`1) 설문 4개 반영 여부: ${allDiff ? "반영됨(비교 기준 차이 확인)" : "일부/약함(비교에서 무차이 케이스 존재)"}`);
  console.log(
    `2) 가중치 적정성: personal ${HYBRID_WEIGHT_PERSONAL * 100}% 축 + dietary 필터 결합 구조(개인화 영향 확대 반영)`
  );
  console.log("3) 누락 항목: 위 '누락 항목 점검' 섹션 확인");
  console.log(`4) 사용자별 결과 차이: ${uniqueCount === users.length ? "있음" : "없음/약함"}`);

  if (scoredA.length > 0) {
    console.log("\n[참고] 사용자 A top3:", scoredA.slice(0, 3).map((x) => x.card.name).join(" | "));
  }
}

void main();

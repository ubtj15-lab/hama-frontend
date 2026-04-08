import type { ScenarioObject, IntentCategory, FoodSubCategory } from "@/lib/scenarioEngine/types";

export type ConstraintChip = {
  id: string;
  label: string;
  /** 확장용: 나중에 제거/수정 연결 */
  kind?: "time" | "scenario" | "food" | "vibe" | "distance" | "facility" | "category";
};

const INTENT_LABEL: Record<IntentCategory, string> = {
  FOOD: "식당",
  CAFE: "카페",
  ACTIVITY: "액티비티",
  BEAUTY: "미용",
};

const SUB_LABEL: Record<FoodSubCategory, string> = {
  CHINESE: "중식",
  JAPANESE: "일식",
  KOREAN: "한식",
  WESTERN: "양식",
  FASTFOOD: "패스트푸드",
};

const SCENARIO_SHORT: Record<string, string> = {
  family_kids: "아이 동반",
  parent_child_outing: "육아 나들이",
  parents: "부모님과",
  date: "데이트",
  solo: "혼밥·혼술",
  friends: "친구",
  group: "단체",
};

const TIME_LONG: Record<string, string> = {
  morning: "아침",
  lunch: "점심",
  afternoon: "오후",
  dinner: "저녁",
  night: "밤·야식",
};

const PREF_CHIP: Record<string, string> = {
  not_spicy: "맵지 않음",
  light: "가벼운 메뉴",
  kid_friendly_menu: "아이 메뉴",
  parent_friendly_menu: "부모님과",
  brothy: "국물",
  parking_friendly: "주차",
};

/**
 * 누적 ScenarioObject → UI chip 데이터.
 */
export function summarizeActiveConstraints(intent: ScenarioObject): ConstraintChip[] {
  const chips: ConstraintChip[] = [];
  const seen = new Set<string>();

  const add = (id: string, label: string, kind?: ConstraintChip["kind"]) => {
    const k = id.replace(/\s+/g, "").toLowerCase();
    if (!k || seen.has(k)) return;
    seen.add(k);
    chips.push({ id, label, kind });
  };

  if (intent.timeOfDay) add(`t-${intent.timeOfDay}`, TIME_LONG[intent.timeOfDay] ?? intent.timeOfDay, "time");

  if (intent.scenario !== "generic") {
    const lab = SCENARIO_SHORT[intent.scenario];
    if (lab) add(`s-${intent.scenario}`, lab, "scenario");
  }

  if (intent.intentCategory) add(`c-${intent.intentCategory}`, INTENT_LABEL[intent.intentCategory], "category");

  if (intent.foodSubCategory) {
    add(`sub-${intent.foodSubCategory}`, SUB_LABEL[intent.foodSubCategory], "food");
  }

  for (const m of intent.menuIntent ?? []) {
    add(`m-${m}`, m, "food");
  }

  for (const p of intent.foodPreference ?? []) {
    const lab = PREF_CHIP[p] ?? p;
    add(`p-${p}`, lab, "food");
  }

  for (const v of intent.vibePreference ?? []) {
    if (v === "calm") add("v-calm", "조용한 편", "vibe");
    else if (v === "atmospheric") add("v-atm", "분위기", "vibe");
    else add(`v-${v}`, v, "vibe");
  }

  if (intent.distanceTolerance === "near_only") add("d-near", "가까운 곳", "distance");

  if (intent.indoorPreferred) add("in", "실내", "facility");

  if (intent.parkingPreferred) add("pk", "주차 가능", "facility");

  if (intent.withKids) add("wk", "아이 동반", "scenario");

  if (intent.withParents) add("wp", "부모님 동반", "scenario");

  return chips.slice(0, 10);
}

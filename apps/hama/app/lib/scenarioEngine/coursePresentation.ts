import type { ScenarioObject, ScenarioConfig, CourseStop, PlaceType, ScenarioType } from "./types";

/** 기능 설명형(A안) 제목 */
export function buildFunctionalCourseTitle(
  obj: ScenarioObject,
  config: ScenarioConfig,
  summaryLine: string
): string {
  const head = obj.intentType === "course_generation" ? `${config.label} 코스` : config.label;
  return `${head} · ${summaryLine}`;
}

function seedPick<T>(seed: string, items: readonly T[]): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return items[h % items.length]!;
}

function hasActivityHeavy(template: PlaceType[]): boolean {
  return template.includes("ACTIVITY");
}

export function totalTravelMinutes(stops: CourseStop[]): number {
  return stops.reduce((s, x) => s + (x.travelMinutesToNext ?? 0), 0);
}

function haystackFromStops(stops: CourseStop[]): string {
  return stops
    .flatMap((s) => [s.placeName, s.categoryLabel, ...(s.mood ?? []), ...(s.tags ?? [])])
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** 시나리오별 제목 풀(행마다 톤이 조금 다름 — courseRank로 행 순환). */
function titlePoolForScenario(scenario: ScenarioType): readonly (readonly string[])[] {
  switch (scenario) {
    case "family_kids":
    case "parent_child_outing":
      return [
        ["아이랑 편한 실내 코스", "실내 위주 가족 나들이 코스", "아이 동선 부담 적은 코스"],
        ["가족과 가볍게 돌아보는 코스", "아이랑 여유 있게 즐기는 코스", "부담 없는 가족 동선"],
      ];
    case "parents":
      return [
        ["부모님과 편하게 가기 좋은 코스", "여유로운 동선의 가족 코스", "발이 편한 일정의 코스"],
      ];
    case "solo":
      return [
        ["혼자 가기 좋은 잔잔한 코스", "나만의 루틴 데이 코스"],
        ["혼자 가기 좋은 루틴 코스", "나만의 페이스로 즐기는 코스", "혼행에 어울리는 코스"],
      ];
    case "group":
    case "friends":
      return [
        ["여럿이 함께 즐기기 좋은 코스", "친구들과 부담 없는 동선 코스"],
        ["모임에 어울리는 활기찬 코스", "시끌벅적 분위기의 모임 코스"],
      ];
    case "family":
      return [["가족과 편하게 즐기는 코스", "온 가족 동선이 편한 코스", "가족 외출 기본 코스"]];
    default:
      return [];
  }
}

/**
 * 상황·감정형(B안) 제목. 시나리오 + 템플릿·시간대 신호로 갈라짐.
 * `courseRank`·`planId`로 카드 간 겹침 완화.
 */
export function buildSituationCourseTitle(
  obj: ScenarioObject,
  config: ScenarioConfig,
  planId: string,
  template: PlaceType[],
  stops: CourseStop[],
  courseRank: number
): string {
  const seed = `${planId}-${courseRank}-${obj.scenario}-${template.join("")}`;
  const travel = totalTravelMinutes(stops);
  const shortRoute = travel <= 35;
  const nightish = obj.timeOfDay === "night" || obj.timeOfDay === "dinner";
  const calm =
    obj.activityLevel === "calm" ||
    (obj.mood?.some((m) => /조용|차분|잔잔|감성/.test(m)) ?? false);
  const active = obj.activityLevel === "active" || hasActivityHeavy(template);
  const indoorish =
    obj.indoorPreferred === true ||
    obj.weatherHint === "rain" ||
    obj.weatherHint === "snow" ||
    !template.includes("WALK");
  const withKids =
    obj.withKids === true || obj.scenario === "family_kids" || obj.scenario === "parent_child_outing";
  const totalMin = stops.reduce((s, x) => s + x.dwellMinutes + (x.travelMinutesToNext ?? 0), 0);
  const light = totalMin <= 200;
  const hay = haystackFromStops(stops);

  const scenarioRows = titlePoolForScenario(obj.scenario);
  if (scenarioRows.length > 0) {
    const row = scenarioRows[courseRank % scenarioRows.length]!;
    return seedPick(seed, row);
  }

  if (withKids && indoorish) {
    return seedPick(seed, ["아이랑 편한 실내 코스", "가족 실내 동선 코스"] as const);
  }

  if (nightish && active) {
    return seedPick(seed, ["활동적인 저녁 데이트", "저녁에 에너지 나는 데이트 코스"] as const);
  }
  if (calm || /감성|조용|브런치/.test(hay)) {
    return seedPick(seed, ["조용하고 감성적인 코스", "느긋한 분위기의 데이트 코스"] as const);
  }
  if (light && shortRoute) {
    return seedPick(seed, ["가볍게 즐기는 근거리 코스", "짧게 다녀오기 좋은 코스"] as const);
  }
  if (indoorish && (obj.weatherHint === "rain" || obj.weatherHint === "snow")) {
    return seedPick(seed, ["실내 위주 데이트 코스", "날씨 걱정 없는 실내 동선"] as const);
  }
  if (active && !calm) {
    return seedPick(seed, ["움직임이 있는 활동형 코스", "체험 위주 데이트 코스"] as const);
  }
  if (indoorish) {
    return seedPick(seed, ["실내 위주로 편한 데이트", "발걸음 가벼운 실내 코스"] as const);
  }

  return seedPick(seed, [
    "오늘 분위기 좋은 데이트 코스",
    "부담 없는 클래식 데이트 코스",
    `${config.label} 느낌의 추천 코스`,
  ] as const);
}

/**
 * 판단 속도용 짧은 배지 2~3개(코스마다 순서 로테이션으로 차별화).
 */
export function buildCourseBadges(
  obj: ScenarioObject,
  template: PlaceType[],
  stops: CourseStop[],
  courseRank: number
): string[] {
  const raw: string[] = [];
  const travel = totalTravelMinutes(stops);
  const withKids =
    obj.withKids === true || obj.scenario === "family_kids" || obj.scenario === "parent_child_outing";
  const withParents = obj.withParents === true || obj.scenario === "parents";
  const active = hasActivityHeavy(template) || obj.activityLevel === "active";
  const calm = obj.activityLevel === "calm" || (obj.mood?.some((m) => /조용|차분|잔잔/.test(m)) ?? false);
  const nightish = obj.timeOfDay === "night" || obj.timeOfDay === "dinner";

  const indoorLean =
    obj.indoorPreferred === true ||
    obj.weatherHint === "rain" ||
    obj.weatherHint === "snow" ||
    !template.includes("WALK");
  if (indoorLean) raw.push("실내 위주");
  if (active) raw.push("활동형");
  if (travel <= 35) raw.push("가까운 동선");
  if (calm) raw.push("조용한 편");
  if (withKids) raw.push("아이와 함께");
  if (withParents) raw.push("부모님과");
  if (nightish) raw.push("저녁 추천");

  const totalMin = stops.reduce((s, x) => s + x.dwellMinutes + (x.travelMinutesToNext ?? 0), 0);
  if (totalMin <= 200) raw.push("가볍게 즐기기");

  const seen = new Set<string>();
  const uniq = raw.filter((b) => (seen.has(b) ? false : (seen.add(b), true)));
  if (uniq.length <= 3) return uniq;

  const start = courseRank % uniq.length;
  return [...uniq.slice(start), ...uniq.slice(0, start)].slice(0, 3);
}

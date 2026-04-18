import type { CourseLearningEventName, CourseLearningLogPayload, CoursePatternStats, PlaceCourseStats } from "./courseLearningTypes";
import { COURSE_LEARNING_EVENT_WEIGHTS } from "./courseLearningConstants";
import { buildPatternKey, stepPatternFromSteps } from "./courseLearningKeys";

function emptyPatternStats(
  key: string,
  payload: CourseLearningLogPayload,
  stepPattern: string
): CoursePatternStats {
  return {
    key,
    scenario: payload.scenario,
    childAgeGroup: payload.childAgeGroup,
    weatherCondition: payload.weatherCondition,
    timeOfDay: payload.timeOfDay,
    dateTimeBand: payload.dateTimeBand,
    templateId: payload.templateId,
    stepPattern,
    impressions: 0,
    clicks: 0,
    starts: 0,
    saves: 0,
    detailViews: 0,
    routeClicks: 0,
    callClicks: 0,
    exits: 0,
    noActions: 0,
    skips: 0,
    behaviorScoreSum: 0,
  };
}

function emptyPlaceStats(placeId: string): PlaceCourseStats {
  return {
    placeId,
    impressions: 0,
    clicks: 0,
    starts: 0,
    saves: 0,
    detailViews: 0,
    exits: 0,
    behaviorScoreSum: 0,
  };
}

/**
 * 통계 기반 학습 저장소 — 클라이언트 메모리 또는 서버 동기화 JSON으로 복원 가능.
 * DB 스키마 전환 시 동일 필드를 테이블에 매핑하면 됨.
 */
export class CourseLearningStore {
  readonly patternStats = new Map<string, CoursePatternStats>();
  readonly placeStats = new Map<string, PlaceCourseStats>();

  recordEvent(event: CourseLearningEventName, payload: CourseLearningLogPayload): void {
    const eventWeight = COURSE_LEARNING_EVENT_WEIGHTS[event] ?? 0;
    const stepPattern = stepPatternFromSteps(payload.stepCategories);
    const ctx = {
      scenario: payload.scenario,
      templateId: payload.templateId,
      stepPattern,
      childAgeGroup: payload.childAgeGroup,
      weatherCondition: payload.weatherCondition,
      timeOfDay: payload.timeOfDay,
      dateTimeBand: payload.dateTimeBand,
    };
    const key = buildPatternKey(ctx);
    const aggKey = buildPatternKey({ ...ctx, templateId: "*" });
    const patternKeys = key === aggKey ? [key] : [key, aggKey];

    const applyToRow = (row: CoursePatternStats): void => {
      row.behaviorScoreSum += eventWeight;

      switch (event) {
        case "course_impression":
          row.impressions += 1;
          break;
        case "course_card_click":
          row.clicks += 1;
          break;
        case "course_detail_view":
        case "long_view_time":
          row.detailViews += 1;
          break;
        case "course_start_click":
          row.starts += 1;
          break;
        case "course_save":
          row.saves += 1;
          break;
        case "first_place_route_click":
          row.routeClicks += 1;
          break;
        case "course_place_detail_click":
          row.detailViews += 1;
          break;
        case "course_call_click":
          row.callClicks += 1;
          break;
        case "immediate_exit":
          row.exits += 1;
          break;
        case "no_action_after_impression":
          row.noActions += 1;
          break;
        case "repeated_skip":
          row.skips += 1;
          break;
        default:
          break;
      }
    };

    for (const k of patternKeys) {
      let row = this.patternStats.get(k);
      if (!row) {
        const isAgg = k === aggKey;
        row = emptyPatternStats(
          k,
          { ...payload, templateId: isAgg ? "*" : payload.templateId },
          stepPattern
        );
        this.patternStats.set(k, row);
      }
      applyToRow(row);
    }

    for (const pid of payload.placeIds) {
      let pr = this.placeStats.get(pid);
      if (!pr) {
        pr = emptyPlaceStats(pid);
        this.placeStats.set(pid, pr);
      }
      pr.behaviorScoreSum += eventWeight;
      if (event === "course_impression") pr.impressions += 1;
      if (event === "course_card_click" || event === "course_detail_view") pr.clicks += 1;
      if (event === "course_start_click") pr.starts += 1;
      if (event === "course_save") pr.saves += 1;
      if (event === "course_place_detail_click") pr.detailViews += 1;
      if (event === "immediate_exit") pr.exits += 1;
    }
  }

  getPattern(key: string): CoursePatternStats | undefined {
    return this.patternStats.get(key);
  }

  getPlace(placeId: string): PlaceCourseStats | undefined {
    return this.placeStats.get(placeId);
  }

  toJSON(): { patterns: CoursePatternStats[]; places: PlaceCourseStats[] } {
    return {
      patterns: [...this.patternStats.values()],
      places: [...this.placeStats.values()],
    };
  }

  static fromJSON(data: { patterns: CoursePatternStats[]; places: PlaceCourseStats[] }): CourseLearningStore {
    const s = new CourseLearningStore();
    for (const p of data.patterns) s.patternStats.set(p.key, { ...p });
    for (const pl of data.places) s.placeStats.set(pl.placeId, { ...pl });
    return s;
  }
}

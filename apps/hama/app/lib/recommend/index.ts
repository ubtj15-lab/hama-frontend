/**
 * HAMA recommend — 검색·배지·**독립 코스 엔진(v2)** 및 레거시 브리지.
 */

/** 코스 추천 v2 — `scenarioEngine`과 타입 분리 */
export * from "./courseTypes";
export * from "./courseTemplates";
export * from "./courseRouting";
export * from "./courseLearning";
export * from "./courseScoring";
export * from "./courseGenerator";
export * from "./getPatternBoost";

/** 기존 `scenarioEngine` 코스 파이프라인 (점진 이전용) */
export * as courseLegacy from "./courseLegacy";

export * from "./courseDuration";

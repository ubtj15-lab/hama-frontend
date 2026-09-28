import type { HomeCard } from "@/lib/storeTypes";
import type { ConversationContext, RefinementType } from "@/lib/conversation/types";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { processConversationTurn } from "@/lib/conversation/processTurn";
import { detectRefinementType } from "@/lib/conversation/refinement";
import { parseTurnIntent } from "@/lib/conversation/parseTurn";
import { mergeResultsScenario } from "@/lib/conversation/mergeResultsScenario";
import { mergeResultsScenarioWithExplicitNav } from "@/lib/hamaResultCategoryCanonical";
import { resolveSearchQueryForHomeCards } from "@/lib/results/resultsQueryRouting";
import { isSoloSituationIntentQuery, matchNamedFoodPreset } from "@/lib/recommend/namedFoodPresets";
import type { ActualTurn, ExpectValue, GoldScenario, GoldTurn, TurnResult } from "./types";

const REGION_TOKENS = ["동탄역", "동탄1", "동탄2", "북광장", "동탄", "오산", "평택", "병점"] as const;

function asList<T>(value: ExpectValue<T> | boolean | "any"): T[] | "any" {
  if (value === "any") return "any";
  return (Array.isArray(value) ? value : [value]) as T[];
}

function matches<T>(actual: T | null | undefined, expected: ExpectValue<T | null> | boolean | "any"): boolean {
  if (expected === "any") return true;
  const allowed = asList(expected as ExpectValue<T | null>);
  if (allowed === "any") return true;
  const normalized = (actual ?? null) as T | null;
  return allowed.some((item) => item === normalized);
}

function sameSet(actual: string[] | undefined, expected: string[]): boolean {
  const left = [...(actual ?? [])].filter(Boolean).sort();
  const right = [...expected].sort();
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function includesAll(actual: string[] | undefined, expected: string[]): boolean {
  const set = new Set(actual ?? []);
  return expected.every((item) => set.has(item));
}

function calmOf(intent: ScenarioObject | null | undefined): boolean {
  const vibe = intent?.vibePreference ?? [];
  return vibe.includes("calm") || intent?.activityLevel === "calm";
}

function notSpicyOf(intent: ScenarioObject | null | undefined): boolean {
  return (intent?.foodPreference ?? []).includes("not_spicy");
}

function textValue(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function cardsOf(places: GoldTurn["shownPlaces"]): HomeCard[] {
  return places.map((place) => ({
    id: place.id,
    name: place.name,
    category: "activity",
  }));
}

function attachShown(ctx: ConversationContext, turn: GoldTurn): ConversationContext {
  if (!turn.shownPlaces.length) return ctx;
  return {
    ...ctx,
    lastRecommendations: {
      placeIds: turn.shownPlaces.map((place) => place.id),
      query: turn.utterance,
      cards: cardsOf(turn.shownPlaces),
    },
  };
}

function pipelineRefinement(text: string, previous: ConversationContext | null): RefinementType {
  if (!previous) return "new_request";
  return detectRefinementType(text, previous);
}

function readActual(
  previous: ConversationContext | null,
  ctx: ConversationContext,
  merged: ScenarioObject | null,
  utterance: string
): ActualTurn {
  const intent = ctx.currentIntent;
  const searchQuery = resolveSearchQueryForHomeCards({
    qRaw: utterance,
    explicitCategory: null,
    isSoloSituationQuery: isSoloSituationIntentQuery(utterance),
    hasNamedFoodPreset: Boolean(matchNamedFoodPreset(utterance)),
  });
  const menuTerms = [
    ...(intent.conversationExcludeMenuTerms ?? []),
    ...(ctx.rejectedTags ?? []),
  ];
  return {
    pipelineRefinement: pipelineRefinement(utterance, previous),
    classifierRefinement: detectRefinementType(utterance, previous),
    screenRefinement: detectRefinementType(utterance, ctx),
    stateCategory: textValue(intent.intentCategory),
    screenCategory: textValue(merged?.intentCategory),
    stateRegion: textValue(intent.region),
    screenRegion: textValue(merged?.region),
    stateScenario: textValue(intent.scenario),
    screenScenario: textValue(merged?.scenario),
    withKids: intent.withKids === true,
    screenWithKids: merged?.withKids === true,
    indoor: intent.indoorPreferred === true,
    screenIndoor: merged?.indoorPreferred === true,
    distance: textValue(intent.distanceTolerance),
    screenDistance: textValue(merged?.distanceTolerance),
    calm: calmOf(intent),
    parking: intent.parkingPreferred === true,
    notSpicy: notSpicyOf(intent),
    weather: textValue(intent.weatherHint),
    foodSub: textValue(intent.foodSubCategory),
    screenFoodSub: textValue(merged?.foodSubCategory),
    linkedFood: (ctx.linkedPurposes ?? []).some((item) => item.intentCategory === "FOOD"),
    frozenPlayIds: (ctx.frozenPlayCards ?? []).map((card) => card.id),
    clarification: Boolean(ctx.clarificationNeeded || ctx.regionClarification),
    regionClarification: ctx.regionClarification ?? null,
    excludePlaceIds: [...(ctx.rejectedPlaceIds ?? [])],
    screenExcludePlaceIds: [...(merged?.conversationExcludePlaceIds ?? intent.conversationExcludePlaceIds ?? [])],
    rejectedCategories: [...(ctx.rejectedCategories ?? [])],
    excludedMenus: [...new Set(menuTerms)],
    recommendationMode: textValue(merged?.recommendationMode ?? intent.recommendationMode),
    searchQuery,
  };
}

function distanceMatches(actual: string | null, expected: GoldTurn["distance"]): boolean {
  if (expected === "any") return true;
  if (expected === "near_only") return actual === "near_only";
  return actual !== "near_only";
}

function checkSide(
  failed: string[],
  label: string,
  ok: boolean
): void {
  if (!ok) failed.push(label);
}

function scoreTurn(
  scenario: GoldScenario,
  turn: GoldTurn,
  index: number,
  previous: ConversationContext | null,
  previousShownIds: string[]
): { result: TurnResult; next: ConversationContext } {
  const utterance = turn.utterance;
  let failed: string[] = [];
  let actual: ActualTurn;
  let next: ConversationContext;
  try {
    parseTurnIntent(utterance, previous);
    next = processConversationTurn(utterance, previous, {
      persist: false,
      turnId: `${scenario.id}-turn-${index + 1}`,
    });
    const mergedDirect = mergeResultsScenario(utterance, next);
    const merged = mergeResultsScenarioWithExplicitNav(utterance, next, null, null);
    if (JSON.stringify(mergedDirect) !== JSON.stringify(merged)) {
      failed.push("screen_nav_merge");
    }
    actual = readActual(previous, next, merged, utterance);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    actual = {
      pipelineRefinement: "new_request",
      classifierRefinement: "new_request",
      screenRefinement: "new_request",
      stateCategory: null,
      screenCategory: null,
      stateRegion: null,
      screenRegion: null,
      stateScenario: null,
      screenScenario: null,
      withKids: false,
      screenWithKids: false,
      indoor: false,
      screenIndoor: false,
      distance: null,
      screenDistance: null,
      calm: false,
      parking: false,
      notSpicy: false,
      weather: null,
      foodSub: null,
      screenFoodSub: null,
      linkedFood: false,
      frozenPlayIds: [],
      clarification: false,
      regionClarification: null,
      excludePlaceIds: [],
      screenExcludePlaceIds: [],
      rejectedCategories: [],
      excludedMenus: [],
      recommendationMode: null,
      searchQuery: null,
    };
    failed = [`pipeline_error:${message}`];
    next = previous ?? {
      sessionId: "simulator-error",
      turns: [],
      currentIntent: {
        rawQuery: utterance,
        intentType: "search_strict",
        scenario: "generic",
      },
    };
    return {
      result: {
        scenarioId: scenario.id,
        title: scenario.title,
        situation: scenario.situation,
        turnIndex: index + 1,
        utterance,
        support: turn.support,
        goldConfidence: turn.goldConfidence,
        fixRoute: turn.fixRoute,
        note: turn.note,
        passed: false,
        failedChecks: failed,
        observations: [],
        primaryCause: "pipeline_error",
        expected: expectedView(turn),
        actual,
      },
      next,
    };
  }

  const observations: string[] = [];
  const stateRefinementOk = matches(actual.pipelineRefinement, turn.refinement);
  const classifierOk = matches(actual.classifierRefinement, turn.refinement);
  const screenRefinementOk = matches(actual.screenRefinement, turn.refinement);
  checkSide(failed, "refinement_state", stateRefinementOk);
  checkSide(failed, "refinement_classifier", classifierOk);
  checkSide(failed, "refinement_screen", screenRefinementOk);
  if (actual.pipelineRefinement !== actual.classifierRefinement) {
    (stateRefinementOk && classifierOk ? observations : failed).push("classifier_pipeline_divergence");
  }
  if (actual.pipelineRefinement !== actual.screenRefinement) {
    (stateRefinementOk && screenRefinementOk ? observations : failed).push("state_screen_refinement_divergence");
  }

  const categoryStateOk = matches(actual.stateCategory, turn.category);
  const categoryScreenOk = matches(actual.screenCategory, turn.category);
  checkSide(failed, "category_state", categoryStateOk);
  checkSide(failed, "category_screen", categoryScreenOk);
  if (actual.stateCategory !== actual.screenCategory) {
    (categoryStateOk && categoryScreenOk ? observations : failed).push("state_screen_category_divergence");
  }

  const regionStateOk = matches(actual.stateRegion, turn.region);
  const regionScreenOk = matches(actual.screenRegion, turn.region);
  checkSide(failed, "region_state", regionStateOk);
  checkSide(failed, "region_screen", regionScreenOk);
  if (actual.stateRegion !== actual.screenRegion) {
    (regionStateOk && regionScreenOk ? observations : failed).push("state_screen_region_divergence");
  }

  if (turn.withKids !== "any") {
    checkSide(failed, "with_kids", actual.withKids === turn.withKids && actual.screenWithKids === turn.withKids);
  }
  checkSide(failed, "scenario_state", matches(actual.stateScenario, turn.scenario));
  checkSide(failed, "scenario_screen", matches(actual.screenScenario, turn.scenario));
  if (turn.indoor !== "any") {
    checkSide(failed, "indoor", actual.indoor === turn.indoor && actual.screenIndoor === turn.indoor);
  }
  if (turn.distance !== "any") {
    checkSide(
      failed,
      "distance",
      distanceMatches(actual.distance, turn.distance) && distanceMatches(actual.screenDistance, turn.distance)
    );
  }
  if (turn.calm !== "any") checkSide(failed, "calm", actual.calm === turn.calm);
  if (turn.parking !== "any") checkSide(failed, "parking", actual.parking === turn.parking);
  if (turn.notSpicy !== "any") checkSide(failed, "not_spicy", actual.notSpicy === turn.notSpicy);
  if (turn.weather !== "any") checkSide(failed, "weather", matches(actual.weather, turn.weather));
  if (turn.foodSub !== "any") {
    checkSide(failed, "food_sub_state", matches(actual.foodSub, turn.foodSub));
    checkSide(failed, "food_sub_screen", matches(actual.screenFoodSub, turn.foodSub));
  }
  checkSide(failed, "linked_food", actual.linkedFood === turn.linkedFood);
  if (turn.playListKept) {
    checkSide(failed, "play_list_kept", sameSet(actual.frozenPlayIds, previousShownIds));
  }
  if (turn.clarification !== "any") checkSide(failed, "clarification", actual.clarification === turn.clarification);
  checkSide(failed, "exclude_ids", sameSet(actual.excludePlaceIds, turn.excludePlaceIds));
  checkSide(failed, "exclude_ids_screen", sameSet(actual.screenExcludePlaceIds, turn.excludePlaceIds));
  if (turn.rejectedCategories.length || actual.rejectedCategories.length) {
    checkSide(failed, "rejected_categories", includesAll(actual.rejectedCategories, turn.rejectedCategories) && sameSet(actual.rejectedCategories, turn.rejectedCategories));
  }
  if (turn.excludeMenus.length) {
    checkSide(failed, "exclude_menus", includesAll(actual.excludedMenus, turn.excludeMenus));
  }
  if (turn.recommendationMode !== "any") {
    checkSide(failed, "recommendation_mode", actual.recommendationMode === turn.recommendationMode);
  }
  const expectedQuery = turn.searchQuery ?? utterance;
  checkSide(failed, "search_query", matches(actual.searchQuery, expectedQuery));

  for (const field of turn.add) {
    const added =
      (field === "withKids" && actual.withKids) ||
      (field === "indoor" && actual.indoor) ||
      (field === "near" && actual.distance === "near_only") ||
      (field === "calm" && actual.calm) ||
      (field === "parking" && actual.parking) ||
      (field === "notSpicy" && actual.notSpicy) ||
      (field === "rain" && actual.weather === "rain") ||
      (field === "date" && (actual.stateScenario === "date" || actual.screenScenario === "date")) ||
      (field === "solo" && (actual.stateScenario === "solo" || actual.screenScenario === "solo")) ||
      (field === "parents" && (actual.stateScenario === "parents" || actual.screenScenario === "parents")) ||
      (field === "friends" && (actual.stateScenario === "friends" || actual.screenScenario === "friends")) ||
      (field === "foodSub" && Boolean(actual.foodSub || actual.screenFoodSub)) ||
      (field === "linkedFood" && actual.linkedFood);
    checkSide(failed, `add_${field}`, Boolean(added));
  }
  for (const field of turn.remove) {
    const removed =
      (field === "indoor" && !actual.indoor) ||
      (field === "withKids" && !actual.withKids) ||
      (field === "near" && actual.distance !== "near_only") ||
      (field === "calm" && !actual.calm) ||
      (field === "parking" && !actual.parking) ||
      (field === "notSpicy" && !actual.notSpicy) ||
      (field === "foodSub" && !actual.foodSub && !actual.screenFoodSub) ||
      (field === "linkedFood" && !actual.linkedFood);
    checkSide(failed, `remove_${field}`, removed);
  }

  const primary = primaryCause(failed);
  return {
    result: {
      scenarioId: scenario.id,
      title: scenario.title,
      situation: scenario.situation,
      turnIndex: index + 1,
      utterance,
      support: turn.support,
      goldConfidence: turn.goldConfidence,
      fixRoute: turn.fixRoute,
      note: turn.note,
      passed: failed.length === 0,
      failedChecks: failed,
      observations,
      primaryCause: primary,
      expected: expectedView(turn),
      actual,
    },
    next: attachShown(next, turn),
  };
}

function expectedView(turn: GoldTurn): Record<string, unknown> {
  return {
    support: turn.support,
    refinement: turn.refinement,
    category: turn.category,
    region: turn.region,
    withKids: turn.withKids,
    scenario: turn.scenario,
    indoor: turn.indoor,
    distance: turn.distance,
    calm: turn.calm,
    parking: turn.parking,
    notSpicy: turn.notSpicy,
    weather: turn.weather,
    foodSub: turn.foodSub,
    linkedFood: turn.linkedFood,
    playListKept: turn.playListKept,
    clarification: turn.clarification,
    excludePlaceIds: turn.excludePlaceIds,
    rejectedCategories: turn.rejectedCategories,
    excludeMenus: turn.excludeMenus,
    recommendationMode: turn.recommendationMode,
    searchQuery: turn.searchQuery ?? turn.utterance,
    retain: turn.retain,
    add: turn.add,
    remove: turn.remove,
  };
}

const CAUSE_ORDER = [
  "pipeline_error",
  "refinement_state",
  "refinement_classifier",
  "refinement_screen",
  "classifier_pipeline_divergence",
  "state_screen_refinement_divergence",
  "category_state",
  "category_screen",
  "state_screen_category_divergence",
  "region_state",
  "region_screen",
  "state_screen_region_divergence",
  "scenario_state",
  "scenario_screen",
  "with_kids",
  "indoor",
  "distance",
  "calm",
  "parking",
  "not_spicy",
  "weather",
  "food_sub_state",
  "food_sub_screen",
  "linked_food",
  "play_list_kept",
  "clarification",
  "exclude_ids",
  "exclude_ids_screen",
  "rejected_categories",
  "exclude_menus",
  "recommendation_mode",
  "search_query",
];

function primaryCause(failed: string[]): string | null {
  if (!failed.length) return null;
  for (const cause of CAUSE_ORDER) {
    if (failed.includes(cause)) return cause;
  }
  const added = failed.find((item) => item.startsWith("add_") || item.startsWith("remove_"));
  return added ?? failed[0];
}

export type GoldWarning = {
  scenarioId: string;
  turnIndex: number;
  utterance: string;
  message: string;
};

export function goldWarnings(scenarios: GoldScenario[]): GoldWarning[] {
  const warnings: GoldWarning[] = [];
  if (scenarios.length !== 40) {
    warnings.push({
      scenarioId: "ALL",
      turnIndex: 0,
      utterance: "",
      message: `시나리오 수가 40이 아닙니다: ${scenarios.length}`,
    });
  }
  const ids = new Set<string>();
  for (const scenario of scenarios) {
    if (ids.has(scenario.id)) {
      warnings.push({
        scenarioId: scenario.id,
        turnIndex: 0,
        utterance: "",
        message: "시나리오 ID가 중복입니다",
      });
    }
    ids.add(scenario.id);
    if (scenario.turns.length < 3 || scenario.turns.length > 5) {
      warnings.push({
        scenarioId: scenario.id,
        turnIndex: 0,
        utterance: "",
        message: `턴 수가 3~5가 아닙니다: ${scenario.turns.length}`,
      });
    }
    const seen = new Set<string>();
    for (let index = 0; index < scenario.turns.length; index += 1) {
      const turn = scenario.turns[index];
      for (const place of turn.shownPlaces) seen.add(place.id);
      const named = namedRegion(turn.utterance);
      if (typeof turn.region === "string" && named && turn.region !== named) {
        warnings.push({
          scenarioId: scenario.id,
          turnIndex: index + 1,
          utterance: turn.utterance,
          message: `발화의 지역 토큰은 ${named}인데 정답 지역은 ${turn.region}입니다`,
        });
      }
      for (const id of turn.excludePlaceIds) {
        if (!seen.has(id) && index > 0) {
          const earlier = scenario.turns.slice(0, index).some((item) => item.shownPlaces.some((place) => place.id === id));
          if (!earlier) {
            warnings.push({
              scenarioId: scenario.id,
              turnIndex: index + 1,
              utterance: turn.utterance,
              message: `제외 ID ${id}가 이전 모의 추천에 없습니다`,
            });
          }
        }
      }
    }
  }
  return warnings;
}

function namedRegion(text: string): string | null {
  for (const token of REGION_TOKENS) {
    if (text.includes(token)) return token;
  }
  return null;
}

export function evaluateConversations(scenarios: GoldScenario[]): TurnResult[] {
  const results: TurnResult[] = [];
  for (const scenario of scenarios) {
    let ctx: ConversationContext | null = null;
    let shownIds: string[] = [];
    for (let index = 0; index < scenario.turns.length; index += 1) {
      const turn = scenario.turns[index];
      const scored = scoreTurn(scenario, turn, index, ctx, shownIds);
      results.push(scored.result);
      ctx = scored.next;
      if (turn.shownPlaces.length) shownIds = turn.shownPlaces.map((place) => place.id);
    }
  }
  return results;
}

export function isContextMiss(result: TurnResult): boolean {
  return result.failedChecks.some((item) =>
    ["region_state", "region_screen", "category_state", "category_screen", "with_kids", "scenario_state", "scenario_screen", "indoor", "distance", "calm", "parking"].includes(item)
  );
}

export function isConditionMiss(result: TurnResult): boolean {
  return result.failedChecks.some((item) => item.startsWith("add_") || item.startsWith("remove_") || item.startsWith("food_sub") || item === "indoor" || item === "distance" || item === "calm" || item === "parking" || item === "not_spicy" || item === "weather");
}

export function isRejectionMiss(result: TurnResult): boolean {
  return result.failedChecks.some((item) => item === "exclude_ids" || item === "exclude_ids_screen" || item === "rejected_categories" || item === "exclude_menus" || item === "refinement_state" || item === "refinement_screen");
}

import type { RefinementType } from "@/lib/conversation/types";

/** Human gold. Written before the first measurement and not copied from function output. */
export type Support = "supported" | "unsupported";

export type GoldConfidence = "firm" | "review";

/** If this turn fails, which kind of follow-up is appropriate. Decided from the language, not the score. */
export type FixRoute = "rules" | "model";

export type RetainField = "region" | "category" | "withKids" | "scenario" | "indoor" | "distance" | "calm" | "parking";

export type AddField =
  | "withKids"
  | "indoor"
  | "near"
  | "calm"
  | "parking"
  | "notSpicy"
  | "rain"
  | "date"
  | "solo"
  | "parents"
  | "friends"
  | "foodSub"
  | "linkedFood";

export type RemoveField = "indoor" | "withKids" | "near" | "calm" | "parking" | "notSpicy" | "foodSub" | "linkedFood";

export type ExpectValue<T> = T | T[] | "any";

export type PlaceStub = {
  id: string;
  name: string;
};

export type GoldTurn = {
  utterance: string;
  support: Support;
  refinement: ExpectValue<RefinementType>;
  category: ExpectValue<string | null>;
  region: ExpectValue<string | null>;
  withKids: boolean | "any";
  scenario: ExpectValue<string | null>;
  indoor: boolean | "any";
  /** null means the turn should not require near_only. flexible is accepted. */
  distance: "near_only" | null | "any";
  calm: boolean | "any";
  parking: boolean | "any";
  notSpicy: boolean | "any";
  weather: "rain" | null | "any";
  foodSub: ExpectValue<string | null>;
  linkedFood: boolean;
  /** Previous play cards should stay frozen because this turn only adds a meal. */
  playListKept: boolean;
  clarification: boolean | "any";
  excludePlaceIds: string[];
  rejectedCategories: string[];
  /** Menu words the user asked to drop, such as 파스타. */
  excludeMenus: string[];
  recommendationMode: "single" | "course" | "any";
  /** Home-card query. Defaults to the utterance when omitted. */
  searchQuery?: string | string[];
  retain: RetainField[];
  add: AddField[];
  remove: RemoveField[];
  /** Mock places the screen would show after this turn. Passed into the next turn only. */
  shownPlaces: PlaceStub[];
  goldConfidence: GoldConfidence;
  fixRoute: FixRoute;
  rejectionCase: boolean;
  note?: string;
};

export type GoldScenario = {
  id: string;
  title: string;
  situation: string;
  turns: GoldTurn[];
};

export type ActualTurn = {
  pipelineRefinement: RefinementType;
  classifierRefinement: RefinementType;
  screenRefinement: RefinementType;
  stateCategory: string | null;
  screenCategory: string | null;
  stateRegion: string | null;
  screenRegion: string | null;
  stateScenario: string | null;
  screenScenario: string | null;
  withKids: boolean;
  screenWithKids: boolean;
  indoor: boolean;
  screenIndoor: boolean;
  distance: string | null;
  screenDistance: string | null;
  calm: boolean;
  parking: boolean;
  notSpicy: boolean;
  weather: string | null;
  foodSub: string | null;
  screenFoodSub: string | null;
  linkedFood: boolean;
  frozenPlayIds: string[];
  clarification: boolean;
  regionClarification: string | null;
  excludePlaceIds: string[];
  screenExcludePlaceIds: string[];
  rejectedCategories: string[];
  excludedMenus: string[];
  recommendationMode: string | null;
  searchQuery: string | null;
};

export type TurnResult = {
  scenarioId: string;
  title: string;
  situation: string;
  turnIndex: number;
  utterance: string;
  support: Support;
  goldConfidence: GoldConfidence;
  fixRoute: FixRoute;
  note?: string;
  passed: boolean;
  failedChecks: string[];
  /** Differences that stayed inside the acceptable gold set. */
  observations: string[];
  primaryCause: string | null;
  expected: Record<string, unknown>;
  actual: ActualTurn;
};

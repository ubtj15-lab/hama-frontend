import type { HomeCard } from "@/lib/storeTypes";
import type { IntentionType } from "@/lib/intention";
import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import type { UserProfile } from "@/lib/onboardingProfile";
import type { RecommendScoreBreakdown } from "@/lib/recommend/scoring";
import type { ExposureItemDebug } from "@/lib/recommend/exposureRerank";
import type { DiscoveryItemDebug, DiscoveryRole } from "@/lib/recommend/discoveryRole";

export type AgeGroup = "20s" | "30s" | "40s" | "50s+" | "unknown";
export type FamilyType = "solo" | "couple" | "family_with_kids" | "friends" | "parents" | "unknown";
export type SimLocationId = "osan" | "dongtan";
export type RetrievalMode = "current" | "full_catalog";

export type FailureCode =
  | "DATA_GAP"
  | "RETRIEVAL_FAILURE"
  | "FILTER_FAILURE"
  | "INTENT_FAILURE"
  | "RANKING_FAILURE"
  | "DIVERSITY_FAILURE"
  | "DISTANCE_FAILURE"
  | "ZERO_RESULT"
  | "WRONG_CATEGORY"
  | "HARD_CONSTRAINT_VIOLATION";

export type ScenarioPersona = {
  ageGroup?: AgeGroup;
  familyType?: FamilyType;
  children?: boolean;
  purpose?: string;
};

export type ScenarioContext = {
  location?: SimLocationId;
  lat?: number;
  lng?: number;
  time?: "morning" | "lunch" | "afternoon" | "dinner" | "night";
  weather?: "clear" | "rain" | "snow" | "unknown";
  companion?: string;
  intent?: string;
};

export type ScenarioExpectations = {
  expectedCategory?: string;
  allowedCategories?: string[];
  excludedCategories?: string[];
  indoorRequired?: boolean;
  maxDistanceKm?: number;
  requiredKeywords?: string[];
  excludedKeywords?: string[];
};

export type SimulationScenario = {
  scenarioId: string;
  query: string;
  tags: string[];
  persona?: ScenarioPersona;
  context?: ScenarioContext;
  expectations?: ScenarioExpectations;
};

export type CatalogCard = HomeCard & {
  search_keywords?: string[];
  updated_at?: string | null;
  vegetarian_available?: boolean | null;
  halal_available?: boolean | null;
};

export type CatalogSnapshot = {
  fetchedAt: string;
  source: "supabase";
  count: number;
  cards: CatalogCard[];
};

export type StageSnapshot = {
  retrievalCount: number;
  filteredCount: number;
  rankedCount: number;
  finalCount: number;
  retrievalIds: string[];
  filteredIds: string[];
  rankedIds: string[];
  relevantInCatalog: number;
  relevantInRetrieval: number;
  relevantInFiltered: number;
  relevantInFinal: number;
};

export type RankedItem = {
  id: string;
  name: string;
  category: string | null;
  distanceKm?: number | null;
  finalScore?: number;
  breakdown?: RecommendScoreBreakdown;
  exposureDebug?: ExposureItemDebug;
  discoveryDebug?: DiscoveryItemDebug;
  tags?: string[];
  withKids?: boolean | null;
  description?: string | null;
  searchKeywords?: string[];
};

export type ScenarioRunResult = {
  scenarioId: string;
  query: string;
  tags: string[];
  retrievalMode: RetrievalMode;
  parsed: {
    intentType: ScenarioObject["intentType"];
    intentCategory?: ScenarioObject["intentCategory"];
    scenario: ScenarioObject["scenario"];
    menuIntent?: string[];
    hardConstraints?: string[];
    weatherHint?: ScenarioObject["weatherHint"];
    withKids?: boolean;
    parkingPreferred?: boolean;
    route?: string;
    parsedQuery?: ScenarioObject["queryUnderstanding"];
    discoveryRole?: DiscoveryRole | null;
    isDiscovery?: boolean;
    isNegationQuery?: boolean;
    negationPatterns?: string[];
    excludedCategories?: string[];
    excludedMenus?: string[];
    excludedContexts?: string[];
    excludedAttributes?: string[];
    suppressedIntents?: string[];
    positiveRemainder?: string;
    hardExclusionsApplied?: string[];
    softSuppressionsApplied?: string[];
    fallbackReason?: string | null;
    staticMenuIntent?: string[];
    catalogMenuMatches?: unknown[];
    catalogMenuPrimary?: string | null;
    catalogMenuSecondary?: string[];
    resolvedMenuIntent?: string[];
    menuCollision?: string | null;
    conversationalDiscovery?: unknown;
    isDiscoveryBeforeConversational?: boolean;
    isDiscoveryAfterConversational?: boolean;
    resolvedDiscoveryRole?: DiscoveryRole | null;
    strongVertical?: boolean;
  };
  profileUsed: Pick<UserProfile, "companions" | "young_child" | "dietary_restrictions">;
  intention: IntentionType;
  deck: RankedItem[];
  stages: StageSnapshot;
  metrics: ScenarioMetrics;
  failures: FailureCode[];
  primaryFailure: FailureCode | null;
  retrievalCategoryDist?: Record<string, number>;
  filteredCategoryDist?: Record<string, number>;
};

export type ScenarioMetrics = {
  zeroResult: boolean;
  categoryMatch: number | null;
  intentMatch: number | null;
  distanceMatch: number | null;
  hardConstraintViolation: boolean;
  diversity: number | null;
  top1Quality: number | null;
  top3Quality: number | null;
  top5Quality: number | null;
  scenarioScore: number;
};

export type AggregateMetrics = {
  scenarioCount: number;
  overallScore: number;
  categoryMatch: number | null;
  intentMatch: number | null;
  distanceMatch: number | null;
  diversity: number | null;
  zeroResultRate: number;
  hardConstraintViolationRate: number;
  coverage: number;
  repetitionTopShare: number;
  top1Quality: number | null;
  top3Quality: number | null;
  top5Quality: number | null;
  failureCounts: Record<FailureCode, number>;
  uniqueTop1?: number;
  uniqueTop3?: number;
  top1Share?: number;
  top5Share?: number;
  top10Share?: number;
  top20Share?: number;
  giniExposed?: number;
  giniCatalog?: number;
};

export type FullCatalogDelta = {
  overallScore: number;
  categoryMatch: number | null;
  intentMatch: number | null;
  distanceMatch: number | null;
  diversity: number | null;
  zeroResultRate: number;
  hardConstraintViolationRate: number;
  rankingFailure: number;
  retrievalFailure: number;
  filterFailure: number;
  dataGap: number;
};

export type SimulationReport = {
  generatedAt: string;
  mode: string;
  catalogCount: number;
  catalogFetchedAt: string | null;
  current: AggregateMetrics;
  fullCatalog: AggregateMetrics;
  delta: FullCatalogDelta;
  worstScenarios: Array<{
    scenarioId: string;
    query: string;
    tags: string[];
    score: number;
    primaryFailure: FailureCode | null;
    failures: FailureCode[];
    topNames: string[];
  }>;
  mostRepeatedStores: Array<{ id: string; name: string; count: number }>;
  currentResults: ScenarioRunResult[];
  fullCatalogResults: ScenarioRunResult[];
};

export type BaselineFile = {
  name: string;
  savedAt: string;
  report: Omit<SimulationReport, "currentResults" | "fullCatalogResults"> & {
    currentResults?: ScenarioRunResult[];
    fullCatalogResults?: ScenarioRunResult[];
  };
};

export type CompareReport = {
  baselineName: string;
  comparedAt: string;
  overall: { baseline: number; current: number; delta: number };
  metrics: Record<string, { baseline: number | null; current: number | null; delta: number | null }>;
  improved: number;
  unchanged: number;
  regressed: number;
  regressedScenarios: Array<{
    scenarioId: string;
    query: string;
    baselineScore: number;
    currentScore: number;
    delta: number;
  }>;
  categoryRegressions: Array<{
    tag: string;
    baseline: number;
    current: number;
    delta: number;
  }>;
};

import type { ScenarioObject } from "@/lib/scenarioEngine/types";
import { parseScenarioIntent, detectMoodAndConstraints } from "@/lib/scenarioEngine/intentClassification";
import { detectMenuIntent, detectFoodSubCategory } from "@/lib/scenarioEngine/foodIntent";
import { detectFoodPreference, detectVibePreference } from "@/lib/scenarioEngine/compositeIntent";
import type { ConversationContext, ParseTurnResult, RefinementType } from "./types";
import { detectRefinementType } from "./refinement";

function norm(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

/** 단발 화에서 부분 필드만 추출(대화 누적용). */
export function extractPartialFromUtterance(
  text: string,
  refinement: RefinementType,
  _previous: ConversationContext | null
): Partial<ScenarioObject> {
  const raw = String(text ?? "").trim();
  const q = norm(raw);
  const out: Partial<ScenarioObject> = { rawQuery: raw };

  Object.assign(out, detectMoodAndConstraints(q));

  if (/애도|아이도|아이\s*랑|애\s*랑|키즈|유아\s*동반|초등/.test(q)) {
    out.withKids = true;
    out.scenario = "family_kids";
  }
  if (/부모님|부모와|어른들이랑/.test(q)) {
    out.withParents = true;
    out.scenario = "parents";
  }
  if (/데이트\s*(하기)?|연인|커플/.test(q)) out.scenario = "date";
  if (/혼자|혼밥|1인/.test(q)) out.scenario = "solo";

  if (
    /멀리\s*는\s*싫|멀리\s*싫|가까운|근처에서|근처\b|멀진\s*않|멀지\s*않|너무\s*멀진|너무\s*멀지/.test(q)
  ) {
    out.distanceTolerance = "near_only";
  }

  if (/맵지\s*않|안\s*맵|맵기\s*싫|안\s*매운|순한/.test(q)) {
    out.foodPreference = uniq([...(out.foodPreference ?? []), "not_spicy"]);
  }

  if (/주차|발렛|주차장/.test(q)) {
    out.parkingPreferred = true;
    out.softConstraints = uniq(["parking_friendly", ...(out.softConstraints ?? [])]);
  }

  if (/너무\s*복잡|복잡한\s*데\s*싫|복잡한\s*데는\s*싫|단순하게/.test(q)) {
    out.activityLevel = "calm";
  }

  if (/실내|인도어/.test(q)) {
    out.indoorPreferred = true;
    out.hardConstraints = uniq(["indoor", ...(out.hardConstraints ?? [])]);
  }

  if (/조용|한적|잔잔/.test(q)) {
    out.vibePreference = uniq(["calm", ...(out.vibePreference ?? []), ...detectVibePreference(raw)]);
  }

  if (refinement === "narrow" && /실내\s*만/.test(q)) {
    out.hardConstraints = uniq(["indoor", ...(out.hardConstraints ?? [])]);
  }

  const fp = detectFoodPreference(raw);
  if (fp.length) out.foodPreference = uniq([...(out.foodPreference ?? []), ...fp]);

  const menu = detectMenuIntent(raw);
  if (menu.length) out.menuIntent = uniq([...(out.menuIntent ?? []), ...menu]);

  const sub = detectFoodSubCategory(raw);
  if (sub) out.foodSubCategory = sub;

  return out;
}

function parseRejection(
  text: string,
  _previous: ConversationContext | null
): NonNullable<ParseTurnResult["rejection"]> {
  const q = norm(text);
  const rejection: NonNullable<ParseTurnResult["rejection"]> = {};

  if (/다른\s*데|다른데|딴\s*거|다시\s*골라|별로/.test(q)) {
    rejection.rejectShownPlaces = true;
  }

  if (/중식\s*말고|중국\s*말고|중식\s*아니/.test(q)) rejection.addRejectedCategory = "CHINESE";
  if (/일식\s*말고/.test(q)) rejection.addRejectedCategory = "JAPANESE";
  if (/한식\s*말고/.test(q)) rejection.addRejectedCategory = "KOREAN";
  if (/카페\s*말고/.test(q)) rejection.addRejectedCategory = "CAFE";

  const menuAnti = /(짜장면|짬뽕|초밥|돈까스|국밥|파스타)\s*말고/.exec(q);
  if (menuAnti) rejection.removeMenuIntent = menuAnti[1]!;

  return rejection;
}

/**
 * 단일 발화 → 부분 의도 + (옵션) 거절 패치.
 */
export function parseTurnIntent(
  text: string,
  previousContext: ConversationContext | null,
  refinementType?: RefinementType
): ParseTurnResult {
  const refinement = refinementType ?? detectRefinementType(text, previousContext);
  const raw = String(text ?? "").trim();
  const partial: Partial<ScenarioObject> = { rawQuery: raw };

  if (refinement === "reject") {
    return {
      refinementType: refinement,
      partialIntent: partial,
      rejection: parseRejection(text, previousContext),
    };
  }

  if (refinement === "broaden") {
    return {
      refinementType: refinement,
      partialIntent: {
        ...partial,
        foodSubCategory: undefined,
        intentStrict: false,
      },
      rejection: { broadenFood: true },
    };
  }

  if (refinement === "new_request") {
    return {
      refinementType: "new_request",
      partialIntent: parseScenarioIntent(text),
      suggestedLocks: [],
    };
  }

  const extracted = extractPartialFromUtterance(text, refinement, previousContext);
  let rejection: ParseTurnResult["rejection"];
  const qn = norm(raw);
  const menuAnti = /(짜장면|짬뽕|초밥|돈까스|국밥|파스타)\s*말고/.exec(qn);
  if (menuAnti) rejection = { ...rejection, removeMenuIntent: menuAnti[1]! };
  if (/중식\s*말고|중국\s*말고/.test(qn)) rejection = { ...rejection, addRejectedCategory: "CHINESE" };

  return {
    refinementType: refinement,
    partialIntent: { ...partial, ...extracted },
    rejection,
    suggestedLocks: extracted.withKids ? ["withKids"] : undefined,
  };
}

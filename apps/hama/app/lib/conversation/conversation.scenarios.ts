import { processConversationTurn } from "./processTurn";
import type { ConversationContext } from "./types";

function ok(name: string, cond: boolean, msg: string): string | null {
  return cond ? null : `${name}: ${msg}`;
}

/**
 * 대화 누적 시나리오 스팟 체크 (sessionStorage 없이 persist: false 체인).
 */
export function runConversationScenarioChecks(): string[] {
  const failures: string[] = [];

  const runChain = (label: string, lines: string[], checks: (ctx: ConversationContext) => (string | null)[]) => {
    let ctx: ConversationContext | null = null;
    for (const line of lines) {
      ctx = processConversationTurn(line, ctx, { persist: false });
    }
    if (!ctx) {
      failures.push(`${label}: no context`);
      return;
    }
    for (const err of checks(ctx)) {
      if (err) failures.push(`${label} → ${err}`);
    }
  };

  runChain(
    "lunch+kids+distance+notspicy",
    ["점심 뭐 먹지?", "애도 같이 있어", "멀리는 싫고", "맵지 않게"],
    (ctx) => [
      ok("intent", ctx.currentIntent.intentCategory === "FOOD", "FOOD"),
      ok("time", ctx.currentIntent.timeOfDay === "lunch", `time ${ctx.currentIntent.timeOfDay}`),
      ok("kids", ctx.currentIntent.withKids === true, "withKids"),
      ok("scenario", ctx.currentIntent.scenario === "family_kids", `scenario ${ctx.currentIntent.scenario}`),
      ok("near", ctx.currentIntent.distanceTolerance === "near_only", "near_only"),
      ok(
        "not_spicy",
        ctx.currentIntent.foodPreference?.includes("not_spicy") === true,
        `prefs ${JSON.stringify(ctx.currentIntent.foodPreference)}`
      ),
    ]
  );

  runChain(
    "course+indoor+calm+reject",
    ["데이트 코스 짜줘", "실내였으면 좋겠어", "너무 복잡한 데는 싫어", "다른 코스 보여줘"],
    (ctx) => [
      ok("course", ctx.currentIntent.intentType === "course_generation", `intent ${ctx.currentIntent.intentType}`),
      ok("indoor", ctx.currentIntent.indoorPreferred === true, "indoor"),
      ok("calm", ctx.currentIntent.activityLevel === "calm", `activity ${ctx.currentIntent.activityLevel}`),
      ok("reject", (ctx.rejectedPlaceIds?.length ?? 0) >= 0, "reject path ok"),
    ]
  );

  runChain(
    "chinese+jjareject+near+parents",
    ["중국음식 추천", "짜장면 말고", "가까운 데로", "부모님도 같이 가"],
    (ctx) => [
      ok("sub", ctx.currentIntent.foodSubCategory === "CHINESE", `sub ${ctx.currentIntent.foodSubCategory}`),
      ok("menu no jjm", !ctx.currentIntent.menuIntent?.includes("짜장면"), `menu ${ctx.currentIntent.menuIntent}`),
      ok("near", ctx.currentIntent.distanceTolerance === "near_only", "near"),
      ok("parents", ctx.currentIntent.withParents === true, "withParents"),
      ok("scenario", ctx.currentIntent.scenario === "parents", `scenario ${ctx.currentIntent.scenario}`),
    ]
  );

  runChain("cafe+calm+near", ["카페 추천", "조용한 데", "너무 멀진 않았으면 좋겠어"], (ctx) => [
    ok("cafe", ctx.currentIntent.intentCategory === "CAFE", `cat ${ctx.currentIntent.intentCategory}`),
    ok(
      "calm",
      ctx.currentIntent.vibePreference?.includes("calm") === true,
      `vibe ${JSON.stringify(ctx.currentIntent.vibePreference)}`
    ),
    ok("near", ctx.currentIntent.distanceTolerance === "near_only", "near"),
  ]);

  return failures;
}

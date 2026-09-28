/**
 * New evaluation only. Does not rewrite scenarios.ts, baseline-v1, or output/report.*.
 * Run from apps/hama:
 *   npx tsx scripts/conversation-simulator/evaluation-v2/run-v2.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { processConversationTurn } from "@/lib/conversation/processTurn";
import { classifyRequestCapability } from "@/lib/conversation/capability";
import type { ConversationContext } from "@/lib/conversation/types";
import { conversationScenarios } from "../scenarios";
import { evaluateConversations } from "../evaluate";
import type { GoldScenario, TurnResult } from "../types";
import { heldoutScenarios } from "./heldout";

const ROOT = join(process.cwd(), "scripts", "conversation-simulator");
const BASELINE_REPORT = join(ROOT, "output", "report.json");
const OUT_DIR = join(ROOT, "evaluation-v2", "output");

type Rate = { passed: number; total: number; percent: number | null };

function rate(passed: number, total: number): Rate {
  if (!total) return { passed, total, percent: null };
  return { passed, total, percent: Math.round((1000 * passed) / total) / 10 };
}

function unnamedOpening(scenario: GoldScenario): boolean {
  const opening = scenario.turns[0]?.utterance ?? "";
  return /갈\s*만한\s*곳|갈\s*곳/.test(opening);
}

function activityOnly(category: GoldScenario["turns"][number]["category"]): boolean {
  if (category === "ACTIVITY") return true;
  return Array.isArray(category) && category.length === 1 && category[0] === "ACTIVITY";
}

function interpret(scenario: GoldScenario, index: number, result: TurnResult) {
  const turn = scenario.turns[index]!;
  const failed = new Set(result.failedChecks);
  const waived: string[] = [];
  const drop = (name: string) => {
    if (failed.delete(name)) waived.push(name);
  };
  if (
    unnamedOpening(scenario) &&
    activityOnly(turn.category) &&
    result.actual.stateCategory == null &&
    result.actual.screenCategory == null
  ) {
    drop("category_state");
    drop("category_screen");
  }
  if (turn.utterance.includes("그 식당은 말고")) {
    for (const name of [
      "refinement_state",
      "refinement_classifier",
      "refinement_screen",
      "clarification",
      "exclude_ids",
      "exclude_ids_screen",
    ]) {
      drop(name);
    }
  }
  if (/키즈카페/.test(turn.utterance)) {
    drop("scenario_state");
    drop("scenario_screen");
  }
  return {
    scenarioId: result.scenarioId,
    turnIndex: result.turnIndex,
    utterance: result.utterance,
    legacyPassed: result.passed,
    passed: failed.size === 0,
    failedChecks: [...failed],
    waived,
  };
}

function scoreHeldout() {
  const turns: Array<Record<string, unknown>> = [];
  for (const scenario of heldoutScenarios) {
    let ctx: ConversationContext | null = null;
    let previousCategory: string | null = null;
    scenario.turns.forEach((turn, index) => {
      const decision = classifyRequestCapability(turn.utterance, ctx);
      const next = processConversationTurn(turn.utterance, ctx, {
        persist: false,
        turnId: `${scenario.id}-${index + 1}`,
      });
      const failed: string[] = [];
      if (decision.requestClass !== turn.requestClass) failed.push("class");
      if (turn.topic !== undefined && decision.topic !== turn.topic) failed.push("topic");
      if (Boolean(next.holdRecommendations) !== turn.hold) failed.push("hold");
      if (turn.region !== undefined && (next.currentIntent.region ?? null) !== turn.region) failed.push("region");
      if (turn.category !== undefined && (next.currentIntent.intentCategory ?? null) !== turn.category) {
        failed.push("category");
      }
      if (turn.keepCategory && (next.currentIntent.intentCategory ?? null) !== previousCategory) {
        failed.push("keep_category");
      }
      if (turn.withKids !== undefined && (next.currentIntent.withKids === true) !== turn.withKids) {
        failed.push("with_kids");
      }
      if (turn.clarification !== undefined && Boolean(next.clarificationNeeded) !== turn.clarification) {
        failed.push("clarification");
      }
      const excluded = new Set(next.rejectedPlaceIds ?? []);
      for (const id of turn.excludeIds ?? []) {
        if (!excluded.has(id)) failed.push(`exclude:${id}`);
      }
      for (const id of turn.excludeAbsent ?? []) {
        if (excluded.has(id)) failed.push(`excluded_unexpected:${id}`);
      }
      const prompt = next.clarificationPrompt ?? "";
      for (const piece of turn.promptIncludes ?? []) {
        if (!prompt.includes(piece)) failed.push(`prompt_missing:${piece}`);
      }
      for (const piece of turn.promptExcludes ?? []) {
        if (prompt.includes(piece)) failed.push(`prompt_forbidden:${piece}`);
      }
      turns.push({
        scenarioId: scenario.id,
        title: scenario.title,
        turnIndex: index + 1,
        utterance: turn.utterance,
        passed: failed.length === 0,
        failed,
        actualClass: decision.requestClass,
        actualTopic: decision.topic,
        hold: Boolean(next.holdRecommendations),
        category: next.currentIntent.intentCategory ?? null,
        scenario: next.currentIntent.scenario ?? null,
        withKids: next.currentIntent.withKids === true,
        prompt,
      });
      if (turn.shownIds?.length) {
        next.lastRecommendations = {
          placeIds: turn.shownIds,
          cards: turn.shownIds.map((id) => ({ id, name: id, category: "activity" })),
        };
      }
      previousCategory = next.currentIntent.intentCategory ?? null;
      ctx = next;
    });
  }
  const byScenario = new Map<string, boolean>();
  for (const scenario of heldoutScenarios) {
    const rows = turns.filter((turn) => turn.scenarioId === scenario.id);
    byScenario.set(scenario.id, rows.every((turn) => turn.passed === true));
  }
  return {
    turns,
    metrics: {
      turns: rate(turns.filter((turn) => turn.passed === true).length, turns.length),
      scenarios: rate([...byScenario.values()].filter(Boolean).length, heldoutScenarios.length),
    },
  };
}

function legacyMetrics(results: TurnResult[]) {
  let cursor = 0;
  const paired = conversationScenarios.flatMap((scenario) =>
    scenario.turns.map((turn) => {
      const result = results[cursor]!;
      cursor += 1;
      return { scenario, turn, result };
    })
  );
  const supported = paired.filter((item) => item.turn.support === "supported");
  const firm = supported.filter((item) => item.turn.goldConfidence === "firm");
  const unsupported = paired.filter((item) => item.turn.support === "unsupported");
  const byScenario = new Map<string, typeof paired>();
  for (const item of paired) {
    const list = byScenario.get(item.scenario.id) ?? [];
    list.push(item);
    byScenario.set(item.scenario.id, list);
  }
  const scenarioPass = (items: typeof paired) => items.every((item) => item.result.passed);
  return {
    overall: rate(paired.filter((item) => item.result.passed).length, paired.length),
    firmTurns: rate(firm.filter((item) => item.result.passed).length, firm.length),
    conversations: rate([...byScenario.values()].filter(scenarioPass).length, byScenario.size),
    unsupported: rate(unsupported.filter((item) => item.result.passed).length, unsupported.length),
  };
}

function main(): void {
  const baseline = JSON.parse(readFileSync(BASELINE_REPORT, "utf8")) as {
    metrics: Record<string, Rate>;
  };
  const results = evaluateConversations(conversationScenarios);
  const legacy = legacyMetrics(results);
  let cursor = 0;
  const interpreted = conversationScenarios.flatMap((scenario) =>
    scenario.turns.map((_, index) => interpret(scenario, index, results[cursor++]!))
  );
  const interpretedByScenario = new Map<string, boolean>();
  for (const scenario of conversationScenarios) {
    const rows = interpreted.filter((turn) => turn.scenarioId === scenario.id);
    interpretedByScenario.set(scenario.id, rows.every((turn) => turn.passed));
  }
  const kids = interpreted.filter((turn) => /키즈카페/.test(turn.utterance));
  const held = scoreHeldout();
  const report = {
    note: "기존 159턴 정답 점수와 검토 해석 점수와 새 시나리오 점수는 합치지 않는다.",
    legacyGold: {
      before: {
        overall: baseline.metrics.overall,
        firmTurns: baseline.metrics.firmTurns,
        conversations: baseline.metrics.conversations,
        context: baseline.metrics.context,
        condition: baseline.metrics.condition,
        rejection: baseline.metrics.rejection,
        unsupported: baseline.metrics.unsupported,
        clarificationWhenNeeded: baseline.metrics.clarificationWhenNeeded,
      },
      after: legacy,
      regressedTurns: results
        .filter((turn) => {
          const previous = (baseline as { turns?: TurnResult[] }).turns?.find(
            (item) => item.scenarioId === turn.scenarioId && item.turnIndex === turn.turnIndex
          );
          return previous?.passed === true && turn.passed === false;
        })
        .map((turn) => `${turn.scenarioId}#${turn.turnIndex} ${turn.utterance}`),
    },
    interpretedReview: {
      turns: rate(interpreted.filter((turn) => turn.passed).length, interpreted.length),
      scenarios: rate([...interpretedByScenario.values()].filter(Boolean).length, interpretedByScenario.size),
      kidsCafeScenarioLabelWaived: kids.length,
    kidsCafeLabels: results
      .filter((turn) => /키즈카페/.test(turn.utterance))
      .map((turn) => ({
        id: `${turn.scenarioId}#${turn.turnIndex}`,
        scenario: turn.actual.stateScenario,
        withKids: turn.actual.withKids,
      })),
      stillFailing: interpreted.filter((turn) => !turn.passed).map((turn) => ({
        id: `${turn.scenarioId}#${turn.turnIndex}`,
        utterance: turn.utterance,
        failed: turn.failedChecks,
      })),
    },
    heldout: held.metrics,
    heldoutFailures: held.turns.filter((turn) => turn.passed === false),
  };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({
    legacyAfter: legacy,
    legacyRegressions: report.legacyGold.regressedTurns.length,
    interpreted: report.interpretedReview.turns,
    interpretedScenarios: report.interpretedReview.scenarios,
    heldout: held.metrics,
    heldoutFailures: report.heldoutFailures.length,
  }, null, 2));
  for (const turn of report.heldoutFailures) {
    console.log("HELD", turn.scenarioId, turn.turnIndex, turn.utterance, JSON.stringify(turn.failed));
  }
}

main();

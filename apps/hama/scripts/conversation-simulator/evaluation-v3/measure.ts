/**
 * Scores the frozen 159, the frozen 55, and the sealed 25.
 * Writes only evaluation-v3/output. Does not touch older reports.
 *
 *   npx tsx scripts/conversation-simulator/evaluation-v3/measure.ts before
 *   npx tsx scripts/conversation-simulator/evaluation-v3/measure.ts after
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { processConversationTurn } from "@/lib/conversation/processTurn";
import { classifyRequestCapability } from "@/lib/conversation/capability";
import type { ConversationContext } from "@/lib/conversation/types";
import { conversationScenarios } from "../scenarios";
import { evaluateConversations } from "../evaluate";
import type { TurnResult } from "../types";
import { heldoutScenarios, type HeldExpect } from "../evaluation-v2/heldout";
import { sealedScenarios, type SealedExpect } from "./sealed";

const V3 = join(process.cwd(), "scripts", "conversation-simulator", "evaluation-v3");
const OUT = join(V3, "output");
const SEALED_FILE = join(V3, "sealed.ts");
const SEALED_HASH = join(V3, "sealed.sha256");

type Rate = { passed: number; total: number; percent: number | null };
type TurnRow = {
  id: string;
  utterance: string;
  passed: boolean;
  failed: string[];
};

function rate(passed: number, total: number): Rate {
  if (!total) return { passed, total, percent: null };
  return { passed, total, percent: Math.round((1000 * passed) / total) / 10 };
}

function assertSealedFrozen(): string {
  const digest = createHash("sha256").update(readFileSync(SEALED_FILE)).digest("hex");
  const locked = readFileSync(SEALED_HASH, "utf8").trim();
  if (digest !== locked) {
    throw new Error("sealed.ts gold changed after it was frozen");
  }
  return digest;
}

function legacyRows(): TurnRow[] {
  const results = evaluateConversations(conversationScenarios);
  return results.map((turn) => ({
    id: `${turn.scenarioId}#${turn.turnIndex}`,
    utterance: turn.utterance,
    passed: turn.passed,
    failed: turn.failedChecks,
  }));
}

function legacyScenarioRate(results: TurnResult[]): Rate {
  let cursor = 0;
  const byScenario = new Map<string, boolean>();
  for (const scenario of conversationScenarios) {
    let ok = true;
    for (const _turn of scenario.turns) {
      if (!results[cursor]?.passed) ok = false;
      cursor += 1;
    }
    byScenario.set(scenario.id, ok);
  }
  return rate([...byScenario.values()].filter(Boolean).length, byScenario.size);
}

function scoreDialogue(
  scenarios: Array<{ id: string; turns: Array<HeldExpect | SealedExpect> }>
): { turns: TurnRow[]; scenarioRate: Rate } {
  const turns: TurnRow[] = [];
  const scenarioOk: boolean[] = [];
  for (const scenario of scenarios) {
    let ctx: ConversationContext | null = null;
    let previousCategory: string | null = null;
    let scenarioPassed = true;
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
      const sealed = turn as SealedExpect;
      if (sealed.calm !== undefined) {
        const calm =
          next.currentIntent.activityLevel === "calm" ||
          (next.currentIntent.vibePreference ?? []).includes("calm");
        if (calm !== sealed.calm) failed.push("calm");
      }
      if (sealed.distance !== undefined && (next.currentIntent.distanceTolerance ?? null) !== sealed.distance) {
        failed.push("distance");
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
      const row: TurnRow = {
        id: `${scenario.id}#${index + 1}`,
        utterance: turn.utterance,
        passed: failed.length === 0,
        failed,
      };
      if (!row.passed) scenarioPassed = false;
      turns.push(row);
      if (sealed.shown?.length) {
        next.lastRecommendations = {
          placeIds: sealed.shown.map((card) => card.id),
          cards: sealed.shown.map((card) => ({ id: card.id, name: card.name, category: "food" })),
        };
      } else if ("shownIds" in turn && turn.shownIds?.length) {
        next.lastRecommendations = {
          placeIds: turn.shownIds,
          cards: turn.shownIds.map((id) => ({ id, name: id, category: "food" })),
        };
      }
      previousCategory = next.currentIntent.intentCategory ?? null;
      ctx = next;
    });
    scenarioOk.push(scenarioPassed);
  }
  return { turns, scenarioRate: rate(scenarioOk.filter(Boolean).length, scenarioOk.length) };
}

function pack(turns: TurnRow[], scenarioRate: Rate) {
  return {
    turns: rate(turns.filter((turn) => turn.passed).length, turns.length),
    scenarios: scenarioRate,
    failures: turns.filter((turn) => !turn.passed),
    rows: turns,
  };
}

function regressions(beforeRows: TurnRow[] | undefined, afterRows: TurnRow[]): TurnRow[] {
  if (!beforeRows) return [];
  const previous = new Map(beforeRows.map((row) => [row.id, row]));
  return afterRows.filter((row) => previous.get(row.id)?.passed === true && !row.passed);
}

function main(): void {
  const phase = process.argv[2];
  if (phase !== "before" && phase !== "after") {
    throw new Error("usage: measure.ts before|after");
  }
  const digest = assertSealedFrozen();
  const legacyResults = evaluateConversations(conversationScenarios);
  const legacy = legacyRows();
  const held = scoreDialogue(heldoutScenarios);
  const sealed = scoreDialogue(sealedScenarios);
  const before =
    phase === "after"
      ? (JSON.parse(readFileSync(join(OUT, "before.json"), "utf8")) as {
          legacy: { rows: TurnRow[] };
          heldout: { rows: TurnRow[] };
          sealed: { rows: TurnRow[] };
        })
      : null;
  const report = {
    phase,
    sealedSha256: digest,
    note: "159턴, 55턴, 25개 시나리오 점수는 서로 합치지 않는다. 25개 정답은 수정 근거가 아니다.",
    legacy: {
      ...pack(legacy, legacyScenarioRate(legacyResults)),
      regressions: regressions(before?.legacy.rows, legacy),
    },
    heldout: {
      ...pack(held.turns, held.scenarioRate),
      regressions: regressions(before?.heldout.rows, held.turns),
    },
    sealed: {
      ...pack(sealed.turns, sealed.scenarioRate),
      regressions: regressions(before?.sealed.rows, sealed.turns),
    },
  };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${phase}.json`), JSON.stringify(report, null, 2), "utf8");
  const summary = {
    phase,
    legacy: report.legacy.turns,
    legacyScenarios: report.legacy.scenarios,
    legacyRegressions: report.legacy.regressions.length,
    heldout: report.heldout.turns,
    heldoutScenarios: report.heldout.scenarios,
    heldoutRegressions: report.heldout.regressions.length,
    sealed: report.sealed.turns,
    sealedScenarios: report.sealed.scenarios,
    sealedRegressions: report.sealed.regressions.length,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (phase === "after") {
    for (const row of report.legacy.regressions) console.log("REGRESS legacy", row.id, row.utterance, row.failed.join(","));
    for (const row of report.heldout.regressions) console.log("REGRESS held", row.id, row.utterance, row.failed.join(","));
  }
}

main();

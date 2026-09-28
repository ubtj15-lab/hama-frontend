/**
 * Re-run from apps/hama:
 *   npx tsx scripts/conversation-simulator/run.ts
 *
 * Calls the existing conversation functions. Does not rank stores or call a network.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { conversationScenarios } from "./scenarios";
import { evaluateConversations, goldWarnings } from "./evaluate";
import type { GoldScenario, GoldTurn, TurnResult } from "./types";

const RETAIN_CHECKS: Record<string, string[]> = {
  region: ["region_state", "region_screen"],
  category: ["category_state", "category_screen"],
  withKids: ["with_kids"],
  scenario: ["scenario_state", "scenario_screen"],
  indoor: ["indoor"],
  distance: ["distance"],
  calm: ["calm"],
  parking: ["parking"],
};

const REJECTION_CHECKS = [
  "exclude_ids",
  "exclude_ids_screen",
  "rejected_categories",
  "exclude_menus",
  "refinement_state",
  "refinement_classifier",
  "refinement_screen",
];

type Paired = { scenario: GoldScenario; turn: GoldTurn; result: TurnResult };

function pairAll(): Paired[] {
  const results = evaluateConversations(conversationScenarios);
  const paired: Paired[] = [];
  let cursor = 0;
  for (const scenario of conversationScenarios) {
    for (const turn of scenario.turns) {
      paired.push({ scenario, turn, result: results[cursor] });
      cursor += 1;
    }
  }
  return paired;
}

function rate(passed: number, total: number): { passed: number; total: number; percent: number | null } {
  if (!total) return { passed, total, percent: null };
  return { passed, total, percent: Math.round((1000 * passed) / total) / 10 };
}

function textRate(metric: { passed: number; total: number; percent: number | null }): string {
  if (metric.percent == null) return "해당 없음";
  return `${metric.passed}/${metric.total} (${metric.percent}%)`;
}

function misses(result: TurnResult, names: string[]): boolean {
  return names.some((name) => result.failedChecks.includes(name));
}

function compactActual(result: TurnResult): string {
  const actual = result.actual;
  return [
    `pipeline=${actual.pipelineRefinement}`,
    `classifier=${actual.classifierRefinement}`,
    `screenRefinement=${actual.screenRefinement}`,
    `category=${actual.stateCategory ?? "없음"}/${actual.screenCategory ?? "없음"}`,
    `region=${actual.stateRegion ?? "없음"}/${actual.screenRegion ?? "없음"}`,
    `scenario=${actual.stateScenario ?? "없음"}/${actual.screenScenario ?? "없음"}`,
    `kids=${actual.withKids}/${actual.screenWithKids}`,
    `indoor=${actual.indoor}/${actual.screenIndoor}`,
    `distance=${actual.distance ?? "없음"}/${actual.screenDistance ?? "없음"}`,
    `calm=${actual.calm}`,
    `parking=${actual.parking}`,
    `notSpicy=${actual.notSpicy}`,
    `weather=${actual.weather ?? "없음"}`,
    `foodSub=${actual.foodSub ?? "없음"}/${actual.screenFoodSub ?? "없음"}`,
    `linkedFood=${actual.linkedFood}`,
    `frozen=${actual.frozenPlayIds.join(",") || "없음"}`,
    `clarification=${actual.clarification}`,
    `exclude=${actual.excludePlaceIds.join(",") || "없음"}`,
    `screenExclude=${actual.screenExcludePlaceIds.join(",") || "없음"}`,
    `rejectedCategories=${actual.rejectedCategories.join(",") || "없음"}`,
    `menus=${actual.excludedMenus.join(",") || "없음"}`,
    `mode=${actual.recommendationMode ?? "없음"}`,
    `search=${actual.searchQuery ?? "없음"}`,
  ].join("\n");
}

function countBy(items: Paired[], pick: (item: Paired) => string | null): Array<{ cause: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const cause = pick(item);
    if (!cause) continue;
    counts.set(cause, (counts.get(cause) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([cause, count]) => ({ cause, count }))
    .sort((left, right) => right.count - left.count || left.cause.localeCompare(right.cause));
}

function main(): void {
  const warnings = goldWarnings(conversationScenarios);
  const paired = pairAll();
  const supported = paired.filter((item) => item.turn.support === "supported");
  const unsupported = paired.filter((item) => item.turn.support === "unsupported");
  const firm = supported.filter((item) => item.turn.goldConfidence === "firm");
  const review = supported.filter((item) => item.turn.goldConfidence === "review");

  const intentOk = (item: Paired) =>
    !misses(item.result, ["refinement_state", "refinement_classifier", "refinement_screen"]);
  const contextItems = supported.filter((item) => item.turn.retain.length > 0);
  const contextOk = (item: Paired) =>
    !item.turn.retain.some((field) => misses(item.result, RETAIN_CHECKS[field] ?? []));
  const conditionItems = supported.filter((item) => item.turn.add.length > 0 || item.turn.remove.length > 0);
  const conditionOk = (item: Paired) =>
    !item.result.failedChecks.some((check) => check.startsWith("add_") || check.startsWith("remove_"));
  const rejectionItems = supported.filter((item) => item.turn.rejectionCase);
  const rejectionOk = (item: Paired) => !misses(item.result, REJECTION_CHECKS);
  const clarificationItems = paired.filter((item) => item.turn.clarification !== "any");
  const clarificationExpected = clarificationItems.filter((item) => item.turn.clarification === true);
  const clarificationNotExpected = clarificationItems.filter((item) => item.turn.clarification === false);
  const clarificationOk = (item: Paired) => !misses(item.result, ["clarification"]);
  const searchOk = (item: Paired) => !misses(item.result, ["search_query"]);

  const byScenario = new Map<string, Paired[]>();
  for (const item of paired) {
    const list = byScenario.get(item.scenario.id) ?? [];
    list.push(item);
    byScenario.set(item.scenario.id, list);
  }
  const scenarioList = [...byScenario.values()];
  const firmScenarios = scenarioList.filter((items) => items.every((item) => item.turn.goldConfidence === "firm"));
  const scenarioPass = (items: Paired[]) => items.every((item) => item.result.passed);

  const failed = paired.filter((item) => !item.result.passed);
  const causeCounts = countBy(failed, (item) => item.result.primaryCause);
  const ruleCauses = countBy(
    failed.filter((item) => item.turn.support === "supported" && item.turn.fixRoute === "rules"),
    (item) => item.result.primaryCause
  );
  const modelCauses = countBy(
    failed.filter((item) => item.turn.support === "unsupported" || item.turn.fixRoute === "model"),
    (item) => item.result.primaryCause
  );

  const examples: Paired[] = [];
  const seenCauses = new Set<string>();
  for (const item of failed) {
    const cause = item.result.primaryCause ?? "unknown";
    if (seenCauses.has(cause)) continue;
    seenCauses.add(cause);
    examples.push(item);
    if (examples.length >= 12) break;
  }

  const metrics = {
    turns: paired.length,
    scenarios: conversationScenarios.length,
    overall: rate(paired.filter((item) => item.result.passed).length, paired.length),
    conversations: rate(scenarioList.filter(scenarioPass).length, scenarioList.length),
    firmTurns: rate(firm.filter((item) => item.result.passed).length, firm.length),
    reviewTurns: rate(review.filter((item) => item.result.passed).length, review.length),
    firmConversations: rate(firmScenarios.filter(scenarioPass).length, firmScenarios.length),
    intentSupported: rate(supported.filter(intentOk).length, supported.length),
    intentFirm: rate(firm.filter(intentOk).length, firm.length),
    context: rate(contextItems.filter(contextOk).length, contextItems.length),
    contextFirm: rate(
      contextItems.filter((item) => item.turn.goldConfidence === "firm" && contextOk(item)).length,
      contextItems.filter((item) => item.turn.goldConfidence === "firm").length
    ),
    condition: rate(conditionItems.filter(conditionOk).length, conditionItems.length),
    conditionFirm: rate(
      conditionItems.filter((item) => item.turn.goldConfidence === "firm" && conditionOk(item)).length,
      conditionItems.filter((item) => item.turn.goldConfidence === "firm").length
    ),
    rejection: rate(rejectionItems.filter(rejectionOk).length, rejectionItems.length),
    clarification: rate(clarificationItems.filter(clarificationOk).length, clarificationItems.length),
    clarificationWhenNeeded: rate(clarificationExpected.filter(clarificationOk).length, clarificationExpected.length),
    clarificationWhenNotNeeded: rate(
      clarificationNotExpected.filter(clarificationOk).length,
      clarificationNotExpected.length
    ),
    search: rate(supported.filter(searchOk).length, supported.length),
    unsupported: rate(unsupported.filter((item) => item.result.passed).length, unsupported.length),
    unsupportedClarification: rate(
      unsupported.filter((item) => item.turn.clarification === true && clarificationOk(item)).length,
      unsupported.filter((item) => item.turn.clarification === true).length
    ),
  };

  const report = {
    generatedBy: "apps/hama/scripts/conversation-simulator/run.ts",
    method: {
      functions: [
        "processConversationTurn",
        "detectRefinementType",
        "parseTurnIntent",
        "mergeResultsScenario",
        "mergeResultsScenarioWithExplicitNav",
        "resolveSearchQueryForHomeCards",
      ],
      persist: false,
      ranking: "not_called",
      network: "not_called",
      recommendationAccuracy: "not_measured",
      goldEditedAfterRun: false,
    },
    goldWarnings: warnings,
    provisional:
      warnings.length > 0 ||
      review.length > 0 ||
      "확정 정답만으로 계산한 수치와 검토 대상이 섞인 전체 수치는 구분해서 읽어야 합니다.",
    metrics,
    failureCauses: causeCounts,
    ruleFixCandidates: ruleCauses,
    modelReviewCandidates: modelCauses,
    examples: examples.map((item) => ({
      scenarioId: item.scenario.id,
      title: item.scenario.title,
      turn: item.result.turnIndex,
      utterance: item.turn.utterance,
      support: item.turn.support,
      goldConfidence: item.turn.goldConfidence,
      fixRoute: item.turn.fixRoute,
      primaryCause: item.result.primaryCause,
      failedChecks: item.result.failedChecks,
      note: item.turn.note ?? null,
      expected: item.result.expected,
      actual: item.result.actual,
    })),
    turns: paired.map((item) => item.result),
  };

  const outputDir = join(process.cwd(), "scripts", "conversation-simulator", "output");
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
  writeFileSync(join(outputDir, "report.md"), renderMarkdown(metrics, warnings, failed, examples, ruleCauses, modelCauses, causeCounts), "utf8");

  console.log(`scenarios=${metrics.scenarios} turns=${metrics.turns}`);
  console.log(`overall=${textRate(metrics.overall)} conversations=${textRate(metrics.conversations)}`);
  console.log(`firmTurns=${textRate(metrics.firmTurns)} firmConversations=${textRate(metrics.firmConversations)}`);
  console.log(`intent=${textRate(metrics.intentSupported)} context=${textRate(metrics.context)} condition=${textRate(metrics.condition)}`);
  console.log(`rejection=${textRate(metrics.rejection)} clarification=${textRate(metrics.clarification)} unsupported=${textRate(metrics.unsupported)}`);
  console.log(`goldWarnings=${warnings.length} failedTurns=${failed.length}`);
}

function renderMarkdown(
  metrics: Record<string, { passed: number; total: number; percent: number | null } | number>,
  warnings: ReturnType<typeof goldWarnings>,
  failed: Paired[],
  examples: Paired[],
  ruleCauses: Array<{ cause: string; count: number }>,
  modelCauses: Array<{ cause: string; count: number }>,
  causeCounts: Array<{ cause: string; count: number }>
): string {
  const m = metrics as Record<string, { passed: number; total: number; percent: number | null }>;
  const lines: string[] = [
    "# HAMA V1 대화 이해 시뮬레이터 1차",
    "",
    "기존 대화 처리 함수를 호출해 측정했습니다. 추천 랭킹, 운영 DB, 외부 API, AI API는 호출하지 않았습니다.",
    "정답은 측정 전에 사람이 작성했고, 점수를 맞추기 위해 바꾸지 않았습니다.",
    "",
    "검토가 필요하다고 표시한 턴과 정답 경고가 있으므로, 그 턴이 섞인 전체 수치는 잠정적입니다. 확정 정답만 모은 수치를 함께 적습니다.",
    "",
    "## 규모",
    "",
    `- 시나리오 ${m.scenarios}개`,
    `- 총 턴 ${m.turns}개`,
    "",
    "## 측정",
    "",
    "| 항목 | 결과 |",
    "| --- | --- |",
    `| 턴별 전체 정답률 | ${textRate(m.overall)} |`,
    `| 모든 턴을 맞힌 대화 | ${textRate(m.conversations)} |`,
    `| 확정 정답 턴 정답률 | ${textRate(m.firmTurns)} |`,
    `| 검토 대상 턴 정답률 | ${textRate(m.reviewTurns)} |`,
    `| 확정 정답만 있는 대화의 완전 일치 | ${textRate(m.firmConversations)} |`,
    `| 의도 분류 (지원 턴) | ${textRate(m.intentSupported)} |`,
    `| 의도 분류 (확정 정답) | ${textRate(m.intentFirm)} |`,
    `| 문맥 유지 | ${textRate(m.context)} |`,
    `| 문맥 유지 (확정 정답) | ${textRate(m.contextFirm)} |`,
    `| 조건 변경 | ${textRate(m.condition)} |`,
    `| 조건 변경 (확정 정답) | ${textRate(m.conditionFirm)} |`,
    `| 거절 처리 | ${textRate(m.rejection)} |`,
    `| 확인 질문 전체 | ${textRate(m.clarification)} |`,
    `| 확인이 필요할 때 | ${textRate(m.clarificationWhenNeeded)} |`,
    `| 확인이 필요 없을 때 | ${textRate(m.clarificationWhenNotNeeded)} |`,
    `| 검색어 결정 (지원 턴) | ${textRate(m.search)} |`,
    `| 미지원 요청 처리 | ${textRate(m.unsupported)} |`,
    `| 미지원 요청에서 확인 질문 | ${textRate(m.unsupportedClarification)} |`,
    "| 매장 추천 정확도 | 측정하지 않음 |",
    "",
    "매장 추천 정확도는 대화 이해와 따로 둡니다. 이번 실행은 모의 장소 ID만 다음 턴에 넘겼고, 랭킹 엔진은 호출하지 않았습니다.",
    "",
    "## 실패 원인",
    "",
    ...causeCounts.map((item) => `- ${item.cause}: ${item.count}`),
    "",
    `실패한 턴 ${failed.length}개의 전체 비교는 report.json에 있습니다.`,
    "",
    "## 대표 실패",
    "",
  ];

  if (!examples.length) lines.push("실패한 턴이 없습니다.");
  for (const item of examples) {
    lines.push(`### ${item.scenario.id} 턴 ${item.result.turnIndex}. ${item.turn.utterance}`);
    lines.push("");
    lines.push(`- 원인: ${item.result.primaryCause}`);
    lines.push(`- 지원: ${item.turn.support}, 정답 확신: ${item.turn.goldConfidence}, 수정 경로: ${item.turn.fixRoute}`);
    lines.push(`- 실패 항목: ${item.result.failedChecks.join(", ")}`);
    if (item.turn.note) lines.push(`- 정답 메모: ${item.turn.note}`);
    lines.push("- 예상:");
    lines.push("");
    lines.push("```");
    lines.push(JSON.stringify(item.result.expected, null, 2));
    lines.push("```");
    lines.push("- 실제:");
    lines.push("");
    lines.push("```");
    lines.push(compactActual(item.result));
    lines.push("```");
    lines.push("");
  }

  lines.push("## 현재 규칙으로 우선 볼 문제");
  lines.push("");
  if (!ruleCauses.length) lines.push("지원 범위 안에서 규칙으로 처리할 실패가 없습니다.");
  ruleCauses.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.cause} ${item.count}건`);
  });
  lines.push("");
  lines.push("지역 유지, 거절 문구, 식사 추가, 확인 질문처럼 이미 규칙의 대상인 실패를 먼저 수정하는 편이 맞습니다.");
  lines.push("");
  lines.push("## AI 모델 도입을 검토할 문제");
  lines.push("");
  if (!modelCauses.length) lines.push("모델 검토로 표시된 실패가 없습니다.");
  modelCauses.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.cause} ${item.count}건`);
  });
  lines.push("");
  lines.push("예약, 실시간 영업·대기, 가격, 알레르기, 반려동물, 콘센트, 특정 매장 이름 지목은 현재 조건 필드에 없습니다.");
  lines.push("");
  lines.push("## 정답 경고");
  lines.push("");
  if (!warnings.length) lines.push("발화와 정답 지역이 어긋난 항목은 없습니다.");
  for (const warning of warnings) {
    lines.push(`- ${warning.scenarioId} 턴 ${warning.turnIndex}: ${warning.message} (${warning.utterance})`);
  }
  lines.push("");
  lines.push("## 정답 기준 검토");
  lines.push("");
  lines.push("아래는 점수를 바꾸지 않은 채, 실패 일부를 정답 기준으로 다시 본 메모입니다. 해당 턴은 실패로 남아 있습니다.");
  lines.push("");
  lines.push("- S02, S06, S30의 '갈 곳'처럼 업종을 말하지 않은 첫 문장은 ACTIVITY만 정답으로 두었습니다. 카테고리를 비우는 해석도 가능하므로 이 실패는 잠정적입니다.");
  lines.push("- S08 '키즈카페'는 아이 동반이 기록되면 scenario가 generic이어도 가족 나들이로 볼 수 있습니다. family_kids만 정답으로 둔 항목은 잠정적입니다.");
  lines.push("- S09 턴 3·4, S29 턴 3·4, S33 턴 4·5의 제외 목록 실패는 앞 턴이 거절을 기록하지 못한 뒤 따라온 결과입니다. 독립된 새 결함으로 세지 않습니다.");
  lines.push("- 미지원 요청의 정답은 '확인 질문을 한다'입니다. 지역과 업종을 유지한 채 일반 수정으로 처리한 결과는 확인 질문 실패로 집계했습니다.");
  lines.push("");
  lines.push("## 다시 실행");
  lines.push("");
  lines.push("```");
  lines.push("npx tsx scripts/conversation-simulator/run.ts");
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}

main();

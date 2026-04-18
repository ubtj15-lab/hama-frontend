# HAMA 코스 자동 생성 엔진

## 1. 전체 흐름

1. 유저 입력 파싱 → `ScenarioObject` (`parseScenarioIntent` 등 기존 파이프라인)
2. 시나리오 추론 → `resolveScenarioConfig`
3. 코스 템플릿 후보 수집 → `mergeTemplateDefinitions` (카탈로그 + `scenarioConfigs.preferredCourseTemplates`)
4. 템플릿별 점수화 → `scoreTemplateSelection`
5. 템플릿 단계별 후보 추출 → `gatherCandidatesForStep` + 빔 서치 `beamFillTemplate`
6. 단계별 점수 → `computeStepScore`
7. 코스 전체 점수 → `computeCourseScore` + `finalScore = stepAvg*0.42 + courseScore*0.58`
8. 시간/동선 → `buildTimelineInner` (`dwellMinutesForPlace`, `estimateTravelMinutes` / Haversine km)
9. 최종 코스 3개 → `pickThreeDiverse` (템플릿 id·Jaccard 유사도로 다양성)

## 2. 템플릿 구조 (`courseTemplateCatalog.ts`)

각 항목: `id`, `scenarios[]`, `steps: PlaceType[]`, `movementLevel`, `indoorPreference`, `durationMin/MaxMinutes`, `vibeTags`.

## 3. 템플릿 선택 (`scoreTemplateSelection`)

반영: 비·실내 선호, 야간+아이, `distanceTolerance`, `mealRequired`, `activityLevel`, `mood`/`rawQuery` 키워드(걷기 싫음 → 저이동 가산), `config.indoorBias` / `activityBias`.

## 4. 단계별 후보 추출

- 타입 버킷: `collectCandidatesByType` (제외·영업 필터)
- 단계별 풀: 기대 `PlaceType` + `fallbackOrderForStep` 순
- 빔 폭 `BEAM_WIDTH`, 분기 `TOP_BRANCH`
- 제약: 동일 코스 내 동일 브랜드·동일 `mainCategory` 중복 완화, `servingOkForStep`

## 5. servingType (`courseServingType.ts`)

- `meal` | `light` | `drink` — `inferServingTypeForPlace`, `inferFoodServingType`
- 식사 단계(FOOD)에서 drink-only 제외, 혼밥·`mealRequired` 시 drink-only 감점/제외

## 6. stepScore (`courseScoring.computeStepScore`)

가중: category 0.25, scenario(tagWeights) 0.25, distance 0.2, serving/time 0.15, quality 0.08, 영업 0.02, mood 0.05.

## 7. courseScore (`computeCourseScore`)

- 전환 자연스러움: `transitionNaturalness` 평균
- 동선 효율: `routeEfficiencyScore` (경로 km / 첫~끝 직선)
- 총 이동 시간 페널티, `defaultDurationHours` 대비 체류 적합, 동일 카테고리 중복 페널티

## 8. 시간 (`courseConstants.ts`)

- `DWELL_RANGE_MINUTES` 업종별 범위
- `dwellMinutesForPlace` — 시드 기반 안정 값
- `estimateTravelMinutes` — Haversine km → 분

## 9. 동선 규칙

- 이전 스텝 대비 거리 점수: `distanceScoreFromKm`, `near_only` 시 원거리 강한 감점
- 왕복·비효율: `routeEfficiencyScore`

## 10. 최종 3안 (`pickThreeDiverse`)

점수 내림차순, 동일 `templateId` 스킵, 템플릿 Jaccard 유사도 높으면 스킵, 부족 시 완화하여 채움.

## 11. 설명 문구 (`buildNarrativeDescription`)

활동·실내·근거리·문화 톤 등 템플릿·총시간·이동분 반영.

## 12. 관련 파일

| 파일 | 역할 |
|------|------|
| `courseTemplateCatalog.ts` | 템플릿 정의·선택 점수·설명 |
| `courseServingType.ts` | meal/light/drink |
| `courseScoring.ts` | step/course 점수·제외·전환 |
| `courseConstants.ts` | 체류·Haversine·이동 |
| `courseEngine.ts` | 빔 서치·`generateCourses` |
| `types.ts` | `CourseServingType`, `CoursePlan.templateId`, `narrativeDescription` |
| `_components/results/CourseDeckCard.tsx` | `narrativeDescription` 표시 |

## 13. 테스트 예시 (개념)

**데이트**  
입력: `scenario: date`, `timeOfDay: dinner`, `indoorPreferred: true`  
기대: `FOOD→ACTIVITY→CAFE` 또는 `CAFE→CULTURE→FOOD` 등 실내·대화 톤 템플릿 상위, 산책(WALK) 감점.

**아이랑**  
입력: `scenario: family_kids`, `withKids: true`  
기대: `ACTIVITY→FOOD→CAFE`, `WALK→FOOD→CAFE` 등, 이동 짧은 편 선호.

**혼자**  
입력: `scenario: solo`, `mealRequired: true`  
기대: `FOOD→CAFE` 위주, drink-only 식사 단계 제외.

CI: `runCourseEngineScenarioChecks()` (`courseEngine.scenarios.ts`).

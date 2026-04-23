/**
 * 코스 엔진 시나리오 검증 — `npm run test:course` (apps/hama)
 */
import {
  runAdvancedCourseEngineChecks,
  runCourseEngineScenarioChecks,
  runDateCourseTimeWeatherChecks,
  runDateEveningClearPipelineChecks,
  runFamilyCourseTemplateChecks,
  runFamilyCourseWeatherAgeChecks,
  runFamilyKidsToddlerRainyPipelineChecks,
  runLowImpressionsLearnedBoostNearZeroChecks,
  runSoloLunchNoDrinkOnlyMealChecks,
} from "./courseEngine.scenarios";

function main() {
  const failures = [
    ...runCourseEngineScenarioChecks(),
    ...runFamilyCourseTemplateChecks(),
    ...runDateCourseTimeWeatherChecks(),
    ...runFamilyCourseWeatherAgeChecks(),
    ...runAdvancedCourseEngineChecks(),
    ...runDateEveningClearPipelineChecks(),
    ...runFamilyKidsToddlerRainyPipelineChecks(),
    ...runSoloLunchNoDrinkOnlyMealChecks(),
    ...runLowImpressionsLearnedBoostNearZeroChecks(),
  ];
  if (failures.length) {
    // eslint-disable-next-line no-console
    console.error("course engine failures:", failures);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log("course engine scenario tests: ok");
}

main();

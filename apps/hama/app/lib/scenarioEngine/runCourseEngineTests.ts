/**
 * 코스 엔진 시나리오 검증 — `npm run test:course` (apps/hama)
 */
import {
  runAdvancedCourseEngineChecks,
  runCourseEngineScenarioChecks,
  runDateCourseTimeWeatherChecks,
  runFamilyCourseTemplateChecks,
  runFamilyCourseWeatherAgeChecks,
} from "./courseEngine.scenarios";

function main() {
  const failures = [
    ...runCourseEngineScenarioChecks(),
    ...runFamilyCourseTemplateChecks(),
    ...runDateCourseTimeWeatherChecks(),
    ...runFamilyCourseWeatherAgeChecks(),
    ...runAdvancedCourseEngineChecks(),
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

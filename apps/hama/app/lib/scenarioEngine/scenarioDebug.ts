import type { ScenarioEngineDebugBundle } from "./types";

const KEY = "hamaDebugScenario";

/** dev 또는 localStorage `hamaDebugScenario=1` */
export function isScenarioDebugEnabled(): boolean {
  if (typeof window !== "undefined" && window.localStorage?.getItem(KEY) === "1") return true;
  return process.env.NODE_ENV === "development";
}

export function logScenarioEngineDebug(bundle: Omit<ScenarioEngineDebugBundle, "timestamp">): void {
  if (!isScenarioDebugEnabled()) return;
  if (typeof window === "undefined") return;
  // eslint-disable-next-line no-console
  console.info("[hama:scenario]", { ...bundle, timestamp: Date.now() });
}

let lastBundle: ScenarioEngineDebugBundle | null = null;

export function setLastScenarioDebugBundle(b: ScenarioEngineDebugBundle): void {
  lastBundle = b;
}

export function getLastScenarioDebugBundle(): ScenarioEngineDebugBundle | null {
  return lastBundle;
}

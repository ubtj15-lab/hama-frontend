import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parseScenarioIntent } from "@/lib/scenarioEngine/parseScenarioIntent";
import { HOME_SITUATIONS, HOME_SURPRISE } from "../TodaySituations";
import { homeContextLine } from "../HomePrompt";

const homeDir = path.resolve(__dirname, "..");
const pagePath = path.resolve(__dirname, "../../../page.tsx");

describe("Open Beta Home V4 situations", () => {
  it("exposes 3–4 desire options mapped to existing supported queries", () => {
    expect(HOME_SITUATIONS.length).toBeGreaterThanOrEqual(3);
    expect(HOME_SITUATIONS.length).toBeLessThanOrEqual(4);
    expect(HOME_SITUATIONS.map((s) => s.id)).toEqual(["family_outing", "date", "food", "outdoor_walk"]);
    expect(HOME_SITUATIONS.map((s) => s.query)).toEqual([
      "아이랑 갈만한 곳",
      "데이트",
      "뭐 먹지",
      "산책하다 들를 곳",
    ]);
  });

  it("family query stays on family_kids via parseScenarioIntent", () => {
    expect(parseScenarioIntent("아이랑 갈만한 곳").scenario).toBe("family_kids");
  });

  it("date query stays on date via parseScenarioIntent", () => {
    expect(parseScenarioIntent("데이트").scenario).toBe("date");
  });

  it("food query reuses existing time-neutral food path", () => {
    const parsed = parseScenarioIntent("뭐 먹지");
    expect(parsed.intentType).toBe("search_strict");
    expect(parsed.intentCategory).toBe("FOOD");
    expect(parsed.timeOfDay).toBeFalsy();
  });

  it("outdoor query reuses existing walk-compatible recommendation path", () => {
    const parsed = parseScenarioIntent("산책하다 들를 곳");
    expect(parsed.intentType).toBe("scenario_recommendation");
  });

  it("surprise-me reuses existing open discovery query", () => {
    expect(HOME_SURPRISE.query).toBe("오늘 뭐하지");
    const parsed = parseScenarioIntent(HOME_SURPRISE.query);
    expect(parsed.intentType).toBe("scenario_recommendation");
    expect(parsed.scenario).toBe("generic");
  });
});

describe("Open Beta Home V4 presentation", () => {
  it("Home has no place picks, no map, and no place-photo home fetch", () => {
    const page = fs.readFileSync(pagePath, "utf8");
    expect(page).not.toContain("OsanDiscoveryMap");
    expect(page).not.toContain("OsanDiscoveryVisual");
    expect(page).not.toContain("dapi.kakao.com/v2/maps");
    expect(page).not.toContain("HomePrimaryPickBlock");
    expect(page).not.toContain("HamaPrimaryPick");
    expect(page).not.toContain("HamaSecondaryPicks");
    expect(page).not.toContain("useHomePicks");
    expect(page).not.toContain("fetchTrustPickPlaceCards");
    expect(page).not.toContain("pickDiverseHomeCards");
    expect(page).not.toContain("오늘 HAMA PICK");
    expect(fs.existsSync(path.join(homeDir, "HamaPrimaryPick.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(homeDir, "HamaSecondaryPicks.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(homeDir, "HomePicksSection.tsx"))).toBe(false);
    expect(fs.existsSync(path.join(homeDir, "homePickPresentation.ts"))).toBe(false);
    expect(fs.existsSync(path.join(homeDir, "OsanDiscoveryVisual.tsx"))).toBe(false);
  });

  it("asks what to do, keeps voice, situations, surprise, and hides mission", () => {
    const page = fs.readFileSync(pagePath, "utf8");
    const prompt = fs.readFileSync(path.join(homeDir, "HomePrompt.tsx"), "utf8");
    const situations = fs.readFileSync(path.join(homeDir, "TodaySituations.tsx"), "utf8");
    expect(prompt).toContain("오늘 뭐 하고");
    expect(prompt).toContain("하고 싶은 걸 말해보세요");
    expect(prompt).toContain("직접 입력");
    expect(page).toContain("openSearch(true)");
    expect(page).toContain("handleSituationSelect");
    expect(page).toContain("handleSurpriseMe");
    expect(page).toContain("HomeBottomNav");
    expect(page).toContain("stashPlaceForSession");
    expect(page).toContain("/place/");
    expect(page).not.toMatch(/VisitMission|방문 미션/);
    expect(situations).toContain("모르겠어, 하마가 골라줘");
    expect(situations).toContain("다른 상황 보기");
    expect(situations).not.toMatch(/맞춤 추천|취향 기반|AI가 분석|OO님을 위한/);
    expect(situations).not.toMatch(/식당|카페|미용실|박물관/);
  });

  it("builds a client-only day/time context line without weather", () => {
    const sundayAfternoon = new Date(2026, 7, 30, 14, 0, 0);
    expect(homeContextLine(sundayAfternoon)).toBe("일요일 오후 · 오산");
    const source = fs.readFileSync(path.join(homeDir, "HomePrompt.tsx"), "utf8");
    expect(source).not.toMatch(/맑음|흐림|비\s*옴/);
  });
});

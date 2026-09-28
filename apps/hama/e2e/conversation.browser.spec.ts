import { expect, test, type Page, type Route } from "@playwright/test";
import { mkdirSync } from "node:fs";

type StoreRow = {
  id: string;
  name: string;
  category: string;
  address: string;
  area: string;
  lat: number;
  lng: number;
  tags: string[];
  updated_at: string;
};

type Mode = "catalog" | "empty" | "all-fail" | "partial" | "suppression" | "race" | "food-hold" | "food-empty" | "food-fail" | "food-block" | "search-hold";

const PLAY = [
  store("play-dongtan-1", "동탄 키즈플레이", "activity", "경기도 화성시 동탄대로 11"),
  store("play-dongtan-2", "동탄 실내놀이터", "activity", "경기도 화성시 동탄대로 22"),
];
const FOOD = [
  store("food-dongtan-1", "동탄 아이밥집", "restaurant", "경기도 화성시 동탄대로 33"),
  store("food-dongtan-2", "동탄 가족식당", "restaurant", "경기도 화성시 동탄대로 44"),
];
const FIRST_CAFE = [store("cafe-first", "첫검색 카페", "cafe", "경기도 화성시 동탄대로 55")];
const OSAN_CAFE = [store("cafe-osan", "오산 조용한 카페", "cafe", "경기도 오산시 오산로 66")];

const gate: {
  mode: Mode;
  generation: number;
  release: Set<number>;
  held: { generation: number; route: Route }[];
  logs: { type?: string; data?: Record<string, unknown> }[];
} = { mode: "catalog", generation: 0, release: new Set<number>(), held: [], logs: [] };

function store(id: string, name: string, category: string, address: string): StoreRow {
  return {
    id,
    name,
    category,
    address,
    area: address.includes("오산") ? "오산" : "동탄",
    lat: address.includes("오산") ? 37.15 : 37.2,
    lng: 127.07,
    tags: category === "activity" ? ["키즈", "실내"] : category === "cafe" ? ["카페", "조용"] : ["식당"],
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function raceRows(generation: number, url: string): StoreRow[] {
  const wanted = generation >= 2 ? OSAN_CAFE : FIRST_CAFE;
  const category = new URL(url).searchParams.get("category") ?? "";
  if (category && !category.includes("cafe")) return [];
  return wanted;
}

function catalog(): StoreRow[] {
  return [...PLAY, ...FOOD, ...FIRST_CAFE, ...OSAN_CAFE];
}

function foodCatalogRows(url: string): StoreRow[] {
  const category = new URL(url).searchParams.get("category") ?? "";
  if (!category) return FOOD;
  return FOOD.filter((row) => category.includes(row.category));
}

function foodRequestHeld(): boolean {
  return gate.mode === "food-hold" && !gate.release.has(1);
}

function searchRequestHeld(): boolean {
  return gate.mode === "search-hold" && !gate.release.has(3);
}

function rowsForCategory(url: string): StoreRow[] {
  const category = new URL(url).searchParams.get("category") ?? "";
  const all = gate.mode === "race" ? [...FIRST_CAFE, ...OSAN_CAFE, ...PLAY, ...FOOD] : catalog();
  if (!category) return all;
  return all.filter((row) => category.includes(row.category));
}

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installMocks(page: Page) {
  const externalHosts: string[] = [];
  page.on("request", (request) => {
    const host = new URL(request.url()).host;
    if (host.endsWith("supabase.co") || host.includes("kakao.com")) externalHosts.push(host);
  });

  await page.route("**/rest/v1/**", async (route) => {
    if (searchRequestHeld()) {
      gate.held.push({ generation: 3, route });
      return;
    }
    if (foodRequestHeld()) {
      gate.held.push({ generation: 1, route });
      return;
    }
    if (gate.mode === "food-hold") {
      await fulfillJson(route, 200, foodCatalogRows(route.request().url()));
      return;
    }
    if (gate.mode === "food-empty") {
      await fulfillJson(route, 200, []);
      return;
    }
    if (gate.mode === "food-fail") {
      await fulfillJson(route, 500, { message: "mock food catalog failure" });
      return;
    }
    if (gate.mode === "all-fail") {
      await fulfillJson(route, 500, { message: "mock catalog failure" });
      return;
    }
    if (gate.mode === "empty") {
      await fulfillJson(route, 200, []);
      return;
    }
    if (gate.mode === "partial") {
      const category = new URL(route.request().url()).searchParams.get("category") ?? "";
      if (category.includes("activity")) {
        await fulfillJson(route, 500, { message: "activity catalog failed" });
        return;
      }
    }
    if (gate.mode === "race") {
      const generation = gate.generation;
      if (gate.release.has(generation)) {
        await fulfillJson(route, 200, raceRows(generation, route.request().url()));
        return;
      }
      gate.held.push({ generation, route });
      return;
    }
    await fulfillJson(route, 200, rowsForCategory(route.request().url()));
  });

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.startsWith("/api/stores/search-by-name")) {
      if (searchRequestHeld()) {
        gate.held.push({ generation: 3, route });
        return;
      }
      if (foodRequestHeld()) {
        gate.held.push({ generation: 1, route });
        return;
      }
      if (gate.mode === "food-hold") {
        await fulfillJson(route, 200, { items: FOOD });
        return;
      }
      if (gate.mode === "food-empty") {
        await fulfillJson(route, 200, { items: [] });
        return;
      }
      if (gate.mode === "food-fail" || gate.mode === "food-block") {
        await fulfillJson(route, gate.mode === "food-fail" ? 500 : 200, {
          items: gate.mode === "food-fail" ? [] : FOOD,
          ...(gate.mode === "food-fail" ? { error: "failed" } : {}),
        });
        return;
      }
      if (gate.mode === "all-fail" || gate.mode === "partial") {
        await fulfillJson(route, 500, { items: [], error: "failed" });
        return;
      }
      if (gate.mode === "suppression") {
        await fulfillJson(route, 503, {
          items: [store("unverified-name", "검증안된 매장", "cafe", "경기도 오산시 오산로 1")],
          error: "suppression_unavailable",
        });
        return;
      }
      if (gate.mode === "empty") {
        await fulfillJson(route, 200, { items: [] });
        return;
      }
      if (gate.mode === "race") {
        const generation = gate.generation;
        if (gate.release.has(generation)) {
          await fulfillJson(route, 200, { items: generation >= 2 ? OSAN_CAFE : FIRST_CAFE });
          return;
        }
        gate.held.push({ generation, route });
        return;
      }
      const query = url.searchParams.get("query") ?? "";
      const items = query.includes("오산")
        ? OSAN_CAFE
        : query.includes("카페")
          ? FIRST_CAFE
          : catalog();
      await fulfillJson(route, 200, { items });
      return;
    }

    if (path === "/api/stores/suppression-filter") {
      if (gate.mode === "food-block") {
        await fulfillJson(route, 500, { status: "failed" });
        return;
      }
      if (gate.mode === "suppression") {
        await fulfillJson(route, 500, { status: "failed" });
        return;
      }
      const posted = route.request().postDataJSON() as { places?: { id: string }[] } | null;
      const keptIds = (posted?.places ?? []).map((place) => place.id);
      await fulfillJson(route, 200, { status: "ok", keptIds });
      return;
    }

    if (path.startsWith("/api/home-recommend") || path === "/api/stores/home") {
      if (searchRequestHeld()) {
        gate.held.push({ generation: 3, route });
        return;
      }
      if (foodRequestHeld()) {
        gate.held.push({ generation: 1, route });
        return;
      }
      if (gate.mode === "food-empty") {
        await fulfillJson(route, 200, { items: [] });
        return;
      }
      if (gate.mode === "food-fail") {
        await fulfillJson(route, 500, { items: [], error: "failed" });
        return;
      }
      if (gate.mode === "food-hold" || gate.mode === "food-block") {
        await fulfillJson(route, 200, { items: FOOD });
        return;
      }
      if (gate.mode === "all-fail") {
        await fulfillJson(route, 500, { items: [], error: "failed" });
        return;
      }
      if (gate.mode === "empty") {
        await fulfillJson(route, 200, { items: [] });
        return;
      }
      await fulfillJson(route, 200, { items: catalog() });
      return;
    }

    if (path === "/api/log") {
      const body = route.request().postDataJSON() as { type?: string; data?: Record<string, unknown> } | null;
      gate.logs.push({ type: body?.type, data: body?.data });
      await fulfillJson(route, 200, { ok: true });
      return;
    }

    if (path === "/api/me" || path === "/api/users/me/profile") {
      await fulfillJson(route, 200, { user: null });
      return;
    }
    if (path.startsWith("/api/recent")) {
      await fulfillJson(route, 200, { stores: [] });
      return;
    }
    if (path.startsWith("/api/local/reverse")) {
      await fulfillJson(route, 200, { region: "동탄" });
      return;
    }
    await fulfillJson(route, 200, {});
  });

  return {
    externalHosts,
  };
}

async function ask(page: Page, text: string) {
  const input = page.getByPlaceholder("지금 상황이나 원하는 걸 말해줘");
  await input.fill(text);
  await input.press("Enter");
}

function currentTurn(page: Page) {
  return page.locator("[data-hama-turn]").last();
}

test.beforeEach(() => {
  gate.mode = "catalog";
  gate.generation = 0;
  gate.release = new Set();
  gate.held = [];
  gate.logs = [];
});

function outcomeLogs() {
  return gate.logs.filter((entry) => entry.type === "conversation_turn_outcome");
}

test("keeps Dongtan context and adds a meal without replacing the play cards", async ({ page }) => {
  const network = await installMocks(page);
  await page.goto("/");
  await ask(page, "동탄에서 아이들이랑 갈 만한 곳 찾아줘");
  const first = currentTurn(page);
  await expect(first).toContainText("동탄 기준으로");
  await expect.poll(async () => (await first.getAttribute("data-hama-play-ids")) ?? "").not.toBe("");
  const keptPlayId = ((await first.getAttribute("data-hama-play-ids")) ?? "").split("|")[0];
  expect(keptPlayId).toBeTruthy();

  await ask(page, "그 근처에 밥 먹을 곳도 있어?");
  const second = currentTurn(page);
  await expect(second).toContainText("그 근처에 밥 먹을 곳도 있어?");
  await expect(second).toContainText("동탄 기준으로");
  const keptIds = ((await second.getAttribute("data-hama-play-ids")) ?? "").split("|");
  expect(keptIds).toContain(keptPlayId);
  await expect(second).not.toContainText("고르는 중");
  const foodIds = ((await second.getAttribute("data-hama-food-ids")) ?? "").split("|").filter(Boolean);
  expect(foodIds.length).toBeGreaterThan(0);
  expect(network.externalHosts).toEqual([]);
});

test("a late first cafe response does not replace the Osan cafe result", async ({ page }) => {
  gate.mode = "race";
  gate.generation = 1;
  await installMocks(page);
  await page.goto("/");
  await ask(page, "카페 찾아줘");
  await expect.poll(() => gate.held.filter((item) => item.generation === 1).length).toBeGreaterThan(0);

  gate.generation = 2;
  await ask(page, "아니, 오산에서 조용한 카페");
  await expect.poll(() => gate.held.filter((item) => item.generation === 2).length).toBeGreaterThan(0);

  gate.release.add(2);
  for (const item of gate.held.filter((entry) => entry.generation === 2)) {
    const url = item.route.request().url();
    const body = url.includes("/api/stores/search-by-name") ? { items: OSAN_CAFE } : raceRows(2, url);
    await fulfillJson(item.route, 200, body);
  }

  const current = currentTurn(page);
  await expect(current).toContainText("오산 조용한 카페");
  await expect(current).toHaveAttribute("data-hama-play-ids", /cafe-osan/);

  gate.release.add(1);
  for (const item of gate.held.filter((entry) => entry.generation === 1)) {
    const url = item.route.request().url();
    const body = url.includes("/api/stores/search-by-name") ? { items: FIRST_CAFE } : raceRows(1, url);
    await fulfillJson(item.route, 200, body);
  }

  await page.waitForTimeout(800);
  await expect(current).toContainText("오산 조용한 카페");
  await expect(current).not.toContainText("첫검색 카페");
  expect(await current.getAttribute("data-hama-play-ids")).toContain("cafe-osan");
  expect(await current.getAttribute("data-hama-play-ids")).not.toContain("cafe-first");
});

test("distinguishes an empty success, a total failure, a partial failure, and a suppression failure", async ({ page }) => {
  const network = await installMocks(page);

  gate.mode = "empty";
  await page.goto("/");
  await ask(page, "카페 찾아줘");
  let turn = currentTurn(page);
  await expect(turn).toContainText("카페 찾아줘");
  await expect(turn).not.toContainText("추천 정보를 불러오지 못해서");
  await expect(turn).not.toContainText("가게 확인에 실패해서");
  await expect(turn).toHaveAttribute("data-hama-play-ids", "");

  gate.mode = "all-fail";
  await ask(page, "조용한 카페 다시");
  turn = currentTurn(page);
  await expect(turn).toContainText("추천 정보를 불러오지 못해서 결과를 보여드리지 않았어요.");
  await expect(turn).toHaveAttribute("data-hama-play-ids", "");

  gate.mode = "partial";
  await ask(page, "오산에서 조용한 카페");
  turn = currentTurn(page);
  await expect(turn).toContainText("오산 조용한 카페");
  await expect(turn).not.toContainText("추천 정보를 불러오지 못해서");
  await expect(turn).not.toContainText("검증안된 매장");

  gate.mode = "suppression";
  await ask(page, "동탄 카페 확인해줘");
  turn = currentTurn(page);
  await expect(turn).toContainText("가게 확인에 실패해서 추천을 보여드리지 않았어요.");
  await expect(turn).not.toContainText("검증안된 매장");
  await expect(turn).not.toContainText("오산 조용한 카페");
  await expect(turn).toHaveAttribute("data-hama-play-ids", "");
  expect(network.externalHosts).toEqual([]);
});

const EMPTY_MEAL = "조건에 맞는 식당이 없어요";
const ASSISTANT_EMPTY_MEAL = "보여줄 식당이 없어요";
const MEAL_LOADING = "식당을 고르는 중이에요";
const FETCH_ERROR = "추천 정보를 불러오지 못해서 결과를 보여드리지 않았어요.";
const SUPPRESSION_ERROR = "가게 확인에 실패해서";

async function openPlayTurn(page: Page) {
  await page.goto("/");
  await ask(page, "동탄에서 아이들이랑 갈 만한 곳 찾아줘");
  const first = currentTurn(page);
  await expect(first).toContainText("동탄 기준으로");
  await expect.poll(async () => (await first.getAttribute("data-hama-play-ids")) ?? "").not.toBe("");
}

async function releaseHeldFood() {
  gate.release.add(1);
  const pending = gate.held.splice(0);
  for (const item of pending) {
    const url = item.route.request().url();
    if (url.includes("/api/stores/search-by-name") || url.includes("/api/home-recommend") || url.includes("/api/stores/home")) {
      await fulfillJson(item.route, 200, { items: FOOD });
      continue;
    }
    await fulfillJson(item.route, 200, foodCatalogRows(url));
  }
}

test("does not show an empty meal result while the follow-up restaurant search is still running", async ({ page }) => {
  await installMocks(page);
  await openPlayTurn(page);

  gate.mode = "food-hold";
  await ask(page, "그 근처에 밥 먹을 곳도 있어?");
  const meal = currentTurn(page);
  await expect(meal).toContainText(MEAL_LOADING);
  await expect(meal).not.toContainText(EMPTY_MEAL);
  await expect(meal).not.toContainText(ASSISTANT_EMPTY_MEAL);
  await expect.poll(() => gate.held.length).toBeGreaterThan(0);

  await releaseHeldFood();
  await expect(meal).not.toContainText("고르는 중");
  await expect(meal).toContainText("동탄 아이밥집");
  await expect(meal).not.toContainText(EMPTY_MEAL);
  const foodIds = ((await meal.getAttribute("data-hama-food-ids")) ?? "").split("|").filter(Boolean);
  expect(foodIds).toEqual(expect.arrayContaining(["food-dongtan-1"]));
});

test("shows the empty meal copy only after a completed search returns nothing", async ({ page }) => {
  await installMocks(page);
  await openPlayTurn(page);

  gate.mode = "food-empty";
  await ask(page, "그 근처에 밥 먹을 곳도 있어?");
  const meal = currentTurn(page);
  await expect(meal).toContainText(EMPTY_MEAL);
  await expect(meal).not.toContainText(MEAL_LOADING);
  await expect(meal).not.toContainText(FETCH_ERROR);
  await expect(meal).not.toContainText("가게 확인에 실패해서");
  await expect(meal).toHaveAttribute("data-hama-food-ids", "");
});

test("meal fetch and suppression failures keep the existing error copy", async ({ page }) => {
  await installMocks(page);
  await openPlayTurn(page);

  gate.mode = "food-fail";
  await ask(page, "그 근처에 밥 먹을 곳도 있어?");
  let meal = currentTurn(page);
  await expect(meal).toContainText(FETCH_ERROR);
  await expect(meal).not.toContainText(EMPTY_MEAL);
  await expect(meal).not.toContainText(ASSISTANT_EMPTY_MEAL);
  await expect(meal).toHaveAttribute("data-hama-food-ids", "");

  gate.mode = "catalog";
  await page.goto("/");
  await openPlayTurn(page);
  gate.mode = "food-block";
  await ask(page, "그 근처에 밥 먹을 곳도 있어?");
  meal = currentTurn(page);
  await expect(meal).toContainText(SUPPRESSION_ERROR);
  await expect(meal).not.toContainText(EMPTY_MEAL);
  await expect(meal).not.toContainText(ASSISTANT_EMPTY_MEAL);
  await expect(meal).toHaveAttribute("data-hama-food-ids", "");
});

async function releaseHeldSearch() {
  gate.release.add(3);
  const pending = gate.held.filter((item) => item.generation === 3);
  gate.held = gate.held.filter((item) => item.generation !== 3);
  for (const item of pending) {
    const url = item.route.request().url();
    if (url.includes("/api/stores/search-by-name")) {
      const query = new URL(url).searchParams.get("query") ?? "";
      const items = query.includes("오산") ? OSAN_CAFE : query.includes("카페") ? FIRST_CAFE : catalog();
      await fulfillJson(item.route, 200, { items });
      continue;
    }
    if (url.includes("/api/home-recommend") || url.includes("/api/stores/home")) {
      await fulfillJson(item.route, 200, { items: catalog() });
      continue;
    }
    await fulfillJson(item.route, 200, rowsForCategory(url));
  }
}

test("shows the question immediately and reveals cards after the real search", async ({ page }) => {
  gate.mode = "search-hold";
  await installMocks(page);
  await page.goto("/");
  await expect(page.locator("[data-hama-intro]")).toBeVisible();

  const question = "동탄에서 아이들이랑 갈 만한 곳 찾아줘";
  await ask(page, question);
  const first = currentTurn(page);
  await expect(first).toContainText(question);
  await expect(first.locator("[data-hama-search-status]")).toHaveText("골라보는 중이에요.");
  await expect(first).toHaveAttribute("data-hama-play-ids", "");
  await expect(page.locator("[data-hama-intro]")).toHaveAttribute("data-leaving", "true");
  await expect.poll(() => gate.held.filter((item) => item.generation === 3).length).toBeGreaterThan(0);

  await releaseHeldSearch();
  await expect(first).not.toContainText("골라보는 중");
  await expect.poll(async () => (await first.getAttribute("data-hama-play-ids")) ?? "").not.toBe("");

  gate.mode = "catalog";
  await ask(page, "그 근처에 밥 먹을 곳도 있어?");
  await expect(page.locator("[data-hama-turn]").first()).toContainText(question);
  const second = currentTurn(page);
  await expect(second).toContainText("그 근처에 밥 먹을 곳도 있어?");
  await expect.poll(async () => ((await second.getAttribute("data-hama-food-ids")) ?? "").split("|").filter(Boolean).length).toBeGreaterThan(0);
  await expect(second).not.toContainText("고르는 중");
});

test("keeps the same search flow when motion is reduced", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  gate.mode = "search-hold";
  await installMocks(page);
  await page.goto("/");

  const question = "동탄에서 아이들이랑 갈 만한 곳 찾아줘";
  await ask(page, question);
  const first = currentTurn(page);
  await expect(first).toContainText(question);
  await expect(first.locator("[data-hama-search-status]")).toHaveText("골라보는 중이에요.");
  await expect(page.locator("[data-hama-conversation]")).toHaveCSS("animation-name", "none");
  await expect(first.locator("[data-hama-search-status]")).toHaveCSS("animation-name", "none");

  await releaseHeldSearch();
  await expect.poll(async () => (await first.getAttribute("data-hama-play-ids")) ?? "").not.toBe("");
  await expect(first.locator("[data-hama-play-list]")).toHaveCSS("animation-name", "none");
  await expect(first.locator(".hama-swipe-track")).toHaveCSS("transition-duration", "0s");
});

async function expectTurnOutcome(turn: ReturnType<typeof currentTurn>, outcome: string) {
  const turnId = await turn.getAttribute("data-hama-turn-id");
  expect(turnId).toBeTruthy();
  await expect.poll(() => outcomeLogs().filter((entry) => entry.data?.turn_id === turnId)).toHaveLength(1);
  const data = outcomeLogs().find((entry) => entry.data?.turn_id === turnId)?.data ?? {};
  expect(data.outcome).toBe(outcome);
  expect(data.screen).toBe("home_conversation");
  expect(data.turn_id).toBe(turnId);
  expect(typeof data.latency_ms).toBe("number");
  expect(data).not.toHaveProperty("query");
  if (outcome === "shown") expect(data.shown_card_count).toBeGreaterThan(0);
  else expect(data.shown_card_count).toBe(0);
}

test("records one shown outcome after the search finishes, not while it is running", async ({ page }) => {
  gate.mode = "search-hold";
  await installMocks(page);
  await page.goto("/");
  await ask(page, "동탄에서 아이들이랑 갈 만한 곳 찾아줘");
  const turn = currentTurn(page);
  await expect(turn.locator("[data-hama-search-status]")).toHaveText("골라보는 중이에요.");
  await expect.poll(() => gate.held.filter((item) => item.generation === 3).length).toBeGreaterThan(0);
  expect(outcomeLogs()).toEqual([]);

  await releaseHeldSearch();
  await expect.poll(async () => (await turn.getAttribute("data-hama-play-ids")) ?? "").not.toBe("");
  await expectTurnOutcome(turn, "shown");
  await page.waitForTimeout(400);
  await expectTurnOutcome(turn, "shown");
});

test("records empty, fetch failure, partial success, and suppression failure", async ({ page }) => {
  await installMocks(page);

  gate.mode = "empty";
  await page.goto("/");
  await ask(page, "카페 찾아줘");
  let turn = currentTurn(page);
  await expect(turn).toHaveAttribute("data-hama-play-ids", "");
  await expectTurnOutcome(turn, "empty");

  gate.mode = "all-fail";
  await ask(page, "조용한 카페 다시");
  turn = currentTurn(page);
  await expect(turn).toContainText(FETCH_ERROR);
  await expectTurnOutcome(turn, "fetch_failed");

  gate.mode = "partial";
  await ask(page, "오산에서 조용한 카페");
  turn = currentTurn(page);
  await expect(turn).toContainText("오산 조용한 카페");
  await expectTurnOutcome(turn, "shown");

  gate.mode = "suppression";
  await ask(page, "동탄 카페 확인해줘");
  turn = currentTurn(page);
  await expect(turn).toContainText("가게 확인에 실패해서 추천을 보여드리지 않았어요.");
  await expectTurnOutcome(turn, "suppression_failed");
});

test("waits for the follow-up meal search before recording that turn", async ({ page }) => {
  await installMocks(page);
  await openPlayTurn(page);
  const first = currentTurn(page);
  await expectTurnOutcome(first, "shown");
  const firstId = await first.getAttribute("data-hama-turn-id");

  gate.mode = "food-hold";
  await ask(page, "그 근처에 밥 먹을 곳도 있어?");
  const meal = currentTurn(page);
  await expect(meal).toContainText(MEAL_LOADING);
  await expect.poll(() => gate.held.filter((item) => item.generation === 1).length).toBeGreaterThan(0);
  const mealId = await meal.getAttribute("data-hama-turn-id");
  expect(outcomeLogs().filter((entry) => entry.data?.turn_id === mealId)).toEqual([]);

  await releaseHeldFood();
  await expectTurnOutcome(meal, "shown");
  expect(outcomeLogs().filter((entry) => entry.data?.turn_id === firstId)).toHaveLength(1);
});

test("does not record a cancelled first search when the next question wins", async ({ page }) => {
  gate.mode = "race";
  gate.generation = 1;
  await installMocks(page);
  await page.goto("/");
  await ask(page, "카페 찾아줘");
  await expect.poll(() => gate.held.filter((item) => item.generation === 1).length).toBeGreaterThan(0);
  expect(outcomeLogs()).toEqual([]);

  gate.generation = 2;
  await ask(page, "아니, 오산에서 조용한 카페");
  await expect.poll(() => gate.held.filter((item) => item.generation === 2).length).toBeGreaterThan(0);
  expect(outcomeLogs()).toEqual([]);

  gate.release.add(2);
  for (const item of gate.held.filter((entry) => entry.generation === 2)) {
    const url = item.route.request().url();
    const body = url.includes("/api/stores/search-by-name") ? { items: OSAN_CAFE } : raceRows(2, url);
    await fulfillJson(item.route, 200, body);
  }

  const current = currentTurn(page);
  await expect(current).toContainText("오산 조용한 카페");
  await expectTurnOutcome(current, "shown");
  const winnerId = await current.getAttribute("data-hama-turn-id");

  gate.release.add(1);
  for (const item of gate.held.filter((entry) => entry.generation === 1)) {
    const url = item.route.request().url();
    const body = url.includes("/api/stores/search-by-name") ? { items: FIRST_CAFE } : raceRows(1, url);
    await fulfillJson(item.route, 200, body);
  }

  await page.waitForTimeout(800);
  expect(outcomeLogs()).toHaveLength(1);
  expect(outcomeLogs()[0]?.data?.turn_id).toBe(winnerId);
  expect(outcomeLogs()[0]?.data?.outcome).toBe("shown");
});

test("keeps earlier questions in one transcript and does not pull the reader back down", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installMocks(page);
  await page.goto("/");
  const composer = page.getByPlaceholder("지금 상황이나 원하는 걸 말해줘");
  const composerY = (await composer.boundingBox())?.y ?? 0;

  await ask(page, "동탄에서 아이들이랑 갈 만한 곳 찾아줘");
  const first = page.locator("[data-hama-turn]").first();
  await expect.poll(async () => (await first.getAttribute("data-hama-play-ids")) ?? "").not.toBe("");
  await expect(page.locator(".hama-conversation-thread")).toHaveCSS("justify-content", "flex-end");
  const firstY = await first.evaluate((element) => element.getBoundingClientRect().top);

  await ask(page, "그 근처에 밥 먹을 곳도 있어?");
  await ask(page, "오산에서 조용한 카페");
  const turns = page.locator("[data-hama-turn]");
  await expect(turns).toHaveCount(3);
  await expect(turns.nth(2)).toContainText("오산 조용한 카페");
  await expect(turns.nth(0)).toContainText("동탄에서 아이들이랑 갈 만한 곳 찾아줘");
  await expect(turns.nth(1)).toContainText("그 근처에 밥 먹을 곳도 있어?");
  const laterY = await first.evaluate((element) => element.getBoundingClientRect().top);
  expect(laterY).toBeLessThan(firstY - 40);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect((await composer.boundingBox())?.y ?? 0).toBe(composerY);
  await expect(first).not.toHaveClass(/hama-turn-current/);
  await expect(first.locator(".hama-user-line")).toHaveCSS("animation-name", "none");

  const scroller = page.locator("[data-hama-conversation-scroll]");
  await scroller.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.waitForTimeout(500);
  expect(await scroller.evaluate((element) => element.scrollTop)).toBeLessThan(40);
  await expect(page.locator("[data-hama-jump-latest]")).toBeVisible();
  await page.locator("[data-hama-jump-latest]").click();
  await expect.poll(() => scroller.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight)).toBeLessThan(80);

  await first.getByRole("button", { name: "접기" }).click();
  await expect(first.locator("[data-hama-place-id]")).toHaveCount(0);
  await first.getByRole("button", { name: /추천 \d+곳 다시 보기/ }).click();
  await expect(first.locator("[data-hama-place-id]").first()).toBeVisible();
});

test("restores the same conversation when returning from place detail", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installMocks(page);
  await page.goto("/");
  const savedTurns = () =>
    page.evaluate(() => {
      const raw = sessionStorage.getItem("hama_conversation_context_v1");
      if (!raw) return 0;
      const parsed = JSON.parse(raw) as { dialogueHistory?: unknown[] };
      return Array.isArray(parsed.dialogueHistory) ? parsed.dialogueHistory.length : 0;
    });
  await ask(page, "동탄에서 아이들이랑 갈 만한 곳 찾아줘");
  await expect.poll(async () => (await page.locator("[data-hama-turn]").nth(0).getAttribute("data-hama-play-ids")) ?? "").not.toBe("");
  await expect.poll(savedTurns).toBe(1);
  await ask(page, "그 근처에 밥 먹을 곳도 있어?");
  await expect.poll(async () => (await page.locator("[data-hama-turn]").nth(1).getAttribute("data-hama-food-ids")) ?? "").not.toBe("");
  await expect.poll(savedTurns).toBe(2);
  await ask(page, "오산에서 조용한 카페 찾아줘");

  const turns = page.locator("[data-hama-turn]");
  await expect(turns).toHaveCount(3);
  const first = turns.nth(0);
  const third = turns.nth(2);
  await expect(third).toContainText("오산 조용한 카페");
  await expect(third).toContainText("이 순서로 골랐어요");
  const playIds = await third.getAttribute("data-hama-play-ids");
  expect(playIds).toBeTruthy();

  await first.getByRole("button", { name: "접기" }).click();
  await expect(first.getByRole("button", { name: /다시 보기/ })).toBeVisible();
  const scroller = page.locator("[data-hama-conversation-scroll]");
  const scrollBefore = await scroller.evaluate((element) => element.scrollTop);

  const openDetail = () => third.getByRole("button", { name: "상세 보기" }).first().evaluate((element: HTMLButtonElement) => element.click());
  await openDetail();
  await expect(page).not.toHaveURL(/\/place\//);
  const panel = page.getByRole("dialog");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("오산 조용한 카페");
  await page.getByRole("button", { name: "닫기" }).click();
  await expect(panel).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/place\//);
  await expect(turns).toHaveCount(3);
  await expect(turns.nth(0)).toContainText("동탄에서 아이들이랑 갈 만한 곳 찾아줘");
  await expect(turns.nth(1)).toContainText("그 근처에 밥 먹을 곳도 있어?");
  await expect(third).toContainText("오산에서 조용한 카페 찾아줘");
  await expect(third).toContainText("오산 조용한 카페");
  await expect(third).toContainText("이 순서로 골랐어요");
  expect(await third.getAttribute("data-hama-play-ids")).toBe(playIds);
  await expect(first.getByRole("button", { name: /다시 보기/ })).toBeVisible();
  await expect.poll(() => scroller.evaluate((element, before) => Math.abs(element.scrollTop - before), scrollBefore)).toBeLessThan(40);

  await openDetail();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/place\//);
  await expect(turns).toHaveCount(3);
  await expect(third).toContainText("오산 조용한 카페");
  await expect(third).toContainText("이 순서로 골랐어요");
  expect(await third.getAttribute("data-hama-play-ids")).toBe(playIds);
  await expect.poll(() => scroller.evaluate((element, before) => Math.abs(element.scrollTop - before), scrollBefore)).toBeLessThan(40);

  await page.getByRole("button", { name: "더보기" }).click();
  await page.getByRole("menuitem", { name: "새 대화" }).click();
  await expect(page.locator("[data-hama-intro]")).toHaveAttribute("data-leaving", "false");
  await expect(page.locator("[data-hama-turn]")).toHaveCount(0);

  await ask(page, "동탄에서 아이들이랑 갈 만한 곳 찾아줘");
  const only = page.locator("[data-hama-turn]");
  await expect(only).toHaveCount(1);
  await expect.poll(async () => (await only.first().getAttribute("data-hama-play-ids")) ?? "").not.toBe("");
  await only.first().getByRole("button", { name: "상세 보기" }).first().evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).not.toHaveURL(/\/place\//);
  await page.goto("/");
  await expect(page.locator("[data-hama-intro]")).toHaveAttribute("data-leaving", "false");
  await expect(page.locator("[data-hama-turn]")).toHaveCount(0);
});

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

test("swipes one card at a time and restores that card after place detail", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
    const shotDir = "C:/Users/ubtj1/AppData/Local/Temp/hama-swipe-cards";
    mkdirSync(shotDir, { recursive: true });
    const shownIds = ["play-dongtan-1", "cafe-first", "food-dongtan-1", "food-dongtan-2"];
    const photoIds = new Set(["play-dongtan-1", "cafe-first"]);
    const withPhoto = (rows: StoreRow[]) =>
      rows
        .filter((row) => shownIds.includes(row.id))
        .map((row) => (photoIds.has(row.id) ? { ...row, image_url: "/hama-e2e-photo.png" } : row));

    await installMocks(page);
    await page.route("**/rest/v1/**", async (route) => {
      const category = new URL(route.request().url()).searchParams.get("category") ?? "";
      const rows = withPhoto(catalog());
      await fulfillJson(route, 200, category ? rows.filter((row) => category.includes(row.category)) : rows);
    });
    await page.route("**/api/home-recommend**", async (route) => {
      await fulfillJson(route, 200, { items: withPhoto(catalog()) });
    });
    await page.route("**/hama-e2e-photo.png", async (route) => {
      await route.fulfill({ status: 200, contentType: "image/png", body: TINY_PNG });
    });

    await page.goto("/");
    await ask(page, "동탄에서 아이들이랑 갈 만한 곳 찾아줘");
    const turn = page.locator("[data-hama-turn]").first();
    const deck = turn.locator("[data-hama-swipe='play']");
    await expect.poll(async () => Number((await deck.getAttribute("data-hama-card-count")) ?? "0")).toBe(3);
    await expect(turn.getByRole("button", { name: "지도에서 보기" })).toBeVisible();
    await expect(deck.getByRole("button", { name: "다른 곳" })).toBeVisible();
    await expect(deck.locator("[data-hama-place-id] .hama-swipe-count")).toHaveText("1 / 3");
    const firstId = await deck.locator("[data-hama-place-id]").getAttribute("data-hama-place-id");
    expect(firstId).toBeTruthy();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${shotDir}/mobile-card.png` });

    await deck.getByRole("button", { name: "다음 추천" }).click();
    await expect(deck).toHaveAttribute("data-hama-card-index", "1");
    await expect(deck.locator("[data-hama-place-id] .hama-swipe-count")).toHaveText("2 / 3");
    const secondId = await deck.locator("[data-hama-place-id]").getAttribute("data-hama-place-id");
    expect(secondId).toBeTruthy();
    expect(secondId).not.toBe(firstId);

    await deck.focus();
    await deck.press("ArrowLeft");
    await expect(deck).toHaveAttribute("data-hama-card-index", "0");
    await expect(deck.locator("[data-hama-place-id]")).toHaveAttribute("data-hama-place-id", firstId!);

    const box = await deck.locator(".hama-swipe-viewport").boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width * 0.82, box!.y + box!.height * 0.45);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.18, box!.y + box!.height * 0.45, { steps: 12 });
    await page.mouse.up();
    await expect(deck).toHaveAttribute("data-hama-card-index", "1");
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${shotDir}/mobile-swiped.png` });

    let sawPhoto = false;
    let sawFallback = false;
    await deck.getByRole("button", { name: "이전 추천" }).click();
    for (let step = 0; step < 3; step += 1) {
      await page.waitForTimeout(350);
      const face = deck.locator("[data-hama-place-id]");
      if ((await face.locator("[data-hama-card-photo]").count()) > 0) {
        sawPhoto = true;
        await expect(face.locator("img")).toBeVisible();
        await page.screenshot({ path: `${shotDir}/mobile-photo.png` });
      }
      if ((await face.locator("[data-hama-card-fallback]").count()) > 0) {
        sawFallback = true;
        await expect(face.locator("img")).toHaveCount(0);
        await page.screenshot({ path: `${shotDir}/mobile-no-photo.png` });
      }
      if (step < 2) await deck.getByRole("button", { name: "다음 추천" }).click();
    }
    expect(sawPhoto).toBe(true);
    expect(sawFallback).toBe(true);

    const selectedIndex = await deck.getAttribute("data-hama-card-index");
    const selectedId = await deck.locator("[data-hama-place-id]").getAttribute("data-hama-place-id");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${shotDir}/desktop-card.png` });
    await page.setViewportSize({ width: 390, height: 844 });

    const homeUrl = page.url();
    await deck.getByRole("button", { name: "상세 보기" }).evaluate((element: HTMLButtonElement) => element.click());
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveAttribute("data-hama-panel-place", selectedId!);
    await expect(page).toHaveURL(homeUrl);
    await page.getByRole("button", { name: "닫기" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(deck).toHaveAttribute("data-hama-card-index", selectedIndex!);
    await expect(deck.locator("[data-hama-place-id]")).toHaveAttribute("data-hama-place-id", selectedId!);

    await ask(page, "그 근처에 밥 먹을 곳도 있어?");
    const turns = page.locator("[data-hama-turn]");
    await expect(turns).toHaveCount(2);
    await expect.poll(async () => (await turns.nth(1).getAttribute("data-hama-food-ids")) ?? "").not.toBe("");
    const previous = turns.nth(0).locator("[data-hama-swipe='play']");
    await expect(previous).toHaveAttribute("data-hama-card-index", selectedIndex!);
    await expect(previous.locator("[data-hama-place-id]")).toHaveAttribute("data-hama-place-id", selectedId!);
    await expect(turns.nth(1).locator("[data-hama-swipe='play']")).toHaveAttribute("data-hama-card-index", "0");
    await expect(turns.nth(0).getByRole("button", { name: "다른 곳" })).toHaveCount(0);
    await expect(turns.nth(1).getByRole("button", { name: "다른 곳" })).toBeVisible();
});

test("opens a place panel over the third question and returns to the same card", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installMocks(page);
  await page.goto("/");
  const shotDir = "C:/Users/ubtj1/AppData/Local/Temp/hama-place-panel";
  mkdirSync(shotDir, { recursive: true });

  await ask(page, "동탄에서 아이들이랑 갈 만한 곳 찾아줘");
  await expect.poll(async () => (await page.locator("[data-hama-turn]").nth(0).getAttribute("data-hama-play-ids")) ?? "").not.toBe("");
  await ask(page, "그 근처에 밥 먹을 곳도 있어?");
  await expect.poll(async () => (await page.locator("[data-hama-turn]").nth(1).getAttribute("data-hama-food-ids")) ?? "").not.toBe("");
  await ask(page, "동탄에서 아이들이랑 갈 만한 곳 찾아줘");

  const turns = page.locator("[data-hama-turn]");
  await expect(turns).toHaveCount(3);
  const third = turns.nth(2);
  const deck = third.locator("[data-hama-swipe='play']");
  await expect.poll(async () => Number((await deck.getAttribute("data-hama-card-count")) ?? "0")).toBeGreaterThan(1);
  await deck.getByRole("button", { name: "다음 추천" }).click();
  await expect(deck).toHaveAttribute("data-hama-card-index", "1");
  const selectedFace = deck.locator("[data-hama-place-id]");
  const selectedId = await selectedFace.getAttribute("data-hama-place-id");
  expect(selectedId).toBeTruthy();
  await selectedFace.scrollIntoViewIfNeeded();
  const scroller = page.locator("[data-hama-conversation-scroll]");
  const scrollBefore = await scroller.evaluate((element) => element.scrollTop);
  await page.screenshot({ path: `${shotDir}/mobile-swipe.png` });

  const outcomesBefore = outcomeLogs().length;
  const homeUrl = page.url();
  await deck.getByRole("button", { name: "상세 보기" }).evaluate((element: HTMLButtonElement) => element.click());
  const panel = page.getByRole("dialog");
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute("data-hama-panel-place", selectedId!);
  await expect(page).toHaveURL(homeUrl);
  await expect(page).not.toHaveURL(/\/place\//);
  await expect(turns).toHaveCount(3);
  await expect(panel.getByRole("button", { name: "길찾기" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "전화하기" })).toHaveCount(0);
  await expect(panel.locator("[data-hama-panel-fallback]")).toBeVisible();
  await expect(panel.locator("img")).toHaveCount(0);
  await expect(panel).not.toContainText("영업중");
  await expect(panel).not.toContainText("혼잡");
  await expect(panel).not.toContainText("평점");
  await page.screenshot({ path: `${shotDir}/mobile-panel.png` });

  await page.getByRole("button", { name: "닫기" }).click();
  await expect(panel).toHaveCount(0);
  await expect(deck).toHaveAttribute("data-hama-card-index", "1");
  await expect(deck.locator("[data-hama-place-id]")).toHaveAttribute("data-hama-place-id", selectedId!);
  await expect.poll(() => scroller.evaluate((element, before) => Math.abs(element.scrollTop - before), scrollBefore)).toBeLessThan(40);
  expect(outcomeLogs().length).toBe(outcomesBefore);
  await page.screenshot({ path: `${shotDir}/mobile-returned.png` });

  await ask(page, "오산에서 조용한 카페 찾아줘");
  await expect(page.locator("[data-hama-turn]")).toHaveCount(4);
  await expect(page.locator("[data-hama-turn]").nth(2).locator("[data-hama-swipe='play']")).toHaveAttribute("data-hama-card-index", "1");
  await expect(page.locator("[data-hama-turn]").nth(3)).toContainText("오산 조용한 카페");
});

test("refreshes the current deck without repeating shown places or the turn outcome", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installMocks(page);
  await page.goto("/");
  const shotDir = "C:/Users/ubtj1/AppData/Local/Temp/hama-find-again";
  mkdirSync(shotDir, { recursive: true });

  await ask(page, "동탄에서 아이들이랑 갈 만한 곳 찾아줘");
  const turn = page.locator("[data-hama-turn]").first();
  const deck = turn.locator("[data-hama-swipe='play']");
  await expect.poll(async () => Number((await deck.getAttribute("data-hama-card-count")) ?? "0")).toBeGreaterThan(0);
  await expect.poll(async () => Number((await deck.getAttribute("data-hama-card-count")) ?? "0")).toBeLessThanOrEqual(3);
  const count = Number(await deck.getAttribute("data-hama-card-count"));
  if (count > 1) {
    await deck.getByRole("button", { name: "다음 추천" }).click();
    await expect(deck).toHaveAttribute("data-hama-card-index", "1");
    await deck.getByRole("button", { name: "이전 추천" }).click();
    await expect(deck).toHaveAttribute("data-hama-card-index", "0");
  }
  const firstIds = ((await turn.getAttribute("data-hama-play-ids")) ?? "").split("|").filter(Boolean);
  expect(firstIds.length).toBeGreaterThan(0);
  const answer = await turn.locator(".hama-assistant-line").innerText();
  const outcomesBefore = outcomeLogs().length;

  await deck.getByRole("button", { name: "상세 보기" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(deck.locator("[data-hama-place-id]")).toHaveAttribute("data-hama-place-id", firstIds[0]!);

  const again = deck.getByRole("button", { name: "다시 찾기" });
  await again.click();
  await expect.poll(async () => ((await turn.getAttribute("data-hama-play-ids")) ?? "").split("|").filter(Boolean).join("|")).not.toBe(firstIds.join("|"));
  await expect(deck).toHaveAttribute("data-hama-card-index", "0");
  await expect(turn.locator(".hama-assistant-line")).toHaveText(answer);
  const nextIds = ((await turn.getAttribute("data-hama-play-ids")) ?? "").split("|").filter(Boolean);
  expect(nextIds.length).toBeGreaterThan(0);
  expect(nextIds.length).toBeLessThanOrEqual(3);
  for (const id of nextIds) expect(firstIds).not.toContain(id);
  expect(outcomeLogs().length).toBe(outcomesBefore);
  await page.screenshot({ path: `${shotDir}/mobile-again.png` });

  await ask(page, "그 근처에 밥 먹을 곳도 있어?");
  await expect(page.locator("[data-hama-turn]")).toHaveCount(2);
  const previous = page.locator("[data-hama-turn]").nth(0);
  await expect(previous).toHaveAttribute("data-hama-play-ids", nextIds.join("|"));
  await expect(previous.locator("[data-hama-swipe='play']")).toHaveAttribute("data-hama-card-index", "0");
  await expect(previous.locator("[data-hama-find-again]")).toHaveCount(0);
  await expect.poll(async () => (await page.locator("[data-hama-turn]").nth(1).getAttribute("data-hama-food-ids")) ?? "").not.toBe("");
  await expect.poll(() => outcomeLogs().length).toBe(outcomesBefore + 1);
});

test("says when another refresh has no new place and ignores a second click", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installMocks(page);
  const only = catalog().slice(0, 1);
  let refreshGate: Promise<void> | null = null;
  let openRefresh = () => {};
  const fulfillOnly = async (route: Route) => {
    if (refreshGate) await refreshGate;
    await fulfillJson(route, 200, route.request().url().includes("/api/") ? { items: only } : only);
  };
  await page.route("**/rest/v1/**", fulfillOnly);
  await page.route("**/api/home-recommend**", fulfillOnly);
  await page.route("**/api/stores/home**", fulfillOnly);

  await page.goto("/");
  await ask(page, "동탄에서 아이들이랑 갈 만한 곳 찾아줘");
  const turn = page.locator("[data-hama-turn]").first();
  const deck = turn.locator("[data-hama-swipe='play']");
  await expect.poll(async () => Number((await deck.getAttribute("data-hama-card-count")) ?? "0")).toBe(1);
  refreshGate = new Promise<void>((resolve) => {
    openRefresh = resolve;
  });
  const again = deck.locator("[data-hama-find-again]");
  await again.click();
  await expect(again).toBeDisabled();
  await expect(again).toHaveText("찾는 중이에요.");
  await again.click({ force: true });
  openRefresh();
  refreshGate = null;
  await expect(turn.locator("[data-hama-refresh-empty]")).toHaveText("조건에 맞는 다른 장소를 찾지 못했어요.");
  await expect(deck).toHaveCount(0);
});

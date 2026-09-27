import { expect, test, type Page, type Route } from "@playwright/test";

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
} = { mode: "catalog", generation: 0, release: new Set<number>(), held: [] };

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
});

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
});

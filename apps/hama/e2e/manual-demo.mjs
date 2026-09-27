import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(fileURLToPath(import.meta.url));
const { chromium } = require("@playwright/test");

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = 3017;
const origin = `http://127.0.0.1:${port}`;
const verify = process.argv.includes("--verify");
const shotDir = "C:/Users/ubtj1/AppData/Local/Temp/hama-manual-demo";
const unexpected = [];

function store(id, name, category, address) {
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

function catalog() {
  return [...PLAY, ...FOOD, ...FIRST_CAFE, ...OSAN_CAFE];
}

function rowsFor(url) {
  const category = new URL(url).searchParams.get("category") ?? "";
  if (!category) return catalog();
  return catalog().filter((row) => category.includes(row.category));
}

function noteUnexpected(url, reason) {
  const entry = { url, reason };
  unexpected.push(entry);
  console.log(`UNEXPECTED ${url} :: ${reason}`);
}

async function fulfill(route, body) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function handleRoute(route) {
  const requestUrl = route.request().url();
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    noteUnexpected(requestUrl, "주소를 해석할 수 없어 차단했습니다.");
    await route.abort();
    return;
  }

  const localApp = (url.hostname === "127.0.0.1" || url.hostname === "localhost") && url.port === String(port);
  if (localApp && !url.pathname.startsWith("/api/")) {
    await route.continue();
    return;
  }

  if (url.pathname.includes("/rest/v1/")) {
    await fulfill(route, rowsFor(requestUrl));
    return;
  }

  const path = url.pathname;
  if (path.startsWith("/api/stores/search-by-name")) {
    const query = url.searchParams.get("query") ?? url.searchParams.get("q") ?? "";
    const items = query.includes("오산") ? OSAN_CAFE : query.includes("카페") ? FIRST_CAFE : catalog();
    await fulfill(route, { items });
    return;
  }
  if (path === "/api/stores/suppression-filter") {
    let posted = null;
    try {
      posted = route.request().postDataJSON();
    } catch {
      posted = null;
    }
    const keptIds = (posted?.places ?? []).map((place) => place.id);
    await fulfill(route, { status: "ok", keptIds });
    return;
  }
  if (path.startsWith("/api/home-recommend") || path === "/api/stores/home") {
    await fulfill(route, { items: catalog() });
    return;
  }
  if (path === "/api/log" || path === "/api/events" || path === "/api/recommendation/log") {
    await fulfill(route, { ok: true });
    return;
  }
  if (path === "/api/me" || path === "/api/users/me/profile") {
    await fulfill(route, { user: null });
    return;
  }
  if (path.startsWith("/api/recent")) {
    await fulfill(route, { stores: [] });
    return;
  }
  if (path.startsWith("/api/local/")) {
    await fulfill(route, { region: "동탄" });
    return;
  }

  noteUnexpected(requestUrl, "시연용 모의 응답이 준비되지 않아 차단했습니다. 실제 서비스로는 보내지 않았습니다.");
  await route.abort();
}

function mockEnv(base) {
  return {
    ...base,
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3999",
    SUPABASE_URL: "http://127.0.0.1:3999",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "mock-service-key",
    KAKAO_REST_API_KEY: "",
    KAKAO_CLIENT_SECRET: "",
    KAKAO_CLIENT_ID: "",
    KAKAO_REST_KEY: "",
  };
}

async function serverIsUp() {
  try {
    const response = await fetch(origin, { signal: AbortSignal.timeout(1500) });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function startServer() {
  if (await serverIsUp()) return null;
  const child = spawn("npx", ["next", "dev", "-p", String(port)], {
    cwd: appDir,
    env: mockEnv(process.env),
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
  const started = Date.now();
  while (Date.now() - started < 90000) {
    if (await serverIsUp()) return child;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  child.kill();
  throw new Error("로컬 시연 서버가 열리지 않았습니다.");
}

async function ask(page, text) {
  const input = page.getByPlaceholder("지금 상황이나 원하는 걸 말해줘");
  await input.click();
  await input.fill(text);
  await input.press("Enter");
}

async function verifyQuestions(page) {
  mkdirSync(shotDir, { recursive: true });
  const questions = [
    { text: "동탄에서 아이들이랑 갈 만한 곳 찾아줘", card: /동탄 키즈플레이|동탄 실내놀이터/, file: "01-play.png" },
    { text: "그 근처에 밥 먹을 곳도 있어?", card: /동탄 아이밥집|동탄 가족식당/, file: "02-meal.png" },
    { text: "오산에서 조용한 카페 찾아줘", card: "오산 조용한 카페", file: "03-cafe.png" },
  ];
  const results = [];
  for (const question of questions) {
    await ask(page, question.text);
    const turn = page.locator("[data-hama-turn]").last();
    let shown = false;
    try {
      await turn.getByText(question.card).first().waitFor({ timeout: 20000 });
      shown = true;
    } catch {
      shown = false;
    }
    await page.screenshot({ path: `${shotDir}/${question.file}` });
    const body = await turn.innerText();
    results.push({
      question: question.text,
      shown,
      suppression: body.includes("가게 확인에 실패해서"),
      fetchError: body.includes("추천 정보를 불러오지 못해서"),
      excerpt: body.slice(0, 280),
    });
  }
  const turns = await page.locator("[data-hama-turn]").count();
  const composer = await page.getByPlaceholder("지금 상황이나 원하는 걸 말해줘").boundingBox();
  const scroll = await page.locator("[data-hama-conversation-scroll]").evaluate((element) => ({
    top: element.scrollTop,
    max: element.scrollHeight - element.clientHeight,
    windowScroll: window.scrollY,
  }));
  return { results, turns, composerVisible: Boolean(composer), scroll, unexpected: [...unexpected] };
}

const server = await startServer();
const browser = await chromium.launch({
  headless: false,
  args: ["--window-position=60,30", "--window-size=460,960"],
});
const context = await browser.newContext({
  viewport: { width: 420, height: 900 },
  locale: "ko-KR",
  serviceWorkers: "block",
});
await context.addInitScript(() => {
  const paint = () => {
    if (!document.body || document.querySelector("[data-hama-demo-banner]")) return;
    const bar = document.createElement("div");
    bar.setAttribute("data-hama-demo-banner", "");
    bar.textContent = "시연 화면 · 모의 매장만 표시됩니다";
    bar.style.cssText = [
      "position:fixed",
      "left:50%",
      "bottom:108px",
      "transform:translateX(-50%)",
      "z-index:40",
      "background:#19584A",
      "color:#FBFCF9",
      "font:13px/1.4 sans-serif",
      "padding:6px 12px",
      "border-radius:999px",
      "pointer-events:none",
    ].join(";");
    document.body.appendChild(bar);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paint);
  else paint();
});
await context.route("**/*", handleRoute);
const page = await context.newPage();
await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });

let report = { verify: null };
if (verify) {
  report.verify = await verifyQuestions(page);
  writeFileSync(`${shotDir}/report.json`, JSON.stringify(report, null, 2));
  const failed = report.verify.results.some((item) => !item.shown);
  console.log(failed ? "VERIFY_FAIL" : "VERIFY_OK");
  console.log(JSON.stringify(report.verify, null, 2));
  if (!failed) {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
  }
}

console.log("DEMO_READY");
console.log("이 창에서만 질문하세요. 주소창을 다른 브라우저에 열면 모의 매장이 없습니다.");
browser.on("disconnected", () => {
  if (server) spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], { shell: true, stdio: "ignore" });
  process.exit(report.verify?.results?.some((item) => !item.shown) ? 1 : 0);
});
await new Promise(() => {});

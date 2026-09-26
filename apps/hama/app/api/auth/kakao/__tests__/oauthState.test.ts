import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sanitizeReturnPath } from "@/lib/auth/safeReturnPath";

const harness = vi.hoisted(() => {
  const users: { id: string; kakao_id: string; nickname: string }[] = [];
  let seq = 1;
  function from(table: string) {
    let op: "select" | "insert" | "update" = "select";
    let payload: Record<string, unknown> | null = null;
    const filters: { col: string; val: unknown }[] = [];
    const builder = {
      select: () => builder,
      eq(col: string, val: unknown) {
        filters.push({ col, val });
        return builder;
      },
      is: () => builder,
      insert(row: Record<string, unknown>) {
        op = "insert";
        payload = row;
        return builder;
      },
      update(row: Record<string, unknown>) {
        op = "update";
        payload = row;
        return builder;
      },
      maybeSingle() {
        return Promise.resolve(finish());
      },
      single() {
        return Promise.resolve(finish());
      },
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(finish()).then(onFulfilled, onRejected);
      },
    };
    function finish() {
      if (table === "users" && op === "select") {
        const row = users.find((item) => filters.every((filter) => item[filter.col as "kakao_id"] === filter.val)) ?? null;
        return { data: row, error: null };
      }
      if (table === "users" && op === "insert" && payload) {
        const row = { id: `user-${seq++}`, kakao_id: String(payload.kakao_id), nickname: String(payload.nickname ?? "") };
        users.push(row);
        return { data: { id: row.id }, error: null };
      }
      if (table === "users" && op === "update") return { data: null, error: null };
      if (table === "hama_sessions") return { data: null, error: null };
      return { data: null, error: { message: "unexpected", code: "test" } };
    }
    return builder;
  }
  return {
    reset() {
      users.length = 0;
      seq = 1;
    },
    admin: () => ({ from }),
  };
});

vi.mock("@/lib/server/supabaseAdmin", () => ({
  getSupabaseAdmin: () => harness.admin(),
  createSupabaseAdmin: () => harness.admin(),
}));
import {
  HAMA_KAKAO_OAUTH_COOKIE,
  OAUTH_STATE_TTL_MS,
  resetOAuthStateReuseForTests,
  sealOAuthState,
} from "@/lib/server/kakaoOAuthState";
import { GET as kakaoCallback } from "../callback/route";
import { GET as kakaoLogin } from "../login/route";

function setCookieLines(res: Response): string[] {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function cookiePair(res: Response, name: string): string | null {
  const line = setCookieLines(res).find((item) => item.startsWith(`${name}=`));
  if (!line) return null;
  return line.slice(name.length + 1).split(";")[0] ?? null;
}

function kakaoSuccess() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("kauth.kakao.com/oauth/token")) {
        return new Response(JSON.stringify({ access_token: "kakao-access-test" }), { status: 200 });
      }
      if (url.includes("kapi.kakao.com/v2/user/me")) {
        return new Response(JSON.stringify({ id: 777, kakao_account: { profile: { nickname: "관리자" } } }), {
          status: 200,
        });
      }
      throw new Error(`unexpected fetch ${url}`);
    })
  );
}

async function startLogin(next: string): Promise<{ state: string; cookie: string; location: string; setCookie: string }> {
  const res = await kakaoLogin(
    new NextRequest(`http://localhost:3000/api/auth/kakao/login?next=${encodeURIComponent(next)}`, {
      headers: { host: "localhost:3000" },
    })
  );
  const location = res.headers.get("location") ?? "";
  const state = new URL(location).searchParams.get("state") ?? "";
  const line = setCookieLines(res).find((item) => item.startsWith(`${HAMA_KAKAO_OAUTH_COOKIE}=`)) ?? "";
  return { state, cookie: cookiePair(res, HAMA_KAKAO_OAUTH_COOKIE) ?? "", location, setCookie: line };
}

function callback(state: string, cookie: string, code = "auth-code-1"): NextRequest {
  return new NextRequest(
    `http://localhost:3000/api/auth/kakao/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
    { headers: { host: "localhost:3000", cookie: `${HAMA_KAKAO_OAUTH_COOKIE}=${cookie}` } }
  );
}

describe("kakao oauth state", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});

  beforeEach(() => {
    harness.reset();
    resetOAuthStateReuseForTests();
    consoleError.mockClear();
    consoleInfo.mockClear();
    vi.stubEnv("KAKAO_REST_API_KEY", "test-kakao-rest-key");
    vi.stubEnv("KAKAO_CLIENT_SECRET", "test-kakao-secret");
    vi.stubEnv("KAKAO_REDIRECT_URI", "http://localhost:3000/api/auth/kakao/callback");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.test");
    vi.stubEnv("SUPABASE_URL", "https://example.test");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("fetch was not stubbed"); }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function loggedText(): string {
    return [...consoleError.mock.calls, ...consoleInfo.mock.calls]
      .map((args) => args.map((part) => (typeof part === "string" ? part : JSON.stringify(part))).join(" "))
      .join("\n");
  }

  it("returns a normal page and the admin page after a matching login", async () => {
    kakaoSuccess();
    const home = await startLogin("/results?tab=1");
    expect(home.setCookie).toMatch(/HttpOnly/i);
    expect(home.setCookie).toMatch(/SameSite=lax/i);
    expect(home.setCookie).toMatch(/Path=\/api\/auth\/kakao/i);
    expect(home.location).toContain("https://kauth.kakao.com/oauth/authorize");
    expect(home.state).toBeTruthy();
    expect(home.location).not.toContain("/results");

    const homeBack = await kakaoCallback(callback(home.state, home.cookie));
    expect(homeBack.headers.get("location")).toBe("http://localhost:3000/results?tab=1");
    expect(cookiePair(homeBack, HAMA_KAKAO_OAUTH_COOKIE)).toBe("");

    const admin = await startLogin("/admin/beta-verifications");
    const adminBack = await kakaoCallback(callback(admin.state, admin.cookie, "auth-code-2"));
    expect(adminBack.headers.get("location")).toBe("http://localhost:3000/admin/beta-verifications");
    expect(loggedText()).not.toContain("auth-code-1");
    expect(loggedText()).not.toContain("auth-code-2");
    expect(loggedText()).not.toContain("kakao-access-test");
    expect(loggedText()).not.toContain("test-kakao-secret");
  });

  it.each([
    ["//evil.example"],
    ["https://evil.example/phish"],
    ["/\\evil.example"],
    ["\\\\evil.example"],
    ["/%2f%2fevil.example"],
    ["%2F%2Fevil.example"],
    ["%252F%252Fevil.example"],
    ["%5C%5Cevil.example"],
    ["/admin/../../\\evil.example"],
  ])("keeps an unsafe next path on this site: %s", async (next) => {
    kakaoSuccess();
    const started = await startLogin(next);
    const res = await kakaoCallback(callback(started.state, started.cookie));
    const location = res.headers.get("location") ?? "";
    expect(location.startsWith("http://localhost:3000/")).toBe(true);
    expect(location).not.toContain("evil.example");
    expect(new URL(location).host).toBe("localhost:3000");
  });

  it("rejects a missing, tampered, expired, or reused state", async () => {
    kakaoSuccess();
    const started = await startLogin("/my");

    const missingCookie = await kakaoCallback(
      new NextRequest(`http://localhost:3000/api/auth/kakao/callback?code=auth-code-1&state=${started.state}`, {
        headers: { host: "localhost:3000" },
      })
    );
    expect(missingCookie.headers.get("location")).toContain("reason=state_missing");

    const missingState = await kakaoCallback(
      new NextRequest("http://localhost:3000/api/auth/kakao/callback?code=auth-code-1", {
        headers: { host: "localhost:3000", cookie: `${HAMA_KAKAO_OAUTH_COOKIE}=${started.cookie}` },
      })
    );
    expect(missingState.headers.get("location")).toContain("reason=state_missing");

    const tamperedState = await kakaoCallback(callback(`${started.state}x`, started.cookie));
    expect(tamperedState.headers.get("location")).toContain("reason=state_mismatch");

    const tamperedCookie = await kakaoCallback(callback(started.state, `${started.cookie}x`));
    expect(tamperedCookie.headers.get("location")).toContain("reason=state_mismatch");

    const expired = sealOAuthState("/admin", Date.now() - OAUTH_STATE_TTL_MS - 1000);
    const expiredRes = await kakaoCallback(callback(expired.state, expired.cookie));
    expect(expiredRes.headers.get("location")).toContain("reason=state_expired");

    const forged = JSON.parse(Buffer.from(started.cookie, "base64url").toString("utf8")) as { p: string; s: string };
    forged.p = "//evil.example";
    const forgedCookie = Buffer.from(JSON.stringify({ v: 1, s: forged.s, p: forged.p, e: Date.now() + 60_000 }), "utf8").toString(
      "base64url"
    );
    const forgedRes = await kakaoCallback(callback(forged.s, forgedCookie));
    expect(forgedRes.headers.get("location")).toContain("reason=state_mismatch");
    expect(forgedRes.headers.get("location")).not.toContain("evil.example");

    const first = await kakaoCallback(callback(started.state, started.cookie));
    expect(first.headers.get("location")).toBe("http://localhost:3000/my");
    const again = await kakaoCallback(callback(started.state, started.cookie, "auth-code-replay"));
    expect(again.headers.get("location")).toContain("reason=state_reused");
    expect(setCookieLines(again).find((line) => line.startsWith(`${HAMA_KAKAO_OAUTH_COOKIE}=`))).toMatch(/Max-Age=0/i);
    expect(loggedText()).not.toContain("auth-code-replay");
    expect(loggedText()).not.toContain("kakao-access-test");
  });

  it("drops unsafe return paths before they are stored", () => {
    expect(sanitizeReturnPath("/admin")).toBe("/admin");
    expect(sanitizeReturnPath("/results?tab=1")).toBe("/results?tab=1");
    expect(sanitizeReturnPath("//evil.example")).toBe("/");
    expect(sanitizeReturnPath("https://evil.example")).toBe("/");
    expect(sanitizeReturnPath("/%2f%2fevil.example")).toBe("/");
    expect(sanitizeReturnPath("%252F%252Fevil.example")).toBe("/");
    expect(sanitizeReturnPath("\\\\evil.example")).toBe("/");
    expect(sanitizeReturnPath("/\\evil.example")).toBe("/");
  });
});

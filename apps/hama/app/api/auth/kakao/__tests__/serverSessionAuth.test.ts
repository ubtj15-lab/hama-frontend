import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { HAMA_SESSION_COOKIE, HAMA_USER_ID_COOKIE } from "@/lib/server/authCookies";
import { HAMA_KAKAO_OAUTH_COOKIE, resetOAuthStateReuseForTests, sealOAuthState } from "@/lib/server/kakaoOAuthState";
import { hashSessionToken } from "@/lib/server/verifiedSession";
import { GET as kakaoCallback } from "../callback/route";
import { GET as kakaoLogout } from "../logout/route";
import { GET as me } from "../../../me/route";

type Filter = { col: string; val: unknown; op: "eq" | "is" };
type UserRow = { id: string; kakao_id: string; nickname: string; role: string };
type SessionRow = {
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
};

const harness = vi.hoisted(() => {
  const state = {
    users: [] as UserRow[],
    sessions: [] as SessionRow[],
    sessionWriteError: null as string | null,
    userSeq: 1,
  };

  function matches(row: Record<string, unknown>, filters: Filter[]) {
    return filters.every((filter) => {
      if (filter.op === "is") {
        return filter.val === null ? row[filter.col] == null : row[filter.col] === filter.val;
      }
      return row[filter.col] === filter.val;
    });
  }

  function finish(table: string, op: "select" | "insert" | "update", payload: Record<string, unknown> | null, filters: Filter[]) {
    if (table === "users" && op === "insert" && payload) {
      const row: UserRow = {
        id: `user-${state.userSeq++}`,
        kakao_id: String(payload.kakao_id),
        nickname: String(payload.nickname ?? ""),
        role: String(payload.role ?? "consumer"),
      };
      state.users.push(row);
      return { data: { id: row.id }, error: null };
    }
    if (table === "users" && op === "update" && payload) {
      const row = state.users.find((item) => matches(item, filters));
      if (row) Object.assign(row, payload);
      return { data: null, error: null };
    }
    if (table === "users" && op === "select") {
      const row = state.users.find((item) => matches(item, filters)) ?? null;
      return { data: row, error: null };
    }
    if (table === "hama_sessions" && op === "insert" && payload) {
      if (state.sessionWriteError) {
        return { data: null, error: { message: state.sessionWriteError, code: "session_write_failed" } };
      }
      state.sessions.push({
        user_id: String(payload.user_id),
        token_hash: String(payload.token_hash),
        expires_at: String(payload.expires_at),
        revoked_at: null,
      });
      return { data: null, error: null };
    }
    if (table === "hama_sessions" && op === "update" && payload) {
      for (const row of state.sessions) {
        if (matches(row, filters)) Object.assign(row, payload);
      }
      return { data: null, error: null };
    }
    if (table === "hama_sessions" && op === "select") {
      const row = state.sessions.find((item) => matches(item, filters)) ?? null;
      return { data: row, error: null };
    }
    return { data: null, error: { message: `unexpected ${table} ${op}`, code: "test_fake" } };
  }

  function from(table: string) {
    let op: "select" | "insert" | "update" = "select";
    let payload: Record<string, unknown> | null = null;
    const filters: Filter[] = [];
    const builder = {
      select() {
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push({ col, val, op: "eq" });
        return builder;
      },
      is(col: string, val: unknown) {
        filters.push({ col, val, op: "is" });
        return builder;
      },
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
        return Promise.resolve(finish(table, op, payload, filters));
      },
      single() {
        return Promise.resolve(finish(table, op, payload, filters));
      },
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(finish(table, op, payload, filters)).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  return {
    state,
    reset() {
      state.users = [];
      state.sessions = [];
      state.sessionWriteError = null;
      state.userSeq = 1;
    },
    admin() {
      return { from };
    },
  };
});

vi.mock("@/lib/server/supabaseAdmin", () => ({
  getSupabaseAdmin: () => harness.admin(),
}));

function callbackRequest(query = "", cookie = ""): NextRequest {
  const headers = new Headers({ host: "localhost:3000" });
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(`http://localhost:3000/api/auth/kakao/callback${query}`, { headers });
}

function callbackWithState(returnTo: string, code?: string): NextRequest {
  const issued = sealOAuthState(returnTo);
  const params = new URLSearchParams({ state: issued.state });
  if (code !== undefined) params.set("code", code);
  return callbackRequest(`?${params.toString()}`, `${HAMA_KAKAO_OAUTH_COOKIE}=${issued.cookie}`);
}

function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function setCookieLines(res: Response): string[] {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const single = res.headers.get("set-cookie");
  return single ? [single] : [];
}

function cookieValue(res: Response, name: string): string | null {
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
        return new Response(
          JSON.stringify({
            id: 4242,
            kakao_account: { profile: { nickname: "하마테스터" } },
          }),
          { status: 200 }
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    })
  );
}

describe("kakao server session", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});

  beforeEach(() => {
    harness.reset();
    resetOAuthStateReuseForTests();
    consoleError.mockClear();
    consoleInfo.mockClear();
    vi.stubEnv("KAKAO_REST_API_KEY", "test-kakao-rest-key");
    vi.stubEnv("KAKAO_CLIENT_SECRET", "");
    vi.stubEnv("KAKAO_REDIRECT_URI", "http://localhost:3000/api/auth/kakao/callback");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_URL", "");
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

  it("issues an httpOnly session after kakao verification and returns the safe path", async () => {
    kakaoSuccess();
    const res = await kakaoCallback(callbackWithState("/results", "test-code"));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get("location")).toBe("http://localhost:3000/results");

    const lines = setCookieLines(res);
    const sessionLine = lines.find((line) => line.startsWith(`${HAMA_SESSION_COOKIE}=`));
    expect(sessionLine).toMatch(/HttpOnly/i);
    expect(sessionLine).toMatch(/SameSite=lax/i);
    expect(sessionLine).toMatch(/Path=\//);
    expect(lines.join("\n")).not.toContain(`${HAMA_USER_ID_COOKIE}=`);
    expect(lines.join("\n")).not.toContain("hama_kakao_id=");

    const token = cookieValue(res, HAMA_SESSION_COOKIE);
    expect(token).toBeTruthy();
    expect(harness.state.sessions).toHaveLength(1);
    expect(harness.state.sessions[0].token_hash).toBe(hashSessionToken(token!));
    expect(JSON.stringify(harness.state.sessions[0])).not.toContain(token!);
    expect(loggedText()).not.toContain(token!);
    expect(loggedText()).not.toContain("kakao-access-test");
    expect(loggedText()).not.toContain("test-code");

    const meRes = await me(
      new NextRequest("http://localhost:3000/api/me", {
        headers: { cookie: cookieHeader({ [HAMA_SESSION_COOKIE]: token! }) },
      })
    );
    await expect(meRes.json()).resolves.toEqual({
      user: { id: "user-1", nickname: "하마테스터", points: 0 },
    });
  });

  it("rejects an external oauth state that is not bound to this browser", async () => {
    kakaoSuccess();
    const res = await kakaoCallback(callbackRequest("?code=test-code&state=https%3A%2F%2Fevil.example%2Fphish"));
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("login=failed");
    expect(location).toContain("reason=state_missing");
    expect(location).not.toContain("evil.example");
    expect(cookieValue(res, HAMA_SESSION_COOKIE)).toBeNull();
    expect(harness.state.sessions).toHaveLength(0);
  });

  it("fails login when kakao rejects the code and does not issue a session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }))
    );
    const res = await kakaoCallback(callbackWithState("/", "bad-code"));
    expect(res.headers.get("location")).toContain("login=failed");
    expect(res.headers.get("location")).toContain("reason=token_request_failed");
    expect(setCookieLines(res).join("\n")).not.toContain(HAMA_SESSION_COOKIE);
    expect(harness.state.sessions).toHaveLength(0);
    expect(harness.state.users).toHaveLength(0);
  });

  it("fails login when the authorization code is missing", async () => {
    const res = await kakaoCallback(callbackWithState("/", ""));
    expect(res.headers.get("location")).toContain("reason=missing_code");
    const bare = await kakaoCallback(callbackRequest(""));
    expect(bare.headers.get("location")).toContain("reason=state_missing");
    expect(harness.state.sessions).toHaveLength(0);
  });

  it("fails login when session issuance fails and does not fall back to a user id cookie", async () => {
    kakaoSuccess();
    harness.state.sessionWriteError = "insert rejected";
    const res = await kakaoCallback(callbackWithState("/", "test-code"));
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("login=failed");
    expect(location).toContain("reason=session_unavailable");
    const lines = setCookieLines(res).join("\n");
    expect(lines).not.toContain(`${HAMA_SESSION_COOKIE}=`);
    expect(lines).not.toContain(`${HAMA_USER_ID_COOKIE}=`);
    expect(harness.state.users).toHaveLength(1);
    expect(harness.state.sessions).toHaveLength(0);
  });

  it("rejects a tampered session cookie even when a user id cookie is present", async () => {
    kakaoSuccess();
    const login = await kakaoCallback(callbackWithState("/", "test-code"));
    const meRes = await me(
      new NextRequest("http://localhost:3000/api/me", {
        headers: {
          cookie: cookieHeader({
            [HAMA_SESSION_COOKIE]: "tampered-token",
            [HAMA_USER_ID_COOKIE]: harness.state.users[0].id,
          }),
        },
      })
    );
    expect(cookieValue(login, HAMA_SESSION_COOKIE)).not.toBe("tampered-token");
    await expect(meRes.json()).resolves.toEqual({ user: null });
  });

  it("rejects an expired session", async () => {
    kakaoSuccess();
    const login = await kakaoCallback(callbackWithState("/", "test-code"));
    const token = cookieValue(login, HAMA_SESSION_COOKIE)!;
    harness.state.sessions[0].expires_at = new Date(Date.now() - 1000).toISOString();
    const meRes = await me(
      new NextRequest("http://localhost:3000/api/me", {
        headers: {
          cookie: cookieHeader({
            [HAMA_SESSION_COOKIE]: token,
            [HAMA_USER_ID_COOKIE]: harness.state.users[0].id,
          }),
        },
      })
    );
    await expect(meRes.json()).resolves.toEqual({ user: null });
  });

  it("revokes the server session on logout so the old cookie cannot be reused", async () => {
    kakaoSuccess();
    const login = await kakaoCallback(callbackWithState("/", "test-code"));
    const token = cookieValue(login, HAMA_SESSION_COOKIE)!;
    const logout = await kakaoLogout(
      new NextRequest("http://localhost:3000/api/auth/kakao/logout", {
        headers: {
          host: "localhost:3000",
          cookie: cookieHeader({ [HAMA_SESSION_COOKIE]: token }),
        },
      })
    );
    expect(logout.headers.get("location")).toContain("https://kauth.kakao.com/oauth/logout");
    expect(logout.headers.get("location")).not.toContain(token);
    const cleared = setCookieLines(logout).find((line) => line.startsWith(`${HAMA_SESSION_COOKIE}=`));
    expect(cleared).toMatch(/Max-Age=0/i);
    expect(harness.state.sessions[0].revoked_at).toBeTruthy();

    const meRes = await me(
      new NextRequest("http://localhost:3000/api/me", {
        headers: { cookie: cookieHeader({ [HAMA_SESSION_COOKIE]: token }) },
      })
    );
    await expect(meRes.json()).resolves.toEqual({ user: null });
    expect(loggedText()).not.toContain(token);
  });
});

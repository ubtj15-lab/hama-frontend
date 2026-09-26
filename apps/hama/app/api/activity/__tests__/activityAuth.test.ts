import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { HAMA_SESSION_COOKIE, HAMA_USER_ID_COOKIE } from "@/lib/server/authCookies";
import { hashSessionToken } from "@/lib/server/verifiedSession";
import { POST as logPost, GET as logGet } from "../../log/route";
import { POST as eventsPost } from "../../events/route";
import { POST as backfillPost } from "../../auth/backfill-events/route";
import { POST as mockPayPost } from "../../hama-pay/mock-complete/route";
import { GET as profileGet, PUT as profilePut } from "../../users/me/profile/route";
import { POST as recommendationPost } from "../../recommendation/log/route";
import { POST as receiptPost } from "../../beta/receipt-verify/route";

type Filter = { col: string; val: unknown; op: "eq" };
type SessionRow = { user_id: string; token_hash: string; expires_at: string; revoked_at: string | null };

const harness = vi.hoisted(() => {
  const state = {
    sessions: [] as SessionRow[],
    users: [] as Array<{ id: string; user_profile: unknown }>,
    events: [] as Array<Record<string, unknown>>,
    hamaEvents: [] as Array<Record<string, unknown>>,
    recommendationEvents: [] as Array<Record<string, unknown>>,
    recommendations: [] as Array<Record<string, unknown>>,
    selectedPlaces: [] as Array<Record<string, unknown>>,
    receipts: [] as Array<Record<string, unknown>>,
    payWrites: 0,
    failEvents: false,
    failUsers: false,
  };

  function matches(row: Record<string, unknown>, filters: Filter[]) {
    return filters.every((filter) => row[filter.col] === filter.val);
  }

  function finish(table: string, op: string, payload: Record<string, unknown> | null, filters: Filter[], mode: "many" | "one") {
    if (table === "hama_sessions" && op === "select") {
      const row = state.sessions.find((item) => matches(item, filters)) ?? null;
      return { data: mode === "one" ? row : row ? [row] : [], error: null };
    }
    if (table === "users" && op === "select") {
      if (state.failUsers) return { data: null, error: { code: "users_read", message: "secret relation users" } };
      const row = state.users.find((item) => matches(item, filters)) ?? null;
      return { data: mode === "one" ? row : row ? [row] : [], error: null };
    }
    if (table === "users" && op === "update" && payload) {
      const row = state.users.find((item) => matches(item, filters));
      if (row) Object.assign(row, payload);
      return { data: row ? [row] : [], error: null };
    }
    if (table === "events" && op === "insert" && payload) {
      if (state.failEvents) return { data: null, error: { code: "events_write", message: "secret insert detail" } };
      const rows = Array.isArray(payload) ? payload : [payload];
      state.events.push(...rows);
      return { data: null, error: null };
    }
    if (table === "hama_events" && op === "insert" && payload) {
      if (state.failEvents) return { data: null, error: { code: "hama_events_write", message: "secret insert detail" } };
      state.hamaEvents.push(payload);
      return { data: null, error: null };
    }
    if (table === "recommendation_events" && op === "insert" && payload) {
      state.recommendationEvents.push(payload);
      return { data: null, error: null };
    }
    if (table === "recommendations" && op === "insert" && payload) {
      if (state.recommendations.some((row) => row.id === payload.id)) {
        return { data: null, error: { code: "23505", message: "duplicate key" } };
      }
      state.recommendations.push(payload);
      return { data: null, error: null };
    }
    if (table === "recommendations" && op === "select") {
      const row = state.recommendations.find((item) => matches(item, filters)) ?? null;
      return { data: mode === "one" ? row : row ? [row] : [], error: null };
    }
    if (table === "recommendations" && op === "update" && payload) {
      const rows = state.recommendations.filter((item) => matches(item, filters));
      for (const row of rows) Object.assign(row, payload);
      return { data: rows.map((row) => ({ id: row.id })), error: null };
    }
    if (table === "selected_place_logs" && op === "select") {
      const row = state.selectedPlaces.find((item) => matches(item, filters)) ?? null;
      return { data: row, error: null };
    }
    if (table === "receipt_verifications" && op === "insert" && payload) {
      state.receipts.push({ ...payload, id: "receipt-1" });
      return { data: { id: "receipt-1" }, error: null };
    }
    if (table === "hama_pay_transactions" || table === "beta_user_state") {
      state.payWrites += 1;
      return { data: null, error: { code: "should_not_write", message: "payment write" } };
    }
    return { data: null, error: { code: `unexpected_${table}_${op}`, message: "unexpected" } };
  }

  function from(table: string) {
    let op = "select";
    let payload: Record<string, unknown> | Record<string, unknown>[] | null = null;
    const filters: Filter[] = [];
    const builder = {
      select() {
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push({ col, val, op: "eq" });
        return builder;
      },
      insert(row: Record<string, unknown> | Record<string, unknown>[]) {
        op = "insert";
        payload = row as Record<string, unknown>;
        return builder;
      },
      update(row: Record<string, unknown>) {
        op = "update";
        payload = row;
        return builder;
      },
      maybeSingle() {
        return Promise.resolve(finish(table, op, payload as Record<string, unknown> | null, filters, "one"));
      },
      single() {
        return Promise.resolve(finish(table, op, payload as Record<string, unknown> | null, filters, "one"));
      },
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(finish(table, op, payload as Record<string, unknown> | null, filters, "many")).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  return {
    state,
    reset() {
      state.sessions = [];
      state.users = [{ id: "user-a", user_profile: { gender: "여성", companions: ["친구"] } }];
      state.events = [{ id: "anon-1", session_id: "browser-session", user_id: null, type: "page_view" }];
      state.hamaEvents = [];
      state.recommendationEvents = [];
      state.recommendations = [{ id: "rec-other", user_id: "user-b", metadata: { keep: true } }];
      state.selectedPlaces = [{ id: "place-log-a", user_id: "user-a", place_id: "store-a", place_name: "오산카페" }];
      state.receipts = [];
      state.payWrites = 0;
      state.failEvents = false;
      state.failUsers = false;
    },
    admin() {
      return {
        from,
        storage: {
          from() {
            return { upload: async () => ({ error: null }) };
          },
        },
      };
    },
  };
});

vi.mock("@/lib/server/supabaseAdmin", () => ({
  getSupabaseAdmin: () => harness.admin(),
}));

function sessionFor(userId: string, token: string, expiresAt = new Date(Date.now() + 60_000).toISOString()) {
  harness.state.sessions.push({
    user_id: userId,
    token_hash: hashSessionToken(token),
    expires_at: expiresAt,
    revoked_at: null,
  });
}

function jsonRequest(path: string, body: unknown, cookies: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join("; "),
    },
    body: JSON.stringify(body),
  });
}

describe("activity and profile session auth", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

  beforeEach(() => {
    harness.reset();
    consoleError.mockClear();
    consoleWarn.mockClear();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  });

  it("keeps anonymous product logs unattached and rejects forged user ids", async () => {
    const anonymous = await logPost(
      jsonRequest("/api/log", { type: "search_submit", user_id: "user-b", session_id: "browser-1", data: { query: "오산" } })
    );
    expect(anonymous.status).toBe(200);
    await expect(anonymous.json()).resolves.toEqual({ ok: true });
    expect(harness.state.events.at(-1)).toMatchObject({ user_id: null, type: "search_submit" });

    const rejected = await logPost(jsonRequest("/api/log", { type: "drop_table", data: {} }));
    expect(rejected.status).toBe(400);

    const event = await eventsPost(
      jsonRequest("/api/events", { event_name: "page_view", user_id: "user-b", source: "home" })
    );
    expect(event.status).toBe(200);
    expect(harness.state.hamaEvents[0]).toMatchObject({ user_id: null, event_name: "page_view" });

    const recommendation = await recommendationPost(
      jsonRequest("/api/recommendation/log", {
        event_name: "place_click",
        user_id: "user-b",
        session_id: "browser-1",
        entity_id: "store-a",
      })
    );
    expect(recommendation.status).toBe(200);
    expect(harness.state.recommendationEvents[0]).toMatchObject({ user_id: null, event_name: "place_click" });
    await expect(logGet()).resolves.toBeTruthy();
  });

  it("attaches logged-in activity only to the verified session", async () => {
    sessionFor("user-a", "token-a");
    const cookies = { [HAMA_SESSION_COOKIE]: "token-a", [HAMA_USER_ID_COOKIE]: "user-b" };
    const logged = await logPost(jsonRequest("/api/log", { type: "place_click", user_id: "user-b", data: { id: "store-a" } }, cookies));
    expect(logged.status).toBe(200);
    expect(harness.state.events.at(-1)).toMatchObject({ user_id: "user-a", type: "place_click" });
  });

  it("does not claim anonymous rows or another user's recommendation", async () => {
    sessionFor("user-a", "token-a");
    const cookies = { [HAMA_SESSION_COOKIE]: "token-a" };
    const backfill = await backfillPost(
      jsonRequest("/api/auth/backfill-events", { session_id: "browser-session", user_id: "user-b", kakao_id: "kakao-b" }, cookies)
    );
    expect(backfill.status).toBe(403);
    expect(harness.state.events[0]).toMatchObject({ id: "anon-1", user_id: null });

    const stolen = await recommendationPost(
      jsonRequest(
        "/api/recommendation/log",
        {
          event_name: "recommendation_impression",
          user_id: "user-b",
          session_id: "browser-1",
          analytics_v2: { recommendation_id: "rec-other", shown_place_ids: ["store-a"] },
        },
        cookies
      )
    );
    expect(stolen.status).toBe(500);
    expect(harness.state.recommendations[0]).toMatchObject({ user_id: "user-b", metadata: { keep: true } });
  });

  it("returns database failures without internal error text", async () => {
    const cookies = { [HAMA_SESSION_COOKIE]: "token-a" };
    sessionFor("user-a", "token-a");
    harness.state.failEvents = true;
    const failed = await logPost(jsonRequest("/api/log", { type: "page_view", data: {} }, cookies));
    expect(failed.status).toBe(500);
    const body = await failed.json();
    expect(body).toEqual({ ok: false, error: "event_write_failed" });
    expect(JSON.stringify(body)).not.toContain("secret");

    harness.state.failUsers = true;
    const profile = await profileGet(
      new NextRequest("http://localhost:3000/api/users/me/profile", { headers: { cookie: `${HAMA_SESSION_COOKIE}=token-a` } })
    );
    expect(profile.status).toBe(500);
    expect(JSON.stringify(await profile.json())).not.toContain("secret");
  });

  it("loads and saves only the verified profile", async () => {
    sessionFor("user-a", "token-a");
    const cookies = { cookie: `${HAMA_SESSION_COOKIE}=token-a; ${HAMA_USER_ID_COOKIE}=user-b` };
    const loaded = await profileGet(new NextRequest("http://localhost:3000/api/users/me/profile", { headers: cookies }));
    expect(loaded.status).toBe(200);
    await expect(loaded.json()).resolves.toMatchObject({ ok: true, user_id: "user-a" });

    const saved = await profilePut(
      jsonRequest("/api/users/me/profile", { user_id: "user-b", gender: "남성", companions: ["가족"] }, {
        [HAMA_SESSION_COOKIE]: "token-a",
        [HAMA_USER_ID_COOKIE]: "user-b",
      })
    );
    expect(saved.status).toBe(200);
    expect(harness.state.users.find((user) => user.id === "user-b")).toBeUndefined();
    expect(harness.state.users[0].user_profile).toMatchObject({ gender: "남성" });

    const missing = await profileGet(new NextRequest("http://localhost:3000/api/users/me/profile"));
    expect(missing.status).toBe(401);
    sessionFor("user-a", "expired", new Date(Date.now() - 1000).toISOString());
    const expired = await profileGet(
      new NextRequest("http://localhost:3000/api/users/me/profile", {
        headers: { cookie: `${HAMA_SESSION_COOKIE}=expired` },
      })
    );
    expect(expired.status).toBe(401);
  });

  it("does not record a mock payment as a completed transaction", async () => {
    sessionFor("user-a", "token-a");
    const res = await mockPayPost();
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "payment_not_verified" });
    expect(harness.state.payWrites).toBe(0);
  });

  it("accepts a logged-in receipt only for that user's selected place", async () => {
    sessionFor("user-a", "token-a");
    const form = new FormData();
    form.set("selected_place_log_id", "place-log-a");
    form.set("user_id", "user-b");
    form.set("receipt_place_name", "오산카페");
    form.set("receipt_image", new Blob([Uint8Array.from([1, 2, 3])], { type: "image/png" }));
    const ok = await receiptPost(
      new NextRequest("http://localhost:3000/api/beta/receipt-verify", {
        method: "POST",
        headers: { cookie: `${HAMA_SESSION_COOKIE}=token-a; ${HAMA_USER_ID_COOKIE}=user-b` },
        body: form,
      })
    );
    expect(ok.status).toBe(200);
    await expect(ok.json()).resolves.toMatchObject({ ok: true, matched: true, selected_place_log_id: "place-log-a" });
    expect(harness.state.receipts[0]).toMatchObject({ user_id: "user-a" });

    const denied = await receiptPost(new NextRequest("http://localhost:3000/api/beta/receipt-verify", { method: "POST", body: new FormData() }));
    expect(denied.status).toBe(401);
    await expect(denied.json()).resolves.toEqual({ ok: false, error: "LOGIN_REQUIRED" });
  });
});

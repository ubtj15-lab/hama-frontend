import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { HAMA_SESSION_COOKIE, HAMA_USER_ID_COOKIE } from "@/lib/server/authCookies";
import { hashSessionToken } from "@/lib/server/verifiedSession";
import { GET as savedGet, POST as savedPost } from "../route";
import { GET as recentGet } from "../../recent/route";
import { POST as recentRecord } from "../../recent/record/route";

type Filter = { col: string; val: unknown; op: "eq" | "in" };
type SavedRow = { id: string; user_id: string; store_id: string; created_at: string };
type RecentRow = { user_id: string; store_id: string; viewed_at: string };
type StoreRow = { id: string; name: string; area: string; address: string };
type SessionRow = { user_id: string; token_hash: string; expires_at: string; revoked_at: string | null };

const harness = vi.hoisted(() => {
  const state = {
    saved: [] as SavedRow[],
    recent: [] as RecentRow[],
    stores: [] as StoreRow[],
    sessions: [] as SessionRow[],
    savedSeq: 1,
    failSavedRead: false,
    failSavedWrite: false,
    failRecentRead: false,
    failRecentWrite: false,
    failStoresRead: false,
  };

  function matches(row: Record<string, unknown>, filters: Filter[]) {
    return filters.every((filter) => {
      if (filter.op === "in") return Array.isArray(filter.val) && filter.val.includes(row[filter.col]);
      return row[filter.col] === filter.val;
    });
  }

  function fail(code: string) {
    return { data: null, error: { code, message: code } };
  }

  function finish(
    table: string,
    op: "select" | "insert" | "delete" | "upsert",
    payload: Record<string, unknown> | null,
    filters: Filter[],
    mode: "many" | "one"
  ) {
    if (table === "hama_sessions" && op === "select") {
      const row = state.sessions.find((item) => matches(item, filters)) ?? null;
      return { data: mode === "one" ? row : row ? [row] : [], error: null };
    }
    if (table === "saved" && op === "select") {
      if (state.failSavedRead) return fail("saved_read");
      const rows = state.saved
        .filter((item) => matches(item, filters))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      return { data: mode === "one" ? rows[0] ?? null : rows, error: null };
    }
    if (table === "saved" && op === "insert" && payload) {
      if (state.failSavedWrite) return fail("saved_write");
      state.saved.push({
        id: `saved-${state.savedSeq++}`,
        user_id: String(payload.user_id),
        store_id: String(payload.store_id),
        created_at: new Date().toISOString(),
      });
      return { data: null, error: null };
    }
    if (table === "saved" && op === "delete") {
      if (state.failSavedWrite) return fail("saved_write");
      state.saved = state.saved.filter((item) => !matches(item, filters));
      return { data: null, error: null };
    }
    if (table === "recent_views" && op === "select") {
      if (state.failRecentRead) return fail("recent_read");
      const rows = state.recent
        .filter((item) => matches(item, filters))
        .sort((a, b) => b.viewed_at.localeCompare(a.viewed_at));
      return { data: rows, error: null };
    }
    if (table === "recent_views" && op === "upsert" && payload) {
      if (state.failRecentWrite) return fail("recent_write");
      const userId = String(payload.user_id);
      const storeId = String(payload.store_id);
      const existing = state.recent.find((item) => item.user_id === userId && item.store_id === storeId);
      if (existing) existing.viewed_at = String(payload.viewed_at);
      else state.recent.push({ user_id: userId, store_id: storeId, viewed_at: String(payload.viewed_at) });
      return { data: null, error: null };
    }
    if (table === "stores" && op === "select") {
      if (state.failStoresRead) return fail("stores_read");
      const rows = state.stores.filter((item) => matches(item, filters));
      return { data: rows, error: null };
    }
    return fail(`unexpected_${table}_${op}`);
  }

  function from(table: string) {
    let op: "select" | "insert" | "delete" | "upsert" = "select";
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
      in(col: string, val: unknown[]) {
        filters.push({ col, val, op: "in" });
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      insert(row: Record<string, unknown>) {
        op = "insert";
        payload = row;
        return builder;
      },
      delete() {
        op = "delete";
        return builder;
      },
      upsert(row: Record<string, unknown>) {
        op = "upsert";
        payload = row;
        return builder;
      },
      maybeSingle() {
        return Promise.resolve(finish(table, op, payload, filters, "one"));
      },
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(finish(table, op, payload, filters, "many")).then(onFulfilled, onRejected);
      },
    };
    return builder;
  }

  return {
    state,
    reset() {
      state.saved = [];
      state.recent = [];
      state.stores = [
        { id: "store-a", name: "오산카페", area: "오산", address: "오산시" },
        { id: "store-b", name: "평택식당", area: "평택", address: "평택시" },
      ];
      state.sessions = [];
      state.savedSeq = 1;
      state.failSavedRead = false;
      state.failSavedWrite = false;
      state.failRecentRead = false;
      state.failRecentWrite = false;
      state.failStoresRead = false;
    },
    admin() {
      return { from };
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

function request(path: string, cookies: Record<string, string> = {}, body?: unknown) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      cookie: Object.entries(cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join("; "),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("saved and recent session scope", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    harness.reset();
    consoleError.mockClear();
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  });

  it("rejects a missing session without reading another user's rows", async () => {
    harness.state.saved.push({
      id: "saved-other",
      user_id: "user-b",
      store_id: "store-b",
      created_at: "2026-09-26T00:00:00.000Z",
    });
    const saved = await savedGet(request("/api/saved?user_id=user-b"));
    const recent = await recentGet(request("/api/recent?user_id=user-b"));
    const recorded = await recentRecord(request("/api/recent/record", {}, { user_id: "user-b", store_id: "store-b" }));
    expect(saved.status).toBe(401);
    expect(recent.status).toBe(401);
    expect(recorded.status).toBe(401);
    expect(harness.state.saved).toHaveLength(1);
    expect(harness.state.recent).toHaveLength(0);
    await expect(saved.json()).resolves.toEqual({ error: "unauthorized" });
    await expect(recorded.json()).resolves.toEqual({ ok: false, error: "unauthorized" });
  });

  it("rejects an expired session and a forged user id cookie", async () => {
    sessionFor("user-a", "token-a", new Date(Date.now() - 1000).toISOString());
    const res = await savedGet(
      request("/api/saved", {
        [HAMA_SESSION_COOKIE]: "token-a",
        [HAMA_USER_ID_COOKIE]: "user-b",
      })
    );
    expect(res.status).toBe(401);
  });

  it("lists, saves, and removes only the verified user's places", async () => {
    sessionFor("user-a", "token-a");
    harness.state.saved.push({
      id: "saved-b",
      user_id: "user-b",
      store_id: "store-b",
      created_at: "2026-09-26T00:00:00.000Z",
    });
    const cookies = { [HAMA_SESSION_COOKIE]: "token-a", [HAMA_USER_ID_COOKIE]: "user-b" };

    const created = await savedPost(request("/api/saved", cookies, { user_id: "user-b", store_id: "store-a" }));
    expect(created.status).toBe(200);
    await expect(created.json()).resolves.toEqual({ ok: true, saved: true });
    expect(harness.state.saved.map((row) => `${row.user_id}:${row.store_id}`).sort()).toEqual([
      "user-a:store-a",
      "user-b:store-b",
    ]);

    const listed = await savedGet(request("/api/saved?user_id=user-b", cookies));
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toEqual({
      saved_ids: ["store-a"],
      stores: [harness.state.stores[0]],
    });

    const removed = await savedPost(request("/api/saved", cookies, { user_id: "user-b", store_id: "store-a" }));
    await expect(removed.json()).resolves.toEqual({ ok: true, saved: false });
    expect(harness.state.saved.map((row) => row.user_id)).toEqual(["user-b"]);
  });

  it("records and lists recent views for the verified user only", async () => {
    sessionFor("user-a", "token-a");
    harness.state.recent.push({
      user_id: "user-b",
      store_id: "store-b",
      viewed_at: "2026-09-26T00:00:00.000Z",
    });
    const cookies = { [HAMA_SESSION_COOKIE]: "token-a" };
    const recorded = await recentRecord(request("/api/recent/record", cookies, { user_id: "user-b", store_id: "store-a" }));
    expect(recorded.status).toBe(200);
    await expect(recorded.json()).resolves.toEqual({ ok: true });
    expect(harness.state.recent.map((row) => `${row.user_id}:${row.store_id}`).sort()).toEqual([
      "user-a:store-a",
      "user-b:store-b",
    ]);

    const listed = await recentGet(request("/api/recent?user_id=user-b&limit=20", cookies));
    await expect(listed.json()).resolves.toEqual({
      store_ids: ["store-a"],
      stores: [harness.state.stores[0]],
    });
  });

  it("returns database failures instead of an empty success", async () => {
    sessionFor("user-a", "token-a");
    const cookies = { [HAMA_SESSION_COOKIE]: "token-a" };
    harness.state.failSavedRead = true;
    const saved = await savedGet(request("/api/saved", cookies));
    expect(saved.status).toBe(500);
    await expect(saved.json()).resolves.toEqual({ error: "saved_read_failed" });

    harness.state.failSavedRead = false;
    harness.state.failSavedWrite = true;
    const write = await savedPost(request("/api/saved", cookies, { store_id: "store-a" }));
    expect(write.status).toBe(500);
    await expect(write.json()).resolves.toEqual({ ok: false, error: "saved_write_failed" });

    harness.state.failRecentRead = true;
    const recent = await recentGet(request("/api/recent", cookies));
    expect(recent.status).toBe(500);
    await expect(recent.json()).resolves.toEqual({ error: "recent_read_failed" });

    harness.state.failRecentWrite = true;
    const recorded = await recentRecord(request("/api/recent/record", cookies, { store_id: "store-a" }));
    expect(recorded.status).toBe(500);
    await expect(recorded.json()).resolves.toEqual({ ok: false, error: "recent_write_failed" });
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest, NextResponse } from "next/server";
import { HAMA_SESSION_COOKIE, HAMA_USER_ID_COOKIE } from "../authCookies";
import {
  createSessionToken,
  evaluateSession,
  getVerifiedUserId,
  hashSessionToken,
  issueServerSession,
  revokeServerSession,
  sessionTokensMatch,
  setSessionCookie,
  type SessionRecord,
} from "../verifiedSession";
import { getUserIdFromAuthCookie, resolveUserIdFromRequest } from "../userResolver";

const now = new Date("2026-09-26T04:00:00.000Z");

const harness = vi.hoisted(() => ({
  admin: null as null | { from: (table: string) => unknown },
}));

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: () => harness.admin,
}));

function record(partial: Partial<SessionRecord> = {}): SessionRecord {
  return {
    userId: "user-a",
    expiresAt: new Date(now.getTime() + 60_000),
    revokedAt: null,
    ...partial,
  };
}

function requestWith(cookies: Record<string, string>): NextRequest {
  return {
    cookies: {
      get(name: string) {
        const value = cookies[name];
        return value === undefined ? undefined : { name, value };
      },
    },
  } as NextRequest;
}

type QueryResult = { data?: unknown; error?: { message: string } | null };

function installAdmin(result: QueryResult = { data: null, error: null }) {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  const filters: Array<{ op: string; args: unknown[] }> = [];
  const builder = {
    select() {
      return builder;
    },
    eq(...args: unknown[]) {
      filters.push({ op: "eq", args });
      return builder;
    },
    is(...args: unknown[]) {
      filters.push({ op: "is", args });
      return Promise.resolve({ error: result.error ?? null });
    },
    insert(row: unknown) {
      inserts.push(row);
      return Promise.resolve({ error: result.error ?? null });
    },
    update(row: unknown) {
      updates.push(row);
      return builder;
    },
    maybeSingle() {
      return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
    },
  };
  const client = {
    from(table: string) {
      filters.push({ op: "from", args: [table] });
      return builder;
    },
  };
  harness.admin = client;
  return { inserts, updates, filters, client };
}

describe("verified server session", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
  const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});

  beforeEach(() => {
    harness.admin = null;
    consoleError.mockClear();
    consoleLog.mockClear();
    consoleInfo.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts only an unexpired unrevoked session and ignores any other identity", () => {
    expect(evaluateSession(record(), now)).toEqual({ ok: true, userId: "user-a" });
    expect(evaluateSession(null, now)).toEqual({ ok: false, reason: "missing" });
    expect(evaluateSession(record({ expiresAt: now }), now)).toEqual({ ok: false, reason: "expired" });
    expect(evaluateSession(record({ expiresAt: new Date("not-a-date") }), now)).toEqual({
      ok: false,
      reason: "expired",
    });
    expect(evaluateSession(record({ revokedAt: now }), now)).toEqual({ ok: false, reason: "revoked" });
  });

  it("stores only a sha256 hash of a random token", () => {
    const token = createSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(createSessionToken()).not.toBe(token);
    const hash = hashSessionToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(token);
    expect(sessionTokensMatch(hash, token)).toBe(true);
    expect(sessionTokensMatch(hash, "claimed-by-b")).toBe(false);
    expect(sessionTokensMatch("short", token)).toBe(false);
  });

  it("fails closed when the session cookie, admin client, or database is unavailable", async () => {
    const db = installAdmin();
    await expect(getVerifiedUserId(requestWith({ [HAMA_USER_ID_COOKIE]: "user-a" }))).resolves.toBeNull();
    expect(db.filters).toEqual([]);

    harness.admin = null;
    await expect(
      getVerifiedUserId(requestWith({ [HAMA_SESSION_COOKIE]: "presented-token" }))
    ).resolves.toBeNull();

    installAdmin({ error: { message: "permission denied for hama_sessions" } });
    await expect(
      getVerifiedUserId(requestWith({ [HAMA_SESSION_COOKIE]: "presented-token" }))
    ).resolves.toBeNull();

    harness.admin = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle() {
            return Promise.reject(new Error("connection reset"));
          },
        };
      },
    };
    await expect(
      getVerifiedUserId(requestWith({ [HAMA_SESSION_COOKIE]: "presented-token" }))
    ).resolves.toBeNull();
  });

  it("rejects expired, revoked, and mismatched tokens without trusting a user id cookie", async () => {
    const token = "owned-by-a";
    const tokenHash = hashSessionToken(token);
    const req = requestWith({
      [HAMA_SESSION_COOKIE]: token,
      [HAMA_USER_ID_COOKIE]: "someone-else",
    });

    installAdmin({
      data: {
        user_id: "user-a",
        expires_at: new Date(Date.now() - 1000).toISOString(),
        revoked_at: null,
        token_hash: tokenHash,
      },
    });
    await expect(getVerifiedUserId(req)).resolves.toBeNull();

    installAdmin({
      data: {
        user_id: "user-a",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        revoked_at: new Date().toISOString(),
        token_hash: tokenHash,
      },
    });
    await expect(getVerifiedUserId(req)).resolves.toBeNull();

    installAdmin({
      data: {
        user_id: "user-a",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        revoked_at: null,
        token_hash: hashSessionToken("other-token"),
      },
    });
    await expect(getVerifiedUserId(req)).resolves.toBeNull();
  });

  it("returns the session user when the stored hash matches an active row", async () => {
    const token = "owned-by-a";
    const db = installAdmin({
      data: {
        user_id: "user-a",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        revoked_at: null,
        token_hash: hashSessionToken(token),
      },
    });
    await expect(
      getVerifiedUserId(
        requestWith({
          [HAMA_SESSION_COOKIE]: token,
          [HAMA_USER_ID_COOKIE]: "forged-user",
        })
      )
    ).resolves.toBe("user-a");
    expect(db.filters).toContainEqual({ op: "from", args: ["hama_sessions"] });
    expect(db.filters).toContainEqual({ op: "eq", args: ["token_hash", hashSessionToken(token)] });
  });

  it("inserts the token hash through the admin client and returns null on write failure", async () => {
    const db = installAdmin();
    const issued = await issueServerSession("user-a");
    expect(issued).not.toBeNull();
    const row = db.inserts[0] as { user_id: string; token_hash: string; expires_at: string };
    expect(row.user_id).toBe("user-a");
    expect(row.token_hash).toBe(hashSessionToken(issued!.token));
    expect(row.token_hash).not.toBe(issued!.token);
    expect(JSON.stringify(row)).not.toContain(issued!.token);

    installAdmin({ error: { message: "relation hama_sessions does not exist" } });
    await expect(issueServerSession("user-a")).resolves.toBeNull();
    harness.admin = null;
    await expect(issueServerSession("user-a")).resolves.toBeNull();
    await expect(issueServerSession("  ")).resolves.toBeNull();
  });

  it("revokes by token hash and ignores a missing or failed admin client", async () => {
    const token = "owned-by-a";
    const db = installAdmin();
    await revokeServerSession(requestWith({ [HAMA_SESSION_COOKIE]: token }));
    expect(db.updates[0]).toMatchObject({ revoked_at: expect.any(String) });
    expect(db.filters).toContainEqual({ op: "eq", args: ["token_hash", hashSessionToken(token)] });
    expect(JSON.stringify(db.filters)).not.toContain(token);

    harness.admin = null;
    await expect(revokeServerSession(requestWith({ [HAMA_SESSION_COOKIE]: token }))).resolves.toBeUndefined();
    await expect(revokeServerSession(requestWith({}))).resolves.toBeUndefined();
  });

  it("sets an httpOnly session cookie with path, samesite, and max-age", () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const set = vi.fn();
    setSessionCookie({ cookies: { set } } as unknown as NextResponse, "raw-token", expiresAt);
    expect(set).toHaveBeenCalledWith(
      HAMA_SESSION_COOKIE,
      "raw-token",
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
        expires: expiresAt,
      })
    );
    const maxAge = set.mock.calls[0][2].maxAge as number;
    expect(maxAge).toBeGreaterThanOrEqual(59);
    expect(maxAge).toBeLessThanOrEqual(60);

    vi.stubEnv("NODE_ENV", "production");
    setSessionCookie({ cookies: { set } } as unknown as NextResponse, "raw-token", expiresAt);
    expect(set.mock.calls[1][2].secure).toBe(true);
  });

  it("does not treat a legacy user id cookie or request user id as a session", async () => {
    installAdmin({
      data: {
        user_id: "should-not-load",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        revoked_at: null,
        token_hash: hashSessionToken("unused"),
      },
    });
    const req = requestWith({ [HAMA_USER_ID_COOKIE]: "user-from-cookie" });
    expect(getUserIdFromAuthCookie(req)).toBeNull();
    await expect(resolveUserIdFromRequest(req, "user-from-body")).resolves.toBeNull();
  });

  it("does not log the session token or service credentials", async () => {
    installAdmin();
    const issued = await issueServerSession("user-a");
    await getVerifiedUserId(requestWith({ [HAMA_SESSION_COOKIE]: issued!.token }));
    await revokeServerSession(requestWith({ [HAMA_SESSION_COOKIE]: issued!.token }));
    const logged = [...consoleError.mock.calls, ...consoleLog.mock.calls, ...consoleInfo.mock.calls]
      .flat()
      .map((part) => String(part))
      .join("\n");
    expect(logged).not.toContain(issued!.token);
    expect(logged).not.toContain("service_role");
    expect(logged).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleInfo).not.toHaveBeenCalled();
  });
});

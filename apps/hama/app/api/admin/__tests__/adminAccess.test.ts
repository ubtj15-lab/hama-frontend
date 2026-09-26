import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HAMA_SESSION_COOKIE } from "@/lib/server/authCookies";
import { hashSessionToken, revokeServerSession } from "@/lib/server/verifiedSession";
import { GET as usersGet } from "../users/route";
import { GET as statsGet } from "../stats/route";
import { PATCH as storeOwnerPatch } from "../stores/[storeId]/route";
import { POST as recommendPost } from "../recommend-test/route";
import { GET as betaListGet } from "../beta-verifications/route";
import { PATCH as betaPatch } from "../beta-verifications/[verificationId]/route";
import { POST as receiptPost } from "../../beta/receipt-verify/route";
import { POST as feedbackPost } from "../../visit-feedback/route";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const PLACE_LOG_ID = "55555555-5555-4555-8555-555555555555";
const RECEIPT_ID = "44444444-4444-4444-8444-444444444444";
const REJECT_ID = "66666666-6666-4666-8666-666666666666";

const memory = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test";
  process.env.HAMA_ADMIN_USER_IDS = "11111111-1111-4111-8111-111111111111";
  const tables: Record<string, Record<string, unknown>[]> = {};
  const businessTables: string[] = [];
  let storageWrites = 0;

  function ensure(table: string) {
    if (!tables[table]) tables[table] = [];
    return tables[table];
  }

  function client() {
    return {
      from(table: string) {
        if (table !== "hama_sessions") businessTables.push(table);
        const rows = ensure(table);
        const filters: Array<(row: Record<string, unknown>) => boolean> = [];
        let mode: "select" | "update" | "upsert" | "insert" = "select";
        let patch: Record<string, unknown> = {};
        let inserted: Record<string, unknown>[] = [];

        const matched = () => rows.filter((row) => filters.every((filter) => filter(row)));
        const finish = (one: boolean) => {
          if (mode === "update") {
            for (const row of matched()) Object.assign(row, patch);
            return { data: one ? matched()[0] ?? null : matched(), error: null, count: matched().length };
          }
          if (mode === "upsert") {
            const key = "user_id";
            const existing = rows.find((row) => String(row[key]) === String(patch[key]));
            if (existing) Object.assign(existing, patch);
            else rows.push({ ...patch });
            return { data: null, error: null, count: null };
          }
          if (mode === "insert") {
            return { data: one ? inserted[0] ?? null : inserted, error: null, count: inserted.length };
          }
          const data = matched();
          return { data: one ? data[0] ?? null : data, error: null, count: data.length };
        };

        const builder: Record<string, unknown> = {
          select: () => builder,
          eq: (column: string, value: unknown) => {
            filters.push((row) => String(row[column]) === String(value));
            return builder;
          },
          neq: (column: string, value: unknown) => {
            filters.push((row) => String(row[column]) !== String(value));
            return builder;
          },
          in: (column: string, values: unknown[]) => {
            const allowed = new Set(values.map((value) => String(value)));
            filters.push((row) => allowed.has(String(row[column])));
            return builder;
          },
          is: (column: string, value: unknown) => {
            filters.push((row) => (value === null ? row[column] == null : row[column] === value));
            return builder;
          },
          gte: () => builder,
          or: () => builder,
          order: () => builder,
          limit: () => builder,
          not: (column: string, operator: string, value: unknown) => {
            if (operator === "is" && value === null) filters.push((row) => row[column] != null);
            return builder;
          },
          ilike: (column: string, pattern: string) => {
            const needle = pattern.replace(/%/g, "").toLowerCase();
            filters.push((row) => String(row[column] ?? "").toLowerCase().includes(needle));
            return builder;
          },
          update: (next: Record<string, unknown>) => {
            mode = "update";
            patch = next;
            return builder;
          },
          upsert: (next: Record<string, unknown>) => {
            mode = "upsert";
            patch = next;
            return builder;
          },
          insert: (next: Record<string, unknown> | Record<string, unknown>[]) => {
            mode = "insert";
            inserted = (Array.isArray(next) ? next : [next]).map((row) => {
              const copy = { ...row };
              if (!copy.id) copy.id = crypto.randomUUID();
              rows.push(copy);
              return copy;
            });
            return builder;
          },
          maybeSingle: () => Promise.resolve(finish(true)),
          single: () => Promise.resolve(finish(true)),
          then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
            Promise.resolve(finish(false)).then(resolve, reject),
        };
        return builder;
      },
      storage: {
        from: () => ({
          upload: async () => {
            storageWrites += 1;
            return { error: null, data: { path: "mock" } };
          },
          remove: async () => ({ error: null }),
          createSignedUrl: async (path: string) => ({
            data: { signedUrl: `https://example.test/${path}` },
            error: null,
          }),
        }),
      },
    };
  }

  return {
    tables,
    businessTables,
    client,
    storageWrites: () => storageWrites,
    reset() {
      for (const key of Object.keys(tables)) delete tables[key];
      businessTables.length = 0;
      storageWrites = 0;
    },
  };
});

vi.mock("@/lib/server/supabaseAdmin", () => ({
  getSupabaseAdmin: () => memory.client(),
  createSupabaseAdmin: () => memory.client(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => memory.client(),
}));

function session(userId: string, token: string, expiresAt: string, revokedAt: string | null = null) {
  const rows = memory.tables.hama_sessions ?? (memory.tables.hama_sessions = []);
  rows.push({
    user_id: userId,
    token_hash: hashSessionToken(token),
    expires_at: expiresAt,
    revoked_at: revokedAt,
  });
}

function cookie(token: string, extra = ""): string {
  return `${HAMA_SESSION_COOKIE}=${token}${extra}`;
}

function request(pathname: string, method = "GET", headers?: HeadersInit, body?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${pathname}`, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" ? undefined : body,
  });
}

function adminHeaders(token: string, origin = true): Headers {
  const headers = new Headers({ cookie: cookie(token) });
  if (origin) headers.set("origin", "http://localhost:3000");
  headers.set("content-type", "application/json");
  return headers;
}

describe("admin access control", () => {
  const previousAllowlist = process.env.HAMA_ADMIN_USER_IDS;

  beforeEach(() => {
    memory.reset();
    process.env.HAMA_ADMIN_USER_IDS = ADMIN_ID;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-test";
    const future = new Date(Date.now() + 60_000).toISOString();
    session(ADMIN_ID, "admin-token", future);
    session(USER_ID, "user-token", future);
    session(USER_ID, "expired-token", new Date(Date.now() - 60_000).toISOString());
    memory.tables.users = [
      { id: ADMIN_ID, nickname: "admin-nick" },
      { id: USER_ID, nickname: "member-nick" },
    ];
    memory.tables.receipt_verifications = [
      {
        id: RECEIPT_ID,
        user_id: USER_ID,
        selected_place_id: "store-1",
        receipt_place_name: "오산카페",
        status: "pending",
        matched: false,
        created_at: new Date().toISOString(),
        feedback_tags: [],
        feedback_text: null,
        receipt_image_url: null,
      },
      {
        id: REJECT_ID,
        user_id: USER_ID,
        selected_place_id: "store-2",
        receipt_place_name: "다른카페",
        status: "pending",
        matched: false,
        created_at: new Date().toISOString(),
        feedback_tags: [],
        feedback_text: null,
        receipt_image_url: null,
      },
    ];
    memory.tables.beta_user_state = [];
    memory.tables.user_place_photos = [];
    memory.tables.selected_place_logs = [
      {
        id: PLACE_LOG_ID,
        user_id: USER_ID,
        place_id: "store-1",
        place_name: "오산카페",
        created_at: new Date().toISOString(),
      },
    ];
    memory.businessTables.length = 0;
  });

  afterEach(() => {
    if (previousAllowlist === undefined) delete process.env.HAMA_ADMIN_USER_IDS;
    else process.env.HAMA_ADMIN_USER_IDS = previousAllowlist;
  });

  it("lets an admin list users and pending receipts", async () => {
    const users = await usersGet(request("/api/admin/users", "GET", adminHeaders("admin-token", false)));
    expect(users.status).toBe(200);
    const listed = (await users.json()) as { users: { id: string }[] };
    expect(listed.users.map((user) => user.id).sort()).toEqual([ADMIN_ID, USER_ID].sort());

    const receipts = await betaListGet(request("/api/admin/beta-verifications", "GET", adminHeaders("admin-token", false)));
    expect(receipts.status).toBe(200);
    const body = (await receipts.json()) as { ok: boolean; pending: { id: string; user_id: string }[]; rewards: unknown[] };
    expect(body.ok).toBe(true);
    expect(body.pending.map((row) => row.id).sort()).toEqual([RECEIPT_ID, REJECT_ID].sort());
    expect(body.pending.every((row) => row.user_id === USER_ID)).toBe(true);
    expect(Array.isArray(body.rewards)).toBe(true);
  });

  it("approves and rejects receipts with the existing success shape", async () => {
    const approved = await betaPatch(
      request(
        `/api/admin/beta-verifications/${RECEIPT_ID}`,
        "PATCH",
        adminHeaders("admin-token"),
        JSON.stringify({ action: "approve", user_id: ADMIN_ID })
      ),
      { params: Promise.resolve({ verificationId: RECEIPT_ID }) }
    );
    expect(approved.status).toBe(200);
    const approvedBody = (await approved.json()) as {
      ok: boolean;
      success: boolean;
      status: string;
      visit_count: number;
      incremented: boolean;
      duplicate: boolean;
    };
    expect(approvedBody).toMatchObject({
      ok: true,
      success: true,
      status: "approved",
      visit_count: 1,
      incremented: true,
      duplicate: false,
    });
    expect(memory.tables.receipt_verifications.find((row) => row.id === RECEIPT_ID)?.status).toBe("approved");
    expect(memory.tables.beta_user_state[0]).toMatchObject({ user_id: USER_ID, visit_count: 1 });

    const rejected = await betaPatch(
      request(
        `/api/admin/beta-verifications/${REJECT_ID}`,
        "PATCH",
        adminHeaders("admin-token"),
        JSON.stringify({ action: "reject" })
      ),
      { params: Promise.resolve({ verificationId: REJECT_ID }) }
    );
    expect(rejected.status).toBe(200);
    await expect(rejected.json()).resolves.toMatchObject({
      ok: true,
      success: true,
      status: "rejected",
      incremented: false,
      duplicate: false,
    });
  });

  it("blocks anonymous, expired, forged, and non-admin callers before business tables", async () => {
    memory.businessTables.length = 0;
    const anonymous = await usersGet(request("/api/admin/users"));
    expect(anonymous.status).toBe(401);
    await expect(anonymous.json()).resolves.toEqual({ ok: false, error: "unauthorized" });

    const expired = await statsGet(
      request("/api/admin/stats", "GET", { cookie: cookie("expired-token"), "hama_user_id": "" })
    );
    expect(expired.status).toBe(401);

    const forged = await usersGet(
      request("/api/admin/users", "GET", { cookie: `hama_user_id=${ADMIN_ID}` })
    );
    expect(forged.status).toBe(401);

    const member = await betaPatch(
      request(
        `/api/admin/beta-verifications/${RECEIPT_ID}`,
        "PATCH",
        adminHeaders("user-token"),
        JSON.stringify({ action: "approve" })
      ),
      { params: Promise.resolve({ verificationId: RECEIPT_ID }) }
    );
    expect(member.status).toBe(403);
    await expect(member.json()).resolves.toEqual({ ok: false, error: "forbidden" });
    expect(memory.tables.receipt_verifications.find((row) => row.id === RECEIPT_ID)?.status).toBe("pending");
    expect(memory.businessTables).toEqual([]);
  });

  it("blocks everyone when the admin allowlist is missing or invalid", async () => {
    delete process.env.HAMA_ADMIN_USER_IDS;
    memory.businessTables.length = 0;
    const missing = await usersGet(request("/api/admin/users", "GET", adminHeaders("admin-token", false)));
    expect(missing.status).toBe(403);
    await expect(missing.json()).resolves.toEqual({ ok: false, error: "forbidden" });

    process.env.HAMA_ADMIN_USER_IDS = `${ADMIN_ID},not-a-uuid`;
    const invalid = await statsGet(request("/api/admin/stats", "GET", adminHeaders("admin-token", false)));
    expect(invalid.status).toBe(403);
    expect(memory.businessTables).toEqual([]);
    const body = JSON.stringify(await invalid.json());
    expect(body).not.toContain(ADMIN_ID);
    expect(body).not.toContain("not-a-uuid");
  });

  it("rejects a cross-site write and an invalid owner before changing rows", async () => {
    memory.businessTables.length = 0;
    const headers = new Headers({
      cookie: cookie("admin-token"),
      origin: "https://evil.test",
      "content-type": "application/json",
    });
    const csrf = await betaPatch(
      request(`/api/admin/beta-verifications/${RECEIPT_ID}`, "PATCH", headers, JSON.stringify({ action: "approve" })),
      { params: Promise.resolve({ verificationId: RECEIPT_ID }) }
    );
    expect(csrf.status).toBe(403);
    await expect(csrf.json()).resolves.toEqual({ ok: false, error: "csrf_rejected" });

    const badOwner = await storeOwnerPatch(
      request(
        "/api/admin/stores/store-1",
        "PATCH",
        adminHeaders("admin-token"),
        JSON.stringify({ owner_id: "not-a-uuid" })
      ),
      { params: Promise.resolve({ storeId: "store-1" }) }
    );
    expect(badOwner.status).toBe(400);

    const badRecommend = await recommendPost(
      request("/api/admin/recommend-test", "POST", adminHeaders("admin-token"), JSON.stringify({ category: "drop_table" }))
    );
    expect(badRecommend.status).toBe(400);
    expect(memory.businessTables).toEqual([]);
    expect(memory.tables.receipt_verifications.find((row) => row.id === RECEIPT_ID)?.status).toBe("pending");
  });

  it("still lets a non-admin submit their own receipt and visit photo", async () => {
    const form = new FormData();
    form.set("user_id", ADMIN_ID);
    form.set("selected_place_log_id", PLACE_LOG_ID);
    form.set("receipt_place_name", "오산카페");
    form.set("receipt_image", new Blob([Uint8Array.from([1, 2, 3])], { type: "image/png" }));
    form.set("visit_photo_0", new Blob([Uint8Array.from([4, 5])], { type: "image/png" }));
    const receipt = await receiptPost(
      new NextRequest("http://localhost:3000/api/beta/receipt-verify", {
        method: "POST",
        headers: { cookie: cookie("user-token") },
        body: form,
      })
    );
    expect(receipt.status).toBe(200);
    const receiptBody = (await receipt.json()) as { ok: boolean; status: string; visit_photos: { uploaded: number } };
    expect(receiptBody.ok).toBe(true);
    expect(receiptBody.status).toBe("pending");
    expect(receiptBody.visit_photos.uploaded).toBe(1);
    const stored = memory.tables.receipt_verifications.filter((row) => row.selected_place_log_id === undefined && row.user_id === USER_ID);
    expect(stored.some((row) => row.user_id === USER_ID && row.status === "pending" && row.id !== RECEIPT_ID)).toBe(true);
    expect(memory.tables.user_place_photos.some((row) => row.user_id === USER_ID && row.source === "receipt_verification")).toBe(true);
    expect(memory.tables.receipt_verifications.some((row) => row.user_id === ADMIN_ID)).toBe(false);

    const feedback = new FormData();
    feedback.set("user_id", ADMIN_ID);
    feedback.set("place_id", "store-1");
    feedback.set("place_name", "오산카페");
    feedback.set("satisfaction", "good");
    feedback.set("visit_photo_0", new Blob([Uint8Array.from([7])], { type: "image/jpeg" }));
    const visit = await feedbackPost(
      new NextRequest("http://localhost:3000/api/visit-feedback", {
        method: "POST",
        headers: { cookie: cookie("user-token") },
        body: feedback,
      })
    );
    expect(visit.status).toBe(200);
    const visitBody = (await visit.json()) as { ok: boolean; visit_photos: { uploaded: number } };
    expect(visitBody.ok).toBe(true);
    expect(visitBody.visit_photos.uploaded).toBe(1);
    expect(memory.tables.user_place_photos.some((row) => row.user_id === USER_ID && row.source === "visit_feedback")).toBe(true);
    expect(memory.storageWrites()).toBeGreaterThan(0);
  });

  it("does not accept the admin session after logout", async () => {
    await revokeServerSession(request("/api/auth/kakao/logout", "GET", { cookie: cookie("admin-token") }));
    memory.businessTables.length = 0;
    const again = await usersGet(request("/api/admin/users", "GET", adminHeaders("admin-token", false)));
    expect(again.status).toBe(401);
    expect(memory.businessTables).toEqual([]);
  });
});

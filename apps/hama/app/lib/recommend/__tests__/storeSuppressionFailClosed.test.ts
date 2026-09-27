import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  keptPlaceIds,
  readKeptPlaceIds,
  readStoreSuppressionLoad,
  SUPPRESSION_UNAVAILABLE_ERROR,
} from "../storeSuppression";
import {
  filterPlacesWithSuppressionRules,
  loadActiveStoreSuppressionRules,
  parsePlaceRefs,
} from "../../server/storeSuppressionAdmin";

const hidden = {
  store_id: "hidden-id",
  store_name: null,
  reason: null,
  starts_at: "",
  ends_at: null,
  is_active: true,
  metadata: null,
  id: "rule-1",
  scope: "food",
};

describe("store suppression server filter", () => {
  it("treats a successful empty result as no rules", () => {
    expect(readStoreSuppressionLoad({ data: [], error: null })).toEqual({ status: "ok", rules: [] });
  });

  it("does not treat a query error or a non-array as an empty list", () => {
    expect(readStoreSuppressionLoad({ data: [], error: { message: "permission denied" } })).toEqual({
      status: "failed",
    });
    expect(readStoreSuppressionLoad({ data: null, error: null })).toEqual({ status: "failed" });
    expect(readStoreSuppressionLoad({ data: { rules: [] }, error: null })).toEqual({ status: "failed" });
  });

  it("keeps every place when there are no rules", () => {
    const places = [
      { id: "a", name: "열린 가게" },
      { id: "b", name: "다른 가게" },
    ];
    expect(keptPlaceIds(places, [])).toEqual(["a", "b"]);
  });

  it("removes a matching place and does not return rule metadata", async () => {
    const places = [
      { id: "hidden-id", name: "숨김 가게" },
      { id: "shown-id", name: "공개 가게" },
    ];
    const filtered = await filterPlacesWithSuppressionRules("food", places, async () => ({
      data: [hidden],
      error: null,
    }));
    expect(filtered).toEqual({ status: "ok", keptIds: ["shown-id"] });
    expect(JSON.stringify(filtered)).not.toContain("reason");
    expect(JSON.stringify(filtered)).not.toContain("metadata");
  });

  it("fails closed on a database error and on a thrown query", async () => {
    const places = [{ id: "shown-id", name: "공개 가게" }];
    await expect(
      filterPlacesWithSuppressionRules("food", places, async () => ({
        data: [],
        error: { message: "db down" },
      }))
    ).resolves.toEqual({ status: "failed" });
    await expect(
      filterPlacesWithSuppressionRules("search", places, async () => {
        throw new Error("network");
      })
    ).resolves.toEqual({ status: "failed" });
  });

  it("fails closed when the admin client is unavailable", async () => {
    const load = await loadActiveStoreSuppressionRules("cafe", async () => ({
      data: null,
      error: { message: "admin_unavailable" },
    }));
    expect(load).toEqual({ status: "failed" });
  });

  it("does not restore a deck when every place is hidden", () => {
    expect(
      keptPlaceIds(
        [{ id: "hidden-id", name: "숨김 가게" }],
        [hidden]
      )
    ).toEqual([]);
  });

  it("rejects a request larger than the filter limit", () => {
    const places = Array.from({ length: 401 }, (_, index) => ({ id: `id-${index}`, name: "가게" }));
    expect(parsePlaceRefs(places)).toBeNull();
  });

  it("rejects a malformed client payload", () => {
    expect(parsePlaceRefs([{ id: "ok", name: "가게" }])).toEqual([{ id: "ok", name: "가게" }]);
    expect(parsePlaceRefs([{ id: "ok", name: "가게", reason: "fastfood" }])).toEqual([{ id: "ok", name: "가게" }]);
    expect(parsePlaceRefs(null)).toBeNull();
    expect(parsePlaceRefs([{ id: "", name: "가게" }])).toBeNull();
  });

  it("ignores ids the client did not ask to filter", () => {
    const requested = [{ id: "shown-id", name: "공개 가게" }];
    expect(
      readKeptPlaceIds(requested, { status: "ok", keptIds: ["shown-id", "hidden-id"], rules: [hidden] })
    ).toEqual(["shown-id"]);
    expect(readKeptPlaceIds(requested, { error: SUPPRESSION_UNAVAILABLE_ERROR })).toBeNull();
    expect(readKeptPlaceIds(requested, null)).toBeNull();
  });
});

describe("suppression call sites stay on the server", () => {
  const read = (path: string) => readFileSync(resolve(__dirname, path), "utf8");

  it("does not query the table or embed a server secret from the browser module", () => {
    const client = read("../storeSuppression.ts");
    expect(client).not.toContain("store_suppression_rules");
    expect(client).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(client).not.toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(client).toContain('fetch("/api/stores/suppression-filter"');
  });

  it("sends home and food recommendations through the server filter", () => {
    const home = read("../../../_hooks/useHomeCards.ts");
    expect(home).toContain("filterPlacesOnServer");
    expect(home).not.toContain("store_suppression_rules");
    expect(home).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("loads name-search rules only through the admin helper", () => {
    const route = read("../../../api/stores/search-by-name/route.ts");
    const admin = read("../../server/storeSuppressionAdmin.ts");
    expect(route).toContain("loadActiveStoreSuppressionRules");
    expect(route).not.toContain("fetchActiveStoreSuppressionRules");
    expect(route).not.toContain("store_suppression_rules");
    expect(admin).toContain("getSupabaseAdmin");
    expect(admin).toContain('select("store_id, store_name")');
    expect(admin).not.toContain("reason");
    expect(admin).not.toContain("metadata");
  });
});

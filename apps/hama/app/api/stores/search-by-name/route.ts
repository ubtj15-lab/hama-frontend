import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeBrandQuery } from "@/lib/results/placeNameSearchIntent";
import {
  fetchPlacesByCompactHalves,
  fetchPlacesByNamePatterns,
  fetchPlacesByNamePrefix,
  fetchStoresByCompactHalves,
  fetchStoresByNamePatterns,
  fetchStoresByNamePrefix,
  mergeStoreRows,
  PLACES_TABLE,
  STORES_TABLE,
} from "@/lib/places/placeNameSearch";
import { orderRowsServiceRegionFirst } from "@/lib/serviceRegion";
import type { StoreRow } from "@/lib/storeTypes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function sanitizeToken(s: string): string {
  return s.replace(/[%_]/g, "").trim().slice(0, 40);
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

function normCompactName(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function nameMatchTierScore(
  name: string,
  queryCompact: string,
  querySpaced: string
): { base: number; tier: "exact" | "prefix" | "substring" | "multi_token" | "spaced_merge" | "sql_loose" } {
  const n = normCompactName(name);
  const q = queryCompact;
  if (!q || !n) return { base: 0, tier: "sql_loose" };
  if (n === q) return { base: 1_000_000, tier: "exact" };
  if (n.startsWith(q)) return { base: 920_000, tier: "prefix" };
  if (n.includes(q)) return { base: 720_000, tier: "substring" };
  const qs = querySpaced.replace(/\s+/g, " ").trim().toLowerCase();
  const parts = qs.split(/\s+/).filter((x) => x.length >= 1);
  if (parts.length >= 2 && parts.every((p) => n.includes(p.replace(/\s/g, "").toLowerCase()))) {
    return { base: 680_000, tier: "multi_token" };
  }
  if (qs && n.includes(qs.replace(/\s/g, ""))) return { base: 640_000, tier: "spaced_merge" };
  return { base: 200_000, tier: "sql_loose" };
}

function buildNamePatterns(safe: string): string[] {
  const compact = safe.replace(/\s+/g, "");
  const patterns = new Set<string>();
  patterns.add(safe);
  if (compact !== safe && compact.length >= 1) patterns.add(compact);
  for (const tok of safe.split(/\s+/)) {
    const t = tok.trim();
    if (t.length >= 2) patterns.add(t);
  }
  return [...patterns];
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const searchQuery = String(url.searchParams.get("q") ?? "").trim();
    const safe = sanitizeToken(normalizeBrandQuery(searchQuery));

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[place-search] query:", searchQuery);
      // eslint-disable-next-line no-console
      console.log("[place-search] tables:", STORES_TABLE, "+", PLACES_TABLE);
      // eslint-disable-next-line no-console
      console.log("[place-search] normalized:", safe);
    }

    if (!safe || safe.length < 2) {
      return NextResponse.json({ items: [] }, { status: 200 });
    }

    const lat = Number(url.searchParams.get("lat"));
    const lng = Number(url.searchParams.get("lng"));
    const hasLoc = Number.isFinite(lat) && Number.isFinite(lng);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ items: [], error: "missing_env" }, { status: 500 });
    }

    const wantDebug = url.searchParams.get("debug") === "1";

    const supabase = createClient(supabaseUrl, supabaseKey);
    const patterns = buildNamePatterns(safe);
    const sr = await fetchStoresByNamePatterns(supabase, patterns);
    const pr = await fetchPlacesByNamePatterns(supabase, patterns);
    const patternRows = mergeStoreRows(sr.rows, pr.rows);
    const hadError = patternRows.length === 0 && sr.hadError && pr.hadError;

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[place-search] data (pattern phase row count):", patternRows.length);
      // eslint-disable-next-line no-console
      console.log("[place-search] error (pattern phase):", hadError ? "both_tables_failed" : null);
    }

    if (hadError && patternRows.length === 0) {
      const body: Record<string, unknown> = { items: [], error: "query_failed" };
      if (wantDebug) {
        body.debug = {
          queryRaw: searchQuery,
          queryNormalized: safe,
          tables: [STORES_TABLE, PLACES_TABLE],
          conclusion: "api_error",
          patternCount: patternRows.length,
        };
      }
      return NextResponse.json(body, { status: 500 });
    }

    let rows = patternRows;
    let stage = "pattern" as "pattern" | "prefix" | "halves";

    if (rows.length === 0) {
      const compact = safe.replace(/\s+/g, "");
      const sub = sanitizeToken(compact.length >= 3 ? compact.slice(0, 3) : safe.slice(0, 2));
      if (sub.length >= 2) {
        const rs = await fetchStoresByNamePrefix(supabase, sub);
        const rp = await fetchPlacesByNamePrefix(supabase, sub);
        rows = mergeStoreRows(rs, rp);
        if (rows.length) stage = "prefix";
      }
    }

    if (rows.length === 0) {
      const hs = await fetchStoresByCompactHalves(supabase, safe);
      const hp = await fetchPlacesByCompactHalves(supabase, safe);
      rows = mergeStoreRows(hs, hp);
      if (rows.length) stage = "halves";
    }

    rows = orderRowsServiceRegionFirst(rows);

    const queryCompact = normCompactName(safe);

    const scored = rows.map((r) => {
      const name = String(r.name ?? "");
      const { base: nameSc, tier } = nameMatchTierScore(name, queryCompact, safe);
      let distScore = 0;
      if (
        hasLoc &&
        r.lat != null &&
        r.lng != null &&
        Number.isFinite(r.lat) &&
        Number.isFinite(r.lng)
      ) {
        const km = distanceKm(lat, lng, r.lat, r.lng);
        distScore = Math.max(0, 120 - Math.min(km, 120));
      }
      return { row: r, score: nameSc + distScore, tier };
    });

    const qc = queryCompact;
    const qualityFiltered = scored.filter(({ row, tier }) => {
      const n = normCompactName(String(row.name ?? ""));
      if (tier !== "sql_loose") return true;
      if (qc.length <= 3) return true;
      return n.includes(qc);
    });

    qualityFiltered.sort((a, b) => b.score - a.score);

    const seen = new Set<string>();
    const items: StoreRow[] = [];
    for (const { row } of qualityFiltered) {
      if (!row.id || seen.has(row.id)) continue;
      seen.add(row.id);
      items.push(row);
      if (items.length >= 12) break;
    }

    const body: Record<string, unknown> = { items };
    if (wantDebug) {
      const nCompact = normCompactName(safe);
      body.debug = {
        queryRaw: searchQuery,
        queryNormalized: safe,
        queryCompact: nCompact,
        tables: [STORES_TABLE, PLACES_TABLE],
        fetchStage: stage,
        rowsAfterFetch: rows.length,
        rowsAfterQualityFilter: qualityFiltered.length,
        itemCount: items.length,
        matchedNames: items.map((r) => r.name),
        conclusion:
          items.length > 0
            ? "db_has_matches"
            : hadError
              ? "partial_error_but_no_rows"
              : "db_likely_no_row_for_query",
      };
    }

    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[place-search] data (items returned):", items.length, items.map((r) => r.name));
    }

    return NextResponse.json(body, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[search-by-name]", e);
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[place-search] error:", e);
    }
    return NextResponse.json({ items: [], error: "failed" }, { status: 500 });
  }
}

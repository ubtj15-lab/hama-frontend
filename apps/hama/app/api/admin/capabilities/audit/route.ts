import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const supabaseKey =
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as
    | string
    | undefined;

const CAPABILITY_FIELDS = [
  "solo_friendly",
  "group_seating",
  "private_room",
  "alcohol_available",
  "fast_food",
  "formal_atmosphere",
  "quick_service",
  "vegan_available",
  "halal_available",
  "with_kids",
  "max_group_size",
] as const;

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

function hasData(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

export async function GET() {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

  const { count, error: countError } = await supabase
    .from("stores")
    .select("id", { count: "exact", head: true })
    .not("name", "is", null)
    .neq("name", "");

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .not("name", "is", null)
    .neq("name", "")
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = Array.isArray(data) ? data : [];
  const total = count ?? rows.length;

  const allColumns = new Set<string>();
  for (const row of rows) {
    for (const k of Object.keys(row ?? {})) allColumns.add(k);
  }
  const sortedColumns = [...allColumns].sort();
  const filledColumns: string[] = [];
  const emptyColumns: string[] = [];
  for (const c of sortedColumns) {
    const filled = rows.some((r) => hasData((r as any)?.[c]));
    if (filled) filledColumns.push(c);
    else emptyColumns.push(c);
  }

  const coverage = CAPABILITY_FIELDS.map((field) => {
    if (!sortedColumns.includes(field)) {
      return {
        field,
        total,
        filled: 0,
        percent: 0,
        trueCount: 0,
        truePercent: 0,
        status: "missing_column",
      };
    }
    const filled = rows.filter((r) => hasData((r as any)?.[field])).length;
    const percent = total > 0 ? Number(((filled / total) * 100).toFixed(1)) : 0;
    const trueCount = rows.filter((r) => (r as any)?.[field] === true).length;
    const truePercent = total > 0 ? Number(((trueCount / total) * 100).toFixed(1)) : 0;
    return {
      field,
      total,
      filled,
      percent,
      trueCount,
      truePercent,
      status: percent < 50 ? "low" : "ok",
    };
  });

  const osanDongtan = rows.filter((r: any) => {
    const area = String(r?.area ?? "");
    const addr = String(r?.address ?? "");
    return /오산|동탄/.test(`${area} ${addr}`);
  });
  const pool = osanDongtan.length ? osanDongtan : rows;
  const priority = [...pool]
    .map((r: any) => {
      const score =
        (r.image_url ? 3 : 0) +
        (Array.isArray(r.tags) && r.tags.length ? 2 : 0) +
        (Array.isArray(r.mood) && r.mood.length ? 1 : 0) +
        (r.with_kids != null ? 1 : 0) +
        (r.updated_at ? 1 : 0);
      return { row: r, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 100)
    .map(({ row }) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      area: row.area,
      address: row.address,
      description: row.description ?? null,
      tags: Array.isArray(row.tags) ? row.tags : [],
      mood: Array.isArray(row.mood) ? row.mood : [],
      capability: {
        solo_friendly: row.solo_friendly ?? null,
        group_seating: row.group_seating ?? null,
        private_room: row.private_room ?? null,
        alcohol_available: row.alcohol_available ?? null,
        fast_food: row.fast_food ?? null,
        formal_atmosphere: row.formal_atmosphere ?? null,
        quick_service: row.quick_service ?? null,
        vegan_available: row.vegan_available ?? null,
        halal_available: row.halal_available ?? null,
        with_kids: row.with_kids ?? null,
        max_group_size: row.max_group_size ?? null,
      },
    }));

  return NextResponse.json({
    totalStores: total,
    columns: sortedColumns,
    filledColumns,
    emptyColumns,
    coverage,
    priorityStores: priority,
  });
}

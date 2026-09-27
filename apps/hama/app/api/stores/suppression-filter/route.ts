import { NextResponse } from "next/server";
import { SUPPRESSION_UNAVAILABLE_ERROR } from "@/lib/recommend/storeSuppression";
import {
  filterPlacesWithSuppressionRules,
  normalizeSuppressionScope,
  parsePlaceRefs,
} from "@/lib/server/storeSuppressionAdmin";

export async function POST(request: Request) {
  const unavailable = NextResponse.json(
    { error: SUPPRESSION_UNAVAILABLE_ERROR },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return unavailable;
  }
  if (!body || typeof body !== "object") return unavailable;
  const record = body as Record<string, unknown>;
  const places = parsePlaceRefs(record.places);
  if (!places) return unavailable;
  const filtered = await filterPlacesWithSuppressionRules(normalizeSuppressionScope(record.scope), places);
  if (filtered.status !== "ok") return unavailable;
  return NextResponse.json(
    { status: "ok", keptIds: filtered.keptIds },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

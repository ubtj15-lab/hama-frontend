// lib/diClient.ts
import { supabase } from "./supabaseClient";

// 1) types (오베 최소)
export type Action =
  | "IMPRESSION"
  | "SWIPE"
  | "OPEN_DETAIL"
  | "BACK"
  | "NAVIGATE"
  | "CALL"
  | "SAVE"
  | "SHARE"
  | "REFRESH"
  | "SEARCH";

export function getSessionId(): string {
  const key = "hama_session_id";
  if (typeof window === "undefined") return "server";
  let v = localStorage.getItem(key);
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem(key, v);
  }
  return v;
}

export function computeContext(input: {
  region?: string;      // "오산", "동탄" 등
  radiusKm?: number;    // 2/5/10
  groupHint?: string;   // "키즈" "데이트" 등
}) {
  const now = new Date();
  const hour = now.getHours();

  const time_bucket =
    hour < 10 ? "MORNING" :
    hour < 14 ? "LUNCH" :
    hour < 17 ? "AFTERNOON" :
    hour < 21 ? "DINNER" : "NIGHT";

  const day_bucket = (now.getDay() === 0 || now.getDay() === 6) ? "WEEKEND" : "WEEKDAY";

  const region_bucket =
    input.region?.includes("오산") ? "OSAN" :
    input.region?.includes("동탄") ? "DONGTAN" :
    input.region?.includes("평택") ? "PYEONGTAEK" : "UNKNOWN";

  const radius_bucket =
    input.radiusKm === 2 ? "NEAR_2KM" :
    input.radiusKm === 5 ? "MID_5KM" :
    (input.radiusKm && input.radiusKm >= 10) ? "FAR_10KM_PLUS" : "UNKNOWN";

  const group_bucket =
    input.groupHint?.includes("키즈") ? "FAMILY_KIDS" :
    input.groupHint?.includes("데이트") ? "COUPLE" :
    input.groupHint?.includes("혼자") ? "SOLO" :
    input.groupHint?.includes("친구") ? "FRIENDS" : "UNKNOWN";

  return { time_bucket, day_bucket, region_bucket, radius_bucket, group_bucket };
}

export async function startDISession(params: {
  session_id: string;
  context: ReturnType<typeof computeContext>;
  app_version?: string;
  platform?: string;
}) {
  const { session_id, context, app_version, platform } = params;

  const { error } = await supabase.from("di_sessions").upsert([{
    session_id,
    time_bucket: context.time_bucket,
    day_bucket: context.day_bucket,
    region_bucket: context.region_bucket,
    radius_bucket: context.radius_bucket,
    group_bucket: context.group_bucket,
    app_version: app_version ?? null,
    platform: platform ?? null,
  }], { onConflict: "session_id" });

  if (error) console.error("startDISession error:", error);
}

export async function logDIEvent(e: {
  session_id: string;
  action: Action;
  tab?: string;        // "ALL" | "FOOD" | "CAFE" | "SALON" | "ACTIVITY"
  item_type?: string;  // "place"
  item_id?: string;    // stores.id (uuid)
  position?: number;   // 카드 인덱스(1~)
  query?: string;
  extra?: Record<string, any>;
}) {
  const { error } = await supabase.from("di_events").insert([{
    session_id: e.session_id,
    action: e.action,
    tab: e.tab ?? null,
    item_type: e.item_type ?? null,
    item_id: e.item_id ?? null,
    position: e.position ?? null,
    query: e.query ?? null,
    extra: e.extra ?? null,
  }]);

  if (error) console.error("logDIEvent error:", error);
}

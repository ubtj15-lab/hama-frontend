/**
 * scripts/fix-latIng.mjs
 *
 * stores 테이블의 lat/lng를 address 기반(Kakao geocode)으로 보정하고,
 * 실패한 row는 scripts/failed-geocode.json에 저장한다.
 *
 * 실행:
 *   node .\scripts\fix-latIng.mjs
 *
 * 필요 env (.env 또는 .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   KAKAO_REST_API_KEY
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

/* =========================
   1) ENV 로드 (강제)
   - Node는 Next처럼 .env.local 자동 로드가 안정적이지 않음
   - .env → .env.local 순서로 로드, .env.local이 override
========================= */
const root = process.cwd();

const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const envLocalPath = path.join(root, ".env.local");
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath, override: true });

/* =========================
   2) ENV 체크
========================= */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;

// 값은 출력하지 않고 존재 여부만 true/false로 표시
console.log(
  "[ENV CHECK]",
  "NEXT_PUBLIC_SUPABASE_URL:", !!SUPABASE_URL,
  "SUPABASE_SERVICE_ROLE_KEY:", !!SUPABASE_SERVICE_ROLE_KEY,
  "KAKAO_REST_API_KEY:", !!KAKAO_REST_API_KEY
);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
}
if (!KAKAO_REST_API_KEY) {
  throw new Error("Missing env: KAKAO_REST_API_KEY");
}

/* =========================
   3) Supabase Client
========================= */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* =========================
   4) 설정값 (필요시만 수정)
========================= */
const TABLE = "stores"; // ✅ 테이블명 다르면 수정
const COL_ID = "id";
const COL_NAME = "name";
const COL_ADDRESS = "address";
const COL_LAT = "lat";
const COL_LNG = "lng";

const PAGE_LIMIT = 5000; // 한 번에 가져올 row 수(너무 크면 나눠서)
const SLEEP_MS = 140; // 카카오 호출 간 딜레이(리밋 방지)

// true: lat/lng가 null이거나 한국 범위 밖인 row만 업데이트
// false: address 있는 row는 전부 업데이트 (대량 재계산)
const UPDATE_ONLY_IF_BAD = false;

/* =========================
   5) 실패 저장용
========================= */
const failedRows = []; // ✅ 실패한 row가 여기 쌓임

/* =========================
   6) 유틸
========================= */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toStr(v) {
  return (v ?? "").toString().trim();
}

function isValidKoreaLatLng(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;

  // 한국 대략 범위(서비스 지역 방어)
  if (lat < 33 || lat > 39) return false;
  if (lng < 124 || lng > 132) return false;

  return true;
}

/* =========================
   7) Kakao 주소 → 좌표 (x=lng, y=lat)
========================= */
async function geocodeByAddress(address) {
  const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  url.searchParams.set("query", address);

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Kakao geocode failed: ${res.status} ${t}`);
  }

  const data = await res.json();
  const doc = data?.documents?.[0];
  if (!doc) return null;

  const lng = Number(doc.x);
  const lat = Number(doc.y);

  if (!isValidKoreaLatLng(lat, lng)) return null;
  return { lat, lng };
}

/* =========================
   8) 대상 row 로드
========================= */
async function loadTargets() {
  let query = supabase
    .from(TABLE)
    .select(`${COL_ID}, ${COL_NAME}, ${COL_ADDRESS}, ${COL_LAT}, ${COL_LNG}`)
    .not(COL_ADDRESS, "is", null)
    .limit(PAGE_LIMIT);

  if (UPDATE_ONLY_IF_BAD) {
    query = query.or(
      `${COL_LAT}.is.null,${COL_LNG}.is.null,${COL_LAT}.lt.33,${COL_LAT}.gt.39,${COL_LNG}.lt.124,${COL_LNG}.gt.132`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/* =========================
   9) 업데이트
========================= */
async function updateRow(id, lat, lng) {
  const { error } = await supabase
    .from(TABLE)
    .update({ [COL_LAT]: lat, [COL_LNG]: lng })
    .eq(COL_ID, id);

  if (error) throw error;
}

/* =========================
   10) 메인
========================= */
async function main() {
  console.log("=== FIX LAT/LNG START ===");
  console.log("table:", TABLE);
  console.log("mode:", UPDATE_ONLY_IF_BAD ? "ONLY_BAD" : "ALL_WITH_ADDRESS");

  const rows = await loadTargets();
  console.log("targets:", rows.length);

  if (!rows.length) {
    console.log("No targets. (Nothing to update)");
    console.log("=== DONE ===");
    return;
  }

  let ok = 0;
  let fail = 0;
  let skip = 0;

  for (const r of rows) {
    const id = r[COL_ID];
    const name = toStr(r[COL_NAME]);
    const address = toStr(r[COL_ADDRESS]);

    if (!address) {
      skip++;
      console.log("[SKIP no address]", id, name);
      continue;
    }

    try {
      const geo = await geocodeByAddress(address);

      if (!geo) {
        fail++;
        failedRows.push({
          id,
          name,
          address,
          reason: "NO_RESULT_OR_INVALID_COORDS",
        });
        console.log("[FAIL geocode none/invalid]", id, name, address);
        continue;
      }

      await updateRow(id, geo.lat, geo.lng);
      ok++;
      console.log("[OK]", id, name, geo.lat, geo.lng);
    } catch (e) {
      fail++;
      failedRows.push({
        id,
        name,
        address,
        reason: e?.message ?? String(e),
      });
      console.log("[ERROR]", id, name, address, e?.message ?? e);
    }

    await sleep(SLEEP_MS);
  }

  console.log("=== FIX LAT/LNG DONE ===");
  console.log("ok:", ok, "fail:", fail, "skip:", skip);

  // ✅ 실패 목록 저장
  try {
    if (failedRows.length > 0) {
      const outPath = path.join(root, "scripts", "failed-geocode.json");
      fs.writeFileSync(outPath, JSON.stringify(failedRows, null, 2), "utf-8");
      console.log("failed saved:", failedRows.length, "-> scripts/failed-geocode.json");
    } else {
      console.log("failed saved: 0");
    }
  } catch (e) {
    console.log("failed save error:", e?.message ?? e);
  }
}

main().catch((e) => {
  console.error("FATAL:", e?.message ?? e);
  process.exit(1);
});

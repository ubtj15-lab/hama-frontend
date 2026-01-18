/**
 * scripts/fix-failed-geocode.mjs
 *
 * scripts/failed-geocode.json(실패 목록)을 읽어서
 * 1) Kakao address geocode 재시도
 * 2) 실패 시 Kakao keyword(place) search로 폴백
 * 성공한 것만 stores.lat/lng 업데이트
 * 남은 실패는 scripts/failed-geocode-final.json 저장
 *
 * 실행:
 *   node .\scripts\fix-failed-geocode.mjs
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

/* =========================
   ENV 로드 (.env -> .env.local)
========================= */
const root = process.cwd();

const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const envLocalPath = path.join(root, ".env.local");
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath, override: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;

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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* =========================
   설정
========================= */
const TABLE = "stores";
const COL_ID = "id";
const COL_LAT = "lat";
const COL_LNG = "lng";

const INPUT = path.join(root, "scripts", "failed-geocode.json");
const OUTPUT = path.join(root, "scripts", "failed-geocode-final.json");

const SLEEP_MS = 160; // 카카오 호출 딜레이(안전)
const SEARCH_RADIUS_M = 5000; // 키워드검색 반경 (필요 시 조절)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toStr(v) {
  return (v ?? "").toString().trim();
}

function isValidKoreaLatLng(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < 33 || lat > 39) return false;
  if (lng < 124 || lng > 132) return false;
  return true;
}

/* =========================
   주소 문자열 정리(가벼운 정규화)
   - "경기도" -> "경기"
   - 콤마/중복 공백 제거
========================= */
function normalizeAddress(address) {
  let a = toStr(address);
  a = a.replace(/,/g, " ");
  a = a.replace(/\s+/g, " ").trim();
  a = a.replace(/^경기도\s+/g, "경기 ");
  return a;
}

/* =========================
   주소에서 대략 지역 키워드 뽑기 (오산/화성/동탄/평택 등)
========================= */
function guessAreaHint(address) {
  const a = normalizeAddress(address);

  // 아주 간단 룰: 시/구 키워드 우선
  const candidates = ["오산", "동탄", "화성", "평택", "고덕", "영천", "능동", "원동", "누읍동"];
  for (const c of candidates) {
    if (a.includes(c)) return c;
  }

  // "경기 평택시 ..." 형태면 "평택"
  const m = a.match(/경기\s+([가-힣]+)시/);
  if (m?.[1]) return m[1];

  return "";
}

/* =========================
   1) Kakao Address Geocode
========================= */
async function geocodeByAddress(address) {
  const query = normalizeAddress(address);
  if (!query) return null;

  const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  url.searchParams.set("query", query);

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Kakao address geocode failed: ${res.status} ${t}`);
  }

  const data = await res.json();
  const doc = data?.documents?.[0];
  if (!doc) return null;

  const lng = Number(doc.x);
  const lat = Number(doc.y);
  if (!isValidKoreaLatLng(lat, lng)) return null;

  return { lat, lng, source: "address" };
}

/* =========================
   2) Kakao Keyword(Place) Search 폴백
   - address가 가게명만일 때도 이걸로 잡힘
========================= */
async function geocodeByKeyword(keyword, areaHint) {
  const k = toStr(keyword);
  if (!k) return null;

  // 검색어를 "가게명 + 지역힌트"로 강화
  const query = areaHint ? `${k} ${areaHint}` : k;

  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", query);
  url.searchParams.set("size", "1"); // 1개만
  // radius/rect 같은 제한을 더 걸고 싶으면 여기 확장 가능

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Kakao keyword search failed: ${res.status} ${t}`);
  }

  const data = await res.json();
  const doc = data?.documents?.[0];
  if (!doc) return null;

  // keyword 결과는 x/y가 문자열
  const lng = Number(doc.x);
  const lat = Number(doc.y);
  if (!isValidKoreaLatLng(lat, lng)) return null;

  return { lat, lng, source: "keyword", matchedName: doc.place_name ?? "" };
}

/* =========================
   DB 업데이트
========================= */
async function updateRow(id, lat, lng) {
  const { error } = await supabase
    .from(TABLE)
    .update({ [COL_LAT]: lat, [COL_LNG]: lng })
    .eq(COL_ID, id);

  if (error) throw error;
}

/* =========================
   메인
========================= */
async function main() {
  if (!fs.existsSync(INPUT)) {
    throw new Error(`Input not found: ${INPUT}`);
  }

  const raw = fs.readFileSync(INPUT, "utf-8");
  const rows = JSON.parse(raw);

  console.log("=== FIX FAILED GEOCODE START ===");
  console.log("input:", "scripts/failed-geocode.json");
  console.log("targets:", rows.length);

  const stillFailed = [];
  let ok = 0;
  let fail = 0;

  for (const r of rows) {
    const id = toStr(r.id);
    const name = toStr(r.name);
    const address = toStr(r.address);

    const areaHint = guessAreaHint(address) || guessAreaHint(name);

    try {
      // 1) 주소로 먼저 시도
      let geo = await geocodeByAddress(address);

      // 2) 실패면 키워드 폴백
      if (!geo) {
        geo = await geocodeByKeyword(name || address, areaHint);
      }

      if (!geo) {
        fail++;
        stillFailed.push({ ...r, reason: "address+keyword 모두 실패", areaHint });
        console.log("[FAIL]", id, name, address);
      } else {
        await updateRow(id, geo.lat, geo.lng);
        ok++;
        console.log("[OK]", id, name, geo.lat, geo.lng, `(${geo.source}${geo.matchedName ? `:${geo.matchedName}` : ""})`);
      }
    } catch (e) {
      fail++;
      stillFailed.push({ ...r, reason: e?.message ?? String(e), areaHint });
      console.log("[ERROR]", id, name, address, e?.message ?? e);
    }

    await sleep(SLEEP_MS);
  }

  // 남은 실패 저장
  fs.writeFileSync(OUTPUT, JSON.stringify(stillFailed, null, 2), "utf-8");

  console.log("=== FIX FAILED GEOCODE DONE ===");
  console.log("ok:", ok, "fail:", fail);
  console.log("still failed saved -> scripts/failed-geocode-final.json");
}

main().catch((e) => {
  console.error("FATAL:", e?.message ?? e);
  process.exit(1);
});

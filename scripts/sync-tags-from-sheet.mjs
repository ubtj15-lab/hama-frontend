/**
 * scripts/sync-tags-from-sheet.mjs
 *
 * Google Sheet에서 export한 CSV를 읽어서 Supabase stores 테이블의 tags를 원본대로 복구합니다.
 *
 * 사용법:
 * 1. Google Sheet에서 "파일 > 다운로드 > CSV(.csv)" 로 저장
 * 2. scripts/tags-import.csv 로 저장 (또는 -i 옵션으로 경로 지정)
 * 3. CSV 컬럼: id, tags (또는 name, tags)
 *    - id: stores.id (UUID)
 *    - name: 매장명 (id 없을 때 name으로 매칭)
 *    - tags: "중국집 짬뽕 탕수육 볶음밥" (공백/쉼표로 구분)
 * 4. node scripts/sync-tags-from-sheet.mjs
 *
 * .env.local 에 SUPABASE_SERVICE_ROLE_KEY 필요 (또는 anon key로 제한적 업데이트)
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const envPath = path.join(root, ".env");
const envLocalPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath, override: true });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[ERR] .env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY(또는 anon key) 필요");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* =========================
   CSV 파싱 (간단 버전)
========================= */
function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const row = {};
    header.forEach((h, j) => {
      row[h] = (vals[j] ?? "").trim().replace(/^"|"$/g, "");
    });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuote = !inQuote;
    } else if ((c === "," && !inQuote) || c === "\n") {
      result.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

/* =========================
   tags 문자열 -> 배열
   "중국집 짬뽕 탕수육" 또는 "중국집,짬뽕,탕수육" -> ["중국집","짬뽕","탕수육"]
========================= */
function parseTags(tagsStr) {
  if (!tagsStr || typeof tagsStr !== "string") return [];
  const s = tagsStr.trim();
  if (!s) return [];
  // 쉼표 또는 공백(연속 포함)으로 분리
  const arr = s
    .split(/[\s,]+/g)
    .map((t) => t.trim())
    .filter(Boolean);
  return [...new Set(arr)];
}

/* =========================
   메인
========================= */
const INPUT = process.argv.find((a) => a.startsWith("-i="))
  ? process.argv.find((a) => a.startsWith("-i=")).slice(3)
  : path.join(root, "scripts", "tags-import.csv");

const dryRun = process.argv.includes("--dry-run");

async function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`[ERR] 파일 없음: ${INPUT}`);
    console.error("Google Sheet에서 CSV로 내보내기 후 scripts/tags-import.csv 로 저장하세요.");
    console.error("또는 -i=경로 옵션으로 파일 지정. 예: node scripts/sync-tags-from-sheet.mjs -i=./my-tags.csv");
    process.exit(1);
  }

  const csvContent = fs.readFileSync(INPUT, "utf-8");
  const rows = parseCSV(csvContent);

  if (rows.length === 0) {
    console.error("[ERR] CSV에 데이터가 없습니다.");
    process.exit(1);
  }

  const hasId = "id" in rows[0];
  const hasName = "name" in rows[0];
  const tagsCol = "tags" in rows[0] ? "tags" : Object.keys(rows[0]).find((k) => k.toLowerCase().includes("tag"));
  if (!tagsCol) {
    console.error("[ERR] CSV에 'tags' 컬럼이 없습니다.");
    process.exit(1);
  }

  console.log(`[INFO] ${rows.length}행 로드, id=${hasId}, name=${hasName}, tags컬럼=${tagsCol}`);

  let storeMap = null;
  if (!hasId && hasName) {
    const { data: stores, error } = await supabase.from("stores").select("id,name");
    if (error) {
      console.error("[ERR] Supabase stores 조회 실패:", error.message);
      process.exit(1);
    }
    storeMap = new Map((stores ?? []).map((s) => [String(s.name ?? "").trim(), s.id]));
    console.log(`[INFO] Supabase ${storeMap.size}개 매장 로드 (name으로 매칭)`);
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const tagsStr = row[tagsCol];
    const tags = parseTags(tagsStr);
    if (tags.length === 0) {
      skipped++;
      continue;
    }

    let storeId = null;
    if (hasId && row.id) {
      storeId = String(row.id).trim();
    } else if (hasName && storeMap) {
      storeId = storeMap.get(String(row.name ?? "").trim());
    }

    if (!storeId) {
      failed++;
      if (failed <= 3) console.warn(`[SKIP] 매칭 실패:`, row.name ?? row.id ?? row);
      continue;
    }

    if (dryRun) {
      console.log(`[DRY] ${storeId} -> tags: ${tags.slice(0, 5).join(", ")}${tags.length > 5 ? "..." : ""}`);
      updated++;
      continue;
    }

    const { error } = await supabase.from("stores").update({ tags }).eq("id", storeId);
    if (error) {
      failed++;
      console.error(`[ERR] ${storeId}:`, error.message);
    } else {
      updated++;
    }
  }

  console.log(`\n[완료] 업데이트: ${updated}, 스킵: ${skipped}, 실패: ${failed}`);
  if (dryRun) console.log("(--dry-run 이므로 실제 반영 안 됨. 옵션 제거 후 재실행)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

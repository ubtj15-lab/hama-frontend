import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Store = {
  id: string;
  name: string;
  category: string | null;
  solo_friendly: boolean | null;
  group_seating: boolean | null;
  private_room: boolean | null;
  alcohol_available: boolean | null;
  fast_food: boolean | null;
  formal_atmosphere: boolean | null;
  quick_service: boolean | null;
  vegan_available: boolean | null;
  halal_available: boolean | null;
  with_kids: boolean | null;
  max_group_size: number | null;
  ai_classified: boolean | null;
  ai_confidence: number | null;
};

function parseArgs() {
  const args = process.argv.slice(2);
  let sample = 50;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--sample") sample = Math.max(10, Number(args[++i] || "50"));
  }
  return { sample };
}

function isSuspicious(store: Store): string[] {
  const c = String(store.category ?? "").toLowerCase();
  const out: string[] = [];
  if (c.includes("cafe") && store.alcohol_available === true) out.push("카페인데 alcohol_available=true");
  if ((c.includes("restaurant") || /한식|정찬/.test(store.name)) && store.fast_food === true) {
    out.push("일반 식당/정찬인데 fast_food=true");
  }
  if (store.group_seating === false && (store.max_group_size ?? 0) >= 12) {
    out.push("group_seating=false인데 max_group_size>=12");
  }
  if (store.solo_friendly === false && /혼밥|1인|김밥|분식/.test(store.name)) {
    out.push("혼밥/1인 계열 이름인데 solo_friendly=false");
  }
  return out;
}

async function main() {
  const filePath = fileURLToPath(import.meta.url);
  const dir = path.dirname(filePath);
  const appRoot = path.resolve(dir, "..");
  dotenv.config({ path: path.join(appRoot, ".env.local") });
  dotenv.config({ path: path.join(appRoot, ".env") });

  const { sample } = parseArgs();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(
    String(process.env.NEXT_PUBLIC_SUPABASE_URL),
    String(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const { data, error } = await supabase
    .from("stores")
    .select(
      "id,name,category,solo_friendly,group_seating,private_room,alcohol_available,fast_food,formal_atmosphere,quick_service,vegan_available,halal_available,with_kids,max_group_size,ai_classified,ai_confidence"
    )
    .eq("ai_classified", true)
    .limit(2000);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Store[];
  if (rows.length === 0) {
    console.log("ai_classified=true 매장이 없습니다. 먼저 classify:stores를 실행하세요.");
    return;
  }

  const shuffled = [...rows].sort(() => Math.random() - 0.5).slice(0, Math.min(sample, rows.length));
  console.log(`검증 샘플: ${shuffled.length} / 전체 분류된 매장 ${rows.length}`);

  const suspicious = rows
    .map((s) => ({ id: s.id, name: s.name, category: s.category, issues: isSuspicious(s), confidence: s.ai_confidence }))
    .filter((x) => x.issues.length > 0);

  console.log("\n=== 랜덤 샘플 50(또는 지정값) ===");
  console.table(
    shuffled.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      solo: s.solo_friendly,
      group: s.group_seating,
      room: s.private_room,
      alcohol: s.alcohol_available,
      fast: s.fast_food,
      formal: s.formal_atmosphere,
      quick: s.quick_service,
      vegan: s.vegan_available,
      halal: s.halal_available,
      kids: s.with_kids,
      max_group: s.max_group_size,
      conf: s.ai_confidence,
    }))
  );

  console.log("\n=== 카테고리 sanity check (의심 매장) ===");
  console.log(`의심 건수: ${suspicious.length}`);
  console.table(
    suspicious.slice(0, 200).map((x) => ({
      id: x.id,
      name: x.name,
      category: x.category,
      issues: x.issues.join(" | "),
      confidence: x.confidence,
    }))
  );

  const suspiciousRate = (suspicious.length / rows.length) * 100;
  const roughAccuracy = Math.max(0, 100 - suspiciousRate);
  console.log("\n=== 검증 요약 ===");
  console.log(`- 분류 매장 수: ${rows.length}`);
  console.log(`- 의심 비율: ${suspiciousRate.toFixed(1)}%`);
  console.log(`- 추정 정확도(간이): ${roughAccuracy.toFixed(1)}%`);
  console.log(`- 판정: ${roughAccuracy >= 80 ? "80% 이상 (적용 OK)" : "80% 미만 (프롬프트 개선 권장)"}`);
}

void main().catch((e) => {
  console.error("[verify:classification] fatal:", e?.message ?? e);
  process.exit(1);
});

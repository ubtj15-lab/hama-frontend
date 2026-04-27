import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

type Provider = "openai" | "anthropic";

type StoreRow = {
  id: string;
  name: string | null;
  category: string | null;
  address: string | null;
  description?: string | null;
  price_level?: string | null;
  rating?: number | null;
  ai_classified?: boolean | null;
};

type CapabilityResult = {
  solo_friendly: boolean;
  group_seating: boolean;
  private_room: boolean;
  alcohol_available: boolean;
  fast_food: boolean;
  formal_atmosphere: boolean;
  quick_service: boolean;
  vegan_available: boolean;
  halal_available: boolean;
  max_group_size: number;
  confidence: number;
};

type CliOptions = {
  dryRun: boolean;
  limit: number | null;
  provider: Provider;
  confidenceThreshold: number;
  yes: boolean;
  concurrency: number;
};

const DEFAULT_PROVIDER: Provider = (process.env.AI_CLASSIFIER_PROVIDER as Provider) || "openai";
const MAX_CLASSIFY = Number(process.env.MAX_CLASSIFY || "1000");
const DEFAULT_CONCURRENCY = 10;

function loadEnv() {
  const filePath = fileURLToPath(import.meta.url);
  const dir = path.dirname(filePath);
  const appRoot = path.resolve(dir, "..");
  dotenv.config({ path: path.join(appRoot, ".env.local") });
  dotenv.config({ path: path.join(appRoot, ".env") });
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const positional: string[] = [];
  const options: CliOptions = {
    dryRun: false,
    limit: null,
    provider: DEFAULT_PROVIDER,
    confidenceThreshold: 0.7,
    yes: false,
    concurrency: DEFAULT_CONCURRENCY,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--dry-run") options.dryRun = true;
    else if (a === "--yes") options.yes = true;
    else if (a === "--provider") options.provider = (args[++i] as Provider) || options.provider;
    else if (a === "--limit") options.limit = Number(args[++i] || "0");
    else if (a === "--confidence-threshold") options.confidenceThreshold = Number(args[++i] || "0.7");
    else if (a === "--concurrency") options.concurrency = Math.max(1, Number(args[++i] || String(DEFAULT_CONCURRENCY)));
    else if (!a.startsWith("-")) positional.push(a);
  }
  if (options.limit == null && positional[0] && /^\d+$/.test(positional[0])) {
    options.limit = Number(positional[0]);
  }
  if (positional[1] && (positional[1] === "openai" || positional[1] === "anthropic")) {
    options.provider = positional[1];
  }
  if (options.provider !== "openai" && options.provider !== "anthropic") {
    throw new Error(`Unsupported provider: ${options.provider}`);
  }
  return options;
}

function estimateCostKrw(stores: number, provider: Provider): number {
  // Rough budget guardrail for user communication (conservative).
  const perStore = provider === "openai" ? 100 : 50;
  return stores * perStore;
}

function ensureEnv(provider: Provider) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  if (provider === "openai" && !process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  if (provider === "anthropic" && !process.env.ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }
}

function buildPrompt(store: StoreRow): string {
  return [
    "다음 매장 정보를 보고 매장 특성을 분류해줘.",
    "",
    `매장명: ${store.name ?? ""}`,
    `카테고리: ${store.category ?? ""}`,
    `주소: ${store.address ?? ""}`,
    `설명: ${store.description ?? ""}`,
    `가격대: ${store.price_level ?? ""}`,
    `평점: ${store.rating ?? ""}`,
    "",
    "다음 항목을 true/false 또는 숫자로 분류:",
    "- solo_friendly",
    "- group_seating",
    "- private_room",
    "- alcohol_available",
    "- fast_food",
    "- formal_atmosphere",
    "- quick_service",
    "- vegan_available",
    "- halal_available",
    "- max_group_size (4/8/12/20)",
    "- confidence (0.0~1.0)",
    "",
    "판단 기준:",
    "- '이자카야', '호프', '술집' => alcohol_available: true",
    "- '패스트푸드', '맥도날드', 'KFC', '버거킹' => fast_food: true",
    "- '한정식', '정찬' => formal_atmosphere: true, group_seating: true",
    "- '분식', '김밥' => quick_service: true, solo_friendly: true",
    "- 작은 동네 카페 => solo_friendly: true, max_group_size: 4",
    "",
    "반드시 JSON만 반환:",
    `{
  "solo_friendly": true,
  "group_seating": false,
  "private_room": false,
  "alcohol_available": false,
  "fast_food": false,
  "formal_atmosphere": false,
  "quick_service": true,
  "vegan_available": false,
  "halal_available": false,
  "max_group_size": 4,
  "confidence": 0.85
}`,
  ].join("\n");
}

function extractJson(text: string): CapabilityResult {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("No JSON object in model output");
  }
  const raw = trimmed.slice(start, end + 1);
  const obj = JSON.parse(raw) as Record<string, unknown>;
  const bool = (k: string) => Boolean(obj[k]);
  const maxGroupRaw = Number(obj.max_group_size ?? 4);
  const maxGroup = [4, 8, 12, 20].includes(maxGroupRaw) ? maxGroupRaw : maxGroupRaw < 6 ? 4 : maxGroupRaw < 10 ? 8 : maxGroupRaw < 16 ? 12 : 20;
  const confidenceRaw = Number(obj.confidence ?? 0.5);
  const confidence = Math.max(0, Math.min(1, confidenceRaw));

  return {
    solo_friendly: bool("solo_friendly"),
    group_seating: bool("group_seating"),
    private_room: bool("private_room"),
    alcohol_available: bool("alcohol_available"),
    fast_food: bool("fast_food"),
    formal_atmosphere: bool("formal_atmosphere"),
    quick_service: bool("quick_service"),
    vegan_available: bool("vegan_available"),
    halal_available: bool("halal_available"),
    max_group_size: maxGroup,
    confidence,
  };
}

async function callOpenAI(prompt: string): Promise<CapabilityResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: "You are a strict JSON classifier. Return JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as any;
  const content = json?.choices?.[0]?.message?.content ?? "";
  return extractJson(String(content));
}

async function callAnthropic(prompt: string): Promise<CapabilityResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": String(process.env.ANTHROPIC_API_KEY),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-latest",
      max_tokens: 512,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as any;
  const content = json?.content?.[0]?.text ?? "";
  return extractJson(String(content));
}

async function classifyOne(store: StoreRow, provider: Provider): Promise<CapabilityResult> {
  const prompt = buildPrompt(store);
  for (let retry = 1; retry <= 3; retry++) {
    try {
      return provider === "openai" ? await callOpenAI(prompt) : await callAnthropic(prompt);
    } catch (e) {
      if (retry === 3) throw e;
      await new Promise((r) => setTimeout(r, 700 * retry));
    }
  }
  throw new Error("unreachable");
}

function logsDir(): string {
  return path.resolve(process.cwd(), "logs");
}

function ensureLogsDir() {
  fs.mkdirSync(logsDir(), { recursive: true });
}

async function confirmOrExit(message: string, skip: boolean) {
  if (skip) return;
  const rl = readline.createInterface({ input, output });
  const ans = (await rl.question(`${message} 계속할까요? (y/n): `)).trim().toLowerCase();
  rl.close();
  if (ans !== "y" && ans !== "yes") {
    console.log("사용자 취소로 종료합니다.");
    process.exit(0);
  }
}

async function main() {
  loadEnv();
  const options = parseArgs();
  ensureEnv(options.provider);
  ensureLogsDir();

  const supabase = createClient(
    String(process.env.NEXT_PUBLIC_SUPABASE_URL),
    String(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  const { data, error } = await supabase
    .from("stores")
    .select("id,name,category,address,description,price_level,ai_classified")
    .or("ai_classified.is.false,ai_classified.is.null")
    .not("name", "is", null)
    .neq("name", "")
    .limit(MAX_CLASSIFY);
  if (error) throw new Error(error.message);

  const all = (data ?? []) as StoreRow[];
  let targets = all;
  if (options.limit != null && options.limit > 0) {
    targets = targets.slice(0, options.limit);
  }

  const estimated = estimateCostKrw(targets.length, options.provider);
  console.log(`분류 대상: ${targets.length}개 (MAX_CLASSIFY=${MAX_CLASSIFY})`);
  console.log(`예상 비용(대략): ${estimated.toLocaleString("ko-KR")}원, provider=${options.provider}`);
  await confirmOrExit(options.dryRun ? "[dry-run] DB 업데이트 없이 분류만 실행합니다." : `DB 업데이트 모드입니다.`, options.yes);

  const now = new Date().toISOString();
  const runId = `${Date.now()}`;
  const backupPath = path.join(logsDir(), `classify_backup_${runId}.json`);
  const resultPath = path.join(logsDir(), `classify_results_${runId}.jsonl`);
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      targets.map((s) => ({ id: s.id, ai_classified: s.ai_classified ?? false })),
      null,
      2
    )
  );
  fs.writeFileSync(resultPath, "");

  let success = 0;
  let failed = 0;
  let lowConfidence = 0;
  const failures: Array<{ id: string; name: string; error: string }> = [];

  const queue = [...targets];
  const workers: Promise<void>[] = [];

  for (let w = 0; w < options.concurrency; w++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const store = queue.shift();
          if (!store) break;

          try {
            const result = await classifyOne(store, options.provider);
            const payload = {
              ...result,
              ai_confidence: result.confidence,
              ai_classified_at: now,
              ai_classified: result.confidence >= options.confidenceThreshold,
            };
            if (result.confidence < options.confidenceThreshold) lowConfidence += 1;

            fs.appendFileSync(
              resultPath,
              JSON.stringify({ id: store.id, name: store.name, result: payload }) + "\n"
            );

            if (!options.dryRun) {
              const { error: upErr } = await supabase.from("stores").update(payload).eq("id", store.id);
              if (upErr) throw new Error(upErr.message);
            }
            success += 1;
            if ((success + failed) % 100 === 0) {
              console.log(`[progress] ${success + failed}/${targets.length} done (ok=${success}, fail=${failed}, lowConf=${lowConfidence})`);
            }
          } catch (e: any) {
            failed += 1;
            failures.push({
              id: store.id,
              name: store.name ?? "",
              error: e?.message ?? String(e),
            });
            fs.appendFileSync(
              resultPath,
              JSON.stringify({ id: store.id, name: store.name, error: e?.message ?? String(e) }) + "\n"
            );
          }
        }
      })()
    );
  }

  await Promise.all(workers);

  const failPath = path.join(logsDir(), `classify_failures_${runId}.json`);
  fs.writeFileSync(failPath, JSON.stringify(failures, null, 2));

  console.log("\n=== classify summary ===");
  console.log(`targets: ${targets.length}`);
  console.log(`success: ${success}`);
  console.log(`failed: ${failed}`);
  console.log(`low_confidence(<${options.confidenceThreshold}): ${lowConfidence}`);
  console.log(`dry_run: ${options.dryRun}`);
  console.log(`backup: ${backupPath}`);
  console.log(`results: ${resultPath}`);
  console.log(`failures: ${failPath}`);
}

void main().catch((e) => {
  console.error("[classify:stores] fatal:", e?.message ?? e);
  process.exit(1);
});
